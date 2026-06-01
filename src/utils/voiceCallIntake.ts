/**
 * Extract intake prefill from Voice AI call cards (intent + AI summary).
 * Maps to WhatsApp Flow field names: service, shift_type, name, start_date.
 */

import { resolveLeadDisplayName } from './consentFlow';

export { resolveLeadDisplayName };

const SERVICE_OPTIONS = [
    'Nursing Care',
    'Maternity Care',
    'New Born Baby Care',
    'Japa Care (Post-Delivery)',
    'Old Age Care',
] as const;

/** Exact labels from ElevenLabs data collection / call titles */
const INTENT_TO_SERVICE: Record<string, string> = {
    'old age person care': 'Old Age Care',
    'old age care': 'Old Age Care',
    'nursing care': 'Nursing Care',
    'nursing': 'Nursing Care',
    'maternity care': 'Maternity Care',
    'maternity': 'Maternity Care',
    'new born baby care': 'New Born Baby Care',
    'newborn baby care': 'New Born Baby Care',
    'newborn care': 'New Born Baby Care',
    'new born care': 'New Born Baby Care',
    'baby care': 'New Born Baby Care',
    'japa care': 'Japa Care (Post-Delivery)',
    'japa care (post-delivery)': 'Japa Care (Post-Delivery)',
};

/** Order matters: more specific phrases before generic (e.g. newborn before "care"). */
const SERVICE_SIGNALS: { service: string; re: RegExp }[] = [
    { service: 'New Born Baby Care', re: /\b(?:new\s*born|newborn|neonat(?:al|e)?|baby\s*care)\b/i },
    { service: 'Japa Care (Post-Delivery)', re: /\b(?:japa|post[\s-]*delivery)\b/i },
    { service: 'Maternity Care', re: /\b(?:maternity|pregnant|pregnancy|postpartum)\b/i },
    { service: 'Nursing Care', re: /\b(?:nursing|nurse|patient\s+care)\b/i },
    { service: 'Old Age Care', re: /\b(?:old\s*age|elderly|senior\s+citizen|geriatric)\b/i },
];

function stripCrmAutoNotes(text: string): string {
    return text
        .split('\n')
        .filter((line) => !/^(service|shift|start date|source):/i.test(line.trim()))
        .join('\n');
}

function matchServiceInText(text: string): string | null {
    const hay = text || '';
    if (!hay.trim()) return null;
    for (const { service, re } of SERVICE_SIGNALS) {
        if (re.test(hay)) return service;
    }
    for (const option of SERVICE_OPTIONS) {
        if (hay.toLowerCase().includes(option.toLowerCase())) return option;
    }
    return null;
}

const MONTHS: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
};

export type VoiceCallIntakePrefill = {
    service: string;
    shiftType: string;
    shiftLabel: string;
    startDateDisplay: string | null;
    startDateIso: string | null;
    templateParams: [string, string, string];
    flowData: Record<string, string>;
};

