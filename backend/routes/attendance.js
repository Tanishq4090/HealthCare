import express from "express";
import { broadcast } from "../server.js";
import { body, query } from "express-validator";
import { validateStrict } from "../middleware/validation.js";
import * as attendanceService from "../services/attendanceService.js";
import { calculateEffectiveHours, computePayrollPipeline } from "../services/payrollRulesEngine.js";

const router = express.Router();

router.post("/mark", [
  body("employeeId").trim().isString().notEmpty().escape(),
  body("date").trim().isString().notEmpty().escape(),
  body("status").trim().isString().notEmpty().escape(),
  body("note").optional({ nullable: true }).trim().isString().escape(),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  body("hoursWorked").optional({ nullable: true }).isNumeric(),
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
  body("employeeIds.*").trim().isString().notEmpty().escape(),
  body("date").trim().isString().notEmpty().escape(),
  body("status").trim().isString().notEmpty().escape(),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  body("hoursWorked").optional({ nullable: true }).isNumeric(),
  validateStrict
], async (req, res) => {
  const { employeeIds, date, status, markedBy, hoursWorked } = req.body;

  if (!employeeIds || !date || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const results = [];
    for (const id of employeeIds) {
      const hours = calculateEffectiveHours(status, hoursWorked);
      
      const existing = await attendanceService.getRecordByDate(id, date);

      const payload = {
        worker_id: id,
        duty_date: date,
        status: status,
        hours_worked: hours,
        is_absent: status === 'absent',
        is_leave: status.includes('leave'),
        updated_at: new Date().toISOString()
      };

      const result = await attendanceService.upsertAttendance(payload, existing?.id);
      results.push(result);
    }

    broadcast("attendance:bulk_marked", { date, count: results.length });
    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error("[Attendance] Error bulk marking:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bulk-save", [
  body("date").trim().isString().notEmpty().escape(),
  body("records").isArray({ min: 1 }),
  body("records.*.workerId").trim().isString().notEmpty().escape(),
  body("records.*.status").trim().isString().notEmpty().escape(),
  body("records.*.hoursWorked").optional({ nullable: true }).isNumeric(),
  body("records.*.checkInTime").optional({ nullable: true }).trim().isISO8601(),
  body("records.*.checkOutTime").optional({ nullable: true }).trim().isISO8601(),
  body("markedBy").optional({ nullable: true }).trim().isString().escape(),
  validateStrict
], async (req, res) => {
  const { date, records, markedBy } = req.body; // records: [{ workerId, status, hoursWorked }]

  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: "Missing required fields or invalid records format" });
  }

  try {
    const results = [];
    for (const record of records) {
      const { workerId, status, hoursWorked } = record;
      const hours = calculateEffectiveHours(status, hoursWorked);

      const existing = await attendanceService.getRecordByDate(workerId, date);

      const payload = {
        worker_id: workerId,
        duty_date: date,
        status: status,
        hours_worked: hours,
        check_in_time: record.checkInTime,
        check_out_time: record.checkOutTime,
        is_absent: status === 'absent',
        is_leave: status.includes('leave'),
        updated_at: new Date().toISOString()
      };

      const result = await attendanceService.upsertAttendance(payload, existing?.id);
      results.push(result);
    }

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
