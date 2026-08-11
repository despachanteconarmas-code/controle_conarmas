# 💻 Comandos Prontos - Copiar e Colar

Todos os comandos necessários para o deploy, prontos para copiar e colar.

---

## 🖥️ Passo 1: Preparar VPS (SSH)

```bash
# Conectar na VPS
ssh seu-usuario@IP-DA-VPS

# Criar estrutura de pastas
sudo mkdir -p /opt/stacks/conarmas/dist

# Dar permissões
sudo chown -R $USER:$USER /opt/stacks/conarmas
sudo chmod -R 755 /opt/stacks/conarmas

# Verificar
ls -la /opt/stacks/conarmas/

# Anotar hostname (copie o resultado!)
hostname

# Sair
exit
```

---

## 💻 Passo 2: Build Local (Seu PC)

```bash
# Instalar dependências
npm install

# Build de produção
npm run build

# Verificar se criou a pasta dist/
ls -la dist/
```

---

## 📤 Passo 3: SFTP

**Não há comandos - use FileZilla ou WinSCP**

**Arquivos para enviar:**
- `dist/` → `/opt/stacks/conarmas/dist/`
- `nginx.conf` → `/opt/stacks/conarmas/nginx.conf`
- `Dockerfile.production` → `/opt/stacks/conarmas/Dockerfile` (renomear!)

---

## 🐳 Passo 4: Build Docker (SSH na VPS)

```bash
# Conectar na VPS
ssh seu-usuario@IP-DA-VPS

# Ir para pasta
cd /opt/stacks/conarmas/

# Verificar se os arquivos estão lá
ls -la

# Build da imagem
docker build -t conarmas-os-manager:latest .

# Verificar imagem criada
docker images | grep conarmas

# Sair
exit
```

---

## 🎯 Passo 5: Stack do Portainer

**Cole isso no Portainer (edite antes!):**

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
          # EDITAR: Colocar hostname da VPS aqui
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

        # EDITAR: Colocar seu domínio aqui
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

---

## ✅ Passo 6: Verificar

```bash
# Conectar na VPS
ssh seu-usuario@IP-DA-VPS

# Container rodando?
docker ps | grep conarmas

# Logs
docker service logs conarmas_os_manager

# Status detalhado
docker service ps conarmas_os_manager

# Sair
exit
```

**No navegador:**
- Abrir: `https://seu-dominio.com.br`
- Deve carregar a tela de login!

---

## 🔄 Atualizar Deploy (quando fizer mudanças)

```bash
# 1. No seu PC: Build
npm run build

# 2. SFTP: enviar nova pasta dist/ para /opt/stacks/conarmas/dist/

# 3. SSH na VPS
ssh seu-usuario@IP-DA-VPS

# 4. Rebuild
cd /opt/stacks/conarmas/
docker build -t conarmas-os-manager:latest .

# 5. Atualizar serviço
docker service update --force conarmas_os_manager

# 6. Verificar
docker service logs -f conarmas_os_manager

# 7. Sair
exit
```

---

## 🐛 Troubleshooting

### Container não inicia

```bash
ssh seu-usuario@IP-DA-VPS

# Ver erro detalhado
docker service ps conarmas_os_manager --no-trunc

# Ver logs
docker service logs conarmas_os_manager

# Ver containers
docker ps -a | grep conarmas
```

### Verificar Traefik

```bash
# Ver se Traefik está rodando
docker ps | grep traefik

# Logs do Traefik
docker service logs traefik | grep conarmas
```

### Verificar DNS

```bash
# No seu PC
nslookup seu-dominio.com.br

# Ou
dig seu-dominio.com.br
```

### Reiniciar tudo

```bash
ssh seu-usuario@IP-DA-VPS

# Remover serviço
docker service rm conarmas_os_manager

# Aguardar 10 segundos

# Recriar via Portainer
# (ou via comando abaixo)
```

---

## 📊 Monitoramento

```bash
ssh seu-usuario@IP-DA-VPS

# Ver uso de recursos
docker stats

# Ver todos os serviços
docker service ls

# Ver containers em execução
docker ps

# Ver logs em tempo real
docker service logs -f conarmas_os_manager

# Ver eventos
docker events --filter 'service=conarmas_os_manager'
```

---

## 🧹 Limpeza

```bash
ssh seu-usuario@IP-DA-VPS

# Remover imagens antigas
docker image prune -a

# Remover containers parados
docker container prune

# Remover tudo não usado
docker system prune -a

# Cuidado! Isso apaga tudo!
```

---

## 🔐 Políticas RLS do Supabase

**Cole isso no SQL Editor do Supabase:**

```sql
-- Habilitar RLS
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

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

## 📝 Aliases Úteis (Opcional)

```bash
ssh seu-usuario@IP-DA-VPS

# Adicionar ao ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Aliases Conarmas
alias cdconarmas="cd /opt/stacks/conarmas"
alias logsconarmas="docker service logs -f conarmas_os_manager"
alias statusconarmas="docker service ps conarmas_os_manager"
alias restartconarmas="docker service update --force conarmas_os_manager"

EOF

# Aplicar
source ~/.bashrc

# Agora você pode usar:
# cdconarmas
# logsconarmas
# statusconarmas
# restartconarmas
```

---

## 🎯 Checklist de Comandos Executados

- [ ] `mkdir -p /opt/stacks/conarmas/dist` - Criar pastas
- [ ] `chown -R $USER:$USER /opt/stacks/conarmas` - Permissões
- [ ] `hostname` - Anotar hostname
- [ ] `npm run build` - Build local
- [ ] SFTP dos arquivos
- [ ] `docker build -t conarmas-os-manager:latest .` - Build Docker
- [ ] `docker images | grep conarmas` - Verificar imagem
- [ ] Criar stack no Portainer
- [ ] `docker ps | grep conarmas` - Verificar container
- [ ] Acessar site no navegador
- [ ] Configurar URLs no Supabase
- [ ] Habilitar RLS no Supabase

---

**Todos os comandos prontos! 🚀**

Copie e cole conforme necessário durante o deploy.
