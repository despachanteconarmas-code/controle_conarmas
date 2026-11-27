import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as panelClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addMonthsISO, GUIDE_VALIDITY_MONTHS, TrafficGuide } from "@/lib/members";
import {
  DbClient,
  formatFileSize,
  GUIDE_FILE_ACCEPT,
  GUIDE_FILE_MAX_MB,
  openGuideFile,
  removeGuideFiles,
  uploadGuideFile,
  validateGuideFile,
} from "@/lib/guideFiles";
import { Eye, FileText, Image as ImageIcon, Upload, X } from "lucide-react";

interface GuideDialogProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide?: TrafficGuide | null;
  /** Quantas GTs o filiado já tem (para o título "2º endereço") */
  existingCount?: number;
  /** Cliente com a sessão de quem usa a tela. No app do filiado, o da carteira. */
  client?: DbClient;
  onSaved?: () => void;
}

const isImage = (type?: string | null, name?: string | null) =>
  (type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(name ?? "");

/**
 * GT do filiado: uma por endereço do acervo, cobrindo uso permitido,
 * restrito ou os dois, cada uma com a sua validade e, se quiser, o arquivo.
 */
export function GuideDialog({ memberId, open, onOpenChange, guide, existingCount = 0, client, onSaved }: GuideDialogProps) {
  const supabase = client ?? panelClient;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [permitted, setPermitted] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  // Enquanto a validade não for mexida à mão, ela acompanha a emissão
  const [expiryTouched, setExpiryTouched] = useState(false);
  // Arquivo: novo escolhido agora, ou remoção do que já estava salvo
  const [newFile, setNewFile] = useState<File | null>(null);
  const [dropExisting, setDropExisting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAddress(guide?.address ?? "");
    setPermitted(guide ? guide.permitted : true);
    setRestricted(guide?.restricted ?? false);
    setNumber(guide?.guide_number ?? "");
    setIssuedAt(guide?.issued_at ?? "");
    setExpiresAt(guide?.expires_at ?? "");
    setExpiryTouched(!!guide);
    setNewFile(null);
    setDropExisting(false);
    setDragActive(false);
  }, [open, guide]);

  const onIssuedChange = (value: string) => {
    setIssuedAt(value);
    if (!expiryTouched && value) setExpiresAt(addMonthsISO(value, GUIDE_VALIDITY_MONTHS));
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validateGuideFile(file);
    if (problem) {
      toast({ title: "Arquivo inválido", description: problem, variant: "destructive" });
      return;
    }
    setNewFile(file);
  };

  const save = useMutation({
    mutationFn: async () => {
      const oldPath = guide?.file_path ?? null;
      let uploaded: Awaited<ReturnType<typeof uploadGuideFile>> | null = null;
      if (newFile) uploaded = await uploadGuideFile(supabase, memberId, newFile);

      const payload = {
        address: address.trim(),
        permitted,
        restricted,
        guide_number: number.trim() || null,
        issued_at: issuedAt || null,
        expires_at: expiresAt,
        ...(uploaded ?? (dropExisting ? { file_path: null, file_name: null, file_type: null } : {})),
      };
      const { error } = guide
        ? await supabase.from("traffic_guides").update(payload).eq("id", guide.id)
        : await supabase.from("traffic_guides").insert([{ ...payload, member_id: memberId }]);
      if (error) {
        // Não deixa arquivo solto no bucket se a GT não foi salva
        if (uploaded) await removeGuideFiles(supabase, [uploaded.file_path]);
        throw error;
      }
      // Trocou ou removeu: apaga o arquivo antigo
      if (oldPath && (uploaded || dropExisting)) await removeGuideFiles(supabase, [oldPath]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-guides", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
      toast({ title: guide ? "GT atualizada" : "GT cadastrada" });
      onOpenChange(false);
      onSaved?.();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a GT.", variant: "destructive" });
    },
  });

  const noUse = !permitted && !restricted;
  const title = guide
    ? "Editar Guia de Tráfego"
    : existingCount > 0
      ? `Nova GT (${existingCount + 1}º endereço)`
      : "Nova Guia de Tráfego";

  // O que mostrar no campo de arquivo
  const savedFile = guide?.file_path && !dropExisting ? guide : null;
  const shown = newFile
    ? { name: newFile.name, type: newFile.type, detail: formatFileSize(newFile.size) }
    : savedFile
      ? { name: savedFile.file_name || "Arquivo da GT", type: savedFile.file_type, detail: "Arquivo salvo" }
      : null;
  const FileIcon = shown && isImage(shown.type, shown.name) ? ImageIcon : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Uma GT para cada endereço do acervo. Com dois endereços, cadastre duas GTs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gt-address">Endereço do acervo *</Label>
            <Textarea
              id="gt-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço que consta na GT"
              rows={2}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Uso *</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={permitted} onCheckedChange={(v) => setPermitted(v === true)} />
                Permitido
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={restricted} onCheckedChange={(v) => setRestricted(v === true)} />
                Restrito
              </label>
            </div>
            {noUse && <p className="text-xs text-destructive">Marque permitido, restrito ou os dois.</p>}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="gt-number">Nº da GT</Label>
            <Input id="gt-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="opcional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gt-issued">Emissão</Label>
              <DateInput id="gt-issued" value={issuedAt} onChange={onIssuedChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gt-expires">Validade *</Label>
              <DateInput
                id="gt-expires"
                value={expiresAt}
                onChange={(v) => {
                  setExpiresAt(v);
                  setExpiryTouched(true);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A validade é preenchida com a emissão + {GUIDE_VALIDITY_MONTHS} meses e pode ser ajustada.
          </p>

          <div className="space-y-2">
            <Label>Arquivo da guia</Label>
            <input
              ref={fileInput}
              type="file"
              accept={GUIDE_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {shown ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileIcon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{shown.name}</p>
                  <p className="text-xs text-muted-foreground">{shown.detail}</p>
                </div>
                {savedFile && !newFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Ver arquivo"
                    aria-label="Ver arquivo"
                    onClick={() =>
                      openGuideFile(supabase, savedFile.file_path!).catch(() =>
                        toast({ title: "Não foi possível abrir o arquivo", variant: "destructive" }),
                      )
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  Trocar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Remover arquivo"
                  aria-label="Remover arquivo"
                  onClick={() => {
                    if (newFile) setNewFile(null);
                    else setDropExisting(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
                  "hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                )}
              >
                <Upload className="mb-1 h-6 w-6 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">Enviar PDF ou foto da guia</span>
                <span className="text-xs text-muted-foreground">
                  Opcional · PDF, JPG, PNG ou HEIC · até {GUIDE_FILE_MAX_MB} MB
                </span>
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!address.trim() || !expiresAt || noUse || save.isPending}>
            {save.isPending ? (newFile ? "Enviando..." : "Salvando...") : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
