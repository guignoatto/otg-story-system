# Regras globais para agentes de criativos gastronomicos

Este arquivo deve orientar o fluxo entre agentes. Ele existe para impedir que uma boa imagem passe se a estrategia, operacao ou marca estiver errada.

## Ordem recomendada dos agentes

1. Briefing Agent: interpreta o pedido humano e separa objetivo, formato, produto, operacao e restricoes.
2. Brand Manual Agent: carrega o manual certo do cliente e define o que e regra firme, o que e suposicao e o que falta confirmar.
3. Operations Guard Agent: bloqueia ideias que contradizem horario, canal, tipo de atendimento ou produto do restaurante.
4. Media Curator Agent: escolhe fotos reais coerentes e evita repetir imagem parecida no pacote.
5. Content Strategy Agent: transforma objetivo em narrativa organica, nao em anuncio.
6. Copywriter Agent: escreve textos curtos, mobile-first e sem CTA errado.
7. Art Director Agent: define composicao, safe area, hierarquia visual e estilo.
8. Brand Guardian Agent: barra logo distorcido, paleta errada, copy proibida e UI falsa.
9. Preflight QA Agent: revisa antes de gastar credito de imagem.
10. Final QA Agent: revisa imagem gerada e reprova se a IA distorceu logo, prato, texto ou marca.

## Regras de ouro

- Foto real do cliente e sempre a base principal.
- Manual oficial vence manual v1.
- Operacao real vence ideia criativa.
- Story organico nao e anuncio de clique.
- Logo nunca deve ser gerado por IA.
- Texto final deve ser curto o suficiente para ler em 2 segundos.
- Se a IA erra texto ou logo, a imagem deve ser reprovada, mesmo que esteja bonita.

## CTAs permitidos para Stories organicos

Usar com moderacao:

- "responde aqui"
- "manda para quem iria contigo"
- "qual voce escolheria?"
- "com quem voce dividiria?"
- "hoje deu vontade?"
- "marca mentalmente quem ama isso"

## CTAs proibidos para Stories organicos

- "chame no WhatsApp"
- "clique no botao"
- "compre agora"
- "peca agora"
- "salve este story"
- "guarde esse nome"
- "arraste para cima"
- qualquer botao falso
- qualquer enquete/quiz desenhado como se fosse sticker nativo

## Regras de operacao

O Operations Guard Agent deve procurar contradicoes antes da arte:

- restaurante apenas noite: nao falar em almoco;
- restaurante apenas delivery: nao sugerir mesa/salao/reserva;
- restaurante presencial: nao focar em delivery sem briefing;
- rodizio: nao inventar preco nem disponibilidade;
- campanha de awareness: nao usar copy de venda direta;
- campanha de engajamento: nao forcar WhatsApp;
- campanha de desejo/vendas organicas: criar vontade, nao botao.

## Regras de logo

- Nao pedir "logo no topo" para o modelo de imagem se o modelo estiver gerando tudo em uma imagem unica.
- Nao pedir para a IA "melhorar", "refazer", "bordar", "aplicar" ou "estilizar" o logo.
- Se houver logo fotografado em embalagem, preservar como parte da foto.
- Se o logo estiver muito visivel e a IA tiver risco de distorcao, escolher outra foto ou cortar a area.
- Aplicar logo oficial depois, em camada separada, com arquivo PNG/SVG.

## Preflight antes de gerar imagem

Antes de gastar credito, o sistema deve verificar:

- cliente selecionado tem manual carregado?
- objetivo da campanha esta claro?
- operacao permite a ideia?
- foto escolhida e coerente?
- copy nao tem termos proibidos?
- prompt nao manda a IA recriar logo?
- pacote varia composicao e imagem?
- texto estimado cabe no story?

## QA apos gerar imagem

Reprovar automaticamente se:

- logo mudou, mesmo que pouco;
- texto ficou escrito errado ou estranho;
- prato ficou artificial/deformado;
- marca na embalagem foi alterada;
- CTA proibido apareceu;
- existe botao/sticker falso;
- criativo contradiz operacao do cliente;
- todas as imagens parecem iguais.

## Formato de resposta dos agentes

Cada agente deve retornar:

```json
{
  "status": "approved | blocked | needs_review",
  "reason": "motivo curto",
  "risks": ["risco 1", "risco 2"],
  "recommendations": ["acao 1", "acao 2"]
}
```

## Nivel de severidade

- P0: erro grave de marca, logo distorcido, promessa falsa, informacao operacional errada. Bloquear.
- P1: CTA errado, copy com cara de anuncio, texto longo demais. Corrigir antes de gerar.
- P2: paleta ou composicao fraca. Pode gerar se o restante estiver correto, mas recomendar ajuste.
- P3: detalhe estetico opcional. Nao bloquear sozinho.
