// crypto.randomUUID() is native in all modern browsers (no import needed)
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type {
  Employee,
  EmployeeStatus,
  CreateEmployeeInput,
} from '../types/hr';

// ── Constants ─────────────────────────────────────────────

const STORAGE_BUCKET = 'employee-photos';
const DOCS_BUCKET = 'employee-photos'; // Using same bucket for simplicity but under a different path


// ── Helpers ───────────────────────────────────────────────

/**
 * Derives the file extension from a File object.
 * Falls back to 'jpg' if the MIME type is unrecognised.
 */
function getExtension(file: File): string {
  const mime = file.type; // e.g. "image/jpeg"
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mime] ?? 'jpg';
}

/**
 * Uploads an employee photo to the "employee-photos" storage bucket.
 * Returns the public URL of the uploaded file.
 *
 * @throws Error if the upload fails
 */
async function uploadEmployeePhoto(photo: File): Promise<string> {
  const ext = getExtension(photo);
  const filePath = `photos/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, photo, {
      contentType: photo.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Uploads a document (ID proof) for an employee.
 */
async function uploadEmployeeDocument(employeeId: string, doc: File): Promise<string> {
  const ext = getExtension(doc);
  const filePath = `documents/${employeeId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(filePath, doc, {
      contentType: doc.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Document upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// ============================================================
// EMPLOYEE SERVICE FUNCTIONS
// ============================================================

/**
 * Creates a new employee record.
 *
 * - Uploads the photo (if provided) to Supabase Storage.
 * - Inserts the employee row — the DB trigger auto-generates `employee_id`.
 * - Returns the complete employee record including the generated employee_id.
 *
 * @throws Error with a descriptive message on failure
 */
export async function createEmployee(
  data: CreateEmployeeInput
): Promise<Employee> {
  try {
    // 0. Validation
    if (!data.full_name.trim()) {
      throw new Error('Full name is required.');
    }
    if (!data.job_title.trim()) {
      throw new Error('Job title is required.');
    }

    let photo_url: string | null = null;

    // 1. Upload photo if provided
    if (data.photo) {
      photo_url = await uploadEmployeePhoto(data.photo);
    }

    // 2. Insert employee row
    const { data: inserted, error } = await supabase
      .from('employees')
      .insert({
        full_name: data.full_name.trim(),
        job_title: data.job_title.trim(),
        photo_url,
        phone: data.phone?.trim() ?? null,
        aadhaar_number: data.aadhaar_number?.trim() ?? null,
        address: data.address?.trim() ?? null,
        dob: data.dob ?? null,
        preferred_payment_type: data.preferred_payment_type ?? 'monthly',
        services: data.services ?? [],
        hourly_rate: data.hourly_rate ?? 0,
        monthly_daily_rate: data.monthly_daily_rate ?? 0,
        short_term_daily_rate: data.short_term_daily_rate ?? 0,
        shift_hours: data.shift_hours ?? null,
        experience: data.experience?.trim() ?? null,
        gender: data.gender?.trim() ?? null,
        // Note: username intentionally omitted — no username field in form,
        // and sending any value (even null) can trigger DB-level auto-fill
        // that causes unique constraint violations.
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create employee: ${error.message}`);
    }

    if (!inserted) {
      throw new Error('Employee was inserted but no record was returned.');
    }

    // 3. Upload and record documents if provided
    if (data.documents && data.documents.length > 0) {
      for (const doc of data.documents) {
        try {
          const docUrl = await uploadEmployeeDocument(inserted.id, doc);
          await supabase.from('employee_documents').insert({
            employee_id: inserted.id,
            file_url: docUrl,
            file_name: doc.name,
            file_type: doc.type,
          });
        } catch (docErr) {
          console.error('Failed to upload document:', doc.name, docErr);
          toast.error(`Warning: Failed to upload document ${doc.name}`);
        }
      }
    }

    return inserted as Employee;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

// ─────────────────────────────────────────────────────────

/**
 * Fetches a single employee by their UUID primary key.
 *
 * @throws Error if the employee is not found or a DB error occurs
 */
export async function getEmployeeById(id: string): Promise<Employee> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch employee: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No employee found with id: ${id}`);
    }

    return data as Employee;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

// ─────────────────────────────────────────────────────────

/**
 * Fetches all employees with status = 'available', sorted by full_name.
 *
 * @returns Array of available Employee records (empty array if none found)
 */
export async function getAvailableEmployees(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'available')
      .is('assigned_client', null)   // double-safety: exclude anyone still linked to a client
      .is('deleted_at', null)
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch available employees: ${error.message}`);
    }

    return (data ?? []) as Employee[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

// ─────────────────────────────────────────────────────────

/**
 * Updates an employee's status field.
 * The `updated_at` column is automatically managed by the DB trigger,
 * but we also pass it explicitly here for defensive correctness.
 *
 * @throws Error if the update fails or the employee is not found
 */
export async function updateEmployeeStatus(
  id: string,
  status: EmployeeStatus
): Promise<Employee> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .update({
        status,
        updated_at: new Date().toISOString(), // belt-and-suspenders alongside the DB trigger
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update employee status: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No employee found with id: ${id}`);
    }

    return data as Employee;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

// ─────────────────────────────────────────────────────────

/**
 * Fetches an employee by their auto-generated employee_id string
 * (e.g. "EMP-000042").
 *
 * Useful when the caller only has the display ID, not the UUID.
 *
 * @throws Error if not found or query fails
 */
export async function getEmployeeByEmpId(employeeId: string): Promise<Employee> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch employee: ${error.message}`);
    }

    if (!data) {
      throw new Error(`No employee found with employee_id: ${employeeId}`);
    }

    return data as Employee;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Soft-deletes an employee record by setting the deleted_at timestamp.
 * 
 * @throws Error if the update fails
 */
export async function deleteEmployee(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to soft-delete employee: ${error.message}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Fetches all soft-deleted employees.
 */
export async function getDeletedEmployees(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch deleted employees: ${error.message}`);
    }

    return (data ?? []) as Employee[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Restores a soft-deleted employee by clearing the deleted_at timestamp.
 */
export async function restoreEmployee(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to restore employee: ${error.message}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Permanently deletes an employee record and all its dependencies from the database.
 */
export async function permanentlyDeleteEmployee(id: string): Promise<void> {
  try {
    // 1. Fetch related assignment IDs for thorough cleanup
    const { data: assignments } = await supabase
      .from('worker_assignments')
      .select('id')
      .eq('employee_id', id);
    
    const assignmentIds = (assignments ?? []).map(a => a.id);

    // 2. Delete ALL dependent records first
    // Note: We delete id_card_links by both employee_id and assignment_id to be safe
    await supabase.from('id_card_links').delete().eq('employee_id', id);
    if (assignmentIds.length > 0) {
      await supabase.from('id_card_links').delete().in('assignment_id', assignmentIds);
    }
    
    await supabase.from('worker_assignments').delete().eq('employee_id', id);
    await supabase.from('employee_documents').delete().eq('employee_id', id);
    await supabase.from('attendance').delete().eq('worker_id', id);
    await supabase.from('leaves').delete().eq('worker_id', id);

    // 3. Finally, delete the employee record
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to permanently delete employee: ${error.message}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Permanently deletes ALL soft-deleted employee records and their dependencies.
 */
export async function permanentlyDeleteAllDeletedEmployees(): Promise<void> {
  try {
    // 1. Fetch the IDs of all soft-deleted employees
    const { data: softDeleted, error: fetchError } = await supabase
      .from('employees')
      .select('id')
      .not('deleted_at', 'is', null);

    if (fetchError) throw fetchError;
    if (!softDeleted || softDeleted.length === 0) return;

    const ids = softDeleted.map(e => e.id);

    // 2. Fetch all related assignment IDs
    const { data: assignments } = await supabase
      .from('worker_assignments')
      .select('id')
      .in('employee_id', ids);
    
    const assignmentIds = (assignments ?? []).map(a => a.id);

    // 3. Cascade delete dependencies for all these IDs
    await supabase.from('id_card_links').delete().in('employee_id', ids);
    if (assignmentIds.length > 0) {
      await supabase.from('id_card_links').delete().in('assignment_id', assignmentIds);
    }
    
    await supabase.from('worker_assignments').delete().in('employee_id', ids);
    await supabase.from('employee_documents').delete().in('employee_id', ids);
    await supabase.from('attendance').delete().in('worker_id', ids);
    await supabase.from('leaves').delete().in('worker_id', ids);

    // 4. Finally, empty the trash in the employees table
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(`Failed to empty trash: ${deleteError.message}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

/**
 * Fetches all documents (ID proofs) for a specific employee.
 */
export async function getEmployeeDocuments(employeeId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err: any) {
    console.error('Failed to fetch employee documents:', err);
    return [];
  }
}

