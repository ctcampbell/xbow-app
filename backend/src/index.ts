import express from 'express';
import cors from 'cors';
import authRoutes   from './routes/auth';
import userRoutes   from './routes/users';
import courseRoutes from './routes/courses';
import roundRoutes  from './routes/rounds';
import exportRoutes from './routes/export';
import adminRoutes  from './routes/admin';
import debugRoutes  from './routes/debug';
import { errorHandler } from './middleware/errorHandler';
import { ipAllowlist } from './middleware/ipAllowlist';

const app = express();

app.set('trust proxy', 1);
app.use(ipAllowlist);

// VULN: CORS wildcard — any origin can make credentialed requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*',
}));

// VULN: no Helmet, no CSP, no X-Frame-Options, no HSTS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/rounds',  roundRoutes);
app.use('/api/export',  exportRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/debug',   debugRoutes);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  // VULN: secrets printed to stdout on startup
  console.log(`Backend running on port ${PORT}`);
  console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);
  console.log(`JWT_SECRET=${process.env.JWT_SECRET}`);
});
