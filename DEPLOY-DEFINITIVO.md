# 🚀 Deploy Definitivo - Conarmas OS Manager

Método **SIMPLES** - Igual ao FinBot que funcionou!

---

## 📋 Processo Completo (4 passos)

```
1. Preparar VPS → 2. Build Local → 3. SFTP → 4. Portainer
```

**SEM Dockerfile! SEM Build Docker! Apenas nginx:alpine + volumes!** ✅

---

## 1️⃣ Preparar VPS (SSH)

```bash
# Conectar
ssh root@IP-DA-VPS

# Criar estrutura (igual ao FinBot)
mkdir -p /opt/stacks/conarmas/dist

# Verificar
ls -la /opt/stacks/conarmas/

# Sair
exit
```

**Estrutura criada:** `/opt/stacks/conarmas/` ✅

---

## 2️⃣ Build Local (Seu PC)

```bash
# Build de produção
npm run build

# Verificar
ls -la dist/
```

**Pasta `dist/` criada com arquivos compilados** ✅

---

## 3️⃣ SFTP (FileZilla/WinSCP)

**Enviar APENAS 2 arquivos para:** `/opt/stacks/conarmas/`

| Arquivo Local | Destino na VPS |
|---------------|----------------|
| `dist/` (pasta completa) | `/opt/stacks/conarmas/dist/` |
| `nginx.conf` | `/opt/stacks/conarmas/nginx.conf` |

**⚠️ IMPORTANTE:**
- ✅ Enviar **APENAS** `dist/` e `nginx.conf`
- ❌ **NÃO** enviar `Dockerfile`
- ❌ **NÃO** enviar `Dockerfile.production`

### Verificar via SSH:

```bash
ssh root@IP-DA-VPS

# Verificar arquivos
ls -la /opt/stacks/conarmas/

# Deve mostrar:
# dist/
# nginx.conf

# Verificar conteúdo da dist
ls -la /opt/stacks/conarmas/dist/

# Deve mostrar: index.html, assets/, etc.

exit
```

---

## 4️⃣ Portainer (Criar Stack)

### No Portainer:

1. **Stacks** → **Add Stack**
2. **Name:** `conarmas`
3. **Build method:** Web editor
4. Colar o conteúdo de **[portainer-stack-SIMPLES.yml](portainer-stack-SIMPLES.yml)**
5. **Deploy the stack**

**A Stack já está 100% pronta!** Não precisa editar nada! ✅

---

## ✅ Verificar

### Via SSH:

```bash
ssh root@IP-DA-VPS

# Container rodando?
docker ps | grep conarmas

# Logs
docker service logs conarmas

# Status
docker service ps conarmas

exit
```

### No Navegador:

Abrir: **https://controle.armascon.com.br**

**Deve carregar a tela de login!** 🎉

---

## 🔄 Atualizações Futuras

Quando fizer mudanças no código:

### 1. Build local
```bash
npm run build
```

### 2. SFTP
Enviar nova pasta `dist/` para `/opt/stacks/conarmas/dist/`

### 3. Reiniciar serviço

**No Portainer:**
- **Stacks** > `conarmas` > **Update**
- Clicar em **Update**

**Ou via SSH:**
```bash
docker service update --force conarmas
```

**Pronto!** Nova versão no ar! 🚀

---

## 📊 Estrutura Final na VPS

```
/opt/stacks/conarmas/
├── dist/
│   ├── index.html
│   ├── assets/
│   │   ├── index-abc123.js
│   │   └── index-abc123.css
│   └── ...
└── nginx.conf
```

**SEM Dockerfile!** ✅

---

## 🐛 Troubleshooting

### Container não roda

```bash
# Ver erro
docker service ps conarmas --no-trunc

# Ver logs
docker service logs conarmas
```

### 404 no navegador

**Verificar:**
1. Pasta `dist/` foi enviada? `ls /opt/stacks/conarmas/dist/`
2. Tem `index.html` dentro? `ls /opt/stacks/conarmas/dist/index.html`
3. Container rodando? `docker ps | grep conarmas`

### 502 Bad Gateway

**Aguardar:** 30-60 segundos (Traefik configurando SSL)

**Verificar Traefik:**
```bash
docker service logs traefik | grep conarmas
```

### SSL não funciona

**Verificar DNS:**
```bash
nslookup controle.armascon.com.br
# Deve retornar o IP da VPS
```

---

## 🔐 Supabase (Não esquecer!)

### Configurar URLs:

1. Acessar: [Supabase Dashboard](https://app.supabase.com)
2. **Authentication** > **URL Configuration**
3. **Site URL:** `https://controle.armascon.com.br`
4. **Redirect URLs:** `https://controle.armascon.com.br/**`
5. **Save**

### Habilitar RLS:

1. **Database** > **Tables**
2. Para cada tabela:
   - **Enable RLS**
   - Criar políticas de acesso

---

## ✅ Checklist Final

- [ ] Pasta criada: `/opt/stacks/conarmas/`
- [ ] Build local: `npm run build`
- [ ] SFTP: `dist/` e `nginx.conf` enviados
- [ ] Stack criada no Portainer
- [ ] Container rodando: `docker ps | grep conarmas`
- [ ] Site acessível: `https://controle.armascon.com.br`
- [ ] Login funcionando
- [ ] URLs configuradas no Supabase
- [ ] RLS habilitado no Supabase

---

## 🎯 Diferenças do método anterior

| Antes (Complicado) | Agora (Simples) |
|--------------------|-----------------|
| ❌ Precisava Dockerfile | ✅ Sem Dockerfile |
| ❌ Build Docker na VPS | ✅ Sem build Docker |
| ❌ Imagem local | ✅ Usa `nginx:alpine` oficial |
| ❌ Problemas de scheduling | ✅ Funciona sempre |
| ❌ 3 arquivos via SFTP | ✅ 2 arquivos via SFTP |

---

## 📝 Comandos Resumidos

```bash
# 1. VPS
ssh root@IP-VPS
mkdir -p /opt/stacks/conarmas/dist
exit

# 2. Build
npm run build

# 3. SFTP
# Enviar dist/ e nginx.conf

# 4. Portainer
# Criar Stack com portainer-stack-SIMPLES.yml

# 5. Verificar
docker ps | grep conarmas
```

---

**Deploy completo em ~5 minutos! 🚀**

**Método testado e aprovado!** ✅ (Igual ao FinBot)
