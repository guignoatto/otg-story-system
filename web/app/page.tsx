import { SiteNav } from "./components/SiteNav";
import { Studio } from "./Studio";
import { listClients } from "@/lib/data/clients";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const clients = await listClients();
  return (
    <>
      <SiteNav />
      <Studio clients={clients} />
    </>
  );
}
