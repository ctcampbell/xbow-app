interface Props {
  kind?: 'error' | 'success' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}

const STYLES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-clay-100 bg-clay-50 text-clay-700',
};

export default function Alert({ kind = 'error', children, onDismiss }: Props) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm ${STYLES[kind]}`} role="alert">
      <div>{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
