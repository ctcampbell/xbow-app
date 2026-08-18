export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "due in 5 days" / "3 days overdue", for loan due dates. */
export function relativeDays(dueDate: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return { label: 'due today', overdue: false };
  if (days > 0) return { label: `due in ${days} day${days === 1 ? '' : 's'}`, overdue: false };
  const late = Math.abs(days);
  return { label: `${late} day${late === 1 ? '' : 's'} overdue`, overdue: true };
}
