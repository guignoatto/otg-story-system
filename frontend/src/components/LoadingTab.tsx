type LoadingTabProps = {
  active: boolean;
  title: string;
  detail: string;
};

export function LoadingTab({ active, title, detail }: LoadingTabProps) {
  if (!active) return null;

  return (
    <aside className="loading-tab" aria-live="polite" aria-busy="true">
      <div className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </aside>
  );
}
