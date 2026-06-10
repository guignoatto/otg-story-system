#!/bin/zsh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "Ligando o MVP da OTG..."
echo ""

cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  echo "Preparando o ambiente pela primeira vez..."
  python3 -m venv .venv
fi

source .venv/bin/activate
python3 -m pip install -r requirements.txt

if [ -f "$BACKEND_DIR/.env" ]; then
  echo "Carregando variaveis do backend/.env..."
  set -a
  source "$BACKEND_DIR/.env"
  set +a
fi

echo "Iniciando o motor de geracao..."
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Abrindo a tela do produto..."
cd "$FRONTEND_DIR"
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "Nao encontrei npm neste Mac."
  echo "Instale o Node.js pelo site https://nodejs.org ou com Homebrew: brew install node"
  echo "Depois rode este arquivo novamente."
  kill $BACKEND_PID
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias do frontend React..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!

sleep 2
open "http://127.0.0.1:5500"

echo ""
echo "MVP aberto no navegador."
echo "Pode fechar esta janela quando terminar de usar."

wait $BACKEND_PID $FRONTEND_PID
