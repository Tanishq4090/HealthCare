/** WhatsApp consent flow (CONSENT_SCREEN) prefill — keys must match Flow JSON `data` schema. */
export const CONSENT_SCREEN_ID = 'CONSENT_SCREEN';

export function resolveLeadDisplayName(lead: {
    name?: string | null;
    notes?: string | null;
} | null | undefined): string {
    const fromName = (lead?.name || '').trim();
    if (fromName && fromName.toLowerCase() !== 'unknown lead') return fromName;

    const notes = lead?.notes || '';
    const careFor = notes.match(/Care for:\s*(.+)/i)?.[1]?.trim();
    if (careFor) return careFor;

    return fromName;
}

export function buildConsentFlowData(
    lead: {
        name?: string | null;
        notes?: string | null;
        whatsapp_number?: string | null;
        phone?: string | null;
        client_consents?: Record<string, unknown>[];
        crm_quotations?: Record<string, unknown>[];
    } | null,
    options?: {
        consent?: Record<string, unknown> | null;
        quote?: Record<string, unknown> | null;
        normalizeOfferedTime?: (value?: string | null) => string;
        extra?: Record<string, string>;
    },
): Record<string, string> {
    const consent = options?.consent ?? null;
    const quote = options?.quote ?? null;
    const normalizeOfferedTime = options?.normalizeOfferedTime ?? (() => '');
    const phone = (lead?.whatsapp_number || lead?.phone || '').replace(/\D/g, '');
    const leadDisplayName = resolveLeadDisplayName(lead);
    const startDate = consent?.service_start_date || quote?.start_date || '';

    const data: Record<string, string> = {
        relative_name: leadDisplayName || String(consent?.relative_name || '').trim(),
        patient_name: String(consent?.patient_name || '').trim(),
        age: consent?.age != null ? String(consent.age) : '',
        weight: consent?.weight != null ? String(consent.weight) : '',
        contact_number: String(consent?.contact_number || phone || '').trim(),
        alternate_contact_number: String(consent?.alternate_contact_number || '').trim(),
        address: String(consent?.address || '').trim(),
        reference_by: String(consent?.reference_by || '').trim(),
        service_start_date: startDate ? String(startDate).split('T')[0] : '',
        service_category: String(
            consent?.service_category || quote?.service_category || quote?.service_name || '',
        ).trim(),
        offered_time: normalizeOfferedTime(
            String(consent?.offered_time || quote?.hours_per_day || quote?.shift_type || ''),
        ),
        other_details: String(consent?.other_details || '').trim(),
    };

    if (options?.extra) {
        for (const [key, val] of Object.entries(options.extra)) {
            if (val != null && val !== '') data[key] = val;
        }
    }

    return data;
}

/** Payload for template `flow_action_data` (screen + screen data fields). */
export function buildConsentFlowActionData(
    lead: Parameters<typeof buildConsentFlowData>[0],
    options?: Parameters<typeof buildConsentFlowData>[1],
): Record<string, string> {
    const data = buildConsentFlowData(lead, options);
    return {
        screen: CONSENT_SCREEN_ID,
        ...data,
    };
}
