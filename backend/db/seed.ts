/**
 * Development seed data.
 *
 * Passwords come from the environment. If they are not set, a random one is
 * generated and printed once — so a seeded database never ends up with a
 * password that is also written down in this repository.
 *
 *   npm run seed
 *   SEED_ADMIN_PASSWORD=... SEED_MEMBER_PASSWORD=... npm run seed
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../src/db';
import { runMigrations } from '../src/migrate';

const BOOKS = [
  ['978-0-14-143951-8', 'Pride and Prejudice', 'Jane Austen', 'Penguin Classics', 1813, 'Classic Fiction', 3],
  ['978-0-14-144114-6', 'Jane Eyre', 'Charlotte Brontë', 'Penguin Classics', 1847, 'Classic Fiction', 2],
  ['978-0-19-953556-9', 'Frankenstein', 'Mary Shelley', 'Oxford University Press', 1818, 'Gothic', 2],
  ['978-0-14-390150-2', 'Moby-Dick', 'Herman Melville', 'Penguin Classics', 1851, 'Adventure', 1],
  ['978-0-486-28061-4', 'The Adventures of Huckleberry Finn', 'Mark Twain', 'Dover', 1884, 'Adventure', 2],
  ['978-0-14-118776-1', 'Crime and Punishment', 'Fyodor Dostoevsky', 'Penguin Classics', 1866, 'Literary Fiction', 2],
  ['978-1-85326-000-1', 'War and Peace', 'Leo Tolstoy', 'Wordsworth Editions', 1869, 'Historical Fiction', 1],
  ['978-0-14-303943-3', 'The Great Gatsby', 'F. Scott Fitzgerald', 'Penguin', 1925, 'Literary Fiction', 4],
  ['978-0-452-28423-4', 'Nineteen Eighty-Four', 'George Orwell', 'Secker & Warburg', 1949, 'Dystopian', 5],
  ['978-0-452-28424-1', 'Animal Farm', 'George Orwell', 'Secker & Warburg', 1945, 'Satire', 3],
  ['978-0-06-112008-4', 'To Kill a Mockingbird', 'Harper Lee', 'Harper Perennial', 1960, 'Literary Fiction', 4],
  ['978-0-547-92822-7', 'The Hobbit', 'J. R. R. Tolkien', 'Houghton Mifflin', 1937, 'Fantasy', 3],
  ['978-0-618-64015-7', 'The Fellowship of the Ring', 'J. R. R. Tolkien', 'Houghton Mifflin', 1954, 'Fantasy', 2],
  ['978-0-441-01359-3', 'Dune', 'Frank Herbert', 'Ace', 1965, 'Science Fiction', 3],
  ['978-0-553-38016-3', 'I, Robot', 'Isaac Asimov', 'Bantam', 1950, 'Science Fiction', 2],
  ['978-0-06-085052-4', 'Brave New World', 'Aldous Huxley', 'Harper Perennial', 1932, 'Dystopian', 2],
  ['978-0-679-72020-1', 'The Trial', 'Franz Kafka', 'Schocken', 1925, 'Literary Fiction', 1],
  ['978-0-14-118280-3', 'Things Fall Apart', 'Chinua Achebe', 'Penguin', 1958, 'Literary Fiction', 2],
  ['978-0-06-088328-7', 'One Hundred Years of Solitude', 'Gabriel García Márquez', 'Harper', 1967, 'Magical Realism', 2],
  ['978-0-393-97012-5', 'Beloved', 'Toni Morrison', 'Vintage', 1987, 'Literary Fiction', 2],
  ['978-0-14-243724-7', 'The Handmaid’s Tale', 'Margaret Atwood', 'Anchor', 1985, 'Dystopian', 3],
  ['978-0-571-05686-2', 'Lord of the Flies', 'William Golding', 'Faber & Faber', 1954, 'Literary Fiction', 3],
] as const;

const MEMBERS = [
  ['ada.okafor@example.org', 'Ada', 'Okafor'],
  ['bruno.silva@example.org', 'Bruno', 'Silva'],
  ['chen.wei@example.org', 'Chen', 'Wei'],
  ['dara.murphy@example.org', 'Dara', 'Murphy'],
] as const;

function passwordFor(envName: string, label: string): { value: string; generated: boolean } {
  const supplied = (process.env[envName] || '').trim();
  if (supplied) return { value: supplied, generated: false };
  const generated = randomBytes(12).toString('base64url');
  console.log(`  ${label}: ${generated}   (generated — set ${envName} to choose your own)`);
  return { value: generated, generated: true };
}

async function seed(): Promise<void> {
  await runMigrations(pool);

  console.log('\nSeed credentials');
  const adminPassword = passwordFor('SEED_ADMIN_PASSWORD', 'admin@library.local ');
  const memberPassword = passwordFor('SEED_MEMBER_PASSWORD', 'members (all)      ');
  console.log('');

  const adminHash = await bcrypt.hash(adminPassword.value, 12);
  const memberHash = await bcrypt.hash(memberPassword.value, 12);

  await pool.query(
    `INSERT INTO members (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, 'Library', 'Administrator', 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ['admin@library.local', adminHash],
  );

  for (const [email, first, last] of MEMBERS) {
    await pool.query(
      `INSERT INTO members (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [email, memberHash, first, last],
    );
  }

  for (const [isbn, title, author, publisher, year, genre, copies] of BOOKS) {
    await pool.query(
      `INSERT INTO books (isbn, title, author, publisher, published_year, genre, total_copies, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (isbn) DO NOTHING`,
      [isbn, title, author, publisher, year, genre, copies, `${title} by ${author}.`],
    );
  }

  // A couple of loans so the dashboards have something to show, including one
  // that is already overdue.
  const borrower = await pool.query(`SELECT id FROM members WHERE email = $1`, [MEMBERS[0][0]]);
  const titles = await pool.query(`SELECT id FROM books ORDER BY id LIMIT 2`);
  if (borrower.rows[0] && titles.rows.length === 2) {
    await pool.query(
      `INSERT INTO loans (book_id, member_id, borrowed_at, due_date)
       VALUES ($1, $2, NOW() - INTERVAL '30 days', CURRENT_DATE - 9)
       ON CONFLICT DO NOTHING`,
      [titles.rows[0].id, borrower.rows[0].id],
    );
    await pool.query(
      `INSERT INTO loans (book_id, member_id, borrowed_at, due_date)
       VALUES ($1, $2, NOW() - INTERVAL '2 days', CURRENT_DATE + 19)
       ON CONFLICT DO NOTHING`,
      [titles.rows[1].id, borrower.rows[0].id],
    );
  }

  const counts = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM books) AS books,
            (SELECT COUNT(*)::int FROM members) AS members,
            (SELECT COUNT(*)::int FROM loans) AS loans`,
  );
  console.log(`Seeded: ${counts.rows[0].books} books, ${counts.rows[0].members} members, ${counts.rows[0].loans} loans`);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  });
