import type { BrandContext, ClientProfile } from "../types";

export const FRANGO_ISSUE_CODES = [
  "FORBIDDEN_VISIBLE_TEXT",
  "FORBIDDEN_FIRE_BBQ_VISUAL",
  "INVENTED_SENSORY_CLAIM",
  "THIRD_PARTY_BRAND_FOCUS",
  "CTA_FAKE_UI",
  "OFF_BRAND_FOOD_CONTEXT",
] as const;

export type FrangoIssueCode = (typeof FRANGO_ISSUE_CODES)[number];

export type FrangoSafetyRisk = {
  code: FrangoIssueCode;
  label: string;
  recommendation: string;
};

const FRANGO_FORBIDDEN_REPLACEMENTS: [RegExp, string][] = [
  [/\bque\s+chama\s+sua\s+fome\b/gi, "que desperta sua fome"],
  [/\bchama\s+sua\s+fome\b/gi, "desperta sua fome"],
  [/\bfrango\s+assad(o|a|os|as)\b/gi, "frango caseiro"],
  [/\bassad(o|a|os|as)\b/gi, "caseiro"],
  [/\bbrasa(s)?\b/gi, "comida caseira"],
  [/\bchurrasc(o|aria|ueira)\b/gi, "comida caseira"],
  [/\bsteakhouse\b/gi, "restaurante caseiro"],
  [/\bgrelhad(o|a|os|as)\b/gi, "bem servido"],
  [/\bfogo\b/gi, "sabor"],
  [/\bchama(s)?\b/gi, "sabor"],
  [/\bfa[ií]sca(s)?\b/gi, "detalhes"],
  [/\blabareda(s)?\b/gi, "detalhes"],
  [/\bcarv[aã]o\b/gi, "mesa"],
  [/\bgrill(ed)?\b/gi, "homemade"],
  [/\bbarbecue\b/gi, "homemade food"],
  [/\bflame(s)?\b/gi, "warmth"],
  [/\bspark(s)?\b/gi, "details"],
  [/\bember(s)?\b/gi, "details"],
  [/\bcharcoal\b/gi, "table"],
  [/\bbrush\b/gi, "clean"],
  [/\bgrunge\b/gi, "clean"],
  [/\bfast-?food\b/gi, "everyday food"],
  [/\bcartaz\s+agressivo\b/gi, "composição editorial limpa"],
  [/\bcta\s+gigante\b/gi, "small plain caption"],
  [/rodap[eé]/gi, "central safe area"],
  [/\b(bot[aã]o|pill|badge|sticker|enquete|quiz)\b/gi, "plain text"],
  [/\bwhats(app)?\b/gi, "direct message"],
  [/\bzap\b/gi, "direct message"],
  [/\bsalv(e|ar|a)\b/gi, "envie"],
  [/\bguard(e|ar|a)\b/gi, "envie"],
  [/\b(sprite|coca-?cola|coca|fanta|pepsi)\b/gi, "bebida ao fundo"],
  [/\brefrigerante(s)?\s+em\s+destaque\b/gi, "bebida pequena ao fundo"],
  [/\blata(s)?\s+em\s+destaque\b/gi, "lata pequena ao fundo"],
  [/\bem destaque\b/gi, "em segundo plano"],
  [/\bdourado perfeito\b/gi, "almoço bem servido"],
  [/\bderrete\s+na\s+boca\b/gi, "bem servido"],
  [/\bfrango\s+suculent(o|a|os|as)\b/gi, "frango caseiro"],
  [/\bsuculent(o|a|os|as)\b/gi, "caseiro"],
  [/\bsucul[êe]ncia\b/gi, "comida caseira"],
  [/\bjuicy\b/gi, "homemade"],
  [/\bacolhimento no prato\b/gi, "comida caseira no prato"],
  [/\bcroc[âa]ncia\b/gi, "sabor"],
  [/\bcrocante(s)?\b/gi, "saboroso"],
];

const FRANGO_FIRE_BBQ_PATTERNS = [
  /\bbrasa(s)?\b/i,
  /\bfogo\b/i,
  /\bchama(s)?\b/i,
  /\bfa[ií]sca(s)?\b/i,
  /\blabareda(s)?\b/i,
  /\bcarv[aã]o\b/i,
  /\bchurrasc(o|aria|ueira)\b/i,
  /\bsteakhouse\b/i,
  /\bgrelhad(o|a|os|as)\b/i,
  /\bfrango\s+assad(o|a|os|as)\b/i,
  /\bcroc[âa]ncia\b/i,
  /\bcrocante(s)?\b/i,
  /\bbrush\b/i,
  /\bgrunge\b/i,
  /\bfast-?food\b/i,
  /\bcartaz\s+agressivo\b/i,
];

