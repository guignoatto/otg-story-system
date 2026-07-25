# Brand manuals v1 - clientes OTG

Este pacote substitui a ideia de "manual sintetico generico" por guias operacionais de marca para IA. O objetivo nao e fingir que existe um brandbook oficial: e dar aos agentes do sistema regras fortes o suficiente para gerar Stories organicos sem descaracterizar cada restaurante.

Data da montagem inicial: 2026-06-22. Atualizado com Bar i Bar em 2026-07-25.

## Regra principal

Quando um restaurante nao tem manual oficial, estes arquivos devem ser tratados como manual v1 de trabalho, nao como fonte final de verdade. O agente guardiao da marca deve bloquear qualquer criativo que:

- recrie, redesenhe, complete, estilize ou invente logo;
- invente preco, endereco, horario, telefone, unidade, promocao ou beneficio;
- use CTA de anuncio em Story organico, como "chame no WhatsApp", "clique", "peca agora" ou botao falso;
- desenhe enquete, quiz, caixa de pergunta, link sticker ou UI falsa do Instagram dentro da imagem;
- use o objetivo interno da campanha como copy final, por exemplo "vender";
- contradiga operacao conhecida do restaurante.

## Como usar no sistema

1. Use o manual oficial quando existir.
2. Se nao houver manual oficial, use o manual v1 deste pacote.
3. Use os arquivos em `_logos/` apenas como referencia visual, exceto quando o inventario marcar como logo de site oficial.
4. Nunca peca para o modelo de imagem gerar logotipo. O logo deve ser aplicado como camada controlada pelo sistema, usando arquivo oficial em PNG/SVG quando o cliente fornecer.
5. Ao gerar imagem com IA, priorize foto real do cliente e preserve marcas que aparecem na foto como fotografia, sem pedir para corrigir ou melhorar.
6. Quando houver baixa confianca, o sistema deve exigir briefing humano antes de gerar.

## Escala de confianca

- Alta: informacoes confirmadas em site oficial ou manual oficial.
- Media: informacoes confirmadas por Instagram publico, Linktree ou fontes locais consistentes.
- Baixa: ha risco de homonimo, mudanca operacional ou falta de ativo oficial.

## Arquivos

| Cliente | Manual | Confianca | Logo/Referencia |
| --- | --- | --- | --- |
| Churrascaria Santana | `churrascaria-santana.md` | Media | Instagram profile reference |
| Tommatti's | `tommattis.md` | Alta | Site oficial + Instagram profile reference |
| Picanha no Disco | `picanha-no-disco.md` | Media | Instagram profile reference |
| Pizzaria Venus | `pizzaria-venus.md` | Media | Instagram profile reference |
| Fornellone | `fornellone.md` | Media | Instagram profile reference |
| Frango na Brazza | `frango-na-brazza.md` | Media | Instagram profile reference confirmed by OTG |
| Lima's Pizzaria | `limas-pizzaria.md` | Alta | Instagram profile reference + site oficial sem arquivo claro de logo |
| Galeteria Bella Mamma | `bella-mama.md` | Media | Instagram profile reference |
| Eleve | `eleve.md` | Media | Instagram profile reference confirmed by OTG |
| Bar i Bar | `bari-bar-411.md` | Media | Instagram profile reference confirmed by OTG |

## Arquivos de apoio

- `logo-inventory.md`: lista de logos/referencias visuais e como usar cada um.
- `source-map.md`: fontes publicas usadas para montar os manuais.
- `_logos/logo-reference-sheet.png`: prancha visual com as referencias baixadas.
