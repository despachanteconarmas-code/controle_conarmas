import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Member } from "@/lib/members";
import { Camera, Trash2, UserRound } from "lucide-react";

const BUCKET = "member-photos";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Foto 3×4 da carteirinha. Normalmente o próprio filiado envia pelo app;
 * aqui a equipe pode ver, trocar ou remover (não há aprovação).
 */
export function MemberPhoto({ member }: { member: Member }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);

  const { data: url } = useQuery({
    queryKey: ["member-photo", member.photo_path],
    enabled: !!member.photo_path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(member.photo_path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["member", member.id] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem (JPG ou PNG).");
      if (file.size > MAX_BYTES) throw new Error("A imagem passa de 5 MB.");
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${member.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("members").update({ photo_path: path }).eq("id", member.id);
      if (error) throw error;
      if (member.photo_path) await supabase.storage.from(BUCKET).remove([member.photo_path]);
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Foto atualizada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message || "Não foi possível enviar a foto.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("members").update({ photo_path: null }).eq("id", member.id);
      if (error) throw error;
      if (member.photo_path) await supabase.storage.from(BUCKET).remove([member.photo_path]);
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Foto removida" });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível remover a foto.", variant: "destructive" }),
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex aspect-[3/4] w-32 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {url ? (
          <img src={url} alt={`Foto de ${member.full_name}`} className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-12 w-12 text-muted-foreground" aria-label="Sem foto" />
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending}>
          <Camera className="mr-1 h-4 w-4" />
          {upload.isPending ? "Enviando..." : member.photo_path ? "Trocar" : "Enviar"}
        </Button>
        {member.photo_path && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            aria-label="Remover foto"
            title="Remover foto"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
