/**
 * Canonical list of 99 Care services — used everywhere in the app.
 * Update here to change across the entire codebase.
 */
export const CARE_SERVICES = [
  'Nursing Care',
  'Maternity Care',
  'New Born Baby Care',
  'Japa Care (Post-Delivery)',
  'Old Age Care',
] as const;

export type CareService = typeof CARE_SERVICES[number];
