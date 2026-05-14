import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Not found';
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', margin: 0 }}>404</h1>
      <p style={{ margin: '0.5rem 0 1.5rem' }}>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  );
}
