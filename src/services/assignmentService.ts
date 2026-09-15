import { supabase } from '../lib/supabase';
import type {
  Employee,
  WorkerAssignment,
  IdCardLink,
} from '../types/hr';

// ── Env ───────────────────────────────────────────────────

// ── Return Types ──────────────────────────────────────────

export interface AssignmentResult {
  assignment:   WorkerAssignment;
  idCardLink:   IdCardLink;
  shareableUrl: string;
  whatsappSent: boolean;
  whatsappError?: string;
}

export interface AssignmentWithDetails {
  assignment:   WorkerAssignment;
  employee:     Employee;
  idCardLink:   IdCardLink | null;
  shareableUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────

/** Returns a date 30 days from now as an ISO string. */
function thirtyDaysFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

/** Generates a URL-safe random token using the Web Crypto API. */
function generateToken(): string {
  // crypto.randomUUID() is available in all modern browsers & Node 19+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');  // 32 hex chars
  }
  // Fallback: random bytes via Math.random (less secure, dev-only)
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/** Constructs the public-facing ID card shareable URL. */
export function buildShareableUrl(token: string): string {
  // Always prefer the explicit production URL env var, so WhatsApp links
  // are never localhost even when sent from a dev machine.
  const base =
    import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://health-care-iota-red.vercel.app');
  return `${base}/id-card/${token}`;
}

// ============================================================
// 1. WHATSAPP MESSAGE
// ============================================================

/**
 * Sends the ID card shareable link to a client via Meta WhatsApp Cloud API.
 *
 * If the send fails (network error, invalid token, etc.) the error is
 * returned as a string rather than thrown — so the caller can still
 * complete the assignment flow.
 *
 * @returns null on success, error message string on failure
 */
export async function sendIDCardLinkToClient(
  phoneNumber: string,
  employeeName: string,
  jobTitle: string,
  shareableUrl: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('send-id-card-link', {
      body: {
        phoneNumber,
        employeeName,
        jobTitle,
        shareableUrl
      }
    });

    if (error) {
       // Supabase edge function connection or parsing error
       return `Edge Function error: ${error.message}`;
    }

    if (data && data.success === false) {
       // Handled error returned by edge function
       return `WhatsApp send failed: ${data.error}`;
    }

    // Successfully sent
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `WhatsApp send failed: ${msg}`;
  }
}

// ============================================================
// 2. ASSIGN WORKER TO CLIENT
// ============================================================

/**
 * Performs the complete worker assignment flow:
 *
 * 1. Creates a worker_assignments record
 * 2. Updates the employee status to 'assigned'
 * 3. Generates a secure token & creates an id_card_links record
 * 4. Constructs the shareable URL
 * 5. Sends the URL to the client via WhatsApp (non-blocking on failure)
 *
 * If steps 1–3 fail, the error is thrown and no partial data is left
 * (manual compensation on each step). If step 5 (WhatsApp) fails, the
 * result is still returned with `whatsappSent: false`.
 */
