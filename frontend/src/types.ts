export type Role = 'member' | 'admin';
export type MemberStatus = 'active' | 'suspended';

export interface Member {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  status: MemberStatus;
  joined_at: string;
  open_loans?: number;
  overdue_loans?: number;
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
  title: string;
  author: string;
  isbn: string | null;
  first_name: string;
  last_name: string;
  email: string;
  overdue: boolean;
}

export interface Hold {
  id: number;
  book_id: number;
  member_id?: number;
  placed_at: string;
  status: string;
  title: string;
  author: string;
  queue_position?: number;
  first_name?: string;
  last_name?: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  pages: number;
}
