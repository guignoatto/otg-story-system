import type { ClientProfile } from "../types";
import { splitLines } from "../lib/utils";

type AppHeaderProps = {
  activeClient: ClientProfile | undefined;
  restaurantName: string;
  onLoadHistory: () => void;
};

function ruleChips(activeClient: ClientProfile | undefined): string[] {
  const rules = splitLines(activeClient?.notes || "").slice(0, 5);
  return rules.length ? rules.map((rule) => rule.replace(/^nao mencionar/i, "Sem")) : ["Sem observacoes especificas"];
}

export function AppHeader({ activeClient, restaurantName, onLoadHistory }: AppHeaderProps) {
  return (
    <header className="studio-hero">
      <nav className="brand-row" aria-label="Navegacao principal">
        <div className="brand-lockup">
          <img className="brand-logo" src="/assets/otg-logo-horizontal.png" alt="OTG Midia" />
          <div>
            <strong>Creative OS</strong>
            <span>Story Lab para restaurantes</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost" onClick={onLoadHistory}>
            Historico
          </button>
        </div>
      </nav>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">OTG Midia · conteudo organico</p>
          <h1>Crie stories com padrao OTG, usando midias reais e bom senso de restaurante.</h1>
          <p>
            O sistema combina briefing, manual de marca, midias reais, agentes de copy e QA para pre-aprovar o criativo antes de gastar credito com imagem.
          </p>
        </div>

        <aside className="client-status-card" aria-label="Cliente ativo">
          <span className="kicker">Restaurante ativo</span>
          <strong>{restaurantName || activeClient?.name || "Novo restaurante"}</strong>
          <p>As regras operacionais abaixo guiam os agentes e travam ideias fora de contexto.</p>
          <div className="rule-strip">
            {ruleChips(activeClient).map((rule) => (
              <span key={rule}>{rule}</span>
            ))}
          </div>
        </aside>
      </section>

      <section className="workflow-strip" aria-label="Fluxo do criativo">
        <div><span>01</span><strong>Cliente</strong><small>Marca e contexto</small></div>
        <div><span>02</span><strong>Campanha</strong><small>Objetivo e tema</small></div>
        <div><span>03</span><strong>Midias</strong><small>Fotos reais</small></div>
        <div><span>04</span><strong>Aprovacao</strong><small>IA e download</small></div>
      </section>
    </header>
  );
}
