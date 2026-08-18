import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client, { errorMessage } from '../../api/client';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';

const EMPTY = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  published_year: '',
  genre: '',
  description: '',
  total_copies: '1',
};

export default function BookForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    client
      .get(`/books/${id}`)
      .then(({ data }) =>
        setForm({
          title: data.book.title ?? '',
          author: data.book.author ?? '',
          isbn: data.book.isbn ?? '',
          publisher: data.book.publisher ?? '',
          published_year: data.book.published_year ? String(data.book.published_year) : '',
          genre: data.book.genre ?? '',
          description: data.book.description ?? '',
          total_copies: String(data.book.total_copies ?? 1),
        }),
      )
      .catch((err) => setError(errorMessage(err, 'Could not load this book')))
      .finally(() => setLoading(false));
  }, [editing, id]);

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: event.target.value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    // Empty optional fields are sent as null, not '', so they clear cleanly.
    const payload = {
      title: form.title,
      author: form.author,
      isbn: form.isbn.trim() || null,
      publisher: form.publisher.trim() || null,
      published_year: form.published_year.trim() ? Number(form.published_year) : null,
      genre: form.genre.trim() || null,
      description: form.description.trim() || null,
      total_copies: Number(form.total_copies),
    };

    try {
      if (editing) {
        await client.patch(`/books/${id}`, payload);
      } else {
        await client.post('/books', payload);
      }
      navigate('/admin/books');
    } catch (err) {
      setError(errorMessage(err, 'Could not save this book'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading the record" />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{editing ? 'Edit book' : 'Add a book'}</h1>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}

        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" required maxLength={500} value={form.title} onChange={update('title')} />
        </div>

        <div>
          <label className="label" htmlFor="author">Author</label>
          <input id="author" className="input" required maxLength={255} value={form.author} onChange={update('author')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="isbn">ISBN</label>
            <input id="isbn" className="input" value={form.isbn} onChange={update('isbn')}
              placeholder="978-0-14-143951-8" pattern="[0-9\-]*" />
            <p className="mt-1 text-xs text-ink-700">Digits and hyphens only.</p>
          </div>
          <div>
            <label className="label" htmlFor="publisher">Publisher</label>
            <input id="publisher" className="input" value={form.publisher} onChange={update('publisher')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="published_year">Year</label>
            <input id="published_year" type="number" className="input" min={1450} max={2200}
              value={form.published_year} onChange={update('published_year')} />
          </div>
          <div>
            <label className="label" htmlFor="genre">Genre</label>
            <input id="genre" className="input" value={form.genre} onChange={update('genre')} />
          </div>
          <div>
            <label className="label" htmlFor="total_copies">Copies</label>
            <input id="total_copies" type="number" className="input" min={0} required
              value={form.total_copies} onChange={update('total_copies')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" className="input min-h-[7rem]" maxLength={5000}
            value={form.description} onChange={update('description')} />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to catalogue'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin/books')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
