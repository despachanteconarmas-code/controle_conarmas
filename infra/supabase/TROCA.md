# Troca do Supabase gerenciado para o self-hosted

Roteiro da janela de manutenção. Tudo na VPS roda como root.

## Antes da janela (já feito)
- Stack `supabase` no ar em `supabase.armascon.com.br` (`infra/supabase/STACK-SUPABASE.yml`).
- Segredos em `/opt/stacks/supabase/.env` (só root).
- Chave da migração em `/opt/stacks/supabase/migracao/` (privada só na VPS).
- Ensaio completo da importação feito em 25/11/2026.

## Durante a janela (~1 hora)
1. Avisar a equipe para não usar o sistema de OS.
2. Zerar o banco do ensaio: `sh /opt/stacks/supabase/migracao/resetar-banco.sh`
3. Gerar o link: `/opt/stacks/supabase/migracao/gerar-link.sh`
4. GitHub > Actions > **Exportar Supabase gerenciado (migração)** > Run workflow, com o link.
5. `/opt/stacks/supabase/migracao/abrir-pacote.sh`
6. `sh /opt/stacks/conarmas-repo/infra/supabase/importar.sh`
7. No GitHub (Settings > Secrets and variables > Actions):
   - variável `VITE_SUPABASE_URL` = `https://supabase.armascon.com.br`
   - secret `VITE_SUPABASE_ANON_KEY` = `ANON_KEY` do `.env` da VPS (chave pública por natureza)
   - Actions > **Build e publica imagem no GHCR** > Run workflow
8. Quando o build terminar: `sh /opt/stacks/conarmas-repo/infra/deploy-vps.sh`
9. n8n: credencial **Supabase -> Conarmas** (URL e service role do self-hosted) e URL do workflow de avisos.
10. Conferir: login da equipe, lista e anexos de OS, PDF, filiados, agente de atendimento.

## Depois
- Pausar o projeto no Supabase gerenciado (não apagar por 1 a 2 semanas).
- Backup diário do banco e dos arquivos.

## Deploy do dia a dia
`git push` gera as imagens. Depois, na VPS: `sh /opt/stacks/conarmas-repo/infra/deploy-vps.sh`
(aplica migrations novas, atualiza Edge Functions e publica os apps).
