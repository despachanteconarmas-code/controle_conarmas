import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/members/StatusBadge";
import { MemberFormDialog } from "@/components/members/MemberFormDialog";
import { RenewDialog } from "@/components/members/RenewDialog";
import { FirearmDialog } from "@/components/members/FirearmDialog";
import { GuideDialog } from "@/components/members/GuideDialog";
import { MemberPhoto } from "@/components/members/MemberPhoto";
import { CardPdfButton } from "@/components/members/CardPdfButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useOptions } from "@/hooks/useOptions";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, formatPhone, formatDateTime } from "@/lib/formatters";
import {
  formatDateBR,
  Member,
  MemberFirearm,
  MembershipRenewal,
  MEMBER_APP_URL,
  verifyUrl,
  restrictionLabels,
  Restriction,
  TrafficGuide,
  whatsappLink,
} from "@/lib/members";
import {
  ArrowLeft,
  Pencil,
  RefreshCw,
  Plus,
  Trash2,
  MessageCircle,
  QrCode,
  Crosshair,
  MapPin,
  UserCheck,
} from "lucide-react";

type FirearmWithGuides = MemberFirearm & { traffic_guides: TrafficGuide[] };

type Confirm =
  | { kind: "member" }
  | { kind: "firearm"; item: MemberFirearm }
  | { kind: "guide"; item: TrafficGuide }
  | { kind: "qr" }
  | { kind: "renewal"; item: MembershipRenewal };

/** Linha "rótulo: valor" da ficha */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children || "—"}</dd>
    </div>
  );
}