function normalizeText(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolve service for WhatsApp prefill.
 * Voice log "intent" (ElevenLabs data collection) wins when it's a known service label.
 */
export function mapIntentToService(intent: string, summary: string, extraContext = ''): string {
    const key = normalizeText(intent);
    if (INTENT_TO_SERVICE[key]) return INTENT_TO_SERVICE[key];

    const exactOption = SERVICE_OPTIONS.find((o) => normalizeText(o) === key);
    if (exactOption) return exactOption;

    const summaryClean = stripCrmAutoNotes(summary);
    const extraClean = stripCrmAutoNotes(extraContext);
    const fromSummary = matchServiceInText(`${summaryClean} ${extraClean}`);
    if (fromSummary) return fromSummary;

    const fromIntent = matchServiceInText(intent);
    if (fromIntent) return fromIntent;

    return '';
}

export function parseShiftFromText(text: string): { shiftType: string; shiftLabel: string } | null {
    const hay = normalizeText(text);
    if (/\b24[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '24-Hour Shift', shiftLabel: '24 Hour Shift' };
    }
    if (/\b12[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '12-Hour Shift', shiftLabel: '12 Hour Shift' };
    }
    if (/\b10[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '10-Hour Shift', shiftLabel: '10 Hour Shift' };
    }
    if (/\b8[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '8-Hour Shift', shiftLabel: '8 Hour Shift' };
    }
    if (/\bfull[\s-]*day\b|\b24\s*7\b/.test(hay)) {
        return { shiftType: '24-Hour Shift', shiftLabel: '24 Hour Shift' };
    }
    return null;
}

export function parseStartDateFromSummary(summary: string): { display: string; iso: string } | null {
    const text = summary || '';
    const now = new Date();
    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;

    const patterns = [
        /\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i,
        /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i,
        /\bstarting\s+(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i,
        /\bstarting\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i,
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (!m) continue;
        if (/^\d/.test(m[1])) {
            day = parseInt(m[1], 10);
            month = MONTHS[m[2].toLowerCase().slice(0, 3)];
            year = m[3] ? parseInt(m[3], 10) : null;
        } else {
            month = MONTHS[m[1].toLowerCase().slice(0, 3)];
            day = parseInt(m[2], 10);
            year = m[3] ? parseInt(m[3], 10) : null;
        }
        break;
    }

    if (day == null || month == null) return null;

    if (!year) {
        year = now.getFullYear();
        const candidate = new Date(year, month, day);
        if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            year += 1;
        }
    }

    const d = new Date(year, month, day);
    if (Number.isNaN(d.getTime())) return null;

    const display = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { display, iso };
}

export function buildVoiceCallIntakePrefill(call: {
    capturedName?: string;
    intent?: string;
    summary?: string;
    transcript?: string;
}): VoiceCallIntakePrefill {
    const summary = call.summary || '';
    const intent = call.intent || '';
    const service = mapIntentToService(intent, summary, call.transcript || '');
    
    // Prioritize checking the summary (which represents the finalized intent)
    let shiftResult = parseShiftFromText(`${summary} ${intent}`);
    // If not found in summary, try the full transcript, but beware it may contain the agent's stock phrases
    if (!shiftResult && call.transcript) {
        shiftResult = parseShiftFromText(call.transcript);
    }
    const { shiftType, shiftLabel } = shiftResult || { shiftType: '10-Hour Shift', shiftLabel: '10 Hour Shift' };
    
    const startParsed = parseStartDateFromSummary(summary);
    const fullName = (call.capturedName || '').trim();
    const firstName = fullName.split(/\s+/)[0] || 'there';
    const serviceLabel = service || 'Home Healthcare';

    // Keys must match INTAKE_FORM screen `data` schema (passed as template flow_action_data)
    const flowData: Record<string, string> = {
        shift_type: shiftType,
        country: 'India',
        state: 'Gujarat',
        city: 'Surat',
    };
    if (service) flowData.service = service;
    if (fullName) flowData.name = fullName;
    if (startParsed?.iso) {
        // Some WhatsApp flows expect 'start_date', others might expect 'startDate' or 'service_start_date'.
        flowData.start_date = startParsed.iso;
        flowData.service_start_date = startParsed.iso; // Duplicate for safety
    }

    return {
        service: serviceLabel,
        shiftType,
        shiftLabel,
        startDateDisplay: startParsed?.display ?? null,
        startDateIso: startParsed?.iso ?? null,
        templateParams: [firstName, serviceLabel, shiftLabel],
        flowData,
    };
}

/** Prefill from CRM lead card (pipeline greeting). */
export function buildLeadIntakePrefill(lead: {
    name?: string;
    service_interest?: string | null;
    notes?: string | null;
}): VoiceCallIntakePrefill {
    const notes = lead.notes || '';
    const shiftFromNotes = notes.match(/^Shift:\s*(.+)$/im)?.[1]?.trim();
    const service =
        mapIntentToService(lead.service_interest || '', notes) ||
        notes.match(/^Service:\s*(.+)$/im)?.[1]?.trim() ||
        '';
    const serviceLabel = service || 'Home Healthcare';
    const { shiftType, shiftLabel } = shiftFromNotes
        ? { shiftType: shiftFromNotes, shiftLabel: shiftFromNotes }
        : (parseShiftFromText(notes) || { shiftType: '10-Hour Shift', shiftLabel: '10 Hour Shift' });
    const startParsed = parseStartDateFromSummary(notes);
    const fullName = resolveLeadDisplayName(lead);
    const firstName = fullName.split(/\s+/)[0] || 'there';

    const flowData: Record<string, string> = {
        shift_type: shiftType,
        country: 'India',
        state: 'Gujarat',
        city: 'Surat',
    };
    if (service) flowData.service = service;
    if (fullName) flowData.name = fullName;

    return {
        service: serviceLabel,
        shiftType,
        shiftLabel,
        startDateDisplay: startParsed?.display ?? null,
        startDateIso: startParsed?.iso ?? null,
        templateParams: [firstName, serviceLabel, shiftLabel],
        flowData,
    };
}
