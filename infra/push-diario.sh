#!/bin/sh
# Avisos de vencimento por notificação no celular (Web Push), todo dia às
# 12:00 UTC = 09:00 de Brasília:
#   0 12 * * * sh /opt/stacks/conarmas-repo/infra/push-diario.sh >> /var/log/push-diario.log 2>&1
#
# Chama a Edge Function member-push, que manda para quem ativou os avisos
# no app a filiação, CR, CRAF e GT vencendo em 30, 15 e 7 dias e no dia.
# Cada aviso sai uma vez por faixa: se um dia falhar, sai no dia seguinte.
#
# Teste sem enviar:   sh push-diario.sh --dry-run
# Teste para um nº:   sh push-diario.sh --teste 1168
set -eu
ENV=/opt/stacks/supabase/.env
SECRET=$(grep '^CARTEIRA_N8N_SECRET=' "$ENV" | cut -d= -f2-)
URL=$(grep '^SUPABASE_PUBLIC_URL=' "$ENV" | cut -d= -f2-)
[ -n "$SECRET" ] && [ -n "$URL" ] || { echo "ERRO: faltam CARTEIRA_N8N_SECRET ou SUPABASE_PUBLIC_URL em $ENV"; exit 1; }

case "${1:-}" in
  --dry-run) BODY='{"dry_run":true}' ;;
  --teste) BODY="{\"test_member_number\":${2:?informe o nº do filiado}}" ;;
  *) BODY='{}' ;;
esac

RESP=$(curl -sS -m 300 -X POST "$URL/functions/v1/member-push" \
  -H "Content-Type: application/json" \
  -H "x-carteira-secret: $SECRET" \
  -d "$BODY" -w ' HTTP %{http_code}')
echo "$(date -u +%FT%TZ) $RESP"
case "$RESP" in *" HTTP 200") exit 0 ;; *) exit 1 ;; esac
