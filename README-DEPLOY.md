# 📦 Deploy - Conarmas OS Manager

Documentação completa para deploy na VPS Hetzner via SFTP + Docker + Portainer.

---

## 🎯 Escolha seu Guia

### 👤 Para iniciantes ou primeira vez:
📖 **[GUIA-COMPLETO.md](GUIA-COMPLETO.md)** - Passo a passo detalhado com explicações

### ⚡ Para quem já fez antes:
✅ **[CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md)** - Lista de verificação rápida

### 🚀 Para deploy urgente:
⚡ **[INICIO-RAPIDO.md](INICIO-RAPIDO.md)** - Resumo em 5 minutos

---

## 📚 Guias Disponíveis

| Guia | Descrição | Quando usar |
|------|-----------|-------------|
| **[GUIA-COMPLETO.md](GUIA-COMPLETO.md)** | Tutorial completo com todos os passos | Primeira vez ou precisa de ajuda |
| **[DEPLOY-SIMPLES.md](DEPLOY-SIMPLES.md)** | Guia simplificado com SFTP | Método via SFTP (recomendado) |
| **[PREPARAR-VPS.md](PREPARAR-VPS.md)** | Comandos para preparar a VPS | Antes de fazer deploy |
| **[CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md)** | Checklist de verificação | Para acompanhar o progresso |
| **[INICIO-RAPIDO.md](INICIO-RAPIDO.md)** | Resumo super rápido | Já sabe o que está fazendo |
| **[DEPLOY.md](DEPLOY.md)** | Guia com Docker Registry | Deploy via Docker Hub/GHCR |

---

## 🚀 Processo Resumido

```
Preparar VPS → Build Local → SFTP → Build Docker → Portainer → Verificar
```

### 1. Preparar VPS
```bash
sudo mkdir -p /opt/stacks/conarmas/dist
sudo chown -R $USER:$USER /opt/stacks/conarmas
```

### 2. Build Local
```bash
npm run build
```

### 3. SFTP
Enviar `dist/`, `nginx.conf`, `Dockerfile.production` para `/opt/stacks/conarmas/`

### 4. Build Docker
```bash
cd /opt/stacks/conarmas/
docker build -t conarmas-os-manager:latest .
```

### 5. Portainer
Criar Stack com [portainer-stack-local.yml](portainer-stack-local.yml)

### 6. Verificar
Acessar: `https://seu-dominio.com.br`

---

## 📁 Arquivos Importantes

### Para Deploy:
- **`Dockerfile.production`** - Dockerfile para produção (enviar via SFTP)
- **`nginx.conf`** - Configuração do Nginx (enviar via SFTP)
- **`portainer-stack-local.yml`** - Stack do Portainer (colar no Portainer)
- **`.env.example`** - Template de variáveis de ambiente

### Documentação:
- **`GUIA-COMPLETO.md`** - Tutorial completo
- **`DEPLOY-SIMPLES.md`** - Guia simplificado
- **`PREPARAR-VPS.md`** - Preparar VPS
- **`CHECKLIST-DEPLOY.md`** - Checklist
- **`INICIO-RAPIDO.md`** - Resumo rápido

---

## 🔐 Segurança - IMPORTANTE

### ⚠️ Antes do Deploy:

1. **Variáveis de Ambiente:** ✅ Já configuradas em `.env`
2. **Credenciais:** ✅ Não estão mais hardcoded no código

### ⚠️ Depois do Deploy:

1. **Supabase RLS:** Habilitar Row Level Security em todas as tabelas
2. **URLs Supabase:** Adicionar domínio nas URLs permitidas
3. **Políticas:** Criar políticas de acesso no Supabase

---

## 🐛 Problemas Comuns

| Problema | Solução |
|----------|---------|
| Container não inicia | `docker service logs conarmas_os_manager` |
| 502 Bad Gateway | Verificar se container está rodando |
| SSL não funciona | Aguardar 2-5 min para Let's Encrypt |
| Erro de CORS | Configurar URLs no Supabase |

---

## 🔄 Atualizações

```bash
# 1. Build
npm run build

# 2. SFTP: enviar nova dist/

# 3. Rebuild
cd /opt/stacks/conarmas/
docker build -t conarmas-os-manager:latest .
docker service update --force conarmas_os_manager
```

---

## 📞 Comandos Úteis

```bash
# Container rodando?
docker ps | grep conarmas

# Logs
docker service logs -f conarmas_os_manager

# Status
docker service ps conarmas_os_manager

# Recursos
docker stats

# Reiniciar
docker service update --force conarmas_os_manager
```

---

## 📊 Estrutura na VPS

```
/opt/stacks/conarmas/
├── dist/           ← Arquivos buildados
├── nginx.conf      ← Config Nginx
└── Dockerfile      ← Dockerfile
```

---

## ✅ Checklist Rápido

- [ ] VPS preparada (`/opt/stacks/conarmas/`)
- [ ] Build local (`npm run build`)
- [ ] Arquivos enviados via SFTP
- [ ] Imagem Docker buildada
- [ ] Stack criada no Portainer
- [ ] Domínio configurado no DNS
- [ ] Site acessível via HTTPS
- [ ] Login funcionando
- [ ] RLS configurado no Supabase
- [ ] URLs configuradas no Supabase

---

## 🎓 Tecnologias

- **Frontend:** React + Vite + TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Backend:** Supabase (Auth, Database, Storage)
- **Deploy:** Docker + Nginx + Traefik
- **Orquestração:** Docker Swarm + Portainer

---

## 📝 Notas

- Caminho padrão na VPS: `/opt/stacks/conarmas/`
- Rede do Swarm: `network_swarm_public`
- Porta interna: `80` (Nginx)
- Porta externa: `443` (HTTPS via Traefik)

---

**Boa sorte com o deploy! 🚀**

Se precisar de ajuda, consulte o [GUIA-COMPLETO.md](GUIA-COMPLETO.md)
