#!/bin/sh
# Zera o Supabase self-hosted (banco e arquivos) para uma nova importação.
# Usado entre o ensaio e a troca. NÃO usar depois que o sistema estiver em
# produção no self-hosted: apaga todos os dados.
set -e
printf "Isto APAGA o banco e os arquivos do Supabase self-hosted. Digite APAGAR para continuar: "
read RESP
[ "$RESP" = "APAGAR" ] || { echo "Cancelado"; exit 1; }
cd /opt/stacks/supabase
docker stack rm supabase
for i in $(seq 1 30); do [ -z "$(docker ps -q -f name=supabase_)" ] && break; sleep 3; done
sleep 5
docker volume rm supabase_db-config >/dev/null 2>&1 || true
rm -rf /opt/stacks/supabase/volumes/db/data /opt/stacks/supabase/volumes/storage
mkdir -p /opt/stacks/supabase/volumes/db/data /opt/stacks/supabase/volumes/storage
chmod 777 /opt/stacks/supabase/volumes/storage
for i in $(seq 1 10); do docker network inspect supabase_internal >/dev/null 2>&1 || break; sleep 3; done
set -a; . ./.env; set +a
docker stack deploy -c STACK-SUPABASE.yml supabase >/dev/null
echo "Banco zerado; serviços subindo (1 a 2 minutos)."
