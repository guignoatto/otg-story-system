"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientProfile } from "@/lib/types";

type Props = { client?: ClientProfile };

type FormState = {
  name: string;
  instagram: string;
  city: string;
  neighborhood: string;
  tone: string;
  colorPalette: string; // CSV in the form
  typography: string; // CSV in the form
  mediaSourceUrl: string;
  notes: string;
  manualStatus: string;
  syntheticManual: string;
  brandManualSummary: string;
};

function toForm(client?: ClientProfile): FormState {
  return {
    name: client?.name ?? "",
    instagram: client?.instagram ?? "",
    city: client?.city ?? "",
    neighborhood: client?.neighborhood ?? "",
    tone: client?.tone ?? "",
    colorPalette: (client?.color_palette ?? []).join(", "),
    typography: (client?.typography ?? []).join(", "),
    mediaSourceUrl: client?.media_source_url ?? "",
    notes: client?.notes ?? "",
    manualStatus: client?.manual_status ?? "",
    syntheticManual: client?.synthetic_manual ?? "",
    brandManualSummary: client?.brand_manual_summary ?? "",
  };
}

function csv(value: string): string[] {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export function ClientForm({ client }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(toForm(client));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(client);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Informe o nome do restaurante.");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      instagram: form.instagram,
      city: form.city,
      neighborhood: form.neighborhood,
      tone: form.tone,
      color_palette: csv(form.colorPalette),
      typography: csv(form.typography),
      media_source_url: form.mediaSourceUrl,
      notes: form.notes,
      manual_status: form.manualStatus,
      synthetic_manual: form.syntheticManual,
      brand_manual_summary: form.brandManualSummary,
    };
    try {
      const res = await fetch(isEdit ? `/api/clients/${client!.id}` : "/api/clients", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erro ${res.status}`);
      }
      const saved = (await res.json()) as ClientProfile;
      router.push(`/clientes/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!client) return;
    if (!confirm(`Remover o cliente "${client.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      router.push("/clientes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="brief-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {error && <div className="inline-error">{error}</div>}

      <article className="form-card spotlight-card">
        <div className="card-title">
          <div>
            <span>Identidade</span>
            <small>Nome, perfil e contexto do restaurante</small>
          </div>
        </div>
        <div className="two-columns">
          <label className="field-control">
            Nome do restaurante
            <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={busy} />
          </label>
          <label className="field-control">
            Instagram
            <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} disabled={busy} placeholder="@perfil" />
          </label>
        </div>
        <div className="two-columns">
          <label className="field-control">
            Cidade
            <input value={form.city} onChange={(e) => set("city", e.target.value)} disabled={busy} />
          </label>
          <label className="field-control">
            Bairro ou região
            <input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} disabled={busy} />
          </label>
        </div>
        <label className="field-control">
          Tom de voz
          <input value={form.tone} onChange={(e) => set("tone", e.target.value)} disabled={busy} placeholder="ex.: tradicional e acolhedor" />
        </label>
      </article>

      <article className="form-card">
        <div className="card-title">
          <div>
            <span>Marca</span>
            <small>Paleta, tipografia e manual sintético</small>
          </div>
        </div>
        <div className="two-columns">
          <label className="field-control">
            Paleta de cores (separe por vírgula)
            <input value={form.colorPalette} onChange={(e) => set("colorPalette", e.target.value)} disabled={busy} placeholder="#0B2A1E, #4598B2" />
          </label>
          <label className="field-control">
            Tipografia (separe por vírgula)
            <input value={form.typography} onChange={(e) => set("typography", e.target.value)} disabled={busy} placeholder="Sora, Montserrat" />
          </label>
        </div>
        <label className="field-control">
          Manual sintético
          <textarea rows={3} value={form.syntheticManual} onChange={(e) => set("syntheticManual", e.target.value)} disabled={busy} />
        </label>
        <label className="field-control">
          Status do manual
          <input value={form.manualStatus} onChange={(e) => set("manualStatus", e.target.value)} disabled={busy} />
        </label>
        <label className="field-control">
          Resumo do manual de marca (alimenta a IA)
          <textarea rows={3} value={form.brandManualSummary} onChange={(e) => set("brandManualSummary", e.target.value)} disabled={busy} />
        </label>
      </article>

      <article className="form-card">
        <div className="card-title">
          <div>
            <span>Regras operacionais</span>
            <small>Instruções que travam ideias fora de contexto (uma por linha)</small>
          </div>
        </div>
        <label className="field-control">
          Observações do cliente
          <textarea rows={6} value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={busy} />
        </label>
        <label className="field-control">
          Pasta de mídias (Google Drive)
          <input value={form.mediaSourceUrl} onChange={(e) => set("mediaSourceUrl", e.target.value)} disabled={busy} />
        </label>
      </article>

      <div className="button-row">
        <button type="submit" disabled={busy}>
          {busy ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
        {isEdit && (
          <button type="button" className="ghost" disabled={busy} onClick={() => void remove()}>
            Remover
          </button>
        )}
      </div>
    </form>
  );
}
