export type Role = 'member' | 'admin';
export type MemberStatus = 'active' | 'suspended';
export type HoldStatus = 'active' | 'fulfilled' | 'cancelled';

export interface Member {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: MemberStatus;
  joined_at: string;
}

export interface Book {
  id: number;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  published_year: number | null;
  genre: string | null;
  description: string | null;
  total_copies: number;
  created_at: string;
  updated_at: string;
}

/** A catalogue row with its derived availability figures. */
export interface BookWithAvailability extends Book {
  on_loan: number;
  available_copies: number;
  active_holds: number;
}

export interface Loan {
  id: number;
  book_id: number;
  member_id: number;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  renewals: number;
}

/** The authenticated caller, attached to the request by requireAuth. */
export interface AuthContext {
  id: number;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      clientIp?: string;
    }
  }
}