export default function MemberDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const firearmType = useOptions("firearm_type");
  const brand = useOptions("brand");
  const caliber = useOptions("caliber");

  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [firearmDialog, setFirearmDialog] = useState<{ open: boolean; item?: MemberFirearm | null }>({ open: false });
  const [guideDialog, setGuideDialog] = useState<{ open: boolean; firearm?: MemberFirearm; item?: TrafficGuide | null }>({ open: false });
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: member, isLoading } = useQuery({
    queryKey: ["member", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Member | null;
    },
  });

  const { data: firearms = [] } = useQuery({
    queryKey: ["member-firearms", id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_firearms")
        .select("*, traffic_guides(*)")
        .eq("member_id", id!)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as FirearmWithGuides[];
    },
  });

  const { data: renewals = [] } = useQuery({
    queryKey: ["member-renewals", id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_renewals")
        .select("*")
        .eq("member_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MembershipRenewal[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["member", id] });
    queryClient.invalidateQueries({ queryKey: ["member-firearms", id] });
    queryClient.invalidateQueries({ queryKey: ["member-renewals", id] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
  };

  const runConfirm = useMutation({
    mutationFn: async (c: Confirm) => {
      if (c.kind === "member") {
        const { error } = await supabase.from("members").delete().eq("id", id!);
        if (error) throw error;
        if (member?.photo_path) await supabase.storage.from("member-photos").remove([member.photo_path]);
      } else if (c.kind === "firearm") {
        const { error } = await supabase.from("member_firearms").delete().eq("id", c.item.id);
        if (error) throw error;
      } else if (c.kind === "guide") {
        const { error } = await supabase.from("traffic_guides").delete().eq("id", c.item.id);
        if (error) throw error;
      } else if (c.kind === "qr") {
        const { error } = await supabase.rpc("regenerate_verify_token", { p_member_id: id! });
        if (error) throw error;
      } else if (c.kind === "renewal") {
        // Desfaz um lançamento errado: volta o vencimento e apaga o registro.
        // Só a renovação mais recente pode ser desfeita.
        const { error: upErr } = await supabase
          .from("members")
          .update({ membership_expires_at: c.item.previous_expires_at })
          .eq("id", id!);
        if (upErr) throw upErr;
        const { error } = await supabase.from("membership_renewals").delete().eq("id", c.item.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, c) => {
      const messages: Record<Confirm["kind"], string> = {
        member: "Filiado excluído",
        firearm: "Arma excluída",
        guide: "GT excluída",
        qr: "Novo QR gerado. O QR antigo parou de funcionar.",
        renewal: "Renovação desfeita",
      };
      toast({ title: messages[c.kind] });
      setConfirm(null);
      if (c.kind === "member") {
        queryClient.invalidateQueries({ queryKey: ["members"] });
        navigate("/filiados");
      } else {
        invalidateAll();
      }
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível concluir a operação.", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-muted" />
            <div className="h-64 rounded bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 text-center">
          <p className="mb-4 text-muted-foreground">Filiado não encontrado.</p>
          <Button variant="outline" onClick={() => navigate("/filiados")}>Voltar para Filiados</Button>
        </main>
      </div>
    );
  }

  const firearmLabel = (f: MemberFirearm) =>
    [firearmType.getLabel(f.type), brand.getLabel(f.brand), f.model].filter(Boolean).join(" ") || "Arma";

  const qrUrl = verifyUrl(member.verify_token);
  const firstName = member.full_name.split(" ")[0];
  const inviteText =
    `Olá, ${firstName}! Sua carteira digital de filiado do Clube de Tiro Conarmas já está disponível. ` +
    `Acesse ${MEMBER_APP_URL} e entre com o seu CPF. Você vai receber um código aqui no WhatsApp.`;
  const lastRenewalId = renewals[0]?.id;

  const confirmTexts: Record<Confirm["kind"], { title: string; body: string; action: string }> = {
    member: {
      title: "Excluir filiado?",
      body: `${member.full_name} será removido junto com armas, GTs, renovações e foto. Esta ação não pode ser desfeita.`,
      action: "Excluir",
    },
    firearm: {
      title: "Excluir arma?",
      body: "A arma e as GTs dela serão removidas. Esta ação não pode ser desfeita.",
      action: "Excluir",
    },
    guide: { title: "Excluir GT?", body: "A Guia de Tráfego será removida.", action: "Excluir" },
    qr: {
      title: "Gerar novo QR?",
      body: "Use quando o filiado perder a carteirinha. O QR atual, inclusive o impresso, para de funcionar na hora.",
      action: "Gerar novo QR",
    },
    renewal: {
      title: "Desfazer renovação?",
      body: "O vencimento volta para a data anterior e o lançamento sai do histórico.",
      action: "Desfazer",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
          <Link to="/filiados">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Filiados
          </Link>
        </Button>

        {/* Cabeçalho da ficha */}
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
            <MemberPhoto member={member} />
            <div className="flex-1 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Filiado nº {member.member_number}</p>
                  <h1 className="text-2xl font-bold">{member.full_name}</h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge expiresAt={member.membership_expires_at} label="Filiação" />
                    <StatusBadge expiresAt={member.cr_expires_at} label="CR" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1 h-4 w-4" />
                    Editar
                  </Button>
                  <Button size="sm" onClick={() => setRenewing(true)}>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Renovar
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <Field label="CPF">{formatCPF(member.cpf)}</Field>
                <Field label="WhatsApp">{member.phone ? formatPhone(member.phone) : ""}</Field>
                <Field label="E-mail">{member.email}</Field>
                <Field label="Vencimento da filiação">{formatDateBR(member.membership_expires_at)}</Field>
                <Field label="Nº do CR">{member.cr_number}</Field>
                <Field label="Validade do CR">{member.cr_expires_at ? formatDateBR(member.cr_expires_at) : ""}</Field>
              </dl>
              {member.notes && (
                <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{member.notes}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Armas e GTs */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Crosshair className="h-5 w-5" /> Armas
                  </CardTitle>
                  <CardDescription>CRAF e Guias de Tráfego de cada arma</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFirearmDialog({ open: true, item: null })}>
                  <Plus className="mr-1 h-4 w-4" />
                  Arma
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {firearms.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma arma cadastrada.</p>
                )}
                {firearms.map((f, index) => (
                  <div key={f.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          <span className="mr-2 text-muted-foreground">#{index + 1}</span>
                          {firearmLabel(f)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>Calibre: <span className="text-foreground">{caliber.getLabel(f.caliber) || "—"}</span></span>
                          <span>SIGMA: <span className="text-foreground tabular-nums">{f.sigma_number || "—"}</span></span>
                          {f.restriction && (
                            <Badge variant={f.restriction === "RESTRITO" ? "destructive" : "secondary"}>
                              {restrictionLabels[f.restriction as Restriction]}
                            </Badge>
                          )}
                          {f.updated_by && f.updated_by === member.auth_user_id && (
                            <Badge variant="outline" className="gap-1">
                              <UserCheck className="h-3 w-3" /> informado pelo filiado
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <StatusBadge expiresAt={f.sigma_expires_at} label="CRAF" />
                        </div>
                      </div>
                      <div className="flex gap-1 self-end sm:self-start">
                        <Button variant="ghost" size="icon" onClick={() => setFirearmDialog({ open: true, item: f })} aria-label="Editar arma" title="Editar arma">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirm({ kind: "firearm", item: f })} aria-label="Excluir arma" title="Excluir arma">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* GTs da arma */}
                    <div className="mt-4 space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Guias de Tráfego</p>
                        <Button variant="ghost" size="sm" onClick={() => setGuideDialog({ open: true, firearm: f, item: null })}>
                          <Plus className="mr-1 h-4 w-4" /> GT
                        </Button>
                      </div>
                      {f.traffic_guides.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma GT cadastrada.</p>
                      ) : (
                        [...f.traffic_guides]
                          .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
                          .map((g) => (
                            <div key={g.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm">
                              <div className="min-w-0">
                                <p className="flex items-start gap-1">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="break-words">{g.destination_address}</span>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {g.guide_number && <>Nº {g.guide_number} · </>}
                                  {g.issued_at && <>Emitida em {formatDateBR(g.issued_at)} · </>}
                                  Validade {formatDateBR(g.expires_at)}
                                </p>
                                <StatusBadge expiresAt={g.expires_at} className="mt-1" />
                              </div>
                              <div className="flex shrink-0">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGuideDialog({ open: true, firearm: f, item: g })} aria-label="Editar GT" title="Editar GT">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirm({ kind: "guide", item: g })} aria-label="Excluir GT" title="Excluir GT">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acesso ao app</CardTitle>
                <CardDescription>
                  {member.auth_user_id ? "O filiado já entrou no app." : "O filiado ainda não entrou no app."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {member.phone ? (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={whatsappLink(member.phone, inviteText)} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Enviar link pelo WhatsApp
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Cadastre o WhatsApp para o filiado conseguir entrar.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Carteirinha</CardTitle>
                <CardDescription>QR do verso e PDF para impressão</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-xs text-muted-foreground">{qrUrl}</p>
                <Button variant="outline" className="w-full" onClick={() => setConfirm({ kind: "qr" })}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar novo QR
                </Button>
                <CardPdfButton member={member} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Renovações</CardTitle>
              </CardHeader>
              <CardContent>
                {renewals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma renovação lançada.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {renewals.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium tabular-nums">
                            {formatDateBR(r.previous_expires_at)} → {formatDateBR(r.new_expires_at)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pago em {formatDateBR(r.paid_at)} · {r.years} ano{r.years > 1 && "s"} · lançado {formatDateTime(r.created_at)}
                          </p>
                        </div>
                        {r.id === lastRenewalId && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirm({ kind: "renewal", item: r })}>
                            Desfazer
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: "member" })}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir filiado
            </Button>
          </div>
        </div>
      </main>

      <MemberFormDialog open={editing} onOpenChange={setEditing} member={member} />
      <RenewDialog member={member} open={renewing} onOpenChange={setRenewing} />
      <FirearmDialog
        memberId={member.id}
        open={firearmDialog.open}
        onOpenChange={(open) => setFirearmDialog((s) => ({ ...s, open }))}
        firearm={firearmDialog.item}
        nextPosition={firearms.length + 1}
      />
      {guideDialog.firearm && (
        <GuideDialog
          memberId={member.id}
          firearmId={guideDialog.firearm.id}
          firearmLabel={firearmLabel(guideDialog.firearm)}
          open={guideDialog.open}
          onOpenChange={(open) => setGuideDialog((s) => ({ ...s, open }))}
          guide={guideDialog.item}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmTexts[confirm.kind].title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmTexts[confirm.kind].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    runConfirm.mutate(confirm);
                  }}
                  disabled={runConfirm.isPending}
                  className={confirm.kind === "qr" ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                >
                  {confirmTexts[confirm.kind].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
