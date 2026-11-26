import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { PhotoCropper } from "../components/PhotoCropper";
import { PushCard } from "../components/PushCard";
import { supabase } from "../supabase";
import { CarteiraData, useAuth } from "../data";
import { Camera, ImageUp, LogOut, UserRound } from "lucide-react";

export default function ProfilePage({ data, refresh }: { data: CarteiraData; refresh: () => void }) {
  const { member, photo } = data;
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [crDate, setCrDate] = useState(member.cr_expires_at ?? "");
  const [savingCr, setSavingCr] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Escolha uma imagem", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const upload = async (blob: Blob) => {
    setUploading(true);
    try {
      const path = `${member.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("member-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("members").update({ photo_path: path }).eq("id", member.id);
      if (error) throw error;
      if (member.photo_path) await supabase.storage.from("member-photos").remove([member.photo_path]);
      setFile(null);
      toast({ title: "Foto atualizada", description: "Ela já aparece na sua carteirinha." });
      refresh();
    } catch {
      toast({ title: "Não foi possível enviar a foto", description: "Tente de novo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveCr = async () => {
    setSavingCr(true);
    const { error } = await supabase.from("members").update({ cr_expires_at: crDate || null }).eq("id", member.id);
    setSavingCr(false);
    if (error) {
      toast({ title: "Não foi possível salvar", variant: "destructive" });
      return;
    }
    toast({ title: "Validade do CR atualizada" });
    refresh();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Foto da carteirinha</h2>
        {file ? (
          <PhotoCropper file={file} onCancel={() => setFile(null)} onConfirm={upload} busy={uploading} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex aspect-[3/4] w-32 items-center justify-center overflow-hidden rounded-lg border-2 border-gold bg-neutral-900">
              {photo ? (
                <img src={photo} alt="Sua foto" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-12 w-12 text-neutral-500" aria-label="Sem foto" />
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Foto de rosto, de frente, com fundo claro, como em documento.
            </p>
            <div className="flex gap-2">
              <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={onPick} />
              <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={onPick} />
              <Button variant="outline" onClick={() => camera.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Tirar foto
              </Button>
              <Button variant="outline" onClick={() => gallery.current?.click()}>
                <ImageUp className="mr-2 h-4 w-4" /> Galeria
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-1 font-semibold">Validade do CR</h2>
        <p className="mb-3 text-xs text-muted-foreground">Atualize quando renovar o seu Certificado de Registro.</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="cr-date" className="sr-only">Validade do CR</Label>
            <DateInput id="cr-date" value={crDate} onChange={setCrDate} />
          </div>
          <Button onClick={saveCr} disabled={savingCr || crDate === (member.cr_expires_at ?? "")}>
            {savingCr ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </section>

      <PushCard />

      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="mb-3 font-semibold">Seus dados</h2>
        <dl className="space-y-2">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Nome</dt><dd className="text-right">{member.full_name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">CPF</dt><dd className="tabular-nums">{formatCPF(member.cpf)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">WhatsApp</dt><dd className="tabular-nums">{member.phone ? formatPhone(member.phone) : "—"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Nº do CR</dt><dd>{member.cr_number || "—"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Para corrigir nome, CPF, WhatsApp ou nº do CR, fale com a Conarmas.</p>
      </section>

      <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sair deste aparelho
      </Button>
    </div>
  );
}
