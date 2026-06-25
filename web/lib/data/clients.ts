import "server-only";
import { supabaseAdmin } from "../supabase/server";
import { mapClient } from "../mappers";
import { slugify } from "../utils";
import type { ClientInput, ClientProfile } from "../types";
import type { Database } from "../supabase/database.types";

type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export async function listClients(): Promise<ClientProfile[]> {
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClient);
}

/** Accepts a client UUID or a slug. */
export async function getClient(idOrSlug: string): Promise<ClientProfile | null> {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug) ? "id" : "slug";
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .select("*")
    .eq(column, idOrSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapClient(data) : null;
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "cliente";
  let candidate = root;
  let n = 2;
  while (true) {
    const query = supabaseAdmin().from("clients").select("id").eq("slug", candidate);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const collision = (data ?? []).some((r) => r.id !== ignoreId);
    if (!collision) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function createClient(input: ClientInput): Promise<ClientProfile> {
  const slug = await uniqueSlug(input.slug || input.name);
  const { data, error } = await supabaseAdmin()
    .from("clients")
    .insert({
      slug,
      name: input.name,
      city: input.city ?? "",
      neighborhood: input.neighborhood ?? "",
      tone: input.tone ?? "",
      color_palette: input.color_palette ?? [],
      typography: input.typography ?? [],
      instagram: input.instagram ?? "",
      notes: input.notes ?? "",
      manual_status: input.manual_status ?? "",
      synthetic_manual: input.synthetic_manual ?? "",
      media_source_url: input.media_source_url ?? "",
      brand_manual_summary: input.brand_manual_summary ?? "",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

export async function updateClient(id: string, input: ClientInput): Promise<ClientProfile> {
  const patch: ClientUpdate = {
    name: input.name,
    city: input.city,
    neighborhood: input.neighborhood,
    tone: input.tone,
    color_palette: input.color_palette,
    typography: input.typography,
    instagram: input.instagram,
    notes: input.notes,
    manual_status: input.manual_status,
    synthetic_manual: input.synthetic_manual,
    media_source_url: input.media_source_url,
    brand_manual_summary: input.brand_manual_summary,
  };
  if (input.slug) patch.slug = await uniqueSlug(input.slug, id);
  (Object.keys(patch) as (keyof ClientUpdate)[]).forEach(
    (k) => patch[k] === undefined && delete patch[k]
  );

  const { data, error } = await supabaseAdmin()
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapClient(data);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
