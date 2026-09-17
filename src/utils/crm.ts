import type { SupabaseClient } from '@supabase/supabase-js';
import { phoneLast10, phonesMatch } from './phone';

/** Stages removed from the pipeline UI — rows stuck here are invisible on the board */
export const LEGACY_PIPELINE_STAGES = new Set(['New Lead', 'New']);

/** CRM stages that represent an established client (Client Master) */
export const CLIENT_MASTER_STAGES = ['Active Client', 'Monthly Billing', 'Closed Won', 'Archived'] as const;

export type ClientMasterMatch = {
    id: string;
    client_name: string;
    phone_number: string;
};

/** Match phone against Client Master (crm_leads in client stages + clients table) */
export async function findClientMasterByPhone(
    supabase: SupabaseClient,
    phone: string
): Promise<ClientMasterMatch | null> {
    const last10 = phoneLast10(phone);
    if (last10.length < 8) return null;

    const stageRank: Record<string, number> = {
        'Active Client': 4,
        'Monthly Billing': 3,
        'Closed Won': 2,
        Archived: 1,
    };

    const pickBest = (
        rows: Array<{
            id: string;
            name: string;
            phone: string | null;
            whatsapp_number: string | null;
            pipeline_stage: string;
            updated_at?: string | null;
        }>
    ) =>
        rows
            .filter((l) => phonesMatch(l.phone, phone) || phonesMatch(l.whatsapp_number, phone))
            .sort((a, b) => {
                const rankDiff = (stageRank[b.pipeline_stage] || 0) - (stageRank[a.pipeline_stage] || 0);
                if (rankDiff !== 0) return rankDiff;
                return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
            })[0];

    const { data: leadRows, error: leadErr } = await supabase
        .from('crm_leads')
        .select('id, name, phone, whatsapp_number, pipeline_stage, updated_at')
        .is('deleted_at', null)
        .in('pipeline_stage', [...CLIENT_MASTER_STAGES])
        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);

    if (leadErr) console.warn('[findClientMasterByPhone] crm_leads:', leadErr.message);

    const bestLead = pickBest(leadRows || []);
    if (bestLead) {
        return {
            id: bestLead.id,
            client_name: bestLead.name,
            phone_number: bestLead.phone || bestLead.whatsapp_number || phone,
        };
    }

    const { data: clientRows, error: clientErr } = await supabase
        .from('clients')
        .select('id, client_name, phone_number')
        .or(`phone_number.ilike.%${last10}%`);

    if (clientErr) console.warn('[findClientMasterByPhone] clients:', clientErr.message);

    for (const c of clientRows || []) {
        if (!phonesMatch(c.phone_number, phone)) continue;
        const { data: lead } = await supabase
            .from('crm_leads')
            .select('id, name, phone, whatsapp_number, pipeline_stage')
            .eq('id', c.id)
            .is('deleted_at', null)
            .maybeSingle();
        if (lead && (CLIENT_MASTER_STAGES as readonly string[]).includes(lead.pipeline_stage)) {
            return {
                id: c.id,
                client_name: lead.name || c.client_name,
                phone_number: c.phone_number || lead.phone || lead.whatsapp_number || phone,
            };
        }
    }

    return null;
}

/** Every new lead from any source should start in this column */
export const NEW_LEAD_PIPELINE_STAGE = 'New Inquiry';

export function isLegacyPipelineStage(stage: string | null | undefined): boolean {
    return LEGACY_PIPELINE_STAGES.has(stage || '');
}

/** Strip legacy/hidden stages and ensure New Inquiry is first */
export function sanitizePipelineStages(stages: string[]): string[] {
    const cleaned = stages.filter((s) => s && !isLegacyPipelineStage(s));
    const unique = [...new Set(cleaned)];
    if (!unique.includes(NEW_LEAD_PIPELINE_STAGE)) {
        return [NEW_LEAD_PIPELINE_STAGE, ...unique];
    }
    return [NEW_LEAD_PIPELINE_STAGE, ...unique.filter((s) => s !== NEW_LEAD_PIPELINE_STAGE)];
}

export function normalizePipelineStage(
    stage: string | null | undefined,
    firstVisibleStage = NEW_LEAD_PIPELINE_STAGE
): string {
    if (!stage || isLegacyPipelineStage(stage)) return firstVisibleStage;
    return stage;
}

