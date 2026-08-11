# 🚀 Guia de Deploy Simplificado - Via SFTP

Este é o método mais simples para fazer deploy: **Build local + SFTP + Portainer Stack**

---

## ⚠️ ANTES DE COMEÇAR

**IMPORTANTE:** Você precisa preparar a VPS primeiro!

👉 **Siga o guia:** [PREPARAR-VPS.md](PREPARAR-VPS.md)

Esse guia mostra os comandos para criar as pastas necessárias na VPS via SSH.

Depois de preparar a VPS, volte aqui e continue! ⬇️

---

## 📋 Processo Completo (4 Passos)

### **Passo 1: Build Local** 💻

No seu computador, dentro da pasta do projeto:

```bash
# Instalar dependências (se ainda não instalou)
npm install

# Fazer o build de produção
npm run build
```

Isso vai criar a pasta `dist/` com todos os arquivos estáticos prontos para produção.

---

### **Passo 2: Enviar Arquivos via SFTP** 📤

Você precisa enviar **2 arquivos** para a VPS:

#### **Arquivo 1: Dockerfile.production**

Criar na VPS em: `/home/seu-usuario/conarmas-os/Dockerfile`

```dockerfile
FROM nginx:alpine

# Copiar arquivos estáticos buildados
COPY dist/ /usr/share/nginx/html/

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### **Arquivo 2: nginx.conf**

Criar na VPS em: `/home/seu-usuario/conarmas-os/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Segurança
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA - Single Page Application
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Negar acesso a arquivos ocultos
    location ~ /\. {
        deny all;
    }
}
```

#### **Como enviar via SFTP:**

**Opção A: FileZilla / WinSCP**
1. Conectar na VPS via SFTP
2. Criar pasta: `/home/seu-usuario/conarmas-os/`
3. Enviar:
   - Pasta `dist/` → `/home/seu-usuario/conarmas-os/dist/`
   - Arquivo `nginx.conf` → `/home/seu-usuario/conarmas-os/nginx.conf`
   - Arquivo `Dockerfile` (o conteúdo acima) → `/home/seu-usuario/conarmas-os/Dockerfile`

**Opção B: Via SSH/SCP**
```bash
# No seu computador:

# 1. Criar arquivo Dockerfile.production localmente
# (copie o conteúdo do Dockerfile acima)

# 2. Enviar tudo via SCP
scp -r dist/ seu-usuario@IP-VPS:/home/seu-usuario/conarmas-os/
scp nginx.conf seu-usuario@IP-VPS:/home/seu-usuario/conarmas-os/
scp Dockerfile.production seu-usuario@IP-VPS:/home/seu-usuario/conarmas-os/Dockerfile
```

---

### **Passo 3: Build da Imagem na VPS** 🐳

Conectar na VPS via SSH:

```bash
ssh seu-usuario@IP-VPS

# Ir para a pasta do projeto
cd /home/seu-usuario/conarmas-os/

# Buildar a imagem Docker
docker build -t conarmas-os-manager:latest .

# Verificar se a imagem foi criada
docker images | grep conarmas
```

Você deve ver:
```
conarmas-os-manager   latest   abc123def456   2 seconds ago   50MB
```

---

### **Passo 4: Deploy no Portainer** 🎯

#### **4.1: Criar/Editar a Stack no Portainer**

1. Acessar Portainer no navegador
2. Ir em **Stacks** > **Add Stack** (ou editar se já existe)
3. Nome: `conarmas-os-manager`
4. Colar o conteúdo abaixo:

```yaml
version: "3.7"

services:
  conarmas_os_manager:
    # Imagem local que você buildou na VPS
    image: conarmas-os-manager:latest

    hostname: "{{.Service.Name}}.{{.Task.Slot}}"

    networks:
      - network_swarm_public

    deploy:
      mode: replicated
      replicas: 1

      placement:
        constraints:
          # IMPORTANTE: Substitua pelo hostname da sua VPS
          # Para descobrir, rode: hostname
          - node.hostname == SEU-HOSTNAME-VPS

      resources:
        limits:
          cpus: "0.5"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M

      labels:
        - traefik.enable=true

        # IMPORTANTE: Substitua pelo seu domínio
        - traefik.http.routers.conarmas_os.rule=Host(`os.conarmas.com.br`)

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

#### **4.2: Descobrir o hostname da VPS**

Via SSH na VPS:
```bash
hostname
```

Anote o resultado e substitua em `- node.hostname == SEU-HOSTNAME-VPS`

#### **4.3: Configurar o domínio**

