export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-base font-medium text-ink-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-700">{hint}</p>}
    </div>
  );
}
