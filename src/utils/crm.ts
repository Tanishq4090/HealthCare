/** Stages removed from the pipeline UI — rows stuck here are invisible on the board */
export const LEGACY_PIPELINE_STAGES = new Set(['New Lead', 'New']);

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

/** Active leads that should count for pipeline, search, and duplicate warnings */
export function isPipelineVisibleLead(
    lead: { pipeline_stage?: string | null; deleted_at?: string | null },
    pipelineStages: string[],
    clientStages: string[] = ['Active Client', 'Monthly Billing', 'Closed Won', 'Archived']
): boolean {
    if (lead.deleted_at) return false;
    const stage = lead.pipeline_stage || '';
    if (isLegacyPipelineStage(stage)) return false;
    return new Set([...pipelineStages, ...clientStages]).has(stage);
}
