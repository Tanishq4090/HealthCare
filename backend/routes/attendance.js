import express from "express";
import { broadcast } from "../server.js";
import { body, query } from "express-validator";
import { validateStrict } from "../middleware/validation.js";
import * as attendanceService from "../services/attendanceService.js";
import { calculateEffectiveHours, computePayrollPipeline } from "../services/payrollRulesEngine.js";

const router = express.Router();

// Valid attendance status values — used as allowlist across all routes
const VALID_STATUSES = [
  'present', 'absent', 'half_day',
  'paid_leave', 'unpaid_leave',
  'holiday', 'weekly_off'
];

router.post("/mark", [
  body("employeeId").trim().isString().notEmpty().isUUID().withMessage("employeeId must be a valid UUID"),
  body("date").trim().isISO8601().withMessage("date must be a valid ISO 8601 date (YYYY-MM-DD)"),
  body("status").trim().isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  body("note").optional({ nullable: true }).trim().isString().escape(),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  body("hoursWorked").optional({ nullable: true }).isFloat({ min: 0, max: 24 }).withMessage("hoursWorked must be between 0 and 24"),
  body("checkInTime").optional({ nullable: true }).trim().isISO8601(),
  body("checkOutTime").optional({ nullable: true }).trim().isISO8601(),
  validateStrict
], async (req, res) => {
  const { employeeId, date, status, note, markedBy, hoursWorked } = req.body;
  
  if (!employeeId || !date || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const hours = calculateEffectiveHours(status, hoursWorked);

  try {
    const existing = await attendanceService.getRecordByDate(employeeId, date);

    const payload = {
      worker_id: employeeId,
      duty_date: date,
      status: status,
      notes: note,
      hours_worked: hours,
      check_in_time: req.body.checkInTime,
      check_out_time: req.body.checkOutTime,
      is_absent: status === 'absent',
      is_leave: status.includes('leave'),
      updated_at: new Date().toISOString()
    };

    const result = await attendanceService.upsertAttendance(payload, existing?.id);

    broadcast("attendance:marked", result);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[Attendance] Error marking:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/mark", [
  query("employeeId").trim().isString().notEmpty().escape(),
  query("date").trim().isString().notEmpty().escape(),
  validateStrict
], async (req, res) => {
  const { employeeId, date } = req.query;

  if (!employeeId || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await attendanceService.deleteAttendance(employeeId, date);

    broadcast("attendance:deleted", { employeeId, date });
    res.json({ success: true });
  } catch (error) {
    console.error("[Attendance] Error deleting:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bulk-mark", [
  body("employeeIds").isArray({ min: 1 }),
  body("employeeIds.*").trim().isString().notEmpty().isUUID().withMessage("each employeeId must be a valid UUID"),
  body("date").trim().isISO8601().withMessage("date must be a valid ISO 8601 date"),
  body("status").trim().isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  body("hoursWorked").optional({ nullable: true }).isFloat({ min: 0, max: 24 }).withMessage("hoursWorked must be between 0 and 24"),
  validateStrict
], async (req, res) => {
  const { employeeIds, date, status, markedBy, hoursWorked } = req.body;

  if (!employeeIds || !date || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Build all payloads first, then batch upsert — avoids partial writes on crash
    const hours = calculateEffectiveHours(status, hoursWorked);
    const payloads = employeeIds.map(id => ({
      worker_id: id,
      duty_date: date,
      status,
      hours_worked: hours,
      is_absent: status === 'absent',
      is_leave: status.includes('leave'),
      updated_at: new Date().toISOString()
    }));

    const results = await attendanceService.batchUpsertAttendance(payloads);

    broadcast("attendance:bulk_marked", { date, count: results.length });
    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error("[Attendance] Error bulk marking:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bulk-save", [
  body("date").trim().isISO8601().withMessage("date must be a valid ISO 8601 date"),
  body("records").isArray({ min: 1 }),
  body("records.*.workerId").trim().isString().notEmpty().isUUID().withMessage("workerId must be a valid UUID"),
  body("records.*.status").trim().isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  body("records.*.hoursWorked").optional({ nullable: true }).isFloat({ min: 0, max: 24 }).withMessage("hoursWorked must be between 0 and 24"),
  body("records.*.checkInTime").optional({ nullable: true }).trim().isISO8601(),
  body("records.*.checkOutTime").optional({ nullable: true }).trim().isISO8601(),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  validateStrict
], async (req, res) => {
  const { date, records, markedBy } = req.body;

  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Missing required fields or invalid records format" });
  }

  try {
    // Build all payloads first, then batch upsert — avoids partial writes on crash
    const payloads = records.map(record => {
      const { workerId, status, hoursWorked } = record;
      const hours = calculateEffectiveHours(status, hoursWorked);
      return {
        worker_id: workerId,
        duty_date: date,
        status,
        hours_worked: hours,
        check_in_time: record.checkInTime,
        check_out_time: record.checkOutTime,
        is_absent: status === 'absent',
        is_leave: status.includes('leave'),
        updated_at: new Date().toISOString()
      };
    });

    const results = await attendanceService.batchUpsertAttendance(payloads);

    broadcast("attendance:bulk_saved", { date, count: results.length });
    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error("[Attendance] Error bulk saving:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary", [
  query("employeeId").trim().isString().notEmpty().escape(),
  query("month").optional({ nullable: true }).trim().isNumeric(),
  query("year").optional({ nullable: true }).trim().isNumeric(),
  validateStrict
], async (req, res) => {
  const { employeeId, month, year } = req.query;
  
  try {
    const results = await attendanceService.getAttendanceForWorker(employeeId);

    const filtered = results.filter(a => {
      const d = new Date(a.duty_date);
      return (month ? d.getMonth() + 1 === parseInt(month) : true) &&
             (year ? d.getFullYear() === parseInt(year) : true);
    });

    const summary = {
      present: filtered.filter(a => a.status === 'present').length,
      absent: filtered.filter(a => a.status === 'absent' || a.is_absent).length,
      half_day: filtered.filter(a => a.status === 'half_day').length,
      paid_leave: filtered.filter(a => a.status === 'paid_leave' || (a.is_leave && a.status === 'paid_leave')).length,
      unpaid_leave: filtered.filter(a => a.status === 'unpaid_leave' || (a.is_leave && a.status === 'unpaid_leave')).length,
      holiday: filtered.filter(a => a.status === 'holiday').length,
      weekly_off: filtered.filter(a => a.status === 'weekly_off').length,
    };

    const payloadMetrics = computePayrollPipeline(filtered, 0);

    res.json({ 
      employeeId, 
      month, 
      year, 
      summary, 
      totalHours: payloadMetrics.totalComputedHours, 
      effectivePresentDays: payloadMetrics.effectivePresentDays, 
      history: filtered 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/monthly-report", [
  query("month").optional({ nullable: true }).trim().isNumeric(),
  query("year").optional({ nullable: true }).trim().isNumeric(),
  validateStrict
], async (req, res) => {
  const { month, year } = req.query;
  
  try {
    const attendanceData = await attendanceService.getAllAttendance();

    const workers = [...new Set(attendanceData.map(a => a.worker_id))];
    
    const report = workers.map(employeeId => {
      const filtered = attendanceData.filter(a => {
        const date = new Date(a.duty_date);
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear().toString();
        return (!month || m === month) && (!year || y === year) && a.worker_id === employeeId;
      });

      const summary = {
        present: filtered.filter(a => a.status === 'present').length,
        absent: filtered.filter(a => a.status === 'absent' || a.is_absent).length,
        half_day: filtered.filter(a => a.status === 'half_day').length,
        paid_leave: filtered.filter(a => a.status === 'paid_leave').length,
        unpaid_leave: filtered.filter(a => a.status === 'unpaid_leave').length,
        holiday: filtered.filter(a => a.status === 'holiday').length,
        weekly_off: filtered.filter(a => a.status === 'weekly_off').length,
      };

      const payloadMetrics = computePayrollPipeline(filtered, 0);

      return { 
        employeeId, 
        summary, 
        totalHours: payloadMetrics.totalComputedHours, 
        effectivePresentDays: payloadMetrics.effectivePresentDays 
      };
    });

    res.json({ month, year, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