export function isManualInvoiceLead(lead: { source?: string | null; notes?: string | null }): boolean {
    const source = (lead.source || '').toLowerCase();
    const notes = (lead.notes || '').toLowerCase();
    return source.includes('manual invoice') || notes.includes('manual invoice: true');
}

/** Active leads that should count for pipeline, search, and duplicate warnings */
export function isPipelineVisibleLead(
    lead: { pipeline_stage?: string | null; deleted_at?: string | null; source?: string | null; notes?: string | null },
    pipelineStages: string[],
    clientStages: string[] = ['Active Client', 'Monthly Billing', 'Closed Won', 'Archived']
): boolean {
    if (lead.deleted_at) return false;
    const stage = lead.pipeline_stage || '';
    if (isLegacyPipelineStage(stage)) return false;
    return new Set([...pipelineStages, ...clientStages]).has(stage);
}

/**
 * Intelligently extracts city from lead / client records.
 * Checks notes, location fields, work form data, and consent addresses.
 */
export function extractCity(entity: any): string {
    if (!entity) return 'Surat';

    // Direct field if present
    if (entity.city && typeof entity.city === 'string' && entity.city.trim()) {
        const c = entity.city.trim();
        return c.charAt(0).toUpperCase() + c.slice(1);
    }

    // Direct work_form_data from WhatsApp Flow or Website Booking
    if (entity.work_form_data && typeof entity.work_form_data === 'object' && entity.work_form_data.city) {
        const c = String(entity.work_form_data.city).trim();
        if (c && c.toLowerCase() !== 'other') {
            return c.charAt(0).toUpperCase() + c.slice(1);
        }
    }

    // Explicit "City: ..." line extraction from notes
    const cityNoteMatch = (entity.notes || '').match(/^City:\s*([^\n\r,]+)/im);
    if (cityNoteMatch && cityNoteMatch[1].trim() && cityNoteMatch[1].trim().toLowerCase() !== 'other') {
        const c = cityNoteMatch[1].trim();
        return c.charAt(0).toUpperCase() + c.slice(1);
    }

    // Gather all text sources: notes, location, address, client_consents, work_forms, transcripts
    const textSources: string[] = [
        entity.notes || '',
        entity.location || '',
        entity.address || '',
        entity.client_address || '',
        entity.patient_notes || '',
        entity.patientNotes || '',
        typeof entity.work_form_data === 'object' ? JSON.stringify(entity.work_form_data) : (entity.work_form_data || ''),
        Array.isArray(entity.client_consents) 
            ? entity.client_consents.map((c: any) => `${c.address || ''} ${c.other_details || ''}`).join(' ')
            : `${entity.client_consents?.address || ''} ${entity.client_consents?.other_details || ''}`,
        Array.isArray(entity.client_work_forms)
            ? entity.client_work_forms.map((w: any) => `${w.other_work || ''} ${w.patient_name || ''}`).join(' ')
            : `${entity.client_work_forms?.other_work || ''}`,
        entity.summary || '',
        entity.transcript || '',
    ];
    const raw = textSources.join(' ').toLowerCase();

    // Specific non-Surat cities / regions (Check these first to catch regional inquiries)
    // 1. Navsari & areas / pincodes
    if (
        raw.includes('navsari') ||
        raw.includes('lunsikui') ||
        raw.includes('jalalpore') ||
        raw.includes('maroli') ||
        raw.includes('vesma') ||
        raw.includes('vijalpore') ||
        raw.includes('kaliawadi') ||
        raw.includes('dudhia talav') ||
        raw.includes('396445') ||
        raw.includes('396450') ||
        raw.includes('396415')
    ) {
        return 'Navsari';
    }

    // 2. Bardoli & areas / pincodes
    if (
        raw.includes('bardoli') ||
        raw.includes('swaraj ashram') ||
        raw.includes('sardar baug') ||
        raw.includes('dhulia road') ||
        raw.includes('394601') ||
        raw.includes('394602')
    ) {
        return 'Bardoli';
    }

    // 3. Bharuch / Ankleshwar
    if (
        raw.includes('bharuch') ||
        raw.includes('ankleshwar') ||
        raw.includes('dahej') ||
        raw.includes('zadeshwar') ||
        raw.includes('shravan chokdi') ||
        raw.includes('392001') ||
        raw.includes('393001') ||
        raw.includes('393002')
    ) {
        return 'Bharuch';
    }

    // 4. Valsad
    if (
        raw.includes('valsad') ||
        raw.includes('tithal') ||
        raw.includes('dharampur') ||
        raw.includes('parnera') ||
        raw.includes('396001') ||
        raw.includes('396002')
    ) {
        return 'Valsad';
    }

    // 5. Vapi
    if (
        raw.includes('vapi') ||
        raw.includes('gunjan') ||
        raw.includes('chanod') ||
        raw.includes('gidc vapi') ||
        raw.includes('daman road') ||
        raw.includes('chala') ||
        raw.includes('silvassa') ||
        raw.includes('396191') ||
        raw.includes('396195')
    ) {
        return 'Vapi';
    }

    // 6. Vyara / Tapi
    if (raw.includes('vyara') || raw.includes('songadh') || raw.includes('394650')) {
        return 'Vyara';
    }

    // 7. Bilimora / Gandevi / Chikhli
    if (raw.includes('bilimora') || raw.includes('gandevi') || raw.includes('chikhli') || raw.includes('396321')) {
        return 'Bilimora';
    }

    // 8. Ahmedabad
    if (
        raw.includes('ahmedabad') ||
        raw.includes('amdavad') ||
        raw.includes('satellite') ||
        raw.includes('bodakdev') ||
        raw.includes('vastrapur') ||
        raw.includes('maninagar') ||
        raw.includes('bopal') ||
        raw.includes('chandkheda') ||
        raw.includes('prahlad nagar') ||
        /\b380\d{3}\b/.test(raw)
    ) {
        return 'Ahmedabad';
    }

    // 9. Vadodara / Baroda
    if (
        raw.includes('vadodara') ||
        raw.includes('baroda') ||
        raw.includes('alkapuri') ||
        raw.includes('gotri') ||
        raw.includes('manjalpur') ||
        raw.includes('karelibaug') ||
        raw.includes('sayajigunj') ||
        raw.includes('waghodia') ||
        /\b390\d{3}\b/.test(raw)
    ) {
        return 'Vadodara';
    }

    // 10. Mumbai / Thane / Navi Mumbai
    if (
        raw.includes('mumbai') ||
        raw.includes('bombay') ||
        raw.includes('thane') ||
        raw.includes('borivali') ||
        raw.includes('kandivali') ||
        raw.includes('andheri') ||
        raw.includes('bandra') ||
        raw.includes('dadar') ||
        raw.includes('navi mumbai') ||
        raw.includes('vashi') ||
        raw.includes('ghatkopar') ||
        raw.includes('goregaon') ||
        raw.includes('bhayandar') ||
        raw.includes('mira road') ||
        /\b400\d{3}\b/.test(raw)
    ) {
        return 'Mumbai';
    }

    // 11. Pune
    if (raw.includes('pune') || raw.includes('wakad') || raw.includes('hinjewadi') || raw.includes('baner') || /\b411\d{3}\b/.test(raw)) {
        return 'Pune';
    }

    // 12. Delhi / NCR
    if (raw.includes('delhi') || raw.includes('noida') || raw.includes('gurgaon') || raw.includes('gurugram') || raw.includes('faridabad') || /\b110\d{3}\b/.test(raw)) {
        return 'Delhi';
    }

    // 13. Rajkot
    if (raw.includes('rajkot') || raw.includes('kalawad road') || /\b360\d{3}\b/.test(raw)) {
        return 'Rajkot';
    }

    // 14. Surat and common Surat neighborhoods / pincodes
    if (
        raw.includes('surat') ||
        raw.includes('adajan') ||
        raw.includes('pal') ||
        raw.includes('salabatpura') ||
        raw.includes('dindoli') ||
        raw.includes('vesu') ||
        raw.includes('katargam') ||
        raw.includes('varachha') ||
        raw.includes('althan') ||
        raw.includes('alathan') ||
        raw.includes('rander') ||
        raw.includes('udhna') ||
        raw.includes('bhatar') ||
        raw.includes('city light') ||
        raw.includes('citylight') ||
        raw.includes('piplod') ||
        raw.includes('athwa') ||
        raw.includes('amroli') ||
        raw.includes('mota varachha') ||
        raw.includes('ghod dod') ||
        raw.includes('ghoddod') ||
        raw.includes('chauta') ||
        raw.includes('nanpura') ||
        raw.includes('kamrej') ||
        raw.includes('sarthana') ||
        raw.includes('jahangirpura') ||
        raw.includes('parvat patiya') ||
        raw.includes('puna gam') ||
        raw.includes('punagam') ||
        raw.includes('pandesara') ||
        raw.includes('bhestan') ||
        raw.includes('majura') ||
        raw.includes('khatodara') ||
        raw.includes('dumas') ||
        raw.includes('hazira') ||
        raw.includes('bamroli') ||
        raw.includes('olpad') ||
        raw.includes('kosamba') ||
        raw.includes('magdalla') ||
        raw.includes('395') ||
        raw.includes('394101') ||
        raw.includes('394107') ||
        raw.includes('394210') ||
        raw.includes('394221')
    ) {
        return 'Surat';
    }

    // Explicit "Location: ..." or "Address: ..." line extraction fallback
    const locMatch = (entity.notes || '').match(/(?:Location|Address):\s*([^\n\r]+)/i);
    if (locMatch && locMatch[1].trim()) {
        const parts = locMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
            // Check each comma-separated component from right to left (city is usually near the end)
            for (let i = parts.length - 1; i >= 0; i--) {
                const cleaned = parts[i].replace(/\d+/g, '').trim();
                if (cleaned.length >= 3 && cleaned.length <= 25 && !['india', 'gujarat', 'maharashtra'].includes(cleaned.toLowerCase())) {
                    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
            }
        }
    }

    // Default territory for 99 Care operations
    return 'Surat';
}

