#!/bin/sh
# Backup diário da VPS da Conarmas (cron às 06:30 UTC = 03:30 de Brasília):
#   30 6 * * * sh /opt/stacks/conarmas-repo/infra/backup-vps.sh >> /var/log/backup-vps.log 2>&1
#
# Guarda 7 dias em /opt/backups/AAAA-MM-DD (só root):
#   supabase-banco.dump    banco do Supabase self-hosted (pg_dump -Fc: dados,
#                          usuários do login, Storage, estrutura)
#   supabase-roles.sql     papéis do banco (sem senhas)
#   supabase-storage.tar.gz arquivos do Storage (anexos de OS, fotos, logo)
#   supabase-env           configuração (JWT secret, chaves): sem ela o banco
#                          restaurado não aceita os logins existentes
#   vps-<banco>.dump       bancos do Postgres da VPS (n8n: workflows e
#                          credenciais; memória do agente; Chatwoot; Evolution)
#
# Atenção: fica no mesmo disco da VPS. Protege contra erro humano e dado
# corrompido, NÃO contra perda do servidor. Para isso, copiar para fora
# (ex.: Storage Box da Hetzner).
set -eu
DEST=/opt/backups
DIA=$(date +%F)
PASTA="$DEST/$DIA"
umask 077
mkdir -p "$PASTA"
log() { echo "$(date -u +%FT%TZ) $*"; }

SB=$(docker ps -q -f name=supabase_db | head -1)
PG=$(docker ps -q -f name=postgres_postgres | head -1)
[ -n "$SB" ] || { log "ERRO: banco do Supabase não está rodando"; exit 1; }

log "Supabase: banco"
docker exec "$SB" pg_dumpall -U supabase_admin --roles-only --no-role-passwords > "$PASTA/supabase-roles.sql"
docker exec "$SB" pg_dump -U supabase_admin -d postgres -Fc > "$PASTA/supabase-banco.dump"
# Conferência: o dump precisa abrir e listar os objetos
N=$(docker exec -i "$SB" pg_restore --list < "$PASTA/supabase-banco.dump" | grep -c "TABLE DATA")
[ "$N" -gt 10 ] || { log "ERRO: dump do Supabase parece incompleto ($N tabelas com dados)"; exit 1; }

log "Supabase: arquivos e configuração"
tar -C /opt/stacks/supabase/volumes -czf "$PASTA/supabase-storage.tar.gz" storage
cp /opt/stacks/supabase/.env "$PASTA/supabase-env"

if [ -n "$PG" ]; then
  for db in $(docker exec "$PG" psql -U postgres -At -c "select datname from pg_database where not datistemplate"); do
    log "Postgres da VPS: $db"
    docker exec "$PG" pg_dump -U postgres -d "$db" -Fc > "$PASTA/vps-$db.dump"
  done
fi

# Retenção: 7 dias (só pastas com nome de data)
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name "20??-??-??" -mtime +6 -exec rm -rf {} +

log "ok: $PASTA $(du -sh "$PASTA" | cut -f1) ($N tabelas com dados no Supabase); livre no disco: $(df -h / | awk 'NR==2{print $4}')"
