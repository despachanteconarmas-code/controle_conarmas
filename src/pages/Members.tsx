import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { MembersNav } from "@/components/members/MembersNav";
import { MemberFormDialog } from "@/components/members/MemberFormDialog";
import { StatusBadge } from "@/components/members/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCPF } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { expiryStatus, ExpiryStatus, MemberOverview } from "@/lib/members";
import { Search, Plus, IdCard, Smartphone } from "lucide-react";

type Filter = "TODOS" | Exclude<ExpiryStatus, "SEM_DATA">;

const filters: { value: Filter; label: string; tone: string }[] = [
  { value: "TODOS", label: "Total", tone: "text-foreground" },
  { value: "ATIVA", label: "Ativas", tone: "text-success" },
  { value: "VENCENDO", label: "Vencem em 30 dias", tone: "text-amber-600 dark:text-amber-400" },
  { value: "VENCIDA", label: "Vencidas", tone: "text-destructive" },
];

// Busca sem acento e sem diferença de maiúsculas: "joao" acha "João"
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036F]/g, "").toLowerCase();

export default function Members() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // ~1.400 filiados: cabe tudo na memória e os contadores saem da mesma lista
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_overview")
        .select("id, member_number, full_name, cpf, membership_expires_at, cr_expires_at, firearm_count, auth_user_id")
        .order("full_name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as MemberOverview[];
    },
  });

  const counts = useMemo(() => {
    const c = { TODOS: members.length, ATIVA: 0, VENCENDO: 0, VENCIDA: 0 };
    for (const m of members) {
      const s = expiryStatus(m.membership_expires_at);
      if (s !== "SEM_DATA") c[s]++;
    }
    return c;
  }, [members]);

  const visible = useMemo(() => {
    const term = normalize(debounced.trim());
    const termDigits = debounced.replace(/\D/g, "");
    return members.filter((m) => {
      if (filter !== "TODOS" && expiryStatus(m.membership_expires_at) !== filter) return false;
      if (!term) return true;
      if (normalize(m.full_name ?? "").includes(term)) return true;
      if (termDigits && String(m.member_number) === termDigits) return true;
      return termDigits.length >= 3 && (m.cpf ?? "").includes(termDigits);
    });
  }, [members, debounced, filter]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Filiados</h1>
            <p className="text-muted-foreground">Carteira digital de filiação do clube de tiro</p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo filiado
          </Button>
        </div>

        <MembersNav />

        {/* Contadores, que também filtram a lista */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent",
                filter === f.value && "border-primary ring-1 ring-primary",
              )}
            >
              <p className="text-sm text-muted-foreground">{f.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums", f.tone)}>
                {isLoading ? "—" : counts[f.value]}
              </p>
            </button>
          ))}
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou nº de filiação..."
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <IdCard className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {members.length === 0
                  ? "Nenhum filiado cadastrado ainda. Cadastre um ou importe a planilha."
                  : "Nenhum filiado encontrado com esses filtros."}
              </p>
              {members.length === 0 && (
                <Button variant="outline" onClick={() => navigate("/filiados/importar")}>
                  Importar planilha
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {visible.length} filiado{visible.length !== 1 && "s"}
            </p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Nº</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">CPF</TableHead>
                    <TableHead>Filiação</TableHead>
                    <TableHead className="hidden lg:table-cell">CR</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Armas</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">App</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/filiados/${m.id}`)}
                    >
                      <TableCell className="tabular-nums text-muted-foreground">{m.member_number}</TableCell>
                      <TableCell className="font-medium">
                        <a
                          href={`/filiados/${m.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/filiados/${m.id}`);
                          }}
                          className="hover:underline"
                        >
                          {m.full_name}
                        </a>
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">{formatCPF(m.cpf ?? "")}</TableCell>
                      <TableCell>
                        <StatusBadge expiresAt={m.membership_expires_at} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusBadge expiresAt={m.cr_expires_at} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center tabular-nums">{m.firearm_count}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        {m.auth_user_id ? (
                          <Smartphone className="mx-auto h-4 w-4 text-success" aria-label="Já acessou o app" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </main>

      <MemberFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(id) => navigate(`/filiados/${id}`)}
      />
    </div>
  );
}
