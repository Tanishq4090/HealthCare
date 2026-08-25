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
  /** Daily rate for a 10-hour shift. Male default ₹600, Female default ₹500. */
  rate_10hr: number;
  /** Daily rate for a 24-hour shift. Default ₹800 for all. */
  rate_24hr: number;
  services: string[];
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
  services?: string[];
  rate_10hr?: number;
  rate_24hr?: number;
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
  start_date?: string;
  end_date?: string;
  service_type?: 'one_day' | 'date_range';
  hours_per_day?: number;
  total_bill_amount?: number;
  invoice_number?: string;
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
