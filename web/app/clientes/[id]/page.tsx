import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "../../components/SiteNav";
import { ClientForm } from "../ClientForm";
import { ClientAssets } from "./ClientAssets";
import { getClient } from "@/lib/data/clients";
import { listAssets } from "@/lib/data/assets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditClientePage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [media, manuals] = await Promise.all([
    listAssets(client.id, "media"),
    listAssets(client.id, "manual"),
  ]);

  return (
    <>
      <SiteNav />
      <main className="app-shell">
        <section className="content-grid">
          <div className="panel control-panel" style={{ position: "static" }}>
            <div className="page-actions">
              <div className="section-heading" style={{ border: "none", margin: 0, padding: 0 }}>
                <span className="section-number">✎</span>
                <div>
                  <h2>{client.name}</h2>
                  <p>Edite identidade, marca e regras operacionais.</p>
                </div>
              </div>
              <Link href="/clientes">
                <button type="button" className="ghost">Voltar</button>
              </Link>
            </div>
            <ClientForm client={client} />
          </div>

          <div className="panel">
            <ClientAssets
              clientId={client.id}
              initialMedia={media}
              initialManuals={manuals}
              mediaSourceUrl={client.media_source_url}
            />
          </div>
        </section>
      </main>
    </>
  );
}
