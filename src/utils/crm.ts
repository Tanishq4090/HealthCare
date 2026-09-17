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

    const raw = [
        entity.notes || '',
        entity.location || '',
        entity.address || '',
        entity.client_address || '',
        typeof entity.work_form_data === 'object' ? JSON.stringify(entity.work_form_data) : (entity.work_form_data || ''),
        Array.isArray(entity.client_consents) ? entity.client_consents.map((c: any) => c.address).join(' ') : (entity.client_consents?.address || ''),
    ].join(' ').toLowerCase();

    // Specific cities in Gujarat / surrounding regions
    if (raw.includes('navsari')) return 'Navsari';
    if (raw.includes('bardoli')) return 'Bardoli';
    if (raw.includes('bharuch') || raw.includes('ankleshwar')) return 'Bharuch';
    if (raw.includes('valsad')) return 'Valsad';
    if (raw.includes('vapi')) return 'Vapi';
    if (raw.includes('vyara')) return 'Vyara';
    if (raw.includes('bilimora')) return 'Bilimora';
    if (raw.includes('ahmedabad')) return 'Ahmedabad';
    if (raw.includes('vadodara') || raw.includes('baroda')) return 'Vadodara';
    if (raw.includes('mumbai') || raw.includes('thane')) return 'Mumbai';
    if (raw.includes('pune')) return 'Pune';
    if (raw.includes('delhi')) return 'Delhi';
    if (raw.includes('rajkot')) return 'Rajkot';
    if (raw.includes('bhavnagar')) return 'Bhavnagar';
    if (raw.includes('jamnagar')) return 'Jamnagar';
    if (raw.includes('gandhinagar')) return 'Gandhinagar';

    // Surat and common Surat areas/pincodes
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
        raw.includes('rander') ||
        raw.includes('udhna') ||
        raw.includes('bhatar') ||
        raw.includes('city light') ||
        raw.includes('piplod') ||
        raw.includes('athwa') ||
        raw.includes('amroli') ||
        raw.includes('mota varachha') ||
        raw.includes('ghod dod') ||
        raw.includes('chauta') ||
        raw.includes('395')
    ) {
        return 'Surat';
    }

    // Explicit "Location: ..." or "City: ..." line extraction
    const locMatch = (entity.notes || '').match(/(?:Location|City|Address):\s*([^\n\r]+)/i);
    if (locMatch && locMatch[1].trim()) {
        const parts = locMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
            const candidate = parts[parts.length - 1].replace(/\d+/g, '').trim();
            if (candidate.length >= 3 && candidate.length <= 25) {
                return candidate.charAt(0).toUpperCase() + candidate.slice(1);
            }
        }
    }

    // Default territory for 99 Care operations
    return 'Surat';
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

