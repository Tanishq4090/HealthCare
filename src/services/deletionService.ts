import { supabase } from '../lib/supabase';
import { deleteEmployee, permanentlyDeleteEmployee } from './employeeService';

export type DeletionEntityType = 'client' | 'lead' | 'worker' | 'attendance';
export type DeletionActionType = 'move_to_trash' | 'permanent_delete';
export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DeletionRequest {
    id: string;
    entity_type: DeletionEntityType;
    entity_id: string;
    entity_name: string;
    action_type: DeletionActionType;
    reason?: string;
    requested_by_id: string;
    requested_by_name: string;
    status: DeletionRequestStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    review_note?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface SubmitDeletionParams {
    entityType: DeletionEntityType;
    entityId: string;
    entityName: string;
    actionType: DeletionActionType;
    reason?: string;
    requestedById: string;
    requestedByName: string;
    metadata?: Record<string, any>;
}

/**
 * Submits a new deletion request from a non-admin user
 */
export async function submitDeletionRequest(params: SubmitDeletionParams): Promise<DeletionRequest> {
    const { data, error } = await supabase
        .from('deletion_requests')
        .insert([{
            entity_type: params.entityType,
            entity_id: params.entityId,
            entity_name: params.entityName,
            action_type: params.actionType,
            reason: params.reason?.trim() || null,
            requested_by_id: params.requestedById,
            requested_by_name: params.requestedByName,
            status: 'pending',
            metadata: params.metadata || {},
        }])
        .select()
        .single();

    if (error) {
        console.error('Error submitting deletion request:', error);
        throw new Error(`Failed to submit deletion request: ${error.message}`);
    }

    // Optional: Log to crm_lead_activity if entity is a lead or client
    if (params.entityType === 'lead' || params.entityType === 'client') {
        try {
            await supabase.from('crm_lead_activity').insert([{
                lead_id: params.entityId,
                event_type: 'deletion_requested',
                description: `Deletion requested by ${params.requestedByName} (${params.actionType === 'move_to_trash' ? 'Move to Trash' : 'Permanent Delete'}). Reason: ${params.reason || 'No reason provided.'}`,
                metadata: {
                    request_id: data.id,
                    requested_by: params.requestedByName,
                    action_type: params.actionType,
                    reason: params.reason,
                }
            }]);
        } catch (logErr) {
            console.warn('Could not log deletion request activity:', logErr);
        }
    }

    return data as DeletionRequest;
}

/**
 * Fetches all pending deletion requests for Admin review
 */
export async function fetchPendingDeletionRequests(): Promise<DeletionRequest[]> {
    const { data, error } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching pending deletion requests:', error);
        throw error;
    }

    return (data || []) as DeletionRequest[];
}

/**
 * Fetches all deletion requests (audit log for Access Control)
 */
export async function fetchAllDeletionRequests(): Promise<DeletionRequest[]> {
    const { data, error } = await supabase
        .from('deletion_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all deletion requests:', error);
        throw error;
    }

    return (data || []) as DeletionRequest[];
}

/**
 * Approves and executes a deletion request (System Admin only)
 */
export async function approveDeletionRequest(
    request: DeletionRequest,
    adminIdentifier = 'System Admin'
): Promise<void> {
    const { entity_type, entity_id, action_type } = request;

    // 1. Execute actual deletion based on entity type and action type
    try {
        if (entity_type === 'client') {
            if (action_type === 'move_to_trash') {
                const { error } = await supabase
                    .from('crm_leads')
                    .update({ pipeline_stage: 'Trash', updated_at: new Date().toISOString() })
                    .eq('id', entity_id);
                if (error) throw error;
            } else {
                // Permanent delete
                await supabase.from('crm_leads').delete().eq('id', entity_id);
                const { error } = await supabase.from('clients').delete().eq('id', entity_id);
                if (error) throw error;
            }
        } else if (entity_type === 'lead') {
            if (action_type === 'move_to_trash') {
                const { error } = await supabase
                    .from('crm_leads')
                    .update({
                        pipeline_stage: 'Trash',
                        deleted_at: new Date().toISOString(),
                    })
                    .eq('id', entity_id);
                if (error) throw error;
            } else {
                // Permanent delete using robust cleanup RPC
                try {
                    const { error: rpcErr } = await supabase.rpc('delete_crm_lead_robust', { target_lead_id: entity_id });
                    if (rpcErr) throw rpcErr;
                } catch {
                    // Fallback to direct delete
                    const { error: delErr } = await supabase.from('crm_leads').delete().eq('id', entity_id);
                    if (delErr) throw delErr;
                }
            }
        } else if (entity_type === 'worker') {
            if (action_type === 'move_to_trash') {
                await deleteEmployee(entity_id);
            } else {
                await permanentlyDeleteEmployee(entity_id);
            }
        } else if (entity_type === 'attendance') {
            const { error } = await supabase.from('attendance').delete().eq('id', entity_id);
            if (error) throw error;
        }
    } catch (execErr: any) {
        console.error(`Failed to execute deletion for request ${request.id}:`, execErr);
        throw new Error(`Execution error: ${execErr.message || 'Underlying deletion failed'}`);
    }

    // 2. Mark deletion request as approved
    const { error: updateErr } = await supabase
        .from('deletion_requests')
        .update({
            status: 'approved',
            reviewed_by: adminIdentifier,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

    if (updateErr) {
        console.error('Error updating deletion request status to approved:', updateErr);
        throw updateErr;
    }
}

/**
 * Rejects a deletion request (System Admin only)
 */
export async function rejectDeletionRequest(
    requestId: string,
    reviewNote?: string,
    adminIdentifier = 'System Admin'
): Promise<void> {
    const { error } = await supabase
        .from('deletion_requests')
        .update({
            status: 'rejected',
            review_note: reviewNote?.trim() || null,
            reviewed_by: adminIdentifier,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

    if (error) {
        console.error('Error rejecting deletion request:', error);
        throw error;
    }
}
