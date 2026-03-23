/**
 * Business Rules Engine - Payroll & Leave Balances
 * Centralized logic for calculating payroll math, effective hours, and leave boundaries.
 */

// Core Constants
export const SHIFT_CONSTANTS = {
  FULL_DAY_HOURS: 8,
  HALF_DAY_HOURS: 4,
  OVERTIME_MULTIPLIER: 1.5,
  HOLIDAY_MULTIPLIER: 2.0,
};

/**
 * Calculates effective daily working hours natively based on check-in markers.
 * @param {string} status 'present', 'half_day', 'absent', 'holiday', etc
 * @param {number|null} manuallyOverwrittenHours
 * @returns {number} Effective hours to be credited for payroll.
 */
export const calculateEffectiveHours = (status, manuallyOverwrittenHours = null) => {
  if (manuallyOverwrittenHours !== null && typeof manuallyOverwrittenHours === 'number') {
    return manuallyOverwrittenHours;
  }

  switch (status) {
    case 'present':
      return SHIFT_CONSTANTS.FULL_DAY_HOURS;
    case 'half_day':
      return SHIFT_CONSTANTS.HALF_DAY_HOURS;
    case 'absent':
    case 'unpaid_leave':
      return 0;
    case 'paid_leave':
    case 'holiday':
    case 'weekly_off':
      // They are paid for these days without being present (Standard 8 hours value).
      return SHIFT_CONSTANTS.FULL_DAY_HOURS;
    default:
      return 0;
  }
};

/**
 * Calculates total payroll days/salary bounds based on a month's attendance history.
 * @param {Array} attendanceRecords List of attendance documents for a user in a given month.
 * @param {number} baseMonthlySalary Target salary for calculating daily fraction.
 */
export const computePayrollPipeline = (attendanceRecords, baseMonthlySalary) => {
  // Aggregate effective present days explicitly via rules.
  let effectivePresentDays = 0;
  let totalComputedHours = 0;

  attendanceRecords.forEach(record => {
    // Rely on calculated hours or fallback dynamically.
    const hours = record.hours_worked ?? calculateEffectiveHours(record.status);
    totalComputedHours += hours;

    if (record.status === 'present') effectivePresentDays += 1;
    else if (record.status === 'half_day') effectivePresentDays += 0.5;
    else if (['paid_leave', 'holiday', 'weekly_off'].includes(record.status)) effectivePresentDays += 1;
  });

  // Example formula for daily fractional pay based on a standard 30-day corporate window.
  const dailyRate = baseMonthlySalary / 30;
  const computedGrossPay = effectivePresentDays * dailyRate;

  return {
    totalComputedHours,
    effectivePresentDays,
    computedGrossPay: Math.round(computedGrossPay),
    dailyRate: Math.round(dailyRate)
  };
};
