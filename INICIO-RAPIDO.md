# ⚡ Início Rápido - Deploy em 5 Minutos

Guia super resumido para quem já sabe o que está fazendo.

---

## 🎯 Ordem dos Passos

```
1. Preparar VPS → 2. Build Local → 3. SFTP → 4. Build Docker → 5. Portainer
```

---

## 1️⃣ Preparar VPS (SSH)

```bash
ssh usuario@IP-VPS
mkdir -p /home/$USER/conarmas-os/dist
hostname  # Anotar!
exit
```

📖 Detalhes: [PREPARAR-VPS.md](PREPARAR-VPS.md)

---

## 2️⃣ Build Local (Seu PC)

```bash
npm install
npm run build
```

**Resultado:** Pasta `dist/` criada ✅

---

## 3️⃣ SFTP (FileZilla/WinSCP)

**Enviar para VPS:** `/home/usuario/conarmas-os/`

- `dist/` (pasta completa)
- `nginx.conf`
- `Dockerfile.production` → renomear para `Dockerfile`

---

## 4️⃣ Build Docker (SSH na VPS)

```bash
ssh usuario@IP-VPS
cd /home/$USER/conarmas-os/
docker build -t conarmas-os-manager:latest .
docker images | grep conarmas  # Verificar
exit
```

---

## 5️⃣ Portainer

1. Abrir Portainer → **Stacks** → **Add Stack**
2. Nome: `conarmas-os-manager`
3. Copiar [portainer-stack-local.yml](portainer-stack-local.yml)
4. **Editar 2 linhas:**
   - Linha 17: `node.hostname == SEU-HOSTNAME-VPS`
   - Linha 31: `Host(\`seu-dominio.com.br\`)`
5. **Deploy**

---

## ✅ Verificar

```bash
# Container rodando?
docker ps | grep conarmas

# Logs ok?
docker service logs conarmas_os_manager

# Site no ar?
curl -I https://seu-dominio.com.br
```

---

## 🔒 Supabase (Importante!)

**Authentication** → **URL Configuration**:
- Site URL: `https://seu-dominio.com.br`
- Redirect URLs: `https://seu-dominio.com.br/**`

**Database** → **Tables** → Habilitar **RLS** em todas as tabelas!

---

## 🔄 Atualizar Deploy

```bash
# 1. Build local
npm run build

# 2. SFTP: Enviar nova pasta dist/

# 3. SSH na VPS
cd /home/$USER/conarmas-os/
docker build -t conarmas-os-manager:latest .
docker service update --force conarmas_os_manager
```

---

## 🐛 Erro?

**Container não sobe:**
```bash
docker service ps conarmas_os_manager --no-trunc
docker service logs conarmas_os_manager
```

**502 Bad Gateway:**
- Container rodando? `docker ps`
- Porta correta? (80)
- Logs do Traefik?

**SSL não funciona:**
- DNS propagou? `nslookup seu-dominio.com.br`
- Aguardar 2-5 minutos

---

## 📚 Guias Completos

- 📖 **Iniciante:** [DEPLOY-SIMPLES.md](DEPLOY-SIMPLES.md)
- ✅ **Checklist:** [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md)
- 🖥️ **Preparar VPS:** [PREPARAR-VPS.md](PREPARAR-VPS.md)

---

## 📋 Info Útil

**Comandos SSH:**
```bash
docker ps                                    # Containers
docker service logs -f conarmas_os_manager  # Logs
docker stats                                 # Recursos
docker service ps conarmas_os_manager        # Status
```

**Caminhos VPS:**
```
/home/usuario/conarmas-os/
├── dist/
├── nginx.conf
└── Dockerfile
```

---

**Deploy completo em ~5 minutos! 🚀**
