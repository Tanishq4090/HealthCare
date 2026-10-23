import { supabase } from '../lib/supabase';
import { logClientEdit, logAuditEvent } from './auditService';

export type DPDPRetentionPeriod = '1_year' | '3_years_clinical' | '7_years_tax' | 'custom' | 'indefinite';
export type DPDPConsentChannel = 'whatsapp_flow' | 'web_form' | 'admin_recorded' | 'physical_form';
export type DPDPConsentStatus = 'granted' | 'withdrawn' | 'partially_granted';

export interface DPDPConsentData {
    consent_data_storage: boolean;       // Core health records & care execution
    consent_marketing: boolean;          // Marketing & promotional messages (WhatsApp/SMS)
    consent_review_messages: boolean;   // Post-service quality review & feedback requests
    
    consent_status: DPDPConsentStatus;
    consent_channel: DPDPConsentChannel;
    notice_version: string;
    recorded_at: string;
    recorded_by_user?: string;
    recorded_by_name?: string;
    
    retention_period: DPDPRetentionPeriod;
    retention_start_date: string;
    retention_until_date: string;
    
    withdrawn_at?: string;
    withdrawn_reason?: string;
}

export const DEFAULT_NOTICE_VERSION = 'DPDP-2023-V1.0';

/**
 * Calculates retention expiry date based on starting date and period policy.
 */
export function calculateRetentionExpiryDate(
    startDateInput: string | Date = new Date(),
    period: DPDPRetentionPeriod = '3_years_clinical',
    customDate?: string
): string {
    const baseDate = new Date(startDateInput);
    if (isNaN(baseDate.getTime())) return new Date().toISOString();

    if (period === 'custom' && customDate) {
        return new Date(customDate).toISOString();
    }

    const expiry = new Date(baseDate);
    switch (period) {
        case '1_year':
            expiry.setFullYear(expiry.getFullYear() + 1);
            break;
        case '3_years_clinical':
            expiry.setFullYear(expiry.getFullYear() + 3);
            break;
        case '7_years_tax':
            expiry.setFullYear(expiry.getFullYear() + 7);
            break;
        case 'indefinite':
            expiry.setFullYear(expiry.getFullYear() + 10);
            break;
        default:
            expiry.setFullYear(expiry.getFullYear() + 3);
    }
    return expiry.toISOString();
}

/**
 * Evaluates active retention compliance status.
 */
export function getRetentionStatus(retentionUntilDate?: string): {
    status: 'active' | 'expiring_soon' | 'expired';
    daysRemaining: number;
    label: string;
} {
    if (!retentionUntilDate) {
        return { status: 'active', daysRemaining: 1095, label: 'Standard Clinical Retention (3 Years)' };
    }

    const now = new Date().getTime();
    const expiry = new Date(retentionUntilDate).getTime();
    if (isNaN(expiry)) {
        return { status: 'active', daysRemaining: 1095, label: 'Standard Clinical Retention (3 Years)' };
    }

    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return {
            status: 'expired',
            daysRemaining: diffDays,
            label: `Retention Expired (${Math.abs(diffDays)} days ago) — Eligible for Purging under DPDP Act`
        };
    }

    if (diffDays <= 90) {
        return {
            status: 'expiring_soon',
            daysRemaining: diffDays,
            label: `Expiring Soon (${diffDays} days remaining)`
        };
    }

    const years = (diffDays / 365).toFixed(1);
    return {
        status: 'active',
        daysRemaining: diffDays,
        label: `Active (${years} years / ${diffDays} days remaining)`
    };
}

/**
 * Normalizes raw consent data from database into typed DPDPConsentData.
 */
export function normalizeDPDPConsent(raw: any, clientCreatedAt?: string): DPDPConsentData {
    const rawConsent = raw?.dpdp_consent || (typeof raw?.other_details === 'object' ? raw.other_details?.dpdp_consent : null);
    const now = new Date().toISOString();
    const createdDate = clientCreatedAt || raw?.created_at || now;

    if (rawConsent && typeof rawConsent === 'object') {
        const untilDate = rawConsent.retention_until_date ||
            calculateRetentionExpiryDate(rawConsent.retention_start_date || createdDate, rawConsent.retention_period || '3_years_clinical');

        return {
            consent_data_storage: rawConsent.consent_data_storage !== false,
            consent_marketing: Boolean(rawConsent.consent_marketing),
            consent_review_messages: Boolean(rawConsent.consent_review_messages),
            consent_status: rawConsent.consent_status || (rawConsent.withdrawn_at ? 'withdrawn' : 'granted'),
            consent_channel: rawConsent.consent_channel || 'admin_recorded',
            notice_version: rawConsent.notice_version || DEFAULT_NOTICE_VERSION,
            recorded_at: rawConsent.recorded_at || raw?.created_at || now,
            recorded_by_user: rawConsent.recorded_by_user,
            recorded_by_name: rawConsent.recorded_by_name,
            retention_period: rawConsent.retention_period || '3_years_clinical',
            retention_start_date: rawConsent.retention_start_date || createdDate,
            retention_until_date: untilDate,
            withdrawn_at: rawConsent.withdrawn_at,
            withdrawn_reason: rawConsent.withdrawn_reason,
        };
    }

    // Default baseline compliant structure for existing clients
    const defaultUntil = calculateRetentionExpiryDate(createdDate, '3_years_clinical');
    return {
        consent_data_storage: true,
        consent_marketing: false, // Affirmative opt-in required under DPDP Act 2023
        consent_review_messages: false,
        consent_status: 'granted',
        consent_channel: 'admin_recorded',
        notice_version: DEFAULT_NOTICE_VERSION,
        recorded_at: now,
        retention_period: '3_years_clinical',
        retention_start_date: createdDate,
        retention_until_date: defaultUntil,
    };
}

