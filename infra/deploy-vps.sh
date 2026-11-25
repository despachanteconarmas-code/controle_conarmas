#!/bin/sh
# Deploy na VPS da Conarmas (Supabase self-hosted + apps).
#
#   /opt/stacks/conarmas-repo/infra/deploy-vps.sh            tudo
#   /opt/stacks/conarmas-repo/infra/deploy-vps.sh --so-repo  só atualiza o repositório
#
# 1. Atualiza o repositório (público) em /opt/stacks/conarmas-repo
# 2. Aplica no banco só as migrations que ainda não rodaram
# 3. Atualiza as Edge Functions do Supabase self-hosted
# 4. Publica as imagens mais novas do app de OS e da carteira (GHCR)
#
# Substitui os jobs "migrate" e "functions" do CI, que só alcançavam o
# Supabase gerenciado: o banco self-hosted não fica exposto na internet.
set -e
REPO=/opt/stacks/conarmas-repo
SUPA=/opt/stacks/supabase

echo ">> Repositório"
if [ -d "$REPO/.git" ]; then
  git -C "$REPO" fetch -q origin main
  git -C "$REPO" reset -q --hard origin/main
else
  git clone -q https://github.com/despachanteconarmas-code/controle_conarmas.git "$REPO"
fi
echo "   $(git -C "$REPO" log -1 --format='%h %s')"
[ "$1" = "--so-repo" ] && exit 0

D=$(docker ps -q -f name=supabase_db | head -1)
[ -n "$D" ] || { echo "Banco do Supabase self-hosted não está rodando"; exit 1; }
psql_db() { docker exec "$D" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

echo ">> Migrations"
TEM_HIST=$(psql_db -c "select to_regclass('supabase_migrations.schema_migrations') is not null")
[ "$TEM_HIST" = "t" ] || { echo "   Banco sem histórico de migrations (importação ainda não feita). Parando."; exit 1; }
APLICADAS=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  b=$(basename "$f" .sql); v=${b%%_*}; n=${b#*_}
  JA=$(psql_db -c "select count(*) from supabase_migrations.schema_migrations where version = '$v'")
  [ "$JA" = "0" ] || continue
  echo "   aplicando $b"
  docker cp "$f" "$D":/tmp/migration.sql
  docker exec -u 0 "$D" chmod 644 /tmp/migration.sql
  # Migration e registro no histórico na mesma transação
  docker exec "$D" sh -c "{ echo 'BEGIN;'; cat /tmp/migration.sql; echo; echo \"INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$v', '$n');\"; echo 'COMMIT;'; } | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -qAt >/dev/null"
  docker exec -u 0 "$D" rm -f /tmp/migration.sql
  APLICADAS=$((APLICADAS + 1))
done
echo "   $APLICADAS nova(s)"

echo ">> Edge Functions"
for dir in "$REPO"/supabase/functions/*/; do
  name=$(basename "$dir")
  rm -rf "${SUPA:?}/volumes/functions/$name"
  cp -r "$dir" "$SUPA/volumes/functions/$name"
done
chmod -R a+rX "$SUPA/volumes/functions"
docker service update --quiet --force supabase_functions >/dev/null
echo "   $(ls -d "$REPO"/supabase/functions/*/ | wc -l) função(ões) atualizadas"

echo ">> Apps"
docker service update --quiet --with-registry-auth --force \
  --image ghcr.io/despachanteconarmas-code/controle_conarmas:latest controle_conarmas_conarmas >/dev/null
docker service update --quiet --with-registry-auth --force \
  --image ghcr.io/despachanteconarmas-code/controle_conarmas-carteira:latest carteira_carteira >/dev/null
docker service ls --format '   {{.Name}} {{.Replicas}}' | grep -E 'controle_conarmas|carteira_|supabase_functions'
echo ">> Deploy concluído"
