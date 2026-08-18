import { Pagination as PaginationMeta } from '../types';

interface Props {
  meta: PaginationMeta;
  onChange: (page: number) => void;
}

export default function Pagination({ meta, onChange }: Props) {
  if (meta.pages <= 1) return null;

  const from = (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.page * meta.page_size, meta.total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-ink-100 px-4 py-3 text-sm">
      <p className="text-ink-700">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
          Previous
        </button>
        <span className="text-ink-700">
          Page {meta.page} of {meta.pages}
        </span>
        <button className="btn-secondary" disabled={meta.page >= meta.pages} onClick={() => onChange(meta.page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