/**
 * Helper to check if promotional WhatsApp messages can be sent under DPDP Act.
 */
export function canSendMarketing(consent?: DPDPConsentData | null): boolean {
    if (!consent) return false;
    return consent.consent_marketing === true && consent.consent_status !== 'withdrawn';
}

/**
 * Helper to check if review / feedback messages can be sent under DPDP Act.
 */
export function canSendReviewRequest(consent?: DPDPConsentData | null): boolean {
    if (!consent) return false;
    return consent.consent_review_messages === true && consent.consent_status !== 'withdrawn';
}

/**
 * Persist DPDP consent update to database with audit tracking.
 */
export async function saveClientDPDPConsent({
    clientId,
    clientName,
    clientRef,
    updatedConsent,
    previousConsent,
    currentUser,
}: {
    clientId: string;
    clientName: string;
    clientRef?: any;
    updatedConsent: DPDPConsentData;
    previousConsent?: DPDPConsentData;
    currentUser?: { id: string; name: string; role: string };
}): Promise<{ success: boolean; error?: string }> {
    try {
        const payloadToSave: DPDPConsentData = {
            ...updatedConsent,
            recorded_at: new Date().toISOString(),
            recorded_by_user: currentUser?.id,
            recorded_by_name: currentUser?.name || 'Administrator',
            notice_version: updatedConsent.notice_version || DEFAULT_NOTICE_VERSION,
        };

        // 1. Try updating crm_leads if column or work_form_data exists
        const { error: leadErr } = await supabase
            .from('crm_leads')
            .update({
                dpdp_consent: payloadToSave,
            })
            .eq('id', clientId);

        if (leadErr) {
            // Fallback: If dpdp_consent column doesn't exist yet on crm_leads, update client_consents
            console.warn('Could not update dpdp_consent on crm_leads, trying client_consents fallback:', leadErr.message);
        }

        // 2. Also sync to client_consents table
        const { data: latestConsents } = await supabase
            .from('client_consents')
            .select('id')
            .eq('lead_id', clientId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (latestConsents && latestConsents.length > 0) {
            await supabase
                .from('client_consents')
                .update({
                    dpdp_consent: payloadToSave,
                })
                .eq('id', latestConsents[0].id);
        } else {
            // Create a baseline consent record with DPDP metadata
            await supabase
                .from('client_consents')
                .insert([{
                    lead_id: clientId,
                    patient_name: clientName,
                    dpdp_consent: payloadToSave,
                    terms_accepted: payloadToSave.consent_data_storage,
                }]);
        }

        // 3. Log Audit Trail with Device & Connection context
        logClientEdit(
            clientRef || { id: clientId, name: clientName },
            previousConsent || {},
            payloadToSave,
            currentUser,
            `Updated DPDP Act 2023 Consent & Retention Policy: Storage=${payloadToSave.consent_data_storage ? 'Yes' : 'No'}, Marketing=${payloadToSave.consent_marketing ? 'Yes' : 'No'}, Reviews=${payloadToSave.consent_review_messages ? 'Yes' : 'No'}, Retention=${payloadToSave.retention_period}`
        );

        return { success: true };
    } catch (err: any) {
        console.error('Failed to save DPDP consent:', err);
        return { success: false, error: err.message || 'Failed to save consent' };
    }
}

/**
 * Record client consent withdrawal under DPDP Act 2023 Section 6(4).
 */
export async function withdrawClientDPDPConsent({
    clientId,
    clientName,
    clientRef,
    reason,
    previousConsent,
    currentUser,
}: {
    clientId: string;
    clientName: string;
    clientRef?: any;
    reason: string;
    previousConsent?: DPDPConsentData;
    currentUser?: { id: string; name: string; role: string };
}): Promise<{ success: boolean; error?: string }> {
    const withdrawnData: DPDPConsentData = {
        ...(previousConsent || normalizeDPDPConsent(null)),
        consent_status: 'withdrawn',
        consent_marketing: false,
        consent_review_messages: false,
        withdrawn_at: new Date().toISOString(),
        withdrawn_reason: reason || 'Client requested consent revocation',
    };

    const res = await saveClientDPDPConsent({
        clientId,
        clientName,
        clientRef,
        updatedConsent: withdrawnData,
        previousConsent,
        currentUser,
    });

    if (res.success) {
        logAuditEvent({
            entityType: 'client',
            entityId: clientId,
            entityName: clientName,
            action: 'EDIT',
            description: `Withdrew client consent under DPDP Act 2023. Reason: "${reason || 'No reason specified'}"`,
            userId: currentUser?.id,
            userName: currentUser?.name,
            userRole: currentUser?.role,
        });
    }

    return res;
}