/**
 * Intelligently extracts state from lead / client records.
 */
export function extractState(entity: any): string {
    if (!entity) return 'Gujarat';
    if (entity.state && typeof entity.state === 'string' && entity.state.trim()) {
        return entity.state.trim();
    }
    if (entity.work_form_data && typeof entity.work_form_data === 'object' && entity.work_form_data.state) {
        return String(entity.work_form_data.state).trim();
    }
    const stateMatch = (entity.notes || '').match(/^State:\s*([^\n\r,]+)/im);
    if (stateMatch && stateMatch[1].trim()) {
        return stateMatch[1].trim();
    }
    return 'Gujarat';
}

/**
 * Intelligently extracts country from lead / client records.
 */
export function extractCountry(entity: any): string {
    if (!entity) return 'India';
    if (entity.country && typeof entity.country === 'string' && entity.country.trim()) {
        return entity.country.trim();
    }
    if (entity.work_form_data && typeof entity.work_form_data === 'object' && entity.work_form_data.country) {
        return String(entity.work_form_data.country).trim();
    }
    const countryMatch = (entity.notes || '').match(/^Country:\s*([^\n\r,]+)/im);
    if (countryMatch && countryMatch[1].trim()) {
        return countryMatch[1].trim();
    }
    return 'India';
}

