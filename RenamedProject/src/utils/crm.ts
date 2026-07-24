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
    if (isManualInvoiceLead(lead)) return false;
    const stage = lead.pipeline_stage || '';
    if (isLegacyPipelineStage(stage)) return false;
    return new Set([...pipelineStages, ...clientStages]).has(stage);
}
