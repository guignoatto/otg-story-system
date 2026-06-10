import type { DriveMediaItem } from "../types";
import { formatDriveDate, formatDriveSize } from "../lib/utils";

type DriveCatalogProps = {
  items: DriveMediaItem[];
  selectedIds: string[];
  visible: boolean;
  onToggle: (fileId: string) => void;
};

export function DriveCatalog({ items, selectedIds, visible, onToggle }: DriveCatalogProps) {
  if (!visible) return null;

  if (!items.length) {
    return <div className="drive-catalog"><p className="drive-file-meta">Nenhuma imagem ou video encontrado nessa pasta.</p></div>;
  }

  return (
    <div className="drive-catalog">
      {items.map((item) => {
        const isImage = item.mime_type?.startsWith("image/");
        const folder = item.folder_path?.length ? `${item.folder_path.join(" / ")} · ` : "";
        return (
          <label className="drive-catalog-item" key={item.drive_file_id}>
            <input
              type="checkbox"
              value={item.drive_file_id}
              checked={selectedIds.includes(item.drive_file_id)}
              onChange={() => onToggle(item.drive_file_id)}
            />
            <span className="drive-thumb">
              {item.thumbnail_url && isImage ? <img src={item.thumbnail_url} alt="" /> : <span>{isImage ? "IMG" : "VID"}</span>}
            </span>
            <span>
              <span className="drive-file-name">{item.name}</span>
              <span className="drive-file-meta">{folder}{formatDriveSize(item.size_bytes)} · {formatDriveDate(item.modified_time)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
