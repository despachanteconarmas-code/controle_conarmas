// Baixa todos os arquivos de todos os buckets do Supabase gerenciado, para a
// migração ao self-hosted. Usado pelo workflow "Exportar Supabase gerenciado".
//
//   SUPABASE_URL=... SERVICE_KEY=... node exportar-storage.mjs <pasta-de-saída>
//
// Gera <saída>/buckets.json, <saída>/objects.json e <saída>/storage/<bucket>/<caminho>.
// Não imprime nomes de arquivo (podem conter dados pessoais), só totais.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SERVICE_KEY;
const OUT = process.argv[2];
if (!BASE || !KEY || !OUT) throw new Error("Faltam SUPABASE_URL, SERVICE_KEY ou a pasta de saída");

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function api(method, url, body) {
  const res = await fetch(`${BASE}/storage/v1${url}`, {
    method,
    headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url.split("/").slice(0, 4).join("/")} -> ${res.status}`);
  return res;
}

/** Lista recursiva: no Storage, pasta é item com id null */
async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await api("POST", `/object/list/${bucket}`, {
      prefix,
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    const items = await res.json();
    for (const it of items) {
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) files.push(...(await listAll(bucket, full)));
      else files.push({ bucket, name: full, mimetype: it.metadata?.mimetype ?? null, size: it.metadata?.size ?? null });
    }
    if (items.length < 1000) break;
  }
  return files;
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

const buckets = await (await api("GET", "/bucket")).json();
fs.mkdirSync(path.join(OUT, "storage"), { recursive: true });
fs.writeFileSync(path.join(OUT, "buckets.json"), JSON.stringify(buckets, null, 2));

const objects = [];
let bytes = 0;
for (const b of buckets) {
  const files = await listAll(b.id);
  for (const f of files) {
    const res = await api("GET", `/object/${b.id}/${encodePath(f.name)}`);
    const data = Buffer.from(await res.arrayBuffer());
    const dest = path.join(OUT, "storage", b.id, ...f.name.split("/"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    bytes += data.length;
    objects.push({ ...f, size: data.length });
  }
  console.log(`bucket ${b.id}: ${files.length} arquivo(s)`);
}
fs.writeFileSync(path.join(OUT, "objects.json"), JSON.stringify(objects, null, 2));
console.log(`total: ${objects.length} arquivo(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`);
