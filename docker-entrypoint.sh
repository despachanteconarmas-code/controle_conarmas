#!/bin/sh
set -e

# Script de inicialização do container
echo "Iniciando Conarmas OS Manager..."

# Verificar se os arquivos existem
if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "ERRO: Arquivos de build não encontrados!"
    exit 1
fi

echo "Arquivos verificados com sucesso!"
echo "Iniciando Nginx..."

# Executar comando passado como argumento
exec "$@"
