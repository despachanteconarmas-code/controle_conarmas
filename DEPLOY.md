# 🚀 Guia de Deploy - Conarmas OS Manager

Este guia detalha como fazer o deploy do Conarmas OS Manager na sua VPS Hetzner usando Docker e Portainer.

## 📋 Pré-requisitos

- VPS com Docker instalado
- Docker Swarm inicializado
- Portainer rodando
- Traefik configurado (baseado na sua stack do n8n)
- Rede `network_swarm_public` criada
- Domínio configurado (ex: os.conarmas.com.br)

## 🔐 Informações Importantes de Segurança

### ⚠️ ATENÇÃO: Credenciais Expostas

As credenciais do Supabase que estavam hardcoded no código foram corrigidas e movidas para variáveis de ambiente.

**É ALTAMENTE RECOMENDADO** que você:
1. Gere novas chaves no Supabase (opcional, mas recomendado por segurança)
2. Nunca commite o arquivo `.env` no repositório Git

---

## 📦 Arquivos Necessários para Deploy

### Arquivos que você precisa enviar para a VPS:

1. **Código compilado (opção 1)**: Build local e enviar
2. **Código fonte (opção 2)**: Buildar na VPS

**Recomendação**: Buildar localmente e fazer push para um registry Docker.

---

## 🛠️ Processo de Deploy

### Opção A: Build Local + Docker Registry (RECOMENDADO)

#### Passo 1: Buildar a imagem localmente

```bash
# No seu computador, dentro da pasta do projeto:

# 1. Fazer o build da imagem
docker build \
  --build-arg VITE_SUPABASE_URL=https://utwujmzfwpyixczstdjw.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d3VqbXpmd3B5aXhjenN0ZGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MDUyMTYsImV4cCI6MjA3MDE4MTIxNn0.W5M3VRFRY6vFsYV44x2pJy0AJ3QerS_8V7gwknvzqpM \
  -t conarmas-os-manager:latest .

# 2. Testar localmente (opcional)
docker run -p 8080:80 conarmas-os-manager:latest
# Acesse: http://localhost:8080
```

#### Passo 2: Fazer push para um Docker Registry

Você tem 3 opções:

##### Opção 2.1: Docker Hub (Público - Grátis)

```bash
# 1. Login no Docker Hub
docker login

# 2. Tag da imagem
docker tag conarmas-os-manager:latest SEU_USUARIO/conarmas-os-manager:latest

# 3. Push
docker push SEU_USUARIO/conarmas-os-manager:latest
```

##### Opção 2.2: GitHub Container Registry (Privado - Grátis)

```bash
# 1. Criar Personal Access Token no GitHub
# Vá em: Settings > Developer settings > Personal access tokens
# Permissões: write:packages, read:packages

# 2. Login no GHCR
echo "SEU_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin

# 3. Tag da imagem
docker tag conarmas-os-manager:latest ghcr.io/SEU_USUARIO/conarmas-os-manager:latest

# 4. Push
docker push ghcr.io/SEU_USUARIO/conarmas-os-manager:latest
```

##### Opção 2.3: Registry Próprio na VPS

Se você tem um registry rodando na sua VPS:

```bash
# Tag e push
docker tag conarmas-os-manager:latest seu-registry.com/conarmas-os-manager:latest
docker push seu-registry.com/conarmas-os-manager:latest
```

#### Passo 3: Atualizar o portainer-stack.yml

Edite o arquivo `portainer-stack.yml` e altere a linha:

```yaml
image: seu-registry/conarmas-os-manager:latest
```

Para uma das opções:
- Docker Hub: `SEU_USUARIO/conarmas-os-manager:latest`
- GHCR: `ghcr.io/SEU_USUARIO/conarmas-os-manager:latest`
- Registry próprio: `seu-registry.com/conarmas-os-manager:latest`

#### Passo 4: Configurar o Domínio

No arquivo `portainer-stack.yml`, altere a linha:

```yaml
- traefik.http.routers.conarmas_os.rule=Host(`os.conarmas.com.br`)
```

Para o seu domínio real.

#### Passo 5: Deploy no Portainer

1. Acesse o Portainer
2. Vá em **Stacks** > **Add Stack**
3. Cole o conteúdo do arquivo `portainer-stack.yml`
4. Clique em **Deploy the stack**

---

### Opção B: Build Direto na VPS

#### Passo 1: Enviar arquivos para a VPS

```bash
# No seu computador:

# Comprimir o projeto (excluindo node_modules e dist)
tar -czf conarmas-os-manager.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.env' \
  .

# Enviar para a VPS via SCP
scp conarmas-os-manager.tar.gz usuario@seu-servidor:/home/usuario/
```

#### Passo 2: Na VPS, buildar e executar

```bash
# Conectar na VPS
ssh usuario@seu-servidor

# Descomprimir
cd /home/usuario
tar -xzf conarmas-os-manager.tar.gz -C conarmas-os-manager
cd conarmas-os-manager

# Buildar
docker build \
  --build-arg VITE_SUPABASE_URL=https://utwujmzfwpyixczstdjw.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0d3VqbXpmd3B5aXhjenN0ZGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MDUyMTYsImV4cCI6MjA3MDE4MTIxNn0.W5M3VRFRY6vFsYV44x2pJy0AJ3QerS_8V7gwknvzqpM \
  -t conarmas-os-manager:latest .
```

#### Passo 3: Atualizar o portainer-stack.yml

Se buildou na VPS, a imagem está local. Atualize para:

```yaml
image: conarmas-os-manager:latest
```

E adicione estas constraints:

```yaml
placement:
  constraints:
    - node.hostname == SEU_HOSTNAME_VPS
```

#### Passo 4: Deploy no Portainer

Siga o Passo 5 da Opção A.

