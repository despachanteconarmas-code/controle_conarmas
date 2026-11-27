import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as panelClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Copy, Eye, FileText, Image as ImageIcon, Upload, X } from "lucide-react";

export interface GuideFirearmOption {
  id: string;
  label: string;
}

interface GuideDialogProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Armas do filiado, para escolher de qual é a GT */
  firearms: GuideFirearmOption[];
  /** Arma já escolhida ao abrir (botão "+ GT" dentro da arma) */
  firearmId?: string | null;
  /** GT que está sendo editada */
  guide?: TrafficGuide | null;
  /** Duplicar: nova GT com os dados desta, para só trocar o endereço */
  copyFrom?: TrafficGuide | null;
  /** Todas as GTs do filiado (para o título "2º endereço") */
  allGuides?: TrafficGuide[];
  /** Cliente com a sessão de quem usa a tela. No app do filiado, o da carteira. */
  client?: DbClient;
  onSaved?: () => void;
}

const isImage = (type?: string | null, name?: string | null) =>
  (type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(name ?? "");

/**
 * GT de uma arma, para um endereço. Arma com dois endereços tem duas GTs;
 * "Duplicar" copia tudo e deixa o endereço pronto para trocar.
 */
export function GuideDialog({
  memberId,
  open,
  onOpenChange,
  firearms,
  firearmId,
  guide,
  copyFrom,
  allGuides = [],
  client,
  onSaved,
}: GuideDialogProps) {
  const supabase = client ?? panelClient;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const [firearm, setFirearm] = useState("");
  const [address, setAddress] = useState("");
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
    const base = guide ?? copyFrom ?? null;
    setFirearm(base?.firearm_id ?? firearmId ?? (firearms.length === 1 ? firearms[0].id : ""));
    setAddress(base?.address ?? "");
    setNumber(base?.guide_number ?? "");
    setIssuedAt(base?.issued_at ?? "");
    setExpiresAt(base?.expires_at ?? "");
    setExpiryTouched(!!base);
    setNewFile(null);
    setDropExisting(false);
    setDragActive(false);
    // Duplicar: o endereço já vem selecionado, é só digitar o novo
    if (copyFrom) {
      setTimeout(() => {
        addressRef.current?.focus();
        addressRef.current?.select();
      }, 50);
    }
    // Só ao abrir: "firearms" muda a cada render do pai e apagaria o que foi digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guide, copyFrom, firearmId]);

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
        firearm_id: firearm,
        address: address.trim(),
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
      toast({ title: guide ? "GT atualizada" : copyFrom ? "GT duplicada" : "GT cadastrada" });
      onOpenChange(false);
      onSaved?.();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a GT.", variant: "destructive" });
    },
  });

  // Quantas GTs a arma escolhida já tem, para o título "2º endereço"
  const sameFirearm = allGuides.filter((g) => g.firearm_id === firearm && g.id !== guide?.id).length;
  const firearmLabel = firearms.find((f) => f.id === firearm)?.label;
  const title = guide
    ? "Editar Guia de Tráfego"
    : copyFrom
      ? "Duplicar GT"
      : sameFirearm > 0
        ? `Nova GT (${sameFirearm + 1}º endereço)`
        : "Nova Guia de Tráfego";
  const description = copyFrom
    ? "Os dados da GT foram copiados. Troque o endereço e ajuste o que for diferente."
    : "Uma GT para cada endereço. Arma com dois endereços tem duas GTs.";

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
          <DialogTitle className="flex items-center gap-2">
            {copyFrom && <Copy className="h-4 w-4 text-primary" aria-hidden />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Arma *</Label>
            <Select value={firearm || undefined} onValueChange={setFirearm}>
              <SelectTrigger aria-label="Arma da GT">
                <SelectValue placeholder="Escolha a arma" />
              </SelectTrigger>
              <SelectContent>
                {firearms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {firearms.length === 0 && (
              <p className="text-xs text-destructive">Cadastre a arma primeiro para lançar a GT dela.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gt-address">Endereço *</Label>
            <Textarea
              id="gt-address"
              ref={addressRef}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço que consta na GT"
              rows={2}
            />
          </div>

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
            {copyFrom?.file_path && !newFile && (
              <p className="text-xs text-muted-foreground">O arquivo não é copiado: anexe o da GT deste endereço.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!firearm || !address.trim() || !expiresAt || save.isPending}
            title={firearmLabel ? `GT da ${firearmLabel}` : undefined}
          >
            {save.isPending ? (newFile ? "Enviando..." : "Salvando...") : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
