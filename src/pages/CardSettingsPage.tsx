import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { MembersNav } from "@/components/members/MembersNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CardSettings } from "@/lib/members";

type Editable = Pick<CardSettings, "club_name" | "club_cr" | "address" | "whatsapp" | "instagram" | "website" | "email" | "legal_text">;

const fields: { key: keyof Editable; label: string; placeholder?: string; multiline?: boolean }[] = [
  { key: "club_name", label: "Nome do clube" },
  { key: "club_cr", label: "CR do clube" },
  { key: "address", label: "Endereço", placeholder: "Rua Maravilha, ..., Divinópolis/MG" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "(37) 99999-9999" },
  { key: "instagram", label: "Instagram", placeholder: "@conarmas" },
  { key: "website", label: "Site", placeholder: "armascon.com.br" },
  { key: "email", label: "E-mail" },
  { key: "legal_text", label: "Texto legal do verso", multiline: true },
];

/** Dados fixos que aparecem na frente e no verso de todas as carteirinhas */
export default function CardSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Editable | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data } = useQuery({
    queryKey: ["card-settings"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("card_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as CardSettings;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (values: Editable) => {
      const payload = Object.fromEntries(
        fields.map(({ key }) => [key, (values[key] ?? "").toString().trim() || null]),
      ) as Editable;
      // Nome e CR do clube são obrigatórios
      payload.club_name = payload.club_name || "Clube de Tiro Conarmas";
      payload.club_cr = payload.club_cr || "396.674";
      const { error } = await supabase.from("card_settings").update(payload).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-settings"] });
      toast({ title: "Configurações salvas" });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-foreground">Carteirinha</h1>
          <p className="text-muted-foreground">Dados do clube impressos em todas as carteirinhas</p>
        </div>

        <MembersNav />

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Dados do clube</CardTitle>
            <CardDescription>
              Valem para todas as carteirinhas, no app e no PDF. Confirme o endereço (175 ou 179)
              antes de liberar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!form ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(form);
                }}
              >
                {fields.map(({ key, label, placeholder, multiline }) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`cs-${key}`}>{label}</Label>
                    {multiline ? (
                      <Textarea
                        id={`cs-${key}`}
                        rows={4}
                        value={form[key] ?? ""}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    ) : (
                      <Input
                        id={`cs-${key}`}
                        value={form[key] ?? ""}
                        placeholder={placeholder}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