Substitua `os.conarmas.com.br` pelo seu domínio real na linha:
```yaml
- traefik.http.routers.conarmas_os.rule=Host(`SEU-DOMINIO.com.br`)
```

#### **4.4: Deploy**

Clique em **Deploy the stack**

---

## 🌐 DNS - Configurar Domínio

No seu provedor DNS (ex: Cloudflare):

1. Criar registro A:
   - **Tipo:** A
   - **Nome:** os (ou subdomínio desejado)
   - **Valor:** IP da VPS
   - **TTL:** Auto

2. Aguardar propagação (pode levar alguns minutos)

3. Testar:
   ```bash
   nslookup os.conarmas.com.br
   ```

---

## ✅ Verificação

### 1. Verificar container rodando

No Portainer:
- **Containers** → deve aparecer `conarmas_os_manager`
- Status: **Running** (verde)

Ou via SSH:
```bash
docker ps | grep conarmas
```

### 2. Verificar logs

No Portainer:
- **Containers** > `conarmas_os_manager` > **Logs**

Ou via SSH:
```bash
docker service logs conarmas_os_manager
```

### 3. Testar acesso

Abrir no navegador: `https://os.conarmas.com.br`

Deve carregar a tela de login! ✅

---

## 🔄 Atualizações Futuras

Quando você fizer mudanças no código:

### **Passo 1: Build local**
```bash
npm run build
```

### **Passo 2: Enviar nova pasta dist/ via SFTP**
Substituir a pasta `dist/` na VPS

### **Passo 3: Rebuild na VPS**
```bash
ssh seu-usuario@IP-VPS
cd /home/seu-usuario/conarmas-os/
docker build -t conarmas-os-manager:latest .
```

### **Passo 4: Atualizar no Portainer**

**Opção A:** No Portainer
- **Stacks** > `conarmas-os-manager` > **Update the stack**
- Marcar: **Re-pull images and redeploy**
- Clicar: **Update**

**Opção B:** Via SSH
```bash
docker service update --force conarmas_os_manager
```

---

## 🐛 Troubleshooting

### Container não inicia

**Verificar:**
```bash
docker service ps conarmas_os_manager --no-trunc
docker service logs conarmas_os_manager
```

### Erro 502 Bad Gateway

**Causas comuns:**
1. Container não rodando → Verificar no Portainer
2. Porta errada → Deve ser porta 80 no label do Traefik
3. Health check falhando → Verificar logs

### Certificado SSL não funciona

1. Verificar se DNS propagou: `nslookup seu-dominio.com.br`
2. Aguardar alguns minutos (Let's Encrypt demora)
3. Verificar logs do Traefik

### Erro no Supabase / CORS

No Supabase Dashboard:
1. **Authentication** > **URL Configuration**
2. **Site URL:** `https://os.conarmas.com.br`
3. **Redirect URLs:** Adicionar `https://os.conarmas.com.br/**`

---

## 📦 Estrutura de Arquivos na VPS

Após seguir o guia, você terá na VPS:

```
/home/seu-usuario/conarmas-os/
├── dist/                  ← Arquivos buildados (HTML, CSS, JS)
│   ├── index.html
│   ├── assets/
│   └── ...
├── nginx.conf             ← Configuração do Nginx
└── Dockerfile             ← Dockerfile para criar imagem
```

---

## 🔒 Segurança - IMPORTANTE

### ⚠️ Configurar RLS no Supabase

1. Acessar: Supabase Dashboard > **Database** > **Tables**
2. Para cada tabela (service_orders, etc):
   - Clicar em **RLS not enabled** > **Enable RLS**
   - Criar políticas:

```sql
-- Política de exemplo
CREATE POLICY "Users can view own orders"
ON service_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
ON service_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### ⚠️ Adicionar domínio no Supabase

**Authentication** > **URL Configuration**:
- Site URL: `https://os.conarmas.com.br`
- Redirect URLs: `https://os.conarmas.com.br/**`

---

## 📝 Checklist de Deploy

- [ ] Build local: `npm run build`
- [ ] Arquivos enviados via SFTP (dist/, nginx.conf, Dockerfile)
- [ ] Build da imagem na VPS: `docker build -t conarmas-os-manager:latest .`
- [ ] Hostname da VPS anotado
- [ ] Domínio configurado no DNS
- [ ] Stack criada no Portainer
- [ ] Domínio configurado na Stack
- [ ] Container rodando (status: Running)
- [ ] Site acessível via HTTPS
- [ ] Login funcionando
- [ ] RLS configurado no Supabase
- [ ] URLs configuradas no Supabase

---

**Pronto! Seu deploy está completo! 🎉**

Qualquer dúvida, consulte os logs ou a seção de Troubleshooting.
