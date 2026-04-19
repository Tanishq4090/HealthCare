// ============================================================
// HR Module — TypeScript Types
// ============================================================

export type EmployeeStatus = 'available' | 'assigned' | 'inactive';

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  job_title: string;
  photo_url: string | null;
  status: EmployeeStatus;
  phone: string | null;
  aadhaar_number: string | null;
  address: string | null;
  dob: string | null;
  preferred_payment_type: 'hourly' | 'monthly' | 'short_term';
  services: string[];
  hourly_rate: number;
  monthly_daily_rate: number;
  short_term_daily_rate: number;
  shift_hours: number | null;
  rating: number;
  experience: string | null;
  gender: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
}

export interface CreateEmployeeInput {
  full_name: string;
  job_title: string;
  photo?: File;
  phone?: string;
  aadhaar_number?: string;
  address?: string;
  dob?: string;
  preferred_payment_type?: 'hourly' | 'monthly' | 'short_term';
  services?: string[];
  hourly_rate?: number;
  monthly_daily_rate?: number;
  short_term_daily_rate?: number;
  shift_hours?: number;
  experience?: string;
  gender?: string;
  username?: string;
  password?: string;
  documents?: File[];
}

// ── Assignment Types ───────────────────────────────────────

export type AssignmentStatus = 'active' | 'completed' | 'cancelled';

export interface WorkerAssignment {
  id: string;
  employee_id: string;
  client_id: string;
  assigned_at: string;
  assignment_status: AssignmentStatus;
  notes: string | null;
  deposit_paid: number;
}

// ── ID Card Types ──────────────────────────────────────────

export interface IdCardLink {
  id: string;
  employee_id: string;
  assignment_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface IdCardData {
  employee: Employee;
  assignment: WorkerAssignment;
  link: IdCardLink;
}
