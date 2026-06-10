#!/bin/zsh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"

echo "Ligando o Creative OS da OTG..."
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "Nao encontrei npm neste Mac."
  echo "Instale o Node.js pelo site https://nodejs.org ou com Homebrew: brew install node"
  echo "Depois rode este arquivo novamente."
  exit 1
fi

cd "$WEB_DIR"

if [ ! -f ".env.local" ]; then
  echo "Falta o arquivo web/.env.local com as chaves do Supabase e da OpenAI."
  echo "Copie web/.env.example para web/.env.local e preencha os valores."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias (primeira vez pode demorar)..."
  npm install
fi

echo "Iniciando o app..."
npm run dev &
WEB_PID=$!

sleep 3
open "http://localhost:3000"

echo ""
echo "Creative OS aberto no navegador."
echo "Pode fechar esta janela quando terminar de usar."

wait $WEB_PID