/**
 * Returns YYYY-MM month string for a lead based on creation or appointment date
 */
export function getLeadMonthKey(lead: any): string {
    if (!lead) return '';
    const dateStr = lead.created_at || lead.appointment_datetime || '';
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        }
    } catch {}
    return dateStr.slice(0, 7);
}

/**
 * Checks if a lead belongs to a specific YYYY-MM month key
 */
export function isLeadInMonth(lead: any, ym: string): boolean {
    if (!ym || ym === 'all') return true;
    const leadYm = getLeadMonthKey(lead);
    if (leadYm === ym) return true;

    // Fallback: check appointment_datetime if different from created_at
    if (lead.appointment_datetime) {
        try {
            const d = new Date(lead.appointment_datetime);
            if (!isNaN(d.getTime())) {
                const parsedYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (parsedYm === ym) return true;
            }
        } catch {}
        if (lead.appointment_datetime.slice(0, 7) === ym) return true;
    }

    // Check quotations if present
    if (Array.isArray(lead.crm_quotations)) {
        for (const q of lead.crm_quotations) {
            if (q.created_at && q.created_at.slice(0, 7) === ym) return true;
            if (q.start_date && q.start_date.slice(0, 7) === ym) return true;
        }
    }

    // Fallback: check notes for service start date or date mention
    const dateMatch = (lead.notes || '').match(/(?:Start Date|Date):\s*([^\n\r]+)/i);
    if (dateMatch && dateMatch[1]) {
        const rawDate = dateMatch[1].trim();
        if (rawDate.startsWith(ym)) return true;
        try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const parsedYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (parsedYm === ym) return true;
            }
        } catch {}
    }

    return false;
}

