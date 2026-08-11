# 🚀 Guia Completo de Deploy - Conarmas OS Manager

Deploy completo na VPS Hetzner usando `/opt/stacks/conarmas/`

---

## 📚 Índice

1. [Preparar VPS](#1-preparar-vps)
2. [Build Local](#2-build-local)
3. [Enviar via SFTP](#3-enviar-via-sftp)
4. [Build Docker na VPS](#4-build-docker-na-vps)
5. [Deploy no Portainer](#5-deploy-no-portainer)
6. [Configurar Supabase](#6-configurar-supabase)
7. [Verificação Final](#7-verificação-final)

---

## 1️⃣ Preparar VPS

### 1.1: Conectar via SSH

```bash
ssh seu-usuario@IP-DA-VPS
```

### 1.2: Criar estrutura de pastas

```bash
# Criar pasta principal
sudo mkdir -p /opt/stacks/conarmas

# Criar pasta dist
sudo mkdir -p /opt/stacks/conarmas/dist

# Dar permissões
sudo chown -R $USER:$USER /opt/stacks/conarmas
sudo chmod -R 755 /opt/stacks/conarmas

# Verificar
ls -la /opt/stacks/conarmas/
```

**Resultado esperado:**
```
drwxr-xr-x 3 usuario usuario 4096 data hora dist
```

### 1.3: Anotar informações importantes

```bash
# Hostname (para usar no Portainer)
hostname
```

**Anotar hostname:** `_______________________`

**Anotar domínio que vai usar:** `_______________________`

```bash
# Sair do SSH
exit
```

---

## 2️⃣ Build Local

### No seu computador, dentro da pasta do projeto:

```bash
# Instalar dependências (se necessário)
npm install

# Build de produção
npm run build
```

**Resultado:** Pasta `dist/` criada com os arquivos compilados ✅

---

## 3️⃣ Enviar via SFTP

### 3.1: Usando FileZilla ou WinSCP

**Conectar:**
- Host: IP da VPS
- Porta: 22
- Usuário: seu-usuario
- Senha: sua-senha

**Enviar arquivos para:** `/opt/stacks/conarmas/`

| Arquivo Local | Destino na VPS |
|---------------|----------------|
| `dist/` (pasta inteira) | `/opt/stacks/conarmas/dist/` |
| `nginx.conf` | `/opt/stacks/conarmas/nginx.conf` |
| `Dockerfile.production` | `/opt/stacks/conarmas/Dockerfile` |

⚠️ **Importante:** Renomear `Dockerfile.production` para `Dockerfile` ao enviar!

### 3.2: Verificar se os arquivos foram enviados

```bash
# Conectar novamente via SSH
ssh seu-usuario@IP-DA-VPS

# Verificar
ls -la /opt/stacks/conarmas/

# Deve mostrar:
# dist/
# nginx.conf
# Dockerfile

# Verificar conteúdo da dist
ls -la /opt/stacks/conarmas/dist/

# Deve mostrar index.html, assets/, etc.
```

---

## 4️⃣ Build Docker na VPS

### Via SSH na VPS:

```bash
# Ir para a pasta do projeto
cd /opt/stacks/conarmas/

# Buildar a imagem Docker
docker build -t conarmas-os-manager:latest .

# Aguardar o build terminar...

# Verificar se a imagem foi criada
docker images | grep conarmas
```

**Resultado esperado:**
```
conarmas-os-manager   latest   abc123def456   few seconds ago   ~50MB
```

✅ Imagem Docker criada com sucesso!

```bash
# Sair do SSH
exit
```

---

## 5️⃣ Deploy no Portainer

### 5.1: Acessar Portainer

Abrir no navegador: `https://seu-portainer.com`

### 5.2: Criar Stack

1. Menu: **Stacks** > **Add Stack**
2. **Name:** `conarmas-os-manager`
3. **Build method:** Web editor

### 5.3: Colar a Stack (editar antes!)

```yaml
version: "3.7"

services:
  conarmas_os_manager:
    image: conarmas-os-manager:latest

    hostname: "{{.Service.Name}}.{{.Task.Slot}}"

    networks:
      - network_swarm_public

    deploy:
      mode: replicated
      replicas: 1

      placement:
        constraints:
          # EDITAR: Colocar o hostname que você anotou
          - node.hostname == SEU-HOSTNAME-AQUI

      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M

      labels:
        - traefik.enable=true

        # EDITAR: Colocar seu domínio
        - traefik.http.routers.conarmas_os.rule=Host(`seu-dominio.com.br`)

        - traefik.http.routers.conarmas_os.entrypoints=websecure
        - traefik.http.routers.conarmas_os.tls.certresolver=letsencryptresolver
        - traefik.http.routers.conarmas_os.service=conarmas_os
        - traefik.http.services.conarmas_os.loadbalancer.server.port=80
        - traefik.http.services.conarmas_os.loadbalancer.passHostHeader=true
        - traefik.http.services.conarmas_os.loadbalancer.healthcheck.path=/
        - traefik.http.services.conarmas_os.loadbalancer.healthcheck.interval=30s

      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback

      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

networks:
  network_swarm_public:
    name: network_swarm_public
    external: true
```

### 5.4: Editar 2 linhas OBRIGATÓRIAS:

**Linha ~17:**
```yaml
- node.hostname == SEU-HOSTNAME-AQUI
```
Substituir por: `- node.hostname == hostname-que-voce-anotou`

**Linha ~31:**
```yaml
- traefik.http.routers.conarmas_os.rule=Host(`seu-dominio.com.br`)
```
Substituir por: `- traefik.http.routers.conarmas_os.rule=Host(`os.conarmas.com.br`)`

### 5.5: Deploy!

Clicar em: **Deploy the stack**

Aguardar... ⏳

---

## 6️⃣ Configurar Supabase

### 6.1: Adicionar domínio nas URLs permitidas

1. Acessar: [Supabase Dashboard](https://app.supabase.com)
2. Selecionar projeto
3. Ir em: **Authentication** > **URL Configuration**
4. **Site URL:** `https://seu-dominio.com.br`
5. **Redirect URLs:** Adicionar `https://seu-dominio.com.br/**`
6. **Save**

### 6.2: Habilitar RLS (Row Level Security)

🔒 **CRÍTICO PARA SEGURANÇA!**

1. Ir em: **Database** > **Tables**
2. Para cada tabela (`service_orders`, `profiles`, etc):
   - Clicar em `RLS not enabled` > **Enable RLS**
3. Criar políticas de acesso

**Exemplo de políticas:**

```sql
-- Usuários podem ver apenas suas próprias OS
CREATE POLICY "Users can view own orders"
ON service_orders FOR SELECT
USING (auth.uid() = user_id);

-- Usuários podem criar OS para si mesmos
CREATE POLICY "Users can create own orders"
ON service_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias OS
CREATE POLICY "Users can update own orders"
ON service_orders FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar suas próprias OS
CREATE POLICY "Users can delete own orders"
ON service_orders FOR DELETE
USING (auth.uid() = user_id);
```

---

## 7️⃣ Verificação Final

### 7.1: Container está rodando?

**No Portainer:**
- Ir em: **Containers**
- Procurar: `conarmas_os_manager`
- Status deve estar: **Running** (verde) ✅

**Ou via SSH:**
```bash
ssh seu-usuario@IP-VPS
docker ps | grep conarmas
```

### 7.2: Logs estão OK?

**No Portainer:**
- **Containers** > `conarmas_os_manager` > **Logs**
- Deve mostrar: Nginx rodando sem erros

**Ou via SSH:**
```bash
docker service logs conarmas_os_manager
```

### 7.3: Site está no ar?

Abrir navegador: `https://seu-dominio.com.br`

**Deve carregar:**
- Logo da Conarmas ✅
- Formulário de login ✅
- Sem erros no console do navegador (F12) ✅

### 7.4: Login funciona?

1. Fazer login com usuário do Supabase
2. Dashboard deve carregar ✅
3. Testar criar uma OS ✅

---

## ✅ Deploy Completo!

Se chegou até aqui, parabéns! 🎉

Seu sistema está no ar em: `https://seu-dominio.com.br`

---

## 🔄 Atualizações Futuras

Quando fizer mudanças no código:

### 1. Build local
```bash
npm run build
```

### 2. Enviar nova dist/ via SFTP
- Conectar no FileZilla/WinSCP
- Substituir pasta `/opt/stacks/conarmas/dist/`

### 3. Rebuild na VPS
```bash
ssh seu-usuario@IP-VPS
cd /opt/stacks/conarmas/
docker build -t conarmas-os-manager:latest .
```

### 4. Atualizar serviço

**Opção A - Portainer:**
- **Stacks** > `conarmas-os-manager` > **Update**
- Marcar: **Re-pull images and redeploy**
- **Update**

**Opção B - SSH:**
```bash
docker service update --force conarmas_os_manager
```

### 5. Verificar
```bash
docker service ps conarmas_os_manager
docker service logs -f conarmas_os_manager
```

---

## 🐛 Troubleshooting

### ❌ Container não inicia

```bash
# Ver detalhes do erro
docker service ps conarmas_os_manager --no-trunc

# Ver logs
docker service logs conarmas_os_manager
```

**Causas comuns:**
- Imagem não encontrada
- Constraint de hostname errado
- Porta já em uso

### ❌ Erro 502 Bad Gateway

**Verificar:**
1. Container está rodando? `docker ps`
2. Porta está correta? (deve ser 80)
3. Traefik está rodando? `docker ps | grep traefik`

**Logs:**
```bash
docker service logs conarmas_os_manager
docker service logs traefik
```

### ❌ SSL não funciona

**Aguardar:** 2-5 minutos para Let's Encrypt emitir certificado

**Verificar DNS:**
```bash
nslookup seu-dominio.com.br
# Deve retornar o IP da VPS
```

**Logs do Traefik:**
```bash
docker service logs traefik | grep -i "conarmas"
```

### ❌ Erro de CORS / Supabase

**Solução:** Configurar URLs no Supabase (Passo 6.1)

**Verificar no navegador (F12):**
- Erro de CORS → URLs não configuradas
- Erro 401 → Problema de autenticação
- Erro 403 → RLS configurado mas sem políticas

---

## 📞 Comandos Úteis

```bash
# Ver containers rodando
docker ps

# Ver serviços do Swarm
docker service ls

# Logs em tempo real
docker service logs -f conarmas_os_manager

# Status do serviço
docker service ps conarmas_os_manager

# Uso de recursos
docker stats

# Reiniciar serviço
docker service update --force conarmas_os_manager

# Remover serviço
docker service rm conarmas_os_manager

# Ver rede
docker network ls
docker network inspect network_swarm_public
```

---

## 📁 Estrutura Final na VPS

```
/opt/stacks/conarmas/
├── dist/
│   ├── index.html
│   ├── assets/
│   │   ├── index-abc123.js
│   │   └── index-abc123.css
│   └── ...
├── nginx.conf
└── Dockerfile
```

---

## 🔐 Checklist de Segurança

- [x] Credenciais movidas para variáveis de ambiente
- [ ] RLS habilitado no Supabase
- [ ] Políticas de acesso criadas
- [ ] URLs configuradas no Supabase
- [ ] HTTPS funcionando (Let's Encrypt)
- [ ] Headers de segurança configurados (Nginx)
- [ ] Backup do Supabase configurado
- [ ] Monitoramento configurado

---

**🎉 Sucesso! Seu sistema está no ar!**

Para dúvidas, consulte:
- [DEPLOY-SIMPLES.md](DEPLOY-SIMPLES.md) - Guia passo a passo detalhado
- [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md) - Checklist rápido
- [PREPARAR-VPS.md](PREPARAR-VPS.md) - Preparação da VPS
- [INICIO-RAPIDO.md](INICIO-RAPIDO.md) - Resumo rápido
