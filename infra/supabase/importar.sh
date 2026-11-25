#!/bin/sh
# Importação DEFINITIVA do Supabase gerenciado no self-hosted (dia da troca).
#
# Antes: /opt/stacks/supabase/migracao/abrir-pacote.sh (pacote exportado
# pelo workflow "Exportar Supabase gerenciado"). Depois: deploy-vps.sh.
#
# Só roda em banco vazio. Tudo numa transação: se algo falhar, nada fica.
set -e
DADOS=/opt/stacks/supabase/migracao/dados
MIGRATIONS=/opt/stacks/conarmas-repo/supabase/migrations
cd /opt/stacks/supabase
set -a; . ./.env; set +a
D=$(docker ps -q -f name=supabase_db | head -1)
[ -n "$D" ] || { echo "Banco do Supabase self-hosted não está rodando"; exit 1; }
[ -f "$DADOS/schema.sql" ] || { echo "Pacote não aberto (rode abrir-pacote.sh)"; exit 1; }
[ -d "$MIGRATIONS" ] || { echo "Repositório não encontrado em /opt/stacks/conarmas-repo (rode deploy-vps.sh --so-repo)"; exit 1; }

JA_TEM=$(docker exec "$D" psql -U supabase_admin -d postgres -At -c "select to_regclass('public.service_orders') is not null")
[ "$JA_TEM" = "f" ] || { echo "O banco novo já tem dados (public.service_orders existe). Nada foi feito."; exit 1; }

echo ">> Montando o roteiro de importação"
umask 077
# storage.objects fica de fora: os arquivos sobem pela API, que recria os registros
awk '/^COPY "storage"."objects"/{skip=1} skip && /^\\\.$/{skip=0; next} !skip' "$DADOS/data.sql" > /root/importar-data.sql
{
  echo '\set ON_ERROR_STOP on'
  echo 'BEGIN;'
  echo '\i /tmp/importar/roles.sql'
  echo '\i /tmp/importar/schema.sql'
  echo 'SET session_replication_role = replica;'
  echo '\i /tmp/importar/data.sql'
  echo 'SET session_replication_role = DEFAULT;'
  # Histórico de migrations: tudo que está no repositório já está no banco importado
  echo 'CREATE SCHEMA IF NOT EXISTS supabase_migrations;'
  echo 'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);'
  for f in $(ls "$MIGRATIONS"/*.sql | sort); do
    b=$(basename "$f" .sql); v=${b%%_*}; n=${b#*_}
    echo "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$v', '$n') ON CONFLICT DO NOTHING;"
  done
  echo 'COMMIT;'
} > /root/importar.sql

docker exec -u 0 "$D" mkdir -p /tmp/importar
docker cp "$DADOS/roles.sql" "$D":/tmp/importar/roles.sql
docker cp "$DADOS/schema.sql" "$D":/tmp/importar/schema.sql
docker cp /root/importar-data.sql "$D":/tmp/importar/data.sql
docker cp /root/importar.sql "$D":/tmp/importar/importar.sql
rm -f /root/importar-data.sql /root/importar.sql
docker exec -u 0 "$D" chmod -R a+rX /tmp/importar

echo ">> Importando estrutura e dados (transação única)"
docker exec "$D" psql -U supabase_admin -d postgres -qAt -f /tmp/importar/importar.sql \
  | grep -vE '^(SET|COPY [0-9]+|ALTER [A-Z ]+|CREATE [A-Z ]+|COMMENT|GRANT|REVOKE|DO|INSERT 0 [0-9]+|BEGIN|COMMIT|[0-9]+)$|set_config|^\s*$' || true
docker exec -u 0 "$D" rm -rf /tmp/importar

echo ">> Enviando os arquivos do Storage"
cp /opt/stacks/conarmas-repo/infra/supabase/importar-storage.mjs "$DADOS/../importar-storage.mjs"
docker run --rm --network host --add-host supabase.armascon.com.br:127.0.0.1 \
  -e SUPABASE_URL="$SUPABASE_PUBLIC_URL" -e SERVICE_KEY="$SERVICE_ROLE_KEY" \
  -v /opt/stacks/supabase/migracao:/w node:20-alpine node /w/importar-storage.mjs /w/dados
rm -f "$DADOS/../importar-storage.mjs"

echo ">> Conferência"
docker exec "$D" psql -U supabase_admin -d postgres -At -c "
select 'service_orders: '||count(*) from public.service_orders
union all select 'customers: '||count(*) from public.customers
union all select 'service_order_files: '||count(*) from public.service_order_files
union all select 'arquivos no storage: '||count(*) from storage.objects where bucket_id <> 'migracao'
union all select 'auth.users: '||count(*) from auth.users
union all select 'migrations registradas: '||count(*) from supabase_migrations.schema_migrations"
echo ">> Importação concluída"