const INVENTED_SENSORY_CLAIM_PATTERNS = [
  /\bfrango\s+suculent(o|a|os|as)\b/i,
  /\bsuculent(o|a|os|as)\b/i,
  /\bsucul[êe]ncia\b/i,
  /\bjuicy\b/i,
  /\bdourado\s+perfeito\b/i,
  /\bderrete\s+na\s+boca\b/i,
  /\bcroc[âa]ncia\b/i,
  /\bcrocante(s)?\b/i,
];

const THIRD_PARTY_PRESENCE_PATTERNS = [
  /\brefrigerante(s)?\b/i,
  /\blata(s)?\b/i,
  /\bgarrafa(s)?\b/i,
  /\bcoca-?cola\b/i,
  /\bcoca\b/i,
  /\bfanta\b/i,
  /\bsprite\b/i,
  /\bpepsi\b/i,
  /\br[oó]tulo\b/i,
  /\bmarca\s+de\s+terceir(o|os|a|as)\b/i,
  /\bthird-?party\b/i,
];

const THIRD_PARTY_FOCUS_PATTERNS = [
  /\bprotagonista\b/i,
  /\bfoco\b/i,
  /\bem\s+destaque\b/i,
  /\bdestacad(o|a|os|as)\b/i,
  /\bdominante\b/i,
  /\bprincipal\b/i,
  /\bhero\b/i,
  /\bcentro\b/i,
  /\bcentral\b/i,
  /\bprimeiro\s+plano\b/i,
  /\bgrande\s+demais\b/i,
  /\bmaior\s+elemento\b/i,
  /\bcompete\s+com\s+a\s+comida\b/i,
  /\bcompetindo\s+com\s+a\s+comida\b/i,
];

const CTA_FAKE_UI_PATTERNS = [
  /\bbot[aã]o\b/i,
  /\bpill\b/i,
  /\bbadge\b/i,
  /\bsticker\b/i,
  /\benquete\b/i,
  /\bquiz\b/i,
  /\bwhats(app)?\b/i,
  /\bzap\b/i,
  /\btelegram\b/i,
  /\bbarra\s+inferior\b/i,
  /\bui\s+falsa\b/i,
];

const FRANGO_ALLOWED_CONTEXT_PATTERNS = [
  /\bcomida\s+caseira\b/i,
  /\balmo[cç]o\b/i,
  /\bmarmitex\b/i,
  /\bprato\s+feito\b/i,
  /\bdelivery\b/i,
  /\bfrango\s+caseiro\b/i,
];

