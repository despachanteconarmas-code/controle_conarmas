# 🖥️ Preparar VPS - Criar Estrutura de Pastas

Este guia mostra os comandos para preparar a VPS **ANTES** de enviar os arquivos via SFTP.

---

## 📁 Passo 1: Conectar na VPS via SSH

```bash
ssh seu-usuario@IP-DA-VPS
```

Exemplo:
```bash
ssh root@123.45.67.89
```

---

## 📂 Passo 2: Criar Estrutura de Pastas

### Estrutura Padrão em /opt/stacks/ (Recomendado)

```bash
# Criar pasta principal do projeto em /opt/stacks/
sudo mkdir -p /opt/stacks/conarmas

# Criar subpasta para os arquivos buildados
sudo mkdir -p /opt/stacks/conarmas/dist

# Dar permissões corretas ao seu usuário
sudo chown -R $USER:$USER /opt/stacks/conarmas
sudo chmod -R 755 /opt/stacks/conarmas

# Verificar se foi criado
ls -la /opt/stacks/conarmas/
```

**Resultado esperado:**
```
drwxr-xr-x 3 seu-usuario seu-usuario 4096 data hora .
drwxr-xr-x 3 root        root        4096 data hora ..
drwxr-xr-x 2 seu-usuario seu-usuario 4096 data hora dist
```

---

## 📋 Estrutura Final

Após executar os comandos, você terá:

```
/opt/stacks/conarmas/
├── dist/              ← Aqui vão os arquivos buildados (via SFTP)
├── nginx.conf         ← Arquivo de configuração (via SFTP)
└── Dockerfile         ← Dockerfile (via SFTP)
```

---

## ✅ Passo 4: Verificar Info da VPS

### 4.1: Descobrir hostname (para usar no Portainer)

```bash
hostname
```

**Anote o resultado:** `_____________________`

### 4.2: Verificar caminho atual

```bash
pwd
```

### 4.3: Verificar Docker instalado

```bash
docker --version
docker ps
```

Deve mostrar versão do Docker e containers rodando.

---

## 📤 Próximos Passos

Agora que a estrutura está criada na VPS, você pode:

1. **Sair do SSH** (digite `exit`)
2. **No seu PC: Fazer build**
   ```bash
   npm run build
   ```
3. **Enviar via SFTP** os arquivos para as pastas criadas

---

## 📦 Mapeamento de Arquivos para SFTP

| Arquivo Local | Destino na VPS |
|---------------|----------------|
| `dist/*` (todos os arquivos) | `/opt/stacks/conarmas/dist/` |
| `nginx.conf` | `/opt/stacks/conarmas/nginx.conf` |
| `Dockerfile.production` | `/opt/stacks/conarmas/Dockerfile` |

---

## 🖥️ Comandos Úteis SSH

### Ver o que tem na pasta:
```bash
ls -la /opt/stacks/conarmas/
```

### Ver conteúdo da pasta dist:
```bash
ls -la /opt/stacks/conarmas/dist/
```

### Verificar se arquivo existe:
```bash
cat /opt/stacks/conarmas/nginx.conf
```

### Remover tudo e começar de novo:
```bash
sudo rm -rf /opt/stacks/conarmas
```
⚠️ **Cuidado!** Isso apaga tudo!

### Verificar espaço em disco:
```bash
df -h
```

### Verificar uso de memória:
```bash
free -h
```

---

## 📋 Checklist de Preparação

- [ ] Conectado na VPS via SSH
- [ ] Pasta principal criada: `/opt/stacks/conarmas/`
- [ ] Pasta `dist/` criada
- [ ] Permissões configuradas
- [ ] Hostname da VPS anotado
- [ ] Docker funcionando (`docker ps`)
- [ ] Espaço em disco suficiente (`df -h`)

---

## ➡️ Próximo Passo

Agora siga o guia: **[DEPLOY-SIMPLES.md](DEPLOY-SIMPLES.md)** a partir do **Passo 2** (Enviar Arquivos via SFTP)

---

## 💡 Dicas

### Usar variável de ambiente para não digitar o caminho completo:

```bash
# Adicionar ao ~/.bashrc ou ~/.bash_profile
export CONARMAS_PATH="/opt/stacks/conarmas"

# Depois pode usar:
cd $CONARMAS_PATH
ls -la $CONARMAS_PATH
```

### Criar alias útil:

```bash
# Adicionar ao ~/.bashrc
alias cdconarmas="cd /opt/stacks/conarmas"
alias logsconarmas="docker service logs -f conarmas_os_manager"

# Depois pode usar:
cdconarmas
logsconarmas
```

Para aplicar:
```bash
source ~/.bashrc
```

---

**Agora sua VPS está preparada para receber os arquivos! 🚀**
