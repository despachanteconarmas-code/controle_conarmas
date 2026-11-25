// Sobe para o Storage do self-hosted os arquivos exportados do gerenciado,
// mantendo bucket e caminho (os registros do banco apontam para eles).
//
//   SUPABASE_URL=... SERVICE_KEY=... node importar-storage.mjs <pasta-do-pacote>
//
// Lê <pasta>/objects.json e <pasta>/storage/<bucket>/<caminho>. Pode ser
// rodado de novo: usa upsert. Imprime só totais.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SERVICE_KEY;
const DIR = process.argv[2];
if (!BASE || !KEY || !DIR) throw new Error("Faltam SUPABASE_URL, SERVICE_KEY ou a pasta do pacote");

const objects = JSON.parse(fs.readFileSync(path.join(DIR, "objects.json"), "utf8"));
const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

let ok = 0;
let bytes = 0;
const failed = [];

// 4 envios em paralelo: rápido sem sobrecarregar o storage
const queue = [...objects];
async function worker() {
  for (let obj = queue.shift(); obj; obj = queue.shift()) {
    const file = path.join(DIR, "storage", obj.bucket, ...obj.name.split("/"));
    const data = fs.readFileSync(file);
    const res = await fetch(`${BASE}/storage/v1/object/${obj.bucket}/${encodePath(obj.name)}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": obj.mimetype || "application/octet-stream",
        "x-upsert": "true",
      },
      body: data,
    });
    if (res.ok) {
      ok++;
      bytes += data.length;
    } else {
      failed.push({ bucket: obj.bucket, status: res.status, body: (await res.text()).slice(0, 120) });
    }
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

console.log(`enviados: ${ok}/${objects.length} arquivo(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`);
if (failed.length) {
  console.log(`falharam: ${failed.length}`);
  for (const f of failed.slice(0, 10)) console.log(`  ${f.bucket}: HTTP ${f.status} ${f.body}`);
  process.exit(1);
}
