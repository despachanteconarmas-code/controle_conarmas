# ✅ Checklist de Deploy - Conarmas OS Manager

## 📦 ANTES DE COMEÇAR

- [ ] Node.js instalado localmente
- [ ] Acesso SSH/SFTP à VPS
- [ ] VPS com Docker Swarm rodando
- [ ] Portainer funcionando
- [ ] Traefik configurado
- [ ] Domínio disponível

---

## 🖥️ PASSO 0: Preparar VPS (FAZER PRIMEIRO!)

👉 **Siga:** [PREPARAR-VPS.md](PREPARAR-VPS.md)

### Via SSH na VPS:

```bash
# Criar estrutura de pastas
mkdir -p /home/$USER/conarmas-os/dist

# Verificar
ls -la /home/$USER/conarmas-os/

# Anotar hostname
hostname
```

- [ ] Pastas criadas na VPS
- [ ] Hostname anotado: `_______________`

---

## 🔧 PASSO 1: Build Local (no seu computador)

```bash
# 1. Instalar dependências (se necessário)
npm install

# 2. Fazer build de produção
npm run build
```

**Resultado:** Pasta `dist/` criada ✅

---

## 📤 PASSO 2: Enviar para VPS via SFTP

### Arquivos a enviar:

- [ ] Pasta `dist/` → `/home/usuario/conarmas-os/dist/`
- [ ] Arquivo `nginx.conf` → `/home/usuario/conarmas-os/nginx.conf`
- [ ] Arquivo `Dockerfile.production` → `/home/usuario/conarmas-os/Dockerfile`

**Ferramentas:** FileZilla, WinSCP ou SCP

---

## 🐳 PASSO 3: Build na VPS (via SSH)

```bash
# 1. Conectar na VPS
ssh usuario@IP-VPS

# 2. Ir para pasta do projeto
cd /home/usuario/conarmas-os/

# 3. Buildar imagem Docker
docker build -t conarmas-os-manager:latest .

# 4. Verificar
docker images | grep conarmas
```

**Resultado:** Imagem `conarmas-os-manager:latest` criada ✅

---

## 🎯 PASSO 4: Configurar Stack do Portainer

### 4.1: Descobrir hostname da VPS

```bash
hostname
```

**Anote o resultado:** `___________________________`

### 4.2: Configurar DNS

No provedor DNS:
- **Tipo:** A
- **Nome:** os (ou outro)
- **Valor:** IP da VPS

**Domínio configurado:** `___________________________`

### 4.3: Editar portainer-stack-local.yml

- [ ] Linha 17: Substituir `SEU-HOSTNAME-VPS` pelo hostname anotado
- [ ] Linha 31: Substituir `os.conarmas.com.br` pelo seu domínio

### 4.4: Deploy no Portainer

1. [ ] Acessar Portainer
2. [ ] **Stacks** > **Add Stack**
3. [ ] Nome: `conarmas-os-manager`
4. [ ] Colar conteúdo do `portainer-stack-local.yml` editado
5. [ ] **Deploy the stack**

---

## ✅ PASSO 5: Verificação

### Container rodando?

- [ ] Portainer > Containers > `conarmas_os_manager` está **Running** (verde)

Ou via SSH:
```bash
docker ps | grep conarmas
```

### Logs sem erros?

- [ ] Portainer > Containers > `conarmas_os_manager` > Logs

### Site acessível?

- [ ] Abrir navegador: `https://SEU-DOMINIO.com.br`
- [ ] Tela de login carrega ✅

### Login funciona?

- [ ] Fazer login com usuário do Supabase
- [ ] Dashboard carrega ✅

---

## 🔒 PASSO 6: Segurança no Supabase

### Configurar URLs

1. [ ] Acessar: Supabase Dashboard > **Authentication** > **URL Configuration**
2. [ ] **Site URL:** `https://SEU-DOMINIO.com.br`
3. [ ] **Redirect URLs:** Adicionar `https://SEU-DOMINIO.com.br/**`
4. [ ] Salvar

### Habilitar RLS (Row Level Security)

1. [ ] Acessar: Supabase > **Database** > **Tables**
2. [ ] Tabela `service_orders`: **Enable RLS**
3. [ ] Tabela `profiles` (se existir): **Enable RLS**
4. [ ] Criar políticas de acesso

**Exemplo de política:**
```sql
CREATE POLICY "Users can view own orders"
ON service_orders FOR SELECT
USING (auth.uid() = user_id);
```

---

## 🔄 ATUALIZAÇÕES FUTURAS

Quando fizer mudanças no código:

### 1. Build local
```bash
npm run build
```

### 2. Enviar nova dist/ via SFTP
Substituir pasta `dist/` na VPS

### 3. Rebuild na VPS
```bash
ssh usuario@IP-VPS
cd /home/usuario/conarmas-os/
docker build -t conarmas-os-manager:latest .
```

### 4. Atualizar no Portainer

**Opção A:** Portainer UI
- Stacks > conarmas-os-manager > **Update the stack**
- Marcar: **Re-pull images and redeploy**
- **Update**

**Opção B:** SSH
```bash
docker service update --force conarmas_os_manager
```

---

## 🐛 Problemas Comuns

### ❌ Container não inicia

**Verificar:**
```bash
docker service ps conarmas_os_manager --no-trunc
docker service logs conarmas_os_manager
```

### ❌ Erro 502 Bad Gateway

**Causas:**
- Container não rodando
- Porta errada (deve ser 80)
- Health check falhando

**Solução:** Verificar logs do container e do Traefik

### ❌ SSL não funciona

**Aguardar:** 2-5 minutos para Let's Encrypt emitir certificado

**Verificar:**
- DNS propagado: `nslookup SEU-DOMINIO.com.br`
- Logs do Traefik

### ❌ Erro CORS / Supabase

**Solução:** Adicionar domínio nas URLs do Supabase (Passo 6)

---

## 📞 Informações Úteis

### Comandos SSH úteis:

```bash
# Ver containers rodando
docker ps

# Ver logs em tempo real
docker service logs -f conarmas_os_manager

# Ver status do serviço
docker service ps conarmas_os_manager

# Ver uso de recursos
docker stats

# Reiniciar serviço
docker service update --force conarmas_os_manager
```

### Estrutura de arquivos na VPS:

```
/home/usuario/conarmas-os/
├── dist/           ← Arquivos buildados
├── nginx.conf      ← Config Nginx
└── Dockerfile      ← Dockerfile
```

---

## ✅ Deploy Completo!

Se todos os checkboxes estão marcados, seu deploy está completo! 🎉

**Site:** https://SEU-DOMINIO.com.br

---

**Próximos passos:**
- [ ] Configurar backup do Supabase
- [ ] Configurar monitoramento
- [ ] Testar todas as funcionalidades
- [ ] Documentar credenciais e acessos
