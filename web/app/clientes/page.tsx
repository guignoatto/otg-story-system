import Link from "next/link";
import { SiteNav } from "../components/SiteNav";
import { listClients } from "@/lib/data/clients";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const clients = await listClients();

  return (
    <>
      <SiteNav />
      <main className="app-shell">
        <section className="panel">
          <div className="page-actions">
            <div className="section-heading" style={{ border: "none", margin: 0, padding: 0 }}>
              <span className="section-number">01</span>
              <div>
                <h2>Clientes</h2>
                <p>Cadastre e edite restaurantes, manuais de marca e regras operacionais.</p>
              </div>
            </div>
            <Link href="/clientes/novo">
              <button type="button">+ Novo cliente</button>
            </Link>
          </div>

          <div className="client-grid">
            {clients.map((client) => (
              <Link key={client.id} href={`/clientes/${client.id}`} className="client-card">
                <h3>{client.name}</h3>
                <span className="muted">
                  {client.instagram || "sem instagram"}
                  {client.city ? ` · ${client.city}` : ""}
                </span>
                <span className="muted">{client.tone || "tom não definido"}</span>
                <div className="swatches">
                  {client.color_palette.slice(0, 5).map((color, i) => (
                    <span key={`${color}-${i}`} style={{ background: color }} title={color} />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
