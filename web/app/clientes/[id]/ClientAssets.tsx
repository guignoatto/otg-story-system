"use client";

import { useRef, useState } from "react";
import { supabaseBrowser, STORAGE_BUCKET } from "@/lib/supabase/browser";
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

  // Upload direto ao Storage (sem passar pela função): evita o limite de 4,5 MB
  // de corpo de requisição da Vercel. Por arquivo: assina → envia → registra.
  async function uploadOne(role: AssetRole, file: File): Promise<Asset> {
    const signRes = await fetch("/api/assets/sign-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        role,
        file_name: file.name,
        mime_type: file.type,
      }),
    });
    const signData = await signRes.json();
    if (!signRes.ok) throw new Error(signData.detail || `Erro ${signRes.status}`);

    const { error: upErr } = await supabaseBrowser()
      .storage.from(STORAGE_BUCKET)
      .uploadToSignedUrl(signData.storage_path, signData.token, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (upErr) throw new Error(upErr.message);

    const regRes = await fetch("/api/assets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        role,
        storage_path: signData.storage_path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(regData.detail || `Erro ${regRes.status}`);
    return regData.asset as Asset;
  }

  async function upload(role: AssetRole, files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy(true);
    let done = 0;
    const failures: string[] = [];
    try {
      for (const file of list) {
        setStatus(`Enviando ${done + 1} de ${list.length}: ${file.name}...`);
        try {
          const asset = await uploadOne(role, file);
          if (role === "media") setMedia((cur) => [asset, ...cur]);
          else setManuals((cur) => [asset, ...cur]);
          done += 1;
        } catch (err) {
          failures.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (failures.length) {
        setStatus(`${done} enviado(s). Falhou: ${failures.join(" · ")}`);
      } else {
        setStatus(`${done} arquivo(s) salvo(s) na nuvem.`);
      }
    } finally {
      setBusy(false);
      if (mediaInput.current) mediaInput.current.value = "";
      if (manualInput.current) manualInput.current.value = "";
    }
  }

  async function deleteAssetFromLibrary(id: string, role: AssetRole) {
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (role === "manual") setManuals((cur) => cur.filter((a) => a.id !== id));
      else setMedia((cur) => cur.filter((a) => a.id !== id));
      setStatus(role === "manual" ? "Manual removido." : "Mídia removida.");
    } catch {
      setStatus("Não foi possível remover o arquivo agora.");
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
          <div key={m.id} className="drive-status manual-analysis-card">
            <div className="manual-analysis-head">
              <strong>{m.file_name}</strong>
              <button
                type="button"
                className="ghost compact-action"
                onClick={() => void deleteAssetFromLibrary(m.id, "manual")}
                disabled={busy}
              >
                Remover
              </button>
            </div>
            {m.detected_colors.length > 0 && <div>Cores: {m.detected_colors.join(", ")}</div>}
            {m.detected_typography.length > 0 && <div>Fontes: {m.detected_typography.join(", ")}</div>}
            {m.detected_tone && <div>Tom: {m.detected_tone}</div>}
            {m.notes && (
              <div className="manual-analysis-notes">
                {m.notes.split("\n").filter(Boolean).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
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
          accept="image/*,video/*,.heic,.heif"
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
            <div key={asset.id} className="drive-catalog-item" style={{ gridTemplateColumns: "64px 1fr auto" }}>
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
              <button
                type="button"
                onClick={() => void deleteAssetFromLibrary(asset.id, "media")}
                disabled={busy}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px 8px", fontSize: "16px", lineHeight: 1 }}
                title="Remover mídia"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
