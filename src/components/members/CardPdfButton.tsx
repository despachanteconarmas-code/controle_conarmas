import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { CardPdfFormat } from "@/lib/cardPdf";
import { CardSettings, Member } from "@/lib/members";
import { FileDown } from "lucide-react";

/** PDF da carteirinha para a equipe baixar e mandar ou imprimir */
export function CardPdfButton({ member }: { member: Member }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["card-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("card_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as CardSettings;
    },
  });

  const generate = async (format: CardPdfFormat) => {
    if (!settings) return;
    setBusy(true);
    try {
      // Carregado sob demanda: jsPDF e QR Code são pesados
      const { buildCardPdf, cardPdfFileName, imageUrlToDataUrl, photoTo3x4 } = await import("@/lib/cardPdf");
      let photo: string | null = null;
      if (member.photo_path) {
        const { data } = await supabase.storage.from("member-photos").createSignedUrl(member.photo_path, 120);
        if (data?.signedUrl) photo = await photoTo3x4(data.signedUrl);
      }
      const brasao = await imageUrlToDataUrl("/brasao-carteira.jpg");
      const doc = await buildCardPdf(member, settings, { brasao, photo }, format);
      doc.save(cardPdfFileName(member.member_number, format));
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full" disabled={busy || !settings}>
          <FileDown className="mr-2 h-4 w-4" />
          {busy ? "Gerando PDF..." : "Baixar PDF"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => generate("a4")}>
          <div>
            <p className="font-medium">Folha A4</p>
            <p className="text-xs text-muted-foreground">Frente e verso com marcas de corte</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => generate("cr80")}>
          <div>
            <p className="font-medium">Tamanho cartão (gráfica)</p>
            <p className="text-xs text-muted-foreground">85,6 × 54 mm, frente e verso</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
