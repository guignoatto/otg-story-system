# OTG Story System

Sistema de geracao de stories para clientes da OTG Midia com pipeline de 9 agentes:

1. Briefing
2. Brand Guard
3. Trend & References
4. Content Strategy
5. Copywriting
6. Media Curator
7. Art Direction
8. Creative Generator
9. QA & Performance

## Estrutura

- `backend/`: API FastAPI + orquestracao multiagente
- `frontend/`: interface web React + Vite com fluxo de 3 cliques
- `frontend/legacy/`: copia da versao vanilla anterior, mantida como seguranca da refatoracao

## MVP atual (foco operacional OTG)

Fluxo em 3 cliques:

1. Preencher cliente + campanha + manual de marca
2. Clicar em `Gerar stories`
3. `Aprovar pacote` e `Exportar JSON`

Recursos prontos:

- Geracao de pacote com 3-10 frames
- Regeneracao de frame individual (sem perder o resto)
- Historico por cliente
- Resumo de uso e custo estimado por cliente
- Upload de manual de marca em PDF/doc/imagem
- Upload de fotos e videos reais do restaurante
- Importacao de fotos e videos por Google Drive do cliente
- Escolha entre formato Stories e Carrossel

## APIs recomendadas para producao

1. OpenAI Responses API para orquestracao e copy/estrategia
2. OpenAI Image Generation (`gpt-image-2`) para criativos
3. Meta Graph/Marketing API para insights e distribuicao de campanhas
4. Notion API + Make para fluxo operacional interno

## Contrato de endpoints (backend OTG)

Base URL local: `http://127.0.0.1:8000`

- `POST /v1/generations`
  - cria job de geracao por cliente
  - entrada: `client_id` + `campaign`
  - saida: `job_id`, status, custo estimado e resultado quando concluido

- `POST /v1/assets/upload`
  - recebe manual de marca, fotos e videos reais
  - entrada: `client_id`, `role` (`manual` ou `media`) e arquivos
  - saida: lista dos arquivos recebidos para usar na geracao

- `GET /v1/drive/status`
  - mostra se a Google Drive API privada esta configurada
  - quando nao estiver, o sistema usa apenas fallback de pasta publica

- `POST /v1/assets/import-drive`
  - importa imagens/videos da pasta do Google Drive do cliente
  - com service account configurada, funciona com pastas privadas compartilhadas
  - sem service account, tenta apenas pasta publica/compartilhavel por link

- `POST /v1/drive/catalog`
  - lista imagens/videos da pasta do Google Drive sem baixar os arquivos
  - exige Google Drive API privada com service account
  - retorna nome, tipo, tamanho, data, miniatura/link e ID do arquivo

- `POST /v1/assets/import-drive-selected`
  - importa apenas os arquivos do Drive selecionados pelo ID
  - evita baixar a pasta inteira do cliente

- `GET /v1/generations/{job_id}`
  - consulta status de uma geracao

- `GET /v1/clients/{client_id}/generations`
  - lista historico de jobs do cliente

- `GET /v1/clients/{client_id}/usage`
  - resumo de uso/custo estimado do cliente

- `POST /generate`
  - endpoint legado do MVP (sincrono) para testes rapidos

## Exemplo rapido de criacao de job

```bash
curl -X POST http://127.0.0.1:8000/v1/generations \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "churrascaria-santana",
    "campaign": {
      "restaurant_name": "Churrascaria Santana",
      "objective": "vendas",
      "offer": "Rodizio + sobremesa gratis",
      "cta": "Clique e chame no WhatsApp",
      "story_type": "promocao",
      "frames": 4,
      "manual": {
        "brand_name": "Churrascaria Santana",
        "tone_of_voice": "acolhedor e direto",
        "color_palette": ["#F97316", "#111827", "#FFFFFF"],
        "typography": ["Poppins", "Montserrat"],
        "city": "Porto Alegre",
        "neighborhood": "Moinhos de Vento"
      }
    }
  }'
```

## Como abrir sem entender programacao

Pre-requisito para a nova interface React: instalar Node.js, que ja vem com `npm`.

Opcoes:

- Pelo site: `https://nodejs.org`
- Pelo Homebrew: `brew install node`

No Mac, de dois cliques no arquivo:

`ABRIR_MVP.command`

Ele prepara o sistema, liga o backend, abre a tela no navegador e deixa tudo rodando.

Na primeira vez ele pode demorar um pouco porque instala as dependencias.

Na tela, envie primeiro o manual de marca e as fotos/videos. Depois clique em `Gerar stories`.

Para conectar pastas privadas do Google Drive, siga:

`docs/google-drive-setup.md`

Resumo rapido: copie `backend/.env.example` para `backend/.env`, preencha `GOOGLE_APPLICATION_CREDENTIALS` com o caminho do JSON da service account e compartilhe as pastas dos clientes com o e-mail dessa service account.

## Como rodar manualmente

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra `http://127.0.0.1:5500`.

## Proxima fase (apos MVP)

1. Fila assincrona (Redis + worker)
2. Persistencia real (PostgreSQL)
3. Integracao real com OpenAI para copy + imagem
4. Integracao com Notion/Make/Reportei
5. Aprendizado com performance por criativo
