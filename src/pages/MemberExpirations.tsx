import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { MembersNav } from "@/components/members/MembersNav";
import { StatusBadge } from "@/components/members/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/useAuth";
import { formatPhone } from "@/lib/formatters";
import {
  addMonthsISO,
  EXPIRING_WINDOW_DAYS,
  expirationKindLabels,
  formatDateBR,
  MemberExpiration,
  todayISO,
  whatsappLink,
} from "@/lib/members";
import { CalendarCheck, MessageCircle } from "lucide-react";

type Window = "30" | "VENCIDOS" | "90";
type Kind = "TODOS" | "FILIACAO" | "CR" | "CRAF" | "GT";

const kinds: Kind[] = ["TODOS", "FILIACAO", "CR", "CRAF", "GT"];

export default function MemberExpirations() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [win, setWin] = useState<Window>("30");
  const [kind, setKind] = useState<Kind>("TODOS");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const today = todayISO();
  const { from, to } = useMemo(() => {
    if (win === "VENCIDOS") return { from: null, to: today };
    if (win === "90") return { from: today, to: addMonthsISO(today, 3) };
    const end = new Date(`${today}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + EXPIRING_WINDOW_DAYS);
    return { from: today, to: end.toISOString().slice(0, 10) };
  }, [win, today]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["member-expirations", from, to],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("member_expirations").select("*");
      // Vencidos: tudo antes de hoje. Janelas: de hoje até o fim do prazo.
      q = from ? q.gte("expires_at", from).lt("expires_at", to) : q.lt("expires_at", to);
      const { data, error } = await q
        .order("expires_at", { ascending: win !== "VENCIDOS" })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as MemberExpiration[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { TODOS: rows.length, FILIACAO: 0, CR: 0, CRAF: 0, GT: 0 };
    for (const r of rows) if (r.kind) c[r.kind as Kind]++;
    return c;
  }, [rows]);

  const visible = kind === "TODOS" ? rows : rows.filter((r) => r.kind === kind);

  const message = (r: MemberExpiration) => {
    const first = (r.full_name ?? "").split(" ")[0];
    const what = r.kind === "FILIACAO" ? "sua filiação ao Clube de Tiro Conarmas" : `seu ${expirationKindLabels[r.kind ?? ""]} (${r.description})`;
    const when = (r.expires_at ?? "") < today ? `venceu em ${formatDateBR(r.expires_at)}` : `vence em ${formatDateBR(r.expires_at)}`;
    return `Olá, ${first}! Passando para lembrar que ${what} ${when}.`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-foreground">Vencimentos</h1>
          <p className="text-muted-foreground">Filiações, CRs, CRAFs e GTs</p>
        </div>

        <MembersNav />

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ToggleGroup
            type="single"
            value={win}
            onValueChange={(v) => v && setWin(v as Window)}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="30">Próximos 30 dias</ToggleGroupItem>
            <ToggleGroupItem value="90">Próximos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="VENCIDOS">Já vencidos</ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(v) => v && setKind(v as Kind)}
            className="flex-wrap justify-start"
          >
            {kinds.map((k) => (
              <ToggleGroupItem key={k} value={k} className="gap-1">
                {k === "TODOS" ? "Todos" : expirationKindLabels[k]}
                <span className="tabular-nums text-muted-foreground">{counts[k]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {isLoading ? (
          <div className="h-48 animate-pulse rounded bg-muted" />
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarCheck className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Nada vencendo neste período.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Vencimento</TableHead>
                  <TableHead>Filiado</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden md:table-cell">Situação</TableHead>
                  <TableHead className="w-[60px] text-right">Avisar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={`${r.kind}-${r.member_id}-${r.item_id ?? ""}`}>
                    <TableCell className="tabular-nums">{formatDateBR(r.expires_at)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => navigate(`/filiados/${r.member_id}`)}
                      >
                        {r.full_name}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        nº {r.member_number}
                        {r.phone && <> · {formatPhone(r.phone)}</>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{expirationKindLabels[r.kind ?? ""]}</span>
                      {r.kind !== "FILIACAO" && (
                        <span className="block max-w-[320px] truncate text-xs text-muted-foreground" title={r.description ?? ""}>
                          {r.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge expiresAt={r.expires_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.phone ? (
                        <Button variant="ghost" size="icon" asChild title="Avisar pelo WhatsApp">
                          <a href={whatsappLink(r.phone, message(r))} target="_blank" rel="noreferrer" aria-label={`Avisar ${r.full_name} pelo WhatsApp`}>
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