---

## 🔧 Configurações Importantes

### 1. Variáveis de Ambiente no Portainer Stack

As variáveis já estão no `portainer-stack.yml`:

```yaml
environment:
  - VITE_SUPABASE_URL=https://utwujmzfwpyixczstdjw.supabase.co
  - VITE_SUPABASE_ANON_KEY=eyJhbG...
  - NODE_ENV=production
```

### 2. Recursos do Container

Recursos configurados no stack:

- **CPU Limit**: 0.5 (50% de 1 core)
- **RAM Limit**: 512MB
- **CPU Reservation**: 0.25 (25% de 1 core)
- **RAM Reservation**: 256MB

Ajuste conforme necessário na seção `resources` do `portainer-stack.yml`.

### 3. Health Check

O container tem health check configurado:
- Verifica a cada 30 segundos
- Timeout de 3 segundos
- 3 tentativas antes de marcar como unhealthy

---

## 🌐 DNS e Domínio

### Configurar DNS

No seu provedor de DNS (Cloudflare, etc):

1. Crie um registro A apontando para o IP da VPS:
   ```
   Tipo: A
   Nome: os (ou outro subdomínio)
   Valor: IP_DA_VPS
   TTL: Auto ou 3600
   ```

2. Se usar Cloudflare:
   - ⚠️ **Desabilite o Proxy (nuvem laranja)** inicialmente
   - Após confirmar que funciona, pode habilitar

### Verificar DNS

```bash
# No seu computador:
nslookup os.conarmas.com.br

# Ou
dig os.conarmas.com.br
```

Deve retornar o IP da sua VPS.

---

## ✅ Verificação Pós-Deploy

### 1. Verificar container rodando

No Portainer ou via SSH:

```bash
docker ps | grep conarmas
```

### 2. Verificar logs

No Portainer > Containers > conarmas_os_manager > Logs

Ou via SSH:

```bash
docker service logs conarmas_os_manager
```

### 3. Testar acesso

Acesse: https://os.conarmas.com.br

Deve carregar a tela de login.

### 4. Testar login

Use as credenciais de um usuário cadastrado no Supabase.

---

## 🐛 Troubleshooting

### Problema: Container não inicia

**Solução:**
1. Verificar logs: `docker service logs conarmas_os_manager`
2. Verificar se a imagem foi baixada: `docker images`
3. Verificar recursos disponíveis: `docker stats`

### Problema: Erro 502 Bad Gateway

**Causas comuns:**
1. Container não está rodando
2. Porta errada no Traefik
3. Health check falhando

**Solução:**
1. Verificar se o container está healthy: `docker ps`
2. Verificar logs do Traefik
3. Verificar configuração da porta no stack (deve ser 80)

### Problema: Erro de CORS ou Supabase

**Solução:**
1. Verificar se as variáveis de ambiente estão corretas
2. No Supabase, adicionar o domínio nas URLs permitidas:
   - Vá em: Authentication > URL Configuration
   - Adicione: `https://os.conarmas.com.br`

### Problema: Certificado SSL não funciona

**Solução:**
1. Verificar se o DNS está propagado
2. Verificar se o Traefik está configurado corretamente
3. Aguardar alguns minutos (Let's Encrypt pode demorar)
4. Verificar logs do Traefik: `docker service logs traefik`

---

## 🔄 Atualizações Futuras

### Atualizar a aplicação:

1. **Build nova versão localmente**
2. **Push para registry com nova tag ou :latest**
3. **No Portainer:**
   - Vá na Stack
   - Clique em **Update the stack**
   - Se necessário, force pull: marque "Re-pull images"
   - Clique em **Update**

Ou via SSH:

```bash
docker service update --force conarmas_os_manager
```

---

## 📊 Monitoramento

### Verificar uso de recursos

```bash
docker stats
```

### Verificar saúde do serviço

```bash
docker service ps conarmas_os_manager
```

### Logs em tempo real

```bash
docker service logs -f conarmas_os_manager
```

---

## 🔒 Segurança

### Checklist de Segurança:

- ✅ Credenciais não estão no código-fonte
- ✅ HTTPS habilitado (Traefik + Let's Encrypt)
- ✅ Headers de segurança configurados no Nginx
- ✅ Autenticação via Supabase
- ⚠️ Configure Row Level Security (RLS) no Supabase
- ⚠️ Configure políticas de acesso no Supabase
- ⚠️ Habilite 2FA para contas administrativas
- ⚠️ Configure backup do banco de dados
- ⚠️ Configure monitoramento e alertas

### RLS (Row Level Security) no Supabase

O projeto usa Supabase. **É CRÍTICO** configurar RLS:

1. Acesse o Supabase Dashboard
2. Vá em: **Database > Tables**
3. Para cada tabela (service_orders, etc):
   - Clique em **RLS not enabled** > **Enable RLS**
   - Crie políticas de acesso

Exemplo de política:

```sql
-- Usuários só podem ver suas próprias OS
CREATE POLICY "Users can view own orders"
ON service_orders FOR SELECT
USING (auth.uid() = user_id);

-- Usuários só podem criar OS para si mesmos
CREATE POLICY "Users can create own orders"
ON service_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do container
2. Verifique os logs do Traefik
3. Verifique a seção de Troubleshooting
4. Verifique o status do Supabase: https://status.supabase.com

---

## 📝 Notas Importantes

1. **Backup**: Configure backup regular do Supabase
2. **Migrations**: As migrations SQL estão em `supabase/migrations/` - devem ser aplicadas no Supabase
3. **Storage**: Configure o bucket de storage no Supabase para upload de arquivos
4. **Functions**: As Edge Functions estão em `supabase/functions/` - podem ser deployadas se necessário

---

**Boa sorte com o deploy! 🚀**
