/**
 * Extract intake prefill from Voice AI call cards (intent + AI summary).
 * Maps to WhatsApp Flow field names: service, shift_type, name, start_date.
 */

const SERVICE_OPTIONS = [
    'Nursing Care',
    'Maternity Care',
    'New Born Baby Care',
    'Japa Care (Post-Delivery)',
    'Old Age Care',
] as const;

const INTENT_TO_SERVICE: Record<string, string> = {
    'old age person care': 'Old Age Care',
    'old age care': 'Old Age Care',
    'nursing care': 'Nursing Care',
    'nursing': 'Nursing Care',
    'maternity care': 'Maternity Care',
    'maternity': 'Maternity Care',
    'new born baby care': 'New Born Baby Care',
    'newborn baby care': 'New Born Baby Care',
    'japa care': 'Japa Care (Post-Delivery)',
    'japa care (post-delivery)': 'Japa Care (Post-Delivery)',
    'home healthcare': 'Old Age Care',
};

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

export function mapIntentToService(intent: string, summary: string): string {
    const key = normalizeText(intent);
    if (INTENT_TO_SERVICE[key]) return INTENT_TO_SERVICE[key];

    const hay = normalizeText(`${intent} ${summary}`);
    for (const service of SERVICE_OPTIONS) {
        if (hay.includes(normalizeText(service))) return service;
    }
    if (/\bold\s*age\b/.test(hay)) return 'Old Age Care';
    if (/\bnurs/.test(hay)) return 'Nursing Care';
    if (/\bmatern/.test(hay)) return 'Maternity Care';
    if (/\bjapa\b/.test(hay)) return 'Japa Care (Post-Delivery)';
    if (/\bnew\s*born|\bnewborn/.test(hay)) return 'New Born Baby Care';

    return intent?.trim() || 'Home Healthcare';
}

export function parseShiftFromText(text: string): { shiftType: string; shiftLabel: string } {
    const hay = normalizeText(text);
    if (/\b24[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '24-Hour Shift', shiftLabel: '24 Hour Shift' };
    }
    if (/\b10[\s-]*(?:hour|hr|h)\b/.test(hay)) {
        return { shiftType: '10-Hour Shift', shiftLabel: '10 Hour Shift' };
    }
    if (/\bfull[\s-]*day\b|\b24\s*7\b/.test(hay)) {
        return { shiftType: '24-Hour Shift', shiftLabel: '24 Hour Shift' };
    }
    return { shiftType: '10-Hour Shift', shiftLabel: '10 Hour Shift' };
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
}): VoiceCallIntakePrefill {
    const summary = call.summary || '';
    const intent = call.intent || '';
    const service = mapIntentToService(intent, summary);
    const { shiftType, shiftLabel } = parseShiftFromText(`${summary} ${intent}`);
    const startParsed = parseStartDateFromSummary(summary);
    const fullName = (call.capturedName || '').trim();
    const firstName = fullName.split(/\s+/)[0] || 'there';

    // Keys must match INTAKE_FORM screen `data` + init-value bindings (scripts/intake_form_flow.json)
    const flowData: Record<string, string> = {
        screen: 'INTAKE_FORM',
        service,
        shift_type: shiftType,
        country: 'India',
        state: 'Gujarat',
        city: 'Surat',
    };
    if (fullName) flowData.name = fullName;
    if (startParsed?.iso) flowData.start_date = startParsed.iso;

    return {
        service,
        shiftType,
        shiftLabel,
        startDateDisplay: startParsed?.display ?? null,
        startDateIso: startParsed?.iso ?? null,
        templateParams: [firstName, service, shiftLabel],
        flowData,
    };
}
