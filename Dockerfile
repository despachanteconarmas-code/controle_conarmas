# Estágio 1: Build
FROM node:20-alpine AS builder

# Instalar dependências do sistema necessárias
RUN apk add --no-cache libc6-compat

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
# Vem antes do código-fonte para aproveitar o cache do Docker:
# só reinstala quando package.json/package-lock.json mudarem
COPY package.json package-lock.json ./

# Instalar dependências (inclui devDependencies: vite e typescript
# são necessários para o build)
RUN npm ci

# Copiar código fonte
COPY . .

# Build args para variáveis de ambiente (serão passadas no build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Definir variáveis de ambiente para o build
# ATENÇÃO: o Vite lê as VITE_* em tempo de build e embute os valores
# no bundle. Definir isso no runtime do container não tem efeito.
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV NODE_ENV=production

RUN npm run build

# Estágio 2: Runtime com Nginx
FROM nginx:alpine

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar script de inicialização
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Usar o script de entrada personalizado
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
