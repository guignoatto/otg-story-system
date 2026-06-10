"use client";

import { useRef, useState } from "react";
import type { Asset, AssetRole } from "@/lib/types";

type Props = {
  clientId: string;
  initialMedia: Asset[];
  initialManuals: Asset[];
  mediaSourceUrl: string;
};

export function ClientAssets({ clientId, initialMedia, initialManuals, mediaSourceUrl }: Props) {
  const [media, setMedia] = useState<Asset[]>(initialMedia);
  const [manuals, setManuals] = useState<Asset[]>(initialManuals);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const mediaInput = useRef<HTMLInputElement>(null);
  const manualInput = useRef<HTMLInputElement>(null);

  async function upload(role: AssetRole, files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setStatus(`Enviando ${files.length} arquivo(s)...`);
    try {
      const fd = new FormData();
      fd.append("client_id", clientId);
      fd.append("role", role);
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/assets/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erro ${res.status}`);
      }
      const data = (await res.json()) as { items: Asset[] };
      if (role === "media") setMedia((cur) => [...data.items, ...cur]);
      else setManuals((cur) => [...data.items, ...cur]);
      setStatus(`${data.items.length} arquivo(s) salvo(s) na nuvem.`);
    } catch (err) {
      setStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      if (mediaInput.current) mediaInput.current.value = "";
      if (manualInput.current) manualInput.current.value = "";
    }
  }

  async function importDrive() {
    if (!mediaSourceUrl) {
      setStatus("Cadastre a pasta do Google Drive neste cliente antes de importar.");
      return;
    }
    setBusy(true);
    setStatus("Importando do Google Drive...");
    try {
      const res = await fetch("/api/assets/import-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, folder_url: mediaSourceUrl, max_files: 12 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`);
      setMedia((cur) => [...data.items, ...cur]);
      setStatus(`${data.items.length} mídia(s) importada(s) do Drive.`);
    } catch (err) {
      setStatus(`Erro no Drive: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brief-form">
      <div className="section-heading" style={{ border: "none", margin: 0, padding: 0 }}>
        <span className="section-number">02</span>
        <div>
          <h2>Biblioteca</h2>
          <p>Manual de marca e mídias reais ficam salvos na nuvem deste cliente.</p>
        </div>
      </div>

      {status && <div className="upload-status">{status}</div>}

      <article className="form-card">
        <div className="card-title">
          <div>
            <span>Manual de marca</span>
            <small>PDF/texto — usado para extrair cores, fontes e tom</small>
          </div>
        </div>
        <input
          ref={manualInput}
          type="file"
          accept=".pdf,.txt,.md,image/*"
          disabled={busy}
          onChange={(e) => void upload("manual", e.target.files)}
        />
        {manuals.map((m) => (
          <div key={m.id} className="drive-status">
            <strong>{m.file_name}</strong>
            {m.detected_colors.length > 0 && <div>Cores: {m.detected_colors.join(", ")}</div>}
            {m.detected_typography.length > 0 && <div>Fontes: {m.detected_typography.join(", ")}</div>}
            {m.detected_tone && <div>Tom: {m.detected_tone}</div>}
          </div>
        ))}
      </article>

      <article className="form-card">
        <div className="card-title">
          <div>
            <span>Mídias reais</span>
            <small>Fotos do restaurante — base visual para a IA</small>
          </div>
        </div>
        <input
          ref={mediaInput}
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={busy}
          onChange={(e) => void upload("media", e.target.files)}
        />
        <div className="button-row">
          <button type="button" className="ghost" disabled={busy} onClick={() => void importDrive()}>
            Importar primeiras 12 do Drive
          </button>
        </div>
        <div className="drive-catalog">
          {media.length === 0 && <div className="muted">Nenhuma mídia ainda.</div>}
          {media.map((asset) => (
            <div key={asset.id} className="drive-catalog-item" style={{ gridTemplateColumns: "64px 1fr" }}>
              <div className="drive-thumb">
                {asset.mime_type.startsWith("image/") && asset.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.public_url} alt={asset.file_name} />
                ) : (
                  "media"
                )}
              </div>
              <div>
                <span className="drive-file-name">{asset.file_name}</span>
                <span className="drive-file-meta">{asset.mime_type}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
