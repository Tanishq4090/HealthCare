import { useEffect, useState, useMemo } from 'react';
import { 
  FileText, X, Loader2, Download, Send, CalendarDays, 
  ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, 
  Trash2, ArrowRight, RefreshCw, BookmarkCheck, Lock
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO, isAfter } from 'date-fns';
import { calculateWorkerPay, resolveAssignmentHoursPerDay } from '../../utils/workerPayroll';

interface PayslipGeneratorProps {
  assignment: {
    id: string;
    employee_id: string;
    start_date?: string | null;
    assigned_at?: string;
    end_date: string | null;
    deposit_amount?: number;
    advance_paid?: number;
    client_billing_rate?: number;
    hours_per_day?: number | null;
    locked_days_worked?: number | null;
    employees: {
      id: string;
      full_name: string;
      job_title: string;
      phone?: string;
      rate_10hr: number;
      rate_24hr?: number;
      preferred_payment_type?: string;
    } | null;
    clients: { client_name: string; phone_number?: string } | null;
  };
  onClose: () => void;
  onGenerated: () => void;
  autoCloseAssignmentOnGenerate?: boolean;
}

export default function PayslipGenerator({ assignment, onClose, onGenerated, autoCloseAssignmentOnGenerate }: PayslipGeneratorProps) {
  const emp = assignment.employees || (assignment as any).employee;
  const client = assignment.clients || (assignment as any).client;

  // 1. Assignment absolute boundaries
  const fallbackStart = assignment.start_date || assignment.assigned_at || new Date().toISOString();
  const assignmentStartDate = parseISO(fallbackStart.split('T')[0]);
  const assignmentEndDate = assignment.end_date ? parseISO(assignment.end_date.split('T')[0]) : new Date();
  const safeAssignmentStartDate = isAfter(assignmentStartDate, assignmentEndDate) ? assignmentEndDate : assignmentStartDate;

  const [pastPayrolls, setPastPayrolls] = useState<any[]>([]);
  const [isLoadingPastPayrolls, setIsLoadingPastPayrolls] = useState(false);

  // 2. Fetch past billing/payment records for this worker and assignment
  const fetchPastPayrolls = async () => {
    setIsLoadingPastPayrolls(true);
    try {
      const { data } = await supabase
        .from('payroll')
        .select('*')
        .eq('worker_id', assignment.employee_id)
        .order('period_start', { ascending: true });
      
      const seenPeriods = new Set<string>();
      const related = (data || []).filter((p: any) => {
        if (p.assignment_id !== assignment.id) {
          const pClient = (p.client_name || '').trim().toLowerCase();
          const aClient = (client?.client_name || '').trim().toLowerCase();
          if (!pClient || !aClient || pClient !== aClient) return false;
        }
        const pStart = p.period_start?.split('T')[0] || '';
        const pEnd = p.period_end?.split('T')[0] || '';
        const key = `${pStart}_${pEnd}`;
        if (seenPeriods.has(key)) return false;
        seenPeriods.add(key);
        return true;
      });

      setPastPayrolls(related);
      return related;
    } catch (e) {
      console.error('Error fetching past payrolls', e);
      return [];
    } finally {
      setIsLoadingPastPayrolls(false);
    }
  };

  // Determine latest paid-through date
  const latestPaidThroughDate = useMemo(() => {
    const paidList = pastPayrolls.filter(p => p.status === 'Paid' || p.paid_through_date || p.type === 'final');
    if (paidList.length === 0) return null;
    return paidList.reduce((max: string, p: any) => {
      const d = p.paid_through_date || p.period_end?.split('T')[0] || '';
      return d > max ? d : max;
    }, '');
  }, [pastPayrolls]);

  // Suggested next starting date (day after latest paid-through date, or assignment start date)
  const defaultNextStartDate = useMemo(() => {
    if (latestPaidThroughDate) {
      const [y, m, d] = latestPaidThroughDate.split('-').map(Number);
      const nextD = new Date(y, m - 1, d + 1);
      return nextD;
    }
    return safeAssignmentStartDate;
  }, [latestPaidThroughDate, safeAssignmentStartDate]);

  // Active customizable period inputs
  const [startDateStr, setStartDateStr] = useState<string>(() => format(defaultNextStartDate, 'yyyy-MM-dd'));
  const [endDateStr, setEndDateStr] = useState<string>(() => format(assignmentEndDate, 'yyyy-MM-dd'));
  const [advanceAmount, setAdvanceAmount] = useState((assignment.advance_paid || 0).toString());

  // Update starting date when pastPayrolls finishes initial load if user hasn't changed it
  useEffect(() => {
    fetchPastPayrolls().then((rows) => {
      const paidList = (rows || []).filter((p: any) => p.status === 'Paid' || p.paid_through_date || p.type === 'final');
      if (paidList.length > 0) {
        const latestPaid = paidList.reduce((max: string, p: any) => {
          const d = p.paid_through_date || p.period_end?.split('T')[0] || '';
          return d > max ? d : max;
        }, '');
        if (latestPaid) {
          const [y, m, d] = latestPaid.split('-').map(Number);
          const nextDay = new Date(y, m - 1, d + 1);
          setStartDateStr(format(nextDay, 'yyyy-MM-dd'));
        }
      }
    });
  }, [assignment.id]);

  // Active dates parsed
  const activeStartDate = useMemo(() => {
    try {
      return parseISO(startDateStr);
    } catch {
      return safeAssignmentStartDate;
    }
  }, [startDateStr, safeAssignmentStartDate]);

  const activeEndDate = useMemo(() => {
    try {
      return parseISO(endDateStr);
    } catch {
      return assignmentEndDate;
    }
  }, [endDateStr, assignmentEndDate]);

  const safeStartDate = isAfter(activeStartDate, activeEndDate) ? activeEndDate : activeStartDate;
  const safeEndDate = activeEndDate;

  // Total days in active selected period
  const totalPeriodDays = useMemo(() => {
    try {
      return eachDayOfInterval({ start: safeStartDate, end: safeEndDate }).length;
    } catch {
      return 0;
    }
  }, [safeStartDate, safeEndDate]);

  // Attendance state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [showDailyPreview, setShowDailyPreview] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyFilter, setDailyFilter] = useState<'all' | 'present' | 'half' | 'absent'>('all');

  const assignmentHours = resolveAssignmentHoursPerDay(assignment.hours_per_day);
  const lockedDays = assignment.locked_days_worked != null ? parseFloat(String(assignment.locked_days_worked)) : null;

  const daysWorked = attendanceSummary
    ? parseFloat(attendanceSummary.days_present || 0)
    : (lockedDays ?? 0);

  const payCalc = calculateWorkerPay({
    rate_10hr: emp?.rate_10hr,
    rate_24hr: emp?.rate_24hr,
    daysWorked,
    periodDays: totalPeriodDays,
    hoursPerDay: assignmentHours,
  });

  const hoursPerDay = payCalc.hoursPerDay;
  const dailyRate = payCalc.dailyRateForDisplay;
  const totalEarning = payCalc.gross;
  const advanceDeduction = parseFloat(advanceAmount) || 0;
  const netPayable = totalEarning - advanceDeduction;
  const hourlyMissingHours = false;

  // Check if current active slice matches an existing saved payroll
  const matchingExistingPayroll = useMemo(() => {
    const s = format(safeStartDate, 'yyyy-MM-dd');
    const e = format(safeEndDate, 'yyyy-MM-dd');
    return pastPayrolls.find(p => {
      const pStart = p.period_start?.split('T')[0];
      const pEnd = p.period_end?.split('T')[0];
      return pStart === s && pEnd === e;
    });
  }, [pastPayrolls, safeStartDate, safeEndDate]);

  // Fetch attendance for active custom period
  const fetchAttendance = async () => {
    setIsLoadingAttendance(true);
    try {
      const isSyntheticId = assignment.id.startsWith('temp-');
      const startStr = format(safeStartDate, 'yyyy-MM-dd');
      const endStr = format(safeEndDate, 'yyyy-MM-dd');

      const baseQuery = () => supabase
        .from('attendance')
        .select('id, status, is_half_day, duty_date, is_absent, hours_worked, check_in_time, check_out_time, notes')
        .eq('worker_id', assignment.employee_id)
        .gte('duty_date', startStr)
        .lte('duty_date', endStr)
        .order('duty_date', { ascending: true });

      let rawLogs: any[] | null = null;
      let logErr: any = null;

      if (!isSyntheticId) {
        const res = await baseQuery().eq('assignment_id', assignment.id);
        logErr = res.error;
        rawLogs = res.data;

        if (!logErr && (!rawLogs || rawLogs.length === 0)) {
          const fallback = await baseQuery();
          logErr = fallback.error;
          rawLogs = fallback.data;
        }
      } else {
        const res = await baseQuery();
        logErr = res.error;
        rawLogs = res.data;
      }

      const logMap = new Map<string, any>();
      (rawLogs || []).forEach(r => {
        if (r.duty_date) {
          logMap.set(r.duty_date.split('T')[0], r);
        }
      });

      const allDates = eachDayOfInterval({ start: safeStartDate, end: safeEndDate });
      const mapped = allDates.map(d => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const r = logMap.get(dateKey);
        const isHalf = Boolean(r?.is_half_day || r?.status === 'Half Day' || r?.status === 'half_day');
        const isAbs = Boolean(r?.is_absent || r?.status === 'Absent' || r?.status === 'absent');
        const isPres = Boolean(!isHalf && !isAbs && (r?.status === 'Present' || r?.status === 'present' || r?.status === 'On Duty' || r?.status === 'Completed'));

        let status: 'Present' | 'Half Day' | 'Absent' | 'No Duty' = 'No Duty';
        let credit = 0;
        if (isPres) {
          status = 'Present';
          credit = 1.0;
        } else if (isHalf) {
          status = 'Half Day';
          credit = 0.5;
        } else if (isAbs) {
          status = 'Absent';
          credit = 0;
        } else if (r) {
          status = 'Present';
          credit = 1.0;
        }

        return {
          id: r?.id || `virtual-${dateKey}`,
          date: dateKey,
          displayDate: format(d, 'dd MMM yyyy'),
          dayName: format(d, 'EEE'),
          status,
          isHalfDay: isHalf,
          isAbsent: isAbs,
          hoursWorked: r?.hours_worked ?? (isPres ? 8 : (isHalf ? 4 : 0)),
          checkIn: r?.check_in_time ? format(parseISO(r.check_in_time), 'hh:mm a') : null,
          checkOut: r?.check_out_time ? format(parseISO(r.check_out_time), 'hh:mm a') : null,
          notes: r?.notes || null,
          credit,
        };
      });

      setDailyRecords(mapped);

      const full = mapped.filter(d => d.status === 'Present').length;
      const half = mapped.filter(d => d.status === 'Half Day').length;
      const absent = mapped.filter(d => d.status === 'Absent' || d.status === 'No Duty').length;
      const effectiveDays = full + half * 0.5;

      setAttendanceSummary({
        days_full: full,
        days_present: effectiveDays,
        days_half: half,
        days_absent: absent,
        total_days: totalPeriodDays,
      });
    } catch (err: any) {
      toast.error('Failed to fetch attendance: ' + err.message);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [assignment.id, startDateStr, endDateStr]);

  const filteredDailyRecords = dailyRecords.filter(d => {
    if (dailyFilter === 'all') return true;
    if (dailyFilter === 'present') return d.status === 'Present';
    if (dailyFilter === 'half') return d.status === 'Half Day';
    if (dailyFilter === 'absent') return d.status === 'Absent' || d.status === 'No Duty';
    return true;
  });

  // Quick preset handlers
  const handleSetRemainingUnpaid = () => {
    setStartDateStr(format(defaultNextStartDate, 'yyyy-MM-dd'));
    setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'));
  };

  const handleSetFullPeriod = () => {
    setStartDateStr(format(safeAssignmentStartDate, 'yyyy-MM-dd'));
    setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'));
  };

  const handleSetMonthPreset = (year: number, monthZeroIndex: number) => {
    const mStart = new Date(year, monthZeroIndex, 1);
    const mEnd = new Date(year, monthZeroIndex + 1, 0);

    const effStart = isAfter(safeAssignmentStartDate, mStart) ? safeAssignmentStartDate : mStart;
    const effEnd = isAfter(mEnd, assignmentEndDate) ? assignmentEndDate : mEnd;

    setStartDateStr(format(effStart, 'yyyy-MM-dd'));
    setEndDateStr(format(effEnd, 'yyyy-MM-dd'));
  };

  // Generate calendar months list for quick pills
  const monthPills = useMemo(() => {
    const list: { label: string; year: number; month: number }[] = [];
    const sy = safeAssignmentStartDate.getFullYear();
    const sm = safeAssignmentStartDate.getMonth();
    const ey = assignmentEndDate.getFullYear();
    const em = assignmentEndDate.getMonth();

    for (let y = sy; y <= ey; y++) {
      const fromM = (y === sy) ? sm : 0;
      const toM = (y === ey) ? em : 11;
      for (let m = fromM; m <= toM; m++) {
        list.push({
          label: format(new Date(y, m, 1), 'MMM yyyy'),
          year: y,
          month: m,
        });
      }
    }
    return list;
  }, [safeAssignmentStartDate, assignmentEndDate]);

  // PDF Generation
  const getLogo = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = '/99care-logo.png';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 150;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  };

  const generatePayslipPDF = async () => {
    if (hourlyMissingHours) {
      toast.error('Set shift hours on this assignment (Assign to Client) before generating payslip.');
      return null;
    }
    const doc = new jsPDF();
    const dateNow = format(new Date(), 'dd MMM yyyy');
    const period = `${format(safeStartDate, 'dd MMM yyyy')} – ${format(safeEndDate, 'dd MMM yyyy')}`;

    const logoImg = await getLogo();
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 14, 38, 15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(60, 120, 216);
      doc.text('WORKER PAYSLIP', 14, 35);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text('99 CARE', 14, 25);
      doc.setFontSize(13);
      doc.setTextColor(60, 120, 216);
      doc.text('WORKER PAYSLIP', 14, 33);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const companyInfo = [
      '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN',
      'Surat, GUJARAT, 395007',
      'Mobile: +91 9016116564',
      'Email: 99careforyou@gmail.com',
      'Website: 99CARE.ORG'
    ];
    let compY = 16;
    companyInfo.forEach(line => {
      doc.text(line, 196, compY, { align: 'right' });
      compY += 4.5;
    });

    doc.setDrawColor(180, 200, 240);
    doc.setLineWidth(0.8);
    doc.line(14, 42, 196, 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Worker Details:', 14, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(emp?.full_name || 'Staff Member', 14, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Designation: ${emp?.job_title || 'N/A'}`, 14, 62);
    doc.text(`Assigned Client: ${client?.client_name || 'N/A'}`, 14, 68);
    doc.text(`Phone: ${emp?.phone || 'N/A'}`, 14, 74);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Payslip Details:', 130, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Payslip #: PS-${Date.now().toString().slice(-6)}`, 130, 56);
    doc.text(`Issue Date: ${dateNow}`, 130, 62);
    doc.text(`Service Period: ${period}`, 130, 68);
    if (hoursPerDay != null && hoursPerDay > 0) {
      doc.text(`Shift Hours: ${hoursPerDay} hours/day`, 130, 74);
    }

    autoTable(doc, {
      startY: 84,
      theme: 'grid',
      headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' },
      head: [['Attendance Summary', 'Value']],
      body: [
        ['Total Days in Period', `${totalPeriodDays} days`],
        ['Full Days Present', `${attendanceSummary?.days_full ?? 0} days`],
        ['Half Days', `${attendanceSummary?.days_half || 0} days (0.5 day/each)`],
        ['Days Absent', `${attendanceSummary?.days_absent || 0} days`],
        ['Effective Working Days', `${daysWorked} days`],
      ],
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
    });

    const finalY1 = (doc as any).lastAutoTable.finalY + 8;

    autoTable(doc, {
      startY: finalY1,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      head: [['Earning Breakdown', 'Amount']],
      body: [
        [payCalc.earningsLine.replace(/₹/g, 'Rs. '), `Rs. ${totalEarning.toFixed(2)}`],
        ['Advance Paid / Deductions', `- Rs. ${advanceDeduction.toFixed(2)}`],
      ],
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
    });

    const finalY2 = (doc as any).lastAutoTable.finalY + 8;

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(14, finalY2, 182, 18, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text('NET AMOUNT PAYABLE TO WORKER:', 20, finalY2 + 11);
    doc.text(`Rs. ${Math.abs(netPayable).toFixed(2)}`, 185, finalY2 + 11, { align: 'right' });

    let bkY = finalY2 + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Bank Details for Transfer:', 14, bkY);
    bkY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    const bankDetails = [
      { label: 'Bank:', val: 'The Sutex Co-Operative BankLtd.' },
      { label: 'Account Holder:', val: '99 CARE HOME HEALTHCARE SERVICE' },
      { label: 'Account Number:', val: '001810021002033' },
      { label: 'IFSC Code:', val: 'SUTB0248018' },
      { label: 'Branch:', val: 'Adajan Pal' }
    ];
    
    bankDetails.forEach(item => {
      doc.text(item.label, 14, bkY);
      doc.setFont('helvetica', 'bold');
      doc.text(item.val, 42, bkY);
      doc.setFont('helvetica', 'normal');
      bkY += 5;
    });

    const sigY = finalY2 + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('For 99 CARE', 150, sigY);
    
    doc.line(140, sigY + 16, 190, sigY + 16);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Authorized Signatory', 150, sigY + 20);

    let notesY = bkY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Notes:', 14, notesY);
    notesY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    
    const noteLines = [
      '1. This payslip is computer-generated and does not require a physical signature.',
      '2. Any discrepancies in the attendance or salary calculation must be reported to HR within 3 working days.',
      '3. Net payable amount has been initiated for bank transfer to the worker\'s registered bank account.'
    ];
    
    noteLines.forEach(line => {
      doc.text(line, 14, notesY);
      notesY += 4.5;
    });

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('99 CARE HOME HEALTHCARE SERVICE • 104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT • +91 9016116564', 14, 285);

    return doc;
  };

  // Save slice to DB
  const savePayslipToDB = async (opts?: { whatsappSent?: boolean; markAsPaid?: boolean }) => {
    const isPaid = opts?.whatsappSent || opts?.markAsPaid || netPayable <= 0;
    const status = isPaid ? 'Paid' : 'Pending Payment';

    const genStart = format(safeStartDate, 'yyyy-MM-dd');
    const genEnd = format(safeEndDate, 'yyyy-MM-dd');
    const monthLabel = `${format(safeStartDate, 'dd MMM')} – ${format(safeEndDate, 'dd MMM yyyy')}`;

    let existingQuery = supabase
      .from('payroll')
      .select('id, period_start, period_end, status')
      .eq('worker_id', assignment.employee_id)
      .eq('period_start', genStart)
      .eq('period_end', genEnd);

    if (assignment.id) {
      existingQuery = existingQuery.eq('assignment_id', assignment.id);
    }

    const { data: existingRows } = await existingQuery;
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const row = {
      days_worked: daysWorked,
      daily_rate: dailyRate,
      total_amount: totalEarning,
      advance_amount: advanceDeduction,
      paid_amount: isPaid ? netPayable : 0,
      net_balance: isPaid ? 0 : netPayable,
      paid_through_date: isPaid ? genEnd : null,
      status,
      service_month: monthLabel,
      type: 'slice',
      worker_phone: emp?.phone || '',
      period_start: genStart,
      period_end: genEnd,
      updated_at: new Date().toISOString(),
    };

    if (!existing) {
      const { error } = await supabase.from('payroll').insert([{
        worker: emp?.full_name || 'Staff',
        worker_id: assignment.employee_id,
        assignment_id: assignment.id,
        client_name: client?.client_name || 'N/A',
        deposit_received: 0,
        payslip_type: 'worker',
        payroll_type: 'payslip',
        ...row,
      }]);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('payroll').update(row).eq('id', existing.id);
      if (error) throw error;
    }

    await supabase.from('worker_assignments').update({
      payslip_generated: true,
      advance_paid: advanceDeduction,
    }).eq('id', assignment.id);
  };

  // Mark slice as Paid
  const handleMarkAsPaid = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsMarkingPaid(true);
    try {
      await savePayslipToDB({ markAsPaid: true });
      const currentPeriodLabel = `${format(safeStartDate, 'dd MMM yyyy')} – ${format(safeEndDate, 'dd MMM yyyy')}`;
      toast.success(`Period ${currentPeriodLabel} marked as PAID (₹${Math.abs(netPayable).toLocaleString('en-IN')})! ✅`);
      
      const updatedRows = await fetchPastPayrolls();
      onGenerated();

      // Automatically advance startDateStr to the day after this paid slice's end date!
      const [ey, em, ed] = format(safeEndDate, 'yyyy-MM-dd').split('-').map(Number);
      const nextDay = new Date(ey, em - 1, ed + 1);
      const nextStartStr = format(nextDay, 'yyyy-MM-dd');
      setStartDateStr(nextStartStr);
      setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'));
      toast.info(`Next unpaid period ready: ${format(nextDay, 'dd MMM yyyy')} to Present.`);
    } catch (err: any) {
      toast.error('Failed to mark as paid: ' + err.message);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Download PDF
  const handleGeneratePayslip = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsGenerating(true);
    try {
      const doc = await generatePayslipPDF();
      if (!doc) return;
      const startStr = format(safeStartDate, 'yyyyMMdd');
      const endStr = format(safeEndDate, 'yyyyMMdd');
      doc.save(`Payslip_${emp?.full_name?.replace(/\s+/g, '_')}_${startStr}_to_${endStr}.pdf`);
      await savePayslipToDB();
      toast.success('Worker payslip generated and saved!');
      await fetchPastPayrolls();
      onGenerated();

      // Automatically advance startDateStr to the day after this slice's end date
      const [ey, em, ed] = format(safeEndDate, 'yyyy-MM-dd').split('-').map(Number);
      const nextDay = new Date(ey, em - 1, ed + 1);
      const nextStartStr = format(nextDay, 'yyyy-MM-dd');
      setStartDateStr(nextStartStr);
      setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'));
      toast.info(`Next unpaid period ready: ${format(nextDay, 'dd MMM yyyy')} to Present.`);
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Send via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    let phone = emp?.phone || '';
    if (!phone) {
      toast.error('No phone number found for this worker. Please update their profile.');
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;

    const toastId = toast.loading('Generating and dispatching payslip via WhatsApp...');
    setIsGenerating(true);
    try {
      const doc = await generatePayslipPDF();
      if (!doc) return;
      const pdfBlob = doc.output('blob');
      const fileName = `payslip-${(emp?.full_name || 'worker').replace(/\s+/g, '-')}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('payslips').getPublicUrl(fileName);

      const { data: waData, error: waError } = await supabase.functions.invoke('meta-whatsapp-outbound', {
        body: {
          phone,
          sendInvoicePdf: true,
          invoicePdfUrl: publicUrl,
          useTemplate: true,
          templateName: 'worker_payslip',
          templateParams: [emp?.full_name || 'Worker']
        }
      });
      if (waError) throw waError;
      if (waData && waData.success === false) throw new Error(waData.error || 'Meta API rejected the message.');

      await savePayslipToDB({ whatsappSent: true });
      toast.success('Payslip dispatched via WhatsApp successfully! ✅', { id: toastId });
      await fetchPastPayrolls();
      onGenerated();

      // Automatically advance startDateStr to the day after this slice's end date
      const [ey, em, ed] = format(safeEndDate, 'yyyy-MM-dd').split('-').map(Number);
      const nextDay = new Date(ey, em - 1, ed + 1);
      const nextStartStr = format(nextDay, 'yyyy-MM-dd');
      setStartDateStr(nextStartStr);
      setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'));
      toast.info(`Next unpaid period ready: ${format(nextDay, 'dd MMM yyyy')} to Present.`);
    } catch (err: any) {
      toast.error('Failed to dispatch: ' + err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete / Undo slice
  const handleDeleteSlice = async (payrollId: string, label: string) => {
    if (!confirm(`Are you sure you want to delete the billing record for ${label}?`)) return;
    try {
      const { error } = await supabase.from('payroll').delete().eq('id', payrollId);
      if (error) throw error;
      toast.success(`Removed billing slice for ${label}`);
      await fetchPastPayrolls();
      onGenerated();
    } catch (e: any) {
      toast.error('Failed to delete: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Worker Payslip Generator</h2>
              <p className="text-xs text-slate-300">{emp?.full_name} (Assigned to: {client?.client_name || 'N/A'})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Historical Settled / Paid Slices Timeline */}
          {pastPayrolls.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <BookmarkCheck className="w-4 h-4 text-emerald-600" /> Previous Billing & Paid Periods
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {pastPayrolls.length} recorded {pastPayrolls.length === 1 ? 'period' : 'periods'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {pastPayrolls.map(p => {
                  const pStart = p.period_start ? format(parseISO(p.period_start.split('T')[0]), 'dd MMM yyyy') : 'Start';
                  const pEnd = p.period_end ? format(parseISO(p.period_end.split('T')[0]), 'dd MMM yyyy') : 'End';
                  const isPaid = p.status === 'Paid';

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        <span className="font-bold text-slate-800">{pStart} <span className="text-slate-400">→</span> {pEnd}</span>
                        <span className="text-[11px] text-slate-500">({p.days_worked || 0} days)</span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className={`font-bold ${isPaid ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'} px-2 py-0.5 rounded text-[10px]`}>
                          {isPaid ? `Paid ₹${Number(p.paid_amount || p.total_amount).toLocaleString('en-IN')}` : `Pending ₹${Number(p.net_balance || p.total_amount).toLocaleString('en-IN')}`}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteSlice(p.id, `${pStart} – ${pEnd}`)}
                          className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                          title="Delete / Undo this recorded slice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clean Pay Period Selector: Start Date is fixed, End Date is editable */}
          <div className="bg-gradient-to-r from-slate-50 to-teal-50/20 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#1AA6A8]" />
                  Pay Period Slicing
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Start date is fixed to the next unpaid day. Adjust the end date below to slice pay.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                  Rate: ₹{Math.round(dailyRate).toLocaleString('en-IN')}/day
                </span>
                <span className="text-[11px] font-bold text-[#1AA6A8] bg-[#EAFBFB] border border-[#1AA6A8]/30 px-2.5 py-1 rounded-lg">
                  {totalPeriodDays} {totalPeriodDays === 1 ? 'day' : 'days'} selected
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Start Date (Locked) */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" /> Start Date (Locked)
                  </p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {format(safeStartDate, 'dd MMM yyyy')}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Unpaid Day 1
                </span>
              </div>

              {/* End Date (Editable) */}
              <div className="bg-white border-2 border-[#1AA6A8]/60 hover:border-[#1AA6A8] focus-within:border-[#1AA6A8] rounded-xl p-3 flex items-center justify-between shadow-2xs transition-all">
                <div className="flex-1 mr-2">
                  <label className="text-[10px] font-bold text-[#1AA6A8] uppercase tracking-wider block">
                    Pay Through (End Date)
                  </label>
                  <input
                    type="date"
                    value={endDateStr}
                    min={startDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="w-full text-sm font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer mt-0.5"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEndDateStr(format(assignmentEndDate, 'yyyy-MM-dd'))}
                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    title="Set End Date to Today"
                  >
                    Today
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Current Period Matching Status Banner */}
          {matchingExistingPayroll && (
            <div className={`border rounded-xl p-3 flex items-center justify-between text-xs ${
              matchingExistingPayroll.status === 'Paid'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${matchingExistingPayroll.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>
                  This exact slice (<strong>{format(safeStartDate, 'dd MMM yyyy')} – {format(safeEndDate, 'dd MMM yyyy')}</strong>) is currently saved as <strong>{matchingExistingPayroll.status.toUpperCase()}</strong>.
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                matchingExistingPayroll.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300'
              }`}>
                {matchingExistingPayroll.status}
              </span>
            </div>
          )}

          {/* Attendance Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">Attendance Summary</h3>
                {dailyRecords.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {dailyRecords.length} days
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDailyPreview(!showDailyPreview)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
                    showDailyPreview
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
                  }`}
                  title="Preview mini attendance record for each date in this period"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{showDailyPreview ? 'Hide Dates' : 'Preview Dates'}</span>
                  {showDailyPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button onClick={fetchAttendance} disabled={isLoadingAttendance}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 px-1 py-1">
                  {isLoadingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingAttendance ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : attendanceSummary ? (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Full Days Present', value: attendanceSummary.days_full ?? 0, color: 'text-emerald-600' },
                  { label: 'Half Days (0.5d)', value: attendanceSummary.days_half ?? 0, color: 'text-amber-600' },
                  { label: 'Days Absent', value: attendanceSummary.days_absent ?? 0, color: 'text-red-500' },
                  { label: 'Effective Days', value: daysWorked, color: 'text-primary font-bold' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center bg-white/70 rounded-lg py-2 border border-slate-200/60">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-3">Loading attendance data...</p>
            )}

            {/* Mini Attendance Record with Dates Preview */}
            {showDailyPreview && (
              <div className="mt-4 pt-3.5 border-t border-slate-200/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">Filter:</span>
                    <button
                      type="button"
                      onClick={() => setDailyFilter('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        dailyFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                      }`}
                    >
                      All ({dailyRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilter('present')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        dailyFilter === 'present'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                      }`}
                    >
                      Present ({dailyRecords.filter(d => d.status === 'Present').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilter('half')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        dailyFilter === 'half'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                      }`}
                    >
                      Half Day ({dailyRecords.filter(d => d.status === 'Half Day').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyFilter('absent')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        dailyFilter === 'absent'
                          ? 'bg-red-500 text-white shadow-xs'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/60'
                      }`}
                    >
                      Absent / No Duty ({dailyRecords.filter(d => d.status === 'Absent' || d.status === 'No Duty').length})
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Showing {filteredDailyRecords.length} of {dailyRecords.length} days
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-inner">
                  {filteredDailyRecords.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      No dates match the selected filter in this range.
                    </div>
                  ) : (
                    filteredDailyRecords.map((d) => (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-slate-50 ${
                          d.status === 'Half Day'
                            ? 'bg-amber-50/40'
                            : (d.status === 'Absent' || d.status === 'No Duty')
                            ? 'bg-red-50/30'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 font-semibold w-7">{d.dayName}</span>
                          <span className="font-bold text-slate-800">{d.displayDate}</span>
                          {d.checkIn && d.checkOut && (
                            <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                              ({d.checkIn} – {d.checkOut})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {d.status === 'Present' && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Full Day (+1.0d)
                            </span>
                          )}
                          {d.status === 'Half Day' && (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100/90 border border-amber-200/80 px-2 py-0.5 rounded-md text-[10px]">
                              <Clock className="w-3 h-3 text-amber-600" /> Half Day (+0.5d)
                            </span>
                          )}
                          {(d.status === 'Absent' || d.status === 'No Duty') && (
                            <span className="inline-flex items-center gap-1 font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[10px]">
                              <XCircle className="w-3 h-3 text-slate-400" /> {d.status === 'Absent' ? 'Absent (0d)' : 'No Duty (0d)'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Deduction Input */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Advance Deducted for this Period (₹)</label>
              <input
                type="number"
                min="0"
                value={advanceAmount}
                onChange={e => setAdvanceAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0"
              />
            </div>
          </div>

          {/* Calculation Preview */}
          <div className="grid grid-cols-1 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Worker Payslip ({format(safeStartDate, 'dd MMM')} – {format(safeEndDate, 'dd MMM yyyy')})
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>Assigned Client</span><span className="font-semibold text-slate-800">{client?.client_name || 'N/A'}</span></div>
                {hoursPerDay != null && hoursPerDay > 0 && (
                  <div className="flex justify-between text-slate-600"><span>Shift Hours (assignment)</span><span className="font-semibold text-slate-800">{hoursPerDay} hours/day</span></div>
                )}
                <div className="flex justify-between text-slate-600"><span>{payCalc.schemeLabel}</span><span className="text-xs text-slate-500">{payCalc.earningsLine}</span></div>
                <div className="flex justify-between font-medium text-slate-800"><span>Gross</span><span>₹{totalEarning.toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>Advance deduction</span><span>- ₹{advanceDeduction.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                  <span>Net Payable</span><span className="text-emerald-600">₹{Math.abs(netPayable).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0 flex-wrap items-center">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>

          {/* Mark as Paid Action */}
          <button
            type="button"
            onClick={handleMarkAsPaid}
            disabled={isMarkingPaid || isGenerating || !attendanceSummary}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
              matchingExistingPayroll?.status === 'Paid'
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Mark this selected date range as Paid and advance remaining starting date"
          >
            {isMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{matchingExistingPayroll?.status === 'Paid' ? 'Paid ✓ (Update)' : 'Mark as Paid'}</span>
          </button>

          {/* Download Action */}
          <button
            type="button"
            onClick={handleGeneratePayslip}
            disabled={isGenerating || isMarkingPaid || !attendanceSummary}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            title="Download PDF payslip for this date range"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>

          {/* Send via WhatsApp Action */}
          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={isGenerating || isMarkingPaid || !attendanceSummary}
            className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            title="Send PDF payslip to worker WhatsApp & record as Paid"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