export async function assignWorkerToClient(
  employeeUuid: string,
  clientUuid: string,
  notes?: string,
  depositPaid: number = 0,
  skipWhatsApp: boolean = false,
  billingData?: {
    startDate: string;
    endDate?: string;
    serviceType: 'one_day' | 'date_range';
    hoursPerDay?: number;
    totalBillAmount: number;
    depositAmount?: number;
  }
): Promise<AssignmentResult> {

  // ── Step 0: Ensure client exists in clients table (Convert from crm_leads if needed)
  const { data: existingClient } = await supabase.from('clients').select('id').eq('id', clientUuid).maybeSingle();
  if (!existingClient) {
    const { data: lead } = await supabase.from('crm_leads').select('*').eq('id', clientUuid).maybeSingle();
    if (lead) {
      await supabase.from('clients').insert({
        id: lead.id,
        client_name: lead.name,
        phone_number: lead.whatsapp_number || lead.phone,
        email: lead.email,
        created_at: new Date().toISOString()
      });
    }
  }

  // ── Step 0.4: Enforce Single-Client-Per-Worker Rule ─────
  // Prevent assigning a worker who is already active on another service / client
  const { data: existingSwa } = await supabase
    .from('service_worker_assignments')
    .select('id, service_id, services(id, status, client_id, lead_id, crm_leads(id, name))')
    .eq('employee_id', employeeUuid)
    .is('end_date', null);

  const conflictingSwa = (existingSwa || []).find((a: any) =>
    a.services &&
    (a.services.status === 'active' || a.services.status === 'pending') &&
    a.services.client_id !== clientUuid &&
    a.services.lead_id !== clientUuid &&
    a.services.crm_leads?.id !== clientUuid
  );

  if (conflictingSwa) {
    const conflictingClientName = (conflictingSwa as any).services?.crm_leads?.name || 'another client';
    const { data: emp } = await supabase.from('employees').select('full_name').eq('id', employeeUuid).maybeSingle();
    const workerName = emp?.full_name || 'Worker';
    throw new Error(`${workerName} is currently deployed to ${conflictingClientName}. Please release or end their active deployment before reassigning.`);
  }

  // Also check legacy worker_assignments table
  const { data: legacyActive } = await supabase
    .from('worker_assignments')
    .select('id, client_id, clients(client_name)')
    .eq('employee_id', employeeUuid)
    .eq('assignment_status', 'active')
    .is('end_date', null);

  const conflictingLegacy = (legacyActive || []).find((a: any) => a.client_id !== clientUuid);
  if (conflictingLegacy) {
    const conflictingClientName = (conflictingLegacy as any).clients?.client_name || 'another client';
    const { data: emp } = await supabase.from('employees').select('full_name').eq('id', employeeUuid).maybeSingle();
    const workerName = emp?.full_name || 'Worker';
    throw new Error(`${workerName} is currently deployed to ${conflictingClientName}. Please release or end their active deployment before reassigning.`);
  }

  // ── Step 0.5: Enforce Single Staff Rule ──────────────────
  // Removed: We now support multiple active workers per client using the new services model.

  // ── Step 0.8: Inherit deposit from active service if already collected ──
  let resolvedDepositPaid = depositPaid;
  let resolvedDepositAmount = billingData?.depositAmount ?? 0;
  if (resolvedDepositPaid <= 0) {
    const { data: activeSvc } = await supabase
      .from('services')
      .select('deposit_status, deposit_amount')
      .eq('client_id', clientUuid)
      .eq('status', 'active')
      .maybeSingle();

    if (activeSvc && activeSvc.deposit_status === 'collected') {
      resolvedDepositPaid = Number(activeSvc.deposit_amount) || 5000;
      resolvedDepositAmount = Number(activeSvc.deposit_amount) || 5000;
    }
  }

  // ── Step 1: Create assignment record ──────────────────
  const { data: assignment, error: assignError } = await supabase
    .from('worker_assignments')
    .insert({
      employee_id:       employeeUuid,
      client_id:         clientUuid,
      assignment_status: 'active',
      notes:             notes?.trim() ?? null,
      deposit_paid:      resolvedDepositPaid,
      deposit_amount:    resolvedDepositAmount,
      start_date:        billingData?.startDate || new Date().toISOString(),
      end_date:          billingData?.endDate ? billingData.endDate : null,
      service_type:      billingData?.serviceType || 'date_range',
      hours_per_day:     billingData?.hoursPerDay ?? 10,
      total_bill_amount: billingData?.totalBillAmount || 0,
      invoice_number:    `INV-${Date.now().toString().slice(-6)}`,
    })
    .select()
    .single();

  if (assignError || !assignment) {
    throw new Error(
      `Failed to create assignment: ${assignError?.message ?? 'No record returned'}`
    );
  }

  // ── Step 2: Update employee status and assigned client ──────
  const { data: lead } = await supabase.from('crm_leads').select('name, pipeline_stage, assigned_worker_role, complete_month_daily_rate, incomplete_month_daily_rate').eq('id', clientUuid).maybeSingle();
  const leadName = lead?.name || 'Assigned Client';

  const { error: statusError } = await supabase
    .from('employees')
    .update({
      status:          'assigned',
      assigned_client: leadName,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', employeeUuid);

  if (statusError) {
    // Compensate: delete the assignment we just created
    await supabase
      .from('worker_assignments')
      .delete()
      .eq('id', assignment.id);

    throw new Error(
      `Failed to update employee status: ${statusError.message}. Assignment rolled back.`
    );
  }

  // ── Step 2b: Update CRM Lead stage + store assigned worker info ──────────────────
  const { data: empInfo } = await supabase.from('employees').select('full_name, job_title').eq('id', employeeUuid).single();
  
  // Only advance to 'Staff Assigned' if they are in an earlier stage
  const currentStage = lead?.pipeline_stage || '';
  const advancedStages = ['Staff Assigned', 'Deposit Pending', 'Active Client', 'Monthly Billing', 'Closed Won', 'Archived'];
  const shouldAdvanceStage = !advancedStages.includes(currentStage);

  const leadUpdatePayload: any = {
      assigned_worker_name: empInfo?.full_name ?? null,
      assigned_worker_role: empInfo?.job_title ?? null,
  };

  if (shouldAdvanceStage) {
      leadUpdatePayload.pipeline_stage = 'Staff Assigned';
  }

  await supabase
    .from('crm_leads')
    .update(leadUpdatePayload)
    .eq('id', clientUuid);

  // ── Step 3: Generate token ────────────────────────────
  const token = generateToken();

  // ── Step 4: Create id_card_links record ───────────────
  const { data: idCardLink, error: linkError } = await supabase
    .from('id_card_links')
    .insert({
      employee_id:   employeeUuid,
      assignment_id: assignment.id,
      token,
      is_active:     true,
      expires_at:    thirtyDaysFromNow(),
    })
    .select()
    .single();

  if (linkError || !idCardLink) {
    // Compensate: revert employee status and delete assignment
    await supabase
      .from('employees')
      .update({ status: 'available', updated_at: new Date().toISOString() })
      .eq('id', employeeUuid);
    await supabase
      .from('worker_assignments')
      .delete()
      .eq('id', assignment.id);

    throw new Error(
      `Failed to create ID card link: ${linkError?.message ?? 'No record returned'}. Assignment rolled back.`
    );
  }

  // ── Step 5: Construct shareable URL ───────────────────
  const shareableUrl = buildShareableUrl(token);

  // ── Step 6: Send WhatsApp notification (non-fatal) ────
  // Fetch the client's phone number first
  let whatsappSent = false;
  let whatsappError: string | undefined;

  if (!skipWhatsApp) {
    try {
      // Try regular clients table first
      const { data: client } = await supabase
        .from('clients')
        .select('phone_number, client_name')
        .eq('id', clientUuid)
        .single();

      let targetPhone = client?.phone_number;
      let targetName = client?.client_name;

      // Fallback to crm_leads if not found in clients
      if (!targetPhone) {
        const { data: lead } = await supabase
          .from('crm_leads')
          .select('whatsapp_number, phone, name')
          .eq('id', clientUuid)
          .single();
        
        if (lead) {
          targetPhone = lead.whatsapp_number || lead.phone;
          targetName = lead.name;
        }
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('full_name, job_title')
        .eq('id', employeeUuid)
        .single();

      if (targetPhone && employee) {
        // Standardize phone format for WhatsApp (ensure it has country code if missing)
        let phoneDigits = targetPhone.replace(/\D/g, '');
        if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;

        const sendError = await sendIDCardLinkToClient(
          phoneDigits,
          employee.full_name,
          employee.job_title,
          shareableUrl
        );
        if (sendError) {
          whatsappError = sendError;
        } else {
          whatsappSent = true;
        }
      } else {
        whatsappError = 'Target contact number not on file — WhatsApp skipped.';
      }
    } catch (err: unknown) {
      whatsappError = err instanceof Error ? err.message : String(err);
    }
  } else {
    // CRM dispatch handles WhatsApp — skip to avoid double message
    whatsappError = 'Skipped: CRM dispatch handles WhatsApp delivery';
  }

  // ── Step 7: Dual-Sync with services & service_worker_assignments ────
  try {
    const { data: activeSvc } = await supabase
      .from('services')
      .select('id, start_date, deposit_amount, deposit_status')
      .or(`client_id.eq.${clientUuid},lead_id.eq.${clientUuid}`)
      .eq('status', 'active')
      .maybeSingle();

    let targetServiceId = activeSvc?.id;

    if (!targetServiceId) {
      const startDate = billingData?.startDate ? billingData.startDate.split('T')[0] : new Date().toISOString().split('T')[0];
      const serviceType = billingData?.serviceType || lead?.assigned_worker_role || 'Home Care Service';
      const depositAmt = resolvedDepositAmount > 0 ? resolvedDepositAmount : 5000;
      const depStatus = (resolvedDepositPaid >= depositAmt && depositAmt > 0) ? 'collected' : 'pending';

      const { data: newSvc, error: svcInsertErr } = await supabase
        .from('services')
        .insert([{
          client_id: clientUuid,
          lead_id: clientUuid,
          service_type: serviceType,
          hours_per_day: billingData?.hoursPerDay || 10,
          start_date: startDate,
          end_date: billingData?.endDate ? billingData.endDate.split('T')[0] : null,
          status: 'active',
          deposit_amount: depositAmt,
          deposit_status: depStatus,
          complete_month_daily_rate: Number(lead?.complete_month_daily_rate) || 0,
          incomplete_month_daily_rate: Number(lead?.incomplete_month_daily_rate) || 0,
        }])
        .select('id')
        .maybeSingle();

      if (!svcInsertErr && newSvc?.id) {
        targetServiceId = newSvc.id;
      }
    }

    if (targetServiceId) {
      const { data: existingSwa } = await supabase
        .from('service_worker_assignments')
        .select('id')
        .eq('service_id', targetServiceId)
        .eq('employee_id', employeeUuid)
        .is('end_date', null)
        .maybeSingle();

      if (!existingSwa) {
        const asgnStartDate = billingData?.startDate ? billingData.startDate.split('T')[0] : new Date().toISOString().split('T')[0];
        await supabase.from('service_worker_assignments').insert([{
          service_id: targetServiceId,
          employee_id: employeeUuid,
          start_date: asgnStartDate,
          end_date: billingData?.endDate ? billingData.endDate.split('T')[0] : null,
        }]);
      }
    }
  } catch (svcSyncErr) {
    console.warn('assignmentService: dual-sync with services/service_worker_assignments error:', svcSyncErr);
  }

  return {
    assignment:   assignment as WorkerAssignment,
    idCardLink:   idCardLink as IdCardLink,
    shareableUrl,
    whatsappSent,
    ...(whatsappError ? { whatsappError } : {}),
  };
}

// ============================================================
// 3. DEACTIVATE ID CARD LINK
// ============================================================

/**
 * Deactivates the id_card_links record tied to an assignment.
 * Called when an assignment is completed or cancelled.
 *
 * Also updates the worker_assignments status to the provided value.
 */
export async function deactivateIDCardLink(
  assignmentId: string,
  newAssignmentStatus: 'completed' | 'cancelled' = 'completed'
): Promise<void> {
  // Deactivate the link
  const { error: linkError } = await supabase
    .from('id_card_links')
    .update({ is_active: false })
    .eq('assignment_id', assignmentId);

  if (linkError) {
    throw new Error(`Failed to deactivate ID card link: ${linkError.message}`);
  }

  // Update assignment status
  const { error: assignError } = await supabase
    .from('worker_assignments')
    .update({ assignment_status: newAssignmentStatus })
    .eq('id', assignmentId);

  if (assignError) {
    throw new Error(`Failed to update assignment status: ${assignError.message}`);
  }

  // Revert employee status back to 'available'
  // First get the employee_id from the assignment
  const { data: assignment } = await supabase
    .from('worker_assignments')
    .select('employee_id, client_id')
    .eq('id', assignmentId)
    .single();

  if (assignment?.employee_id) {
    await supabase
      .from('employees')
      .update({ 
        status: 'available', 
        assigned_client: null, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', assignment.employee_id);
  }

  // Clear the denormalized worker info from the lead record
  if (assignment?.client_id) {
    await supabase
      .from('crm_leads')
      .update({ assigned_worker_name: null, assigned_worker_role: null })
      .eq('id', assignment.client_id);
  }
}

// ============================================================
// 4. GET ASSIGNMENT WITH ID CARD DETAILS
// ============================================================

/**
 * Fetches a full assignment record including joined employee details
 * and the associated id_card_links row.
 *
 * Returns the shareable URL if an active link exists.
 */
export async function getAssignmentWithIDCard(
  assignmentId: string
): Promise<AssignmentWithDetails> {
  // Fetch assignment + employee in one query
  const { data: assignment, error: assignError } = await supabase
    .from('worker_assignments')
    .select(`
      *,
      employees (*)
    `)
    .eq('id', assignmentId)
    .single();

  if (assignError || !assignment) {
    throw new Error(
      `Assignment not found: ${assignError?.message ?? assignmentId}`
    );
  }

  // Fetch the id_card_link separately (simpler, avoids nested join complexity)
  const { data: idCardLink } = await supabase
    .from('id_card_links')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const shareableUrl = idCardLink
    ? buildShareableUrl(idCardLink.token)
    : null;

  // Destructure the nested employee out of the assignment row
  const { employees: employee, ...assignmentOnly } = assignment as any;

  return {
    assignment:   assignmentOnly as WorkerAssignment,
    employee:     employee       as Employee,
    idCardLink:   (idCardLink ?? null) as IdCardLink | null,
    shareableUrl,
  };
}

// ============================================================
// 5. RELEASE WORKER BY CLIENT ID
// ============================================================

/**
 * Finds the active assignment for a given client (lead) and releases the worker.
 * Automatically called when a lead is moved backward in the pipeline out of the "Staff Assigned" stage.
 */
export async function releaseWorkerByClientId(clientId: string): Promise<void> {
  const { data: assignment } = await supabase
    .from('worker_assignments')
    .select('id, employee_id')
    .eq('client_id', clientId)
    .eq('assignment_status', 'active')
    .maybeSingle();

  const todayStr = new Date().toISOString().split('T')[0];

  if (assignment) {
    await deactivateIDCardLink(assignment.id, 'cancelled');
    await supabase.from('worker_assignments').update({
      assignment_status: 'completed',
      end_date: todayStr
    }).eq('id', assignment.id);
  }

  // Also release in service_worker_assignments if active
  try {
    const { data: activeSvc } = await supabase
      .from('services')
      .select('id')
      .or(`client_id.eq.${clientId},lead_id.eq.${clientId}`)
      .eq('status', 'active')
      .maybeSingle();

    if (activeSvc) {
      await supabase
        .from('service_worker_assignments')
        .update({ end_date: todayStr })
        .eq('service_id', activeSvc.id)
        .is('end_date', null);
    }
  } catch (err) {
    console.warn('Failed to release in service_worker_assignments:', err);
  }
}
