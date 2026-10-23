import { supabase } from '../lib/supabase';
import { getDeviceInfo, getClientIp, type DeviceInfo } from '../utils/deviceInfo';

export type AuditAction = 'VIEW' | 'EDIT' | 'EXPORT' | 'SERVICE_CHANGE' | 'DELETE' | 'CREATE';
export type AuditEntityType = 'client' | 'lead' | 'worker' | 'finance';

export interface AuditLogChanges {
    fields?: string[];
    before?: Record<string, any>;
    after?: Record<string, any>;
    diff?: Record<string, { from: any; to: any }>;
    export_details?: {
        format: 'csv' | 'excel' | 'clipboard';
        record_count: number;
        sample_names?: string[];
        filters_applied?: Record<string, any>;
    };
    meta?: Record<string, any>;
}

export interface AuditLogItem {
    id: string;
    entity_type: AuditEntityType;
    entity_id: string;
    entity_name: string;
    action: AuditAction;
    description: string;
    user_id: string;
    user_name: string;
    user_role: string;
    device_info: DeviceInfo;
    changes?: AuditLogChanges;
    created_at: string;
}

export interface LogAuditParams {
    entityType: AuditEntityType;
    entityId: string;
    entityName: string;
    action: AuditAction;
    description: string;
    userId?: string;
    userName?: string;
    userRole?: string;
    changes?: AuditLogChanges;
}

// In-memory debounce cache to avoid duplicate VIEW logs within 60s
const recentViewsMap = new Map<string, number>();

/**
 * Gets currently logged-in user from storage as fallback
 */
function resolveCurrentStaffUser(): { id: string; name: string; role: string } {
    try {
        const stored = sessionStorage.getItem('99care_os_session_user') || localStorage.getItem('99care_os_auth_user');
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                id: parsed.id || 'unknown',
                name: parsed.name || parsed.username || 'Staff User',
                role: parsed.role || 'user',
            };
        }
    } catch {
        // Ignore JSON error
    }
    return { id: 'admin', name: 'System Admin', role: 'admin' };
}

/**
 * Records an audit log entry in Supabase with device metadata and diffs.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
    try {
        // Prevent duplicate views of the same client within 60 seconds
        if (params.action === 'VIEW') {
            const key = `${params.entityId}_${params.userId || 'anon'}`;
            const lastView = recentViewsMap.get(key);
            const now = Date.now();
            if (lastView && now - lastView < 60000) {
                return; // Debounce duplicate views
            }
            recentViewsMap.set(key, now);
        }

        const currentUser = resolveCurrentStaffUser();
        const userId = params.userId || currentUser.id;
        const userName = params.userName || currentUser.name;
        const userRole = params.userRole || currentUser.role;

        // Fetch IP asynchronously with graceful timeout
        const ip = await getClientIp();
        const device = getDeviceInfo();
        device.ip = ip;

        const payload = {
            entity_type: params.entityType,
            entity_id: params.entityId,
            entity_name: params.entityName,
            action: params.action,
            description: params.description,
            user_id: userId,
            user_name: userName,
            user_role: userRole,
            device_info: device,
            changes: params.changes || {},
            created_at: new Date().toISOString(),
        };

        // 1. Try writing to dedicated audit_logs table
        const { error: primaryError } = await supabase.from('audit_logs').insert([payload]);

        if (!primaryError) return;

        // 2. If audit_logs table is missing (code PGRST205 / 404), fallback to deletion_requests storage
        if (primaryError.code === 'PGRST205' || primaryError.message?.includes('schema cache')) {
            await supabase.from('deletion_requests').insert([{
                entity_type: params.entityType,
                entity_id: params.entityId,
                entity_name: params.entityName,
                action_type: 'audit_log',
                reason: params.description,
                requested_by_id: userId,
                requested_by_name: userName,
                status: 'audit',
                metadata: {
                    action: params.action,
                    user_role: userRole,
                    device_info: device,
                    changes: params.changes || {},
                },
                created_at: payload.created_at,
            }]);
        } else {
            console.warn('Audit logging notice:', primaryError.message);
        }
    } catch (err) {
        // Audit logging should never crash the host application
        console.warn('Failed to record audit log:', err);
    }
}

/**
 * Computes a field-by-field diff between original and modified objects.
 */
export function computeObjectDiff(
    before: Record<string, any>,
    after: Record<string, any>,
    ignoredKeys: string[] = ['updated_at', 'created_at', 'id']
): { fields: string[]; diff: Record<string, { from: any; to: any }> } {
    const fields: string[] = [];
    const diff: Record<string, { from: any; to: any }> = {};

    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
        if (ignoredKeys.includes(key)) continue;

        const valBefore = before?.[key];
        const valAfter = after?.[key];

        // Deep comparison for primitives and simple arrays
        const stringBefore = JSON.stringify(valBefore ?? null);
        const stringAfter = JSON.stringify(valAfter ?? null);

        if (stringBefore !== stringAfter) {
            fields.push(key);
            diff[key] = {
                from: valBefore ?? '—',
                to: valAfter ?? '—',
            };
        }
    }

    return { fields, diff };
}

/**
 * Helper: Log client profile view
 */
export function logClientView(
    client: { id: string; name?: string; client_name?: string },
    user?: { id?: string; name?: string; role?: string }
) {
    const clientName = client.name || client.client_name || 'Client';
    return logAuditEvent({
        entityType: 'client',
        entityId: client.id,
        entityName: clientName,
        action: 'VIEW',
        description: `Viewed client profile: ${clientName}`,
        userId: user?.id,
        userName: user?.name,
        userRole: user?.role,
    });
}

/**
 * Helper: Log client profile edit
 */
