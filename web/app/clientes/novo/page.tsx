import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";
import { ClientForm } from "../ClientForm";

export default function NovoClientePage() {
  return (
    <>
      <SiteNav />
      <main className="app-shell">
        <section className="panel control-panel" style={{ position: "static" }}>
          <div className="page-actions">
            <div className="section-heading" style={{ border: "none", margin: 0, padding: 0 }}>
              <span className="section-number">+</span>
              <div>
                <h2>Novo cliente</h2>
                <p>Cadastre um restaurante. Mídias e manual podem ser anexados após salvar.</p>
              </div>
            </div>
            <Link href="/clientes">
              <button type="button" className="ghost">Voltar</button>
            </Link>
          </div>
          <ClientForm />
        </section>
      </main>
    </>
  );
}