const ISSUE_DETAILS: Record<FrangoIssueCode, FrangoSafetyRisk> = {
  FORBIDDEN_VISIBLE_TEXT: {
    code: "FORBIDDEN_VISIBLE_TEXT",
    label: "Texto contém termo proibido para Frango na Brazza.",
    recommendation: "Limpar headline, apoio, CTA e qualquer legenda visível antes de gerar novamente.",
  },
  FORBIDDEN_FIRE_BBQ_VISUAL: {
    code: "FORBIDDEN_FIRE_BBQ_VISUAL",
    label: "Direção visual puxou brasa, fogo, churrasco, grelhado ou crocância.",
    recommendation: "Regenerar com direção de comida caseira, almoço, marmitex ou prato feito.",
  },
  INVENTED_SENSORY_CLAIM: {
    code: "INVENTED_SENSORY_CLAIM",
    label: "Texto criou promessa sensorial de frango suculento, crocante ou dourado.",
    recommendation: "Usar texto neutro e operacional: comida caseira, almoço, marmitex ou prato feito.",
  },
  THIRD_PARTY_BRAND_FOCUS: {
    code: "THIRD_PARTY_BRAND_FOCUS",
    label: "Refrigerante, lata ou marca de terceiro virou protagonista.",
    recommendation: "Trocar a foto base ou cortar/manter esse elemento pequeno e ao fundo.",
  },
  CTA_FAKE_UI: {
    code: "CTA_FAKE_UI",
    label: "CTA apareceu como botão, sticker, badge, pill ou interface falsa.",
    recommendation: "Usar CTA apenas como texto editorial pequeno dentro da área segura.",
  },
  OFF_BRAND_FOOD_CONTEXT: {
    code: "OFF_BRAND_FOOD_CONTEXT",
    label: "A imagem saiu do território de comida caseira/almoço/marmitex.",
    recommendation: "Reforçar prato feito, marmitex, delivery e refeição cotidiana como tema principal.",
  },
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function isFrangoNaBrazzaClient(client: ClientProfile): boolean {
  const text = [
    client.slug,
    client.name,
    client.instagram,
    client.notes,
    client.brand_manual_summary,
    client.synthetic_manual,
  ]
    .join(" ")
    .toLowerCase();
  return text.includes("frango na brazza") || text.includes("frangonabrazza");
}

export function isFrangoBrandContext(brandContext: BrandContext): boolean {
  const text = [
    brandContext.tone_rules.join(" "),
    brandContext.required_elements.join(" "),
    brandContext.visual_constraints.join(" "),
    brandContext.cta_style,
  ]
    .join(" ")
    .toLowerCase();
  return text.includes("frangonabrazza") || (text.includes("marmitex") && text.includes("comida caseira"));
}

export function sanitizeFrangoText(value: string): string {
  return FRANGO_FORBIDDEN_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function hasFrangoFireBbqRisk(value: string): boolean {
  return FRANGO_FIRE_BBQ_PATTERNS.some((pattern) => pattern.test(value));
}

export function hasInventedSensoryClaimRisk(value: string): boolean {
  return INVENTED_SENSORY_CLAIM_PATTERNS.some((pattern) => pattern.test(value));
}

export function hasThirdPartyBrandRisk(value: string): boolean {
  return (
    THIRD_PARTY_PRESENCE_PATTERNS.some((pattern) => pattern.test(value)) &&
    THIRD_PARTY_FOCUS_PATTERNS.some((pattern) => pattern.test(value))
  );
}

export function hasFakeCtaRisk(value: string): boolean {
  return CTA_FAKE_UI_PATTERNS.some((pattern) => pattern.test(value));
}

export function buildFrangoSafeVisualDirection(original = ""): string {
  const lower = original.toLowerCase();
  const hero = lower.includes("marmitex")
    ? "marmitex de frango caseiro"
    : lower.includes("prato")
      ? "prato feito caseiro"
      : "comida caseira bem servida";
  const thirdPartyNote = hasThirdPartyBrandRisk(original)
    ? "Se houver lata, refrigerante ou marca de terceiro como foco, recompor para que a comida volte a ser protagonista."
    : "Lata ou refrigerante incidental pode permanecer como parte da foto real, desde que secundário e sem parecer parceria.";

  return [
    `Composição editorial limpa com ${hero} como protagonista.`,
    "Foto real de almoço cotidiano, delivery ou marmitex, com mesa simples e apetite natural.",
    "Usar preto, amarelo e vermelho apenas em detalhes gráficos discretos, com visual editorial discreto.",
    "Luz natural ou quente suave, contraste moderado, margens generosas e texto curto em área segura.",
    "Priorizar composição foto-first: prato grande, fundo simples, tipografia pequena ou média e sem headline gigante empilhada.",
    thirdPartyNote,
    "Se houver placa, cardápio, horário ou texto no fundo, desfocar, escurecer ou cortar para que não fique legível.",
    "Estética limpa, cotidiana e editorial, com textura visual leve, linguagem de foto real e CTA apenas como texto pequeno.",
  ].join(" ");
}

export function frangoPromptSafetyBlock(): string {
  return [
    "FRANGO NA BRAZZA SAFETY LOCK:",
    "The concept must be comida caseira, lunch, marmitex, prato feito or delivery routine.",
    "Never depict or imply fire, flames, embers, charcoal, grill, barbecue, steakhouse, grilled chicken, roasted chicken, crispy/crunchy/juicy/succulent claims, sparks, aggressive fast-food poster or grunge brush style.",
    "Do not render visible text containing these ideas: brasa, fogo, churrasco, churrascaria, grelhado, frango assado, frango suculento, suculento, suculência, derrete na boca, crocante or crocância.",
    "The brand name Frango na Brazza may exist in the photographed environment; do not reinterpret the brand name as a fire, barbecue or roasted-chicken claim.",
    "A visible soda can or bottle is allowed when it is incidental, secondary and part of the real source photo. Do not make it the protagonist, enlarge it, center it, clean up its label, imply a partnership, or let it compete with the food. Prefer cropping it partially out, pushing it to the edge, softening it, or making it smaller than 5% of the canvas.",
    "Readable background text such as schedules, wall plaques, menus or signs should be cropped, blurred or darkened unless it is one of the approved text strings.",
    "Do not create poster typography: no giant stacked headline, no underlined slogan, no bursts, no decorative marks around the text. Use a photo-first editorial story with minimal plain text.",
    "CTA must be plain small editorial text only, never a button, pill, badge, sticker, icon, WhatsApp/Telegram UI or bottom bar.",
  ].join(" ");
}

export function classifyFrangoPromptRisks(value: string): FrangoSafetyRisk[] {
  const codes: FrangoIssueCode[] = [];
  if (hasFrangoFireBbqRisk(value)) codes.push("FORBIDDEN_FIRE_BBQ_VISUAL", "FORBIDDEN_VISIBLE_TEXT");
  if (hasInventedSensoryClaimRisk(value)) codes.push("INVENTED_SENSORY_CLAIM", "FORBIDDEN_VISIBLE_TEXT");
  if (hasThirdPartyBrandRisk(value)) codes.push("THIRD_PARTY_BRAND_FOCUS");
  if (hasFakeCtaRisk(value)) codes.push("CTA_FAKE_UI");
  return unique(codes).map((code) => ISSUE_DETAILS[code]);
}

export function classifyFrangoQaIssues(issues: string[] = [], issueCodes: string[] = []): FrangoIssueCode[] {
  const combined = [...issues, ...issueCodes].join(" ").toLowerCase();
  const codes: FrangoIssueCode[] = [];

  for (const code of FRANGO_ISSUE_CODES) {
    if (combined.includes(code.toLowerCase())) codes.push(code);
  }
  if (/(texto|vis[íi]vel|headline|legenda).*(brasa|fogo|churrasc|grelhad|assad|croc)/i.test(combined)) {
    codes.push("FORBIDDEN_VISIBLE_TEXT");
  }
  if (/(texto|vis[íi]vel|headline|legenda).*(suculent|sucul[êe]ncia|juicy|dourado perfeito|derrete na boca)/i.test(combined)) {
    codes.push("FORBIDDEN_VISIBLE_TEXT", "INVENTED_SENSORY_CLAIM");
  }
  if (/(brasa|fogo|chama|fa[ií]sca|labareda|carv[aã]o|churrasc|grelhad|assad|croc|fast-?food|cartaz|grunge)/i.test(combined)) {
    codes.push("FORBIDDEN_FIRE_BBQ_VISUAL");
  }
  if (/(suculent|sucul[êe]ncia|juicy|dourado perfeito|derrete na boca)/i.test(combined)) {
    codes.push("INVENTED_SENSORY_CLAIM");
  }
  if (
    /(refrigerante|lata|garrafa|coca|fanta|sprite|pepsi|r[oó]tulo|marca de terceiro|third-party)/i.test(combined) &&
    /(protagonista|foco|destaque|destacad|dominante|principal|hero|centro|central|primeiro plano|grande demais|maior elemento|compete|competindo)/i.test(combined)
  ) {
    codes.push("THIRD_PARTY_BRAND_FOCUS");
  }
  if (/(bot[aã]o|barra inferior|sticker|badge|pill|whats|telegram|ui falsa|cta)/i.test(combined)) {
    codes.push("CTA_FAKE_UI");
  }
  if (!FRANGO_ALLOWED_CONTEXT_PATTERNS.some((pattern) => pattern.test(combined)) && /texto principal|contexto|caseira|marmitex|prato feito|almo[cç]o/i.test(combined)) {
    codes.push("OFF_BRAND_FOOD_CONTEXT");
  }

  return unique(codes);
}

export function getFrangoIssueDetails(codes: FrangoIssueCode[]): FrangoSafetyRisk[] {
  return unique(codes).map((code) => ISSUE_DETAILS[code]);
}

export function buildFrangoRepairPrompt(basePrompt: string, issueCodes: FrangoIssueCode[]): string {
  const details = getFrangoIssueDetails(issueCodes);
  const issueText = details.length
    ? details.map((detail) => `- ${detail.label} Correção: ${detail.recommendation}`).join("\n")
    : "- Guardião visual reprovou. Corrigir para território seguro de comida caseira.";

  return [
    basePrompt,
    "",
    "MANDATORY REPAIR PASS FOR FRANGO NA BRAZZA:",
    issueText,
    "",
    buildFrangoSafeVisualDirection("marmitex prato feito comida caseira"),
    frangoPromptSafetyBlock(),
    issueCodes.includes("THIRD_PARTY_BRAND_FOCUS")
      ? "For this retry, crop the beverage can out entirely if needed. If it remains visible, it must be tiny, partial, edge-positioned, softly blurred and clearly less important than the meal."
      : "",
    issueCodes.includes("FORBIDDEN_VISIBLE_TEXT")
      ? "For this retry, crop or blur all background signage and keep only the approved prompt text legible."
      : "",
    "Regenerate as a quieter editorial food story, not a poster. Use only the approved visible text from the prompt, remove any invented risky text, and keep the meal as the dominant subject.",
  ].join("\n");
}

export function buildFrangoPreflightNotes(value: string): string[] {
  return classifyFrangoPromptRisks(value).map(
    (risk) => `${risk.label} ${risk.recommendation}`
  );
}