export function logClientEdit(
    client: { id: string; name?: string; client_name?: string },
    before: Record<string, any>,
    after: Record<string, any>,
    user?: { id?: string; name?: string; role?: string },
    customNote?: string
) {
    const clientName = client.name || client.client_name || 'Client';
    const { fields, diff } = computeObjectDiff(before, after);

    if (fields.length === 0 && !customNote) return Promise.resolve();

    const desc = customNote || `Updated client ${fields.length} field(s): ${fields.join(', ')}`;

    return logAuditEvent({
        entityType: 'client',
        entityId: client.id,
        entityName: clientName,
        action: 'EDIT',
        description: desc,
        userId: user?.id,
        userName: user?.name,
        userRole: user?.role,
        changes: {
            fields,
            before,
            after,
            diff,
        },
    });
}

/**
 * Helper: Log client data export
 */
export function logClientExport(
    format: 'csv' | 'excel' | 'clipboard',
    count: number,
    sampleNames: string[] = [],
    filters?: Record<string, any>,
    user?: { id?: string; name?: string; role?: string }
) {
    const formatLabel = format === 'csv' ? 'CSV' : format === 'excel' ? 'Excel' : 'Clipboard (Bulk Copy)';
    return logAuditEvent({
        entityType: 'client',
        entityId: 'bulk_export',
        entityName: `${count} Clients`,
        action: 'EXPORT',
        description: `Exported ${count} client record(s) to ${formatLabel}`,
        userId: user?.id,
        userName: user?.name,
        userRole: user?.role,
        changes: {
            export_details: {
                format,
                record_count: count,
                sample_names: sampleNames.slice(0, 5),
                filters_applied: filters,
            },
        },
    });
}

/**
 * Fetches all audit logs from Supabase for Admin inspection.
 */
export async function fetchAuditLogs(filters?: {
    action?: string;
    userId?: string;
    search?: string;
    limit?: number;
}): Promise<AuditLogItem[]> {
    const limit = filters?.limit || 200;

    // 1. Try querying dedicated audit_logs table
    let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (filters?.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
    }
    if (filters?.userId && filters.userId !== 'all') {
        query = query.eq('user_id', filters.userId);
    }

    const { data: primaryData, error: primaryError } = await query;

    if (!primaryError && primaryData) {
        let results = primaryData as AuditLogItem[];
        if (filters?.search) {
            const s = filters.search.toLowerCase();
            results = results.filter(item =>
                item.entity_name?.toLowerCase().includes(s) ||
                item.user_name?.toLowerCase().includes(s) ||
                item.description?.toLowerCase().includes(s) ||
                item.device_info?.os?.toLowerCase().includes(s) ||
                item.device_info?.browser?.toLowerCase().includes(s) ||
                item.device_info?.ip?.toLowerCase().includes(s)
            );
        }
        return results;
    }

    // 2. Fallback query to deletion_requests where action_type = 'audit_log'
    let fallbackQuery = supabase
        .from('deletion_requests')
        .select('*')
        .eq('action_type', 'audit_log')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (filters?.userId && filters.userId !== 'all') {
        fallbackQuery = fallbackQuery.eq('requested_by_id', filters.userId);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;

    if (fallbackError) {
        console.error('Error fetching audit logs:', fallbackError);
        return [];
    }

    let items: AuditLogItem[] = (fallbackData || []).map((row: any) => {
        const meta = row.metadata || {};
        return {
            id: row.id,
            entity_type: (row.entity_type || 'client') as AuditEntityType,
            entity_id: row.entity_id,
            entity_name: row.entity_name,
            action: (meta.action || 'EDIT') as AuditAction,
            description: row.reason || 'Client data operation',
            user_id: row.requested_by_id,
            user_name: row.requested_by_name,
            user_role: meta.user_role || 'staff',
            device_info: meta.device_info || {
                deviceType: 'Desktop',
                os: 'Unknown',
                browser: 'Unknown',
                screen: 'N/A',
                userAgent: '',
            },
            changes: meta.changes,
            created_at: row.created_at,
        };
    });

    if (filters?.action && filters.action !== 'all') {
        items = items.filter(i => i.action === filters.action);
    }

    if (filters?.search) {
        const s = filters.search.toLowerCase();
        items = items.filter(item =>
            item.entity_name?.toLowerCase().includes(s) ||
            item.user_name?.toLowerCase().includes(s) ||
            item.description?.toLowerCase().includes(s) ||
            item.device_info?.os?.toLowerCase().includes(s) ||
            item.device_info?.browser?.toLowerCase().includes(s) ||
            item.device_info?.ip?.toLowerCase().includes(s)
        );
    }

    return items;
}

/**
 * Fetches audit logs specific to a given client.
 */
export async function fetchClientAuditHistory(clientId: string): Promise<AuditLogItem[]> {
    if (!clientId) return [];

    // Try primary table
    const { data: primaryData, error: primaryError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (!primaryError && primaryData) {
        return primaryData as AuditLogItem[];
    }

    // Try fallback
    const { data: fallbackData, error: fallbackError } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('action_type', 'audit_log')
        .eq('entity_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (fallbackError || !fallbackData) return [];

    return fallbackData.map((row: any) => {
        const meta = row.metadata || {};
        return {
            id: row.id,
            entity_type: (row.entity_type || 'client') as AuditEntityType,
            entity_id: row.entity_id,
            entity_name: row.entity_name,
            action: (meta.action || 'EDIT') as AuditAction,
            description: row.reason || 'Client data operation',
            user_id: row.requested_by_id,
            user_name: row.requested_by_name,
            user_role: meta.user_role || 'staff',
            device_info: meta.device_info || {
                deviceType: 'Desktop',
                os: 'Unknown',
                browser: 'Unknown',
                screen: 'N/A',
                userAgent: '',
            },
            changes: meta.changes,
            created_at: row.created_at,
        };
    });
}
