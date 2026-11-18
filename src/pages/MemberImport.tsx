import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { MembersNav } from "@/components/members/MembersNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Cell,
  guessMapping,
  importFields,
  ImportField,
  issuesToCSV,
  Mapping,
  ParsedMember,
  RowIssue,
  validateRows,
} from "@/lib/memberImport";
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";

const NONE = "__none__";
const BATCH = 200;

interface Sheet {
  fileName: string;
  headers: string[];
  rows: Cell[][];
}

/** Lê CSV (UTF-8 ou Windows-1252, que é o que o Excel salva) ou XLSX */
async function readSpreadsheet(file: File): Promise<Sheet> {
  const lower = file.name.toLowerCase();
  let table: Cell[][];

  if (lower.endsWith(".xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("A planilha está vazia.");
    table = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1); // values[0] é sempre vazio
      table.push(
        values.map((v): Cell => {
          if (v === null || v === undefined) return null;
          if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
          if (typeof v === "boolean") return String(v);
          const obj = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          if (obj.richText) return obj.richText.map((t) => t.text).join("");
          if (obj.result !== undefined) return obj.result as Cell; // fórmula
          if (obj.text !== undefined) return String(obj.text); // link
          return String(v);
        }),
      );
    });
  } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const buffer = await file.arrayBuffer();
    let content = new TextDecoder("utf-8").decode(buffer);
    if (content.includes("\uFFFD")) content = new TextDecoder("windows-1252").decode(buffer);
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse<string[]>(content.replace(/^\uFEFF/, ""), { skipEmptyLines: true });
    table = parsed.data;
  } else {
    throw new Error("Formato não suportado. Envie .xlsx ou .csv.");
  }

  // Cabeçalho = primeira linha não vazia
  const headerIndex = table.findIndex((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (headerIndex < 0) throw new Error("A planilha está vazia.");
  const width = Math.max(...table.map((r) => r.length));
  return {
    fileName: file.name,
    headers: Array.from({ length: width }, (_, i) => String(table[headerIndex][i] ?? "").trim() || `Coluna ${i + 1}`),
    rows: table.slice(headerIndex + 1),
  };
}

type Outcome = { created: number; updated: number; failed: RowIssue[] };

export default function MemberImport() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [existing, setExisting] = useState<{ numbers: Map<number, string>; cpfs: Map<string, number> } | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const onFile = async (file: File) => {
    setReading(true);
    setOutcome(null);
    try {
      const parsed = await readSpreadsheet(file);
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers));
      // Cadastro atual, para separar novos de atualizações e achar conflitos
      const { data, error } = await supabase.from("members").select("member_number, cpf").limit(10000);
      if (error) throw error;
      setExisting({
        numbers: new Map(data.map((m) => [m.member_number, m.cpf])),
        cpfs: new Map(data.map((m) => [m.cpf, m.member_number])),
      });
    } catch (e) {
      toast({ title: "Erro ao ler a planilha", description: (e as Error).message, variant: "destructive" });
      setSheet(null);
    } finally {
      setReading(false);
    }
  };

  const missingRequired = importFields.filter((f) => f.required && mapping[f.key] === undefined);

  const analysis = useMemo(() => {
    if (!sheet || !existing || missingRequired.length) return null;
    const result = validateRows(sheet.rows, mapping);
    const toCreate: ParsedMember[] = [];
    const toUpdate: ParsedMember[] = [];
    const conflicts: RowIssue[] = [];
    for (const { line, member } of result.valid) {
      const cpfOwner = existing.cpfs.get(member.cpf);
      if (cpfOwner !== undefined && cpfOwner !== member.member_number) {
        conflicts.push({ line, name: member.full_name, message: `CPF já cadastrado no filiado nº ${cpfOwner}` });
      } else if (existing.numbers.has(member.member_number)) {
        toUpdate.push(member);
      } else {
        toCreate.push(member);
      }
    }
    return { ...result, errors: [...result.errors, ...conflicts].sort((a, b) => a.line - b.line), toCreate, toUpdate };
  }, [sheet, existing, mapping, missingRequired.length]);

  const runImport = async () => {
    if (!analysis) return;
    const updates = updateExisting ? analysis.toUpdate : [];
    const total = analysis.toCreate.length + updates.length;
    const failed: RowIssue[] = [];
    const fail = (m: ParsedMember, message: string) =>
      failed.push({ line: 0, name: `${m.member_number} · ${m.full_name}`, message });
    let done = 0;
    const tick = (n: number) => {
      done += n;
      setProgress(Math.round((done / total) * 100));
    };
    setProgress(0);

    // Novos: em lotes
    for (let i = 0; i < analysis.toCreate.length; i += BATCH) {
      const batch = analysis.toCreate.slice(i, i + BATCH);
      const rows = batch.map((m) => ({ ...m, legacy_id: String(m.member_number) }));
      const { error } = await supabase.from("members").insert(rows);
      if (error) {
        // Lote recusado: tenta um a um para saber exatamente quem falhou
        for (const [j, row] of rows.entries()) {
          const { error: rowError } = await supabase.from("members").insert([row]);
          if (rowError) fail(batch[j], rowError.message);
        }
      }
      tick(batch.length);
    }

    // Já cadastrados: só os campos preenchidos na planilha. Campo vazio não
    // apaga o que já existe (ex.: validade do CR informada pelo filiado).
    for (let i = 0; i < updates.length; i += 10) {
      const chunk = updates.slice(i, i + 10);
      await Promise.all(
        chunk.map(async (m) => {
          const { member_number, ...fields } = m;
          const filled = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));
          const { error } = await supabase.from("members").update(filled).eq("member_number", member_number);
          if (error) fail(m, error.message);
        }),
      );
      tick(chunk.length);
    }

    const updatedCount = updateExisting ? analysis.toUpdate.length : 0;
    setOutcome({ created: analysis.toCreate.length, updated: updatedCount, failed });
    setProgress(null);
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
    toast({
      title: "Importação concluída",
      description: failed.length ? `${failed.length} linha(s) falharam.` : "Todos os filiados válidos foram gravados.",
      variant: failed.length ? "destructive" : "default",
    });
  };

  const downloadReport = () => {
    if (!analysis) return;
    const csv = issuesToCSV([
      ...analysis.errors.map((e) => ({ ...e, kind: "Erro (não importada)" })),
      ...analysis.warnings.map((w) => ({ ...w, kind: "Aviso" })),
      ...(outcome?.failed ?? []).map((f) => ({ ...f, kind: "Falhou ao gravar" })),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-importacao-filiados.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCount = analysis ? analysis.toCreate.length + (updateExisting ? analysis.toUpdate.length : 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-foreground">Importar filiados</h1>
          <p className="text-muted-foreground">Planilha exportada do sistema atual (.xlsx ou .csv)</p>
        </div>

        <MembersNav />

        <div className="space-y-6">
          {/* 1. Arquivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Planilha</CardTitle>
              <CardDescription>
                Uma linha por filiado, com cabeçalho. O nº de filiação da planilha é mantido. Quem já
                está cadastrado com o mesmo nº é atualizado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={reading || progress !== null}>
                  <Upload className="mr-2 h-4 w-4" />
                  {reading ? "Lendo..." : sheet ? "Trocar arquivo" : "Escolher arquivo"}
                </Button>
                {sheet && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    {sheet.fileName} · {sheet.rows.length} linhas
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Colunas */}
          {sheet && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Colunas</CardTitle>
                <CardDescription>Confira qual coluna da planilha corresponde a cada campo.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {importFields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label>
                      {f.label}
                      {f.required && " *"}
                    </Label>
                    <Select
                      value={mapping[f.key] === undefined ? NONE : String(mapping[f.key])}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === NONE) delete next[f.key as ImportField];
                          else next[f.key as ImportField] = Number(v);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className={f.required && mapping[f.key] === undefined ? "border-destructive" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— não importar —</SelectItem>
                        {sheet.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h}
                            {sheet.rows[0]?.[i] !== undefined && sheet.rows[0][i] !== null && (
                              <span className="ml-2 text-muted-foreground">
                                ex.: {String(sheet.rows[0][i] instanceof Date ? (sheet.rows[0][i] as Date).toISOString().slice(0, 10) : sheet.rows[0][i]).slice(0, 24)}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 3. Conferência */}
          {sheet && missingRequired.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Faltam colunas obrigatórias</AlertTitle>
              <AlertDescription>{missingRequired.map((f) => f.label).join(", ")}</AlertDescription>
            </Alert>
          )}

          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Conferência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Novos", value: analysis.toCreate.length, tone: "text-success" },
                    { label: "Já cadastrados", value: analysis.toUpdate.length, tone: "text-foreground" },
                    { label: "Com erro (ficam de fora)", value: analysis.errors.length, tone: "text-destructive" },
                    { label: "Avisos", value: analysis.warnings.length, tone: "text-amber-600 dark:text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                      <p className={`text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {analysis.toUpdate.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={updateExisting} onCheckedChange={(v) => setUpdateExisting(v === true)} />
                    Atualizar os {analysis.toUpdate.length} já cadastrados com os dados da planilha
                  </label>
                )}

                {(analysis.errors.length > 0 || analysis.warnings.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Problemas encontrados</p>
                      <Button variant="ghost" size="sm" onClick={downloadReport}>
                        <Download className="mr-1 h-4 w-4" />
                        Baixar relatório
                      </Button>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70px]">Linha</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Problema</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...analysis.errors.map((e) => ({ ...e, error: true })), ...analysis.warnings.map((w) => ({ ...w, error: false }))]
                            .slice(0, 300)
                            .map((i, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="tabular-nums">{i.line}</TableCell>
                                <TableCell>{i.name || "—"}</TableCell>
                                <TableCell className={i.error ? "text-destructive" : "text-amber-700 dark:text-amber-400"}>
                                  {i.error ? "Erro: " : "Aviso: "}
                                  {i.message}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {progress !== null ? (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">Gravando... {progress}%</p>
                  </div>
                ) : outcome ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Importação concluída</AlertTitle>
                    <AlertDescription>
                      {outcome.created} novo(s), {outcome.updated} atualizado(s)
                      {outcome.failed.length > 0 && `, ${outcome.failed.length} falharam (veja o relatório)`}.
                      <Button variant="link" className="h-auto p-0 pl-2" onClick={() => navigate("/filiados")}>
                        Ver filiados
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Button onClick={runImport} disabled={importCount === 0}>
                    Importar {importCount} filiado{importCount !== 1 && "s"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
