export default function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-16 text-ink-700" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-100 border-t-clay-600" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
