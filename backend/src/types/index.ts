export interface User {
  id: number;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  handicap: number;
  role: 'user' | 'admin';
  bio: string;
  avatar_url: string;
  created_at: string;
}

export interface Course {
  id: number;
  name: string;
  location: string;
  description: string;
  par: number;
  slope_rating: number;
  course_rating: number;
  holes: number;
  created_at: string;
}

export interface Round {
  id: number;
  user_id: number;
  course_id: number;
  date_played: string;
  total_score: number;
  notes: string;
  created_at: string;
}

export interface HoleScore {
  id: number;
  round_id: number;
  hole_number: number;
  score: number;
  par: number;
}

export interface JWTPayload {
  id: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
