# OTG Story System — Creative OS

App full-stack (Next.js + TypeScript) para gerar pacotes de stories de restaurantes,
com dados e arquivos persistidos no Supabase e geração via OpenAI.

## Arquitetura

- **`web/`** — app Next.js (App Router). Frontend + API (route handlers) no mesmo projeto.
- **Supabase** — Postgres (clientes, pacotes, frames, metadados de assets) + Storage (imagens e manuais no bucket `client-assets`).
- **OpenAI** — geração dos frames (uma chamada estruturada que substituiu o antigo pipeline de 9 agentes) e edição de imagem (`gpt-image`).
- **Google Drive** (opcional) — importação de mídias via `googleapis` + service account.

Pensado para deploy no **Vercel** (um único projeto).

## Estrutura de `web/`

- `app/` — páginas (`/` estúdio, `/clientes`, `/clientes/[id]`) e rotas de API em `app/api/`.
- `lib/` — acesso a dados (`lib/data/*`), Supabase (`lib/supabase/*`), Storage, geração (`lib/generation/frames.ts` e `image.ts`), Drive e análise de manual.

## Modelo de dados (Supabase)

- `clients` — restaurante, marca, paleta, tipografia, regras operacionais, manual.
- `assets` — arquivos (role `manual` | `media` | `ai`) com caminho no Storage e metadados.
- `packages` — pacotes gerados por cliente (objetivo, formato, custo, scores, rationale).
- `frames` — telas de cada pacote (headline, body, cta, layout, mídia e imagem IA).

## Rodar localmente

Pré-requisito: Node.js 20+.

```bash
cd web
cp .env.example .env.local   # preencha as chaves do Supabase e OpenAI
npm install
npm run dev
```

Abra `http://localhost:3000`.

No Mac, alternativamente dê dois cliques em `ABRIR_MVP.command`.

### Variáveis de ambiente

Veja `web/.env.example`. Necessárias: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
Opcionais: `OPENAI_IMAGE_MODEL`, `OPENAI_TEXT_MODEL`, `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Fluxo de uso

1. **Clientes** (`/clientes`) — cadastre/edite o restaurante: marca, regras operacionais,
   manual (PDF/texto, com extração de cores/fontes/tom) e mídias reais (upload ou Google Drive).
2. **Estúdio** (`/`) — escolha o cliente, defina objetivo/tema/chamada e gere o pacote.
   Cada frame pode receber uma imagem gerada com IA a partir das mídias reais.
3. Histórico e custo por cliente ficam salvos no banco.

## Deploy no Vercel (resumo)

1. Importar o repositório no Vercel apontando o root para `web/`.
2. Configurar as variáveis de ambiente (as mesmas do `.env.local`).
3. As rotas de geração já definem `maxDuration` adequado para a edição de imagem.

> Atenção: rotacione qualquer chave que tenha sido exposta antes de ir a produção.

## Google Drive (opcional)

Defina `GOOGLE_SERVICE_ACCOUNT_JSON` com o JSON da service account (em uma linha) e
compartilhe as pastas dos clientes com o e-mail dessa conta. Detalhes em
`docs/google-drive-setup.md`.
