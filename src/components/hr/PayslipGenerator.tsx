import { useEffect, useState, useMemo } from 'react';
import { FileText, X, Loader2, Download, Send, CalendarDays, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO, isAfter } from 'date-fns';
import { calculateWorkerPay, resolveAssignmentHoursPerDay } from '../../utils/workerPayroll';
import { PAYSLIP_SENT_STATUS } from '../../utils/payrollDispatch';

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

interface CycleOption {
  id: string;
  type: 'month' | 'full' | 'custom';
  label: string;
  fullLabel: string;
  monthKey: string;
  start: Date;
  end: Date;
  startDateStr: string;
  endDateStr: string;
}

export default function PayslipGenerator({ assignment, onClose, onGenerated, autoCloseAssignmentOnGenerate }: PayslipGeneratorProps) {
  const [advanceAmount, setAdvanceAmount] = useState((assignment.advance_paid || 0).toString());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [showDailyPreview, setShowDailyPreview] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyFilter, setDailyFilter] = useState<'all' | 'present' | 'half' | 'absent'>('all');
  const [pastPayrolls, setPastPayrolls] = useState<any[]>([]);

  const emp = assignment.employees || (assignment as any).employee;
  const client = assignment.clients || (assignment as any).client;

  // Base assignment dates
  const fallbackStart = assignment.start_date || assignment.assigned_at || new Date().toISOString();
  const fullStartDate = parseISO(fallbackStart);
  const fullEndDate = assignment.end_date ? parseISO(assignment.end_date) : new Date();
  const safeFullStartDate = isAfter(fullStartDate, fullEndDate) ? fullEndDate : fullStartDate;

  // Generate monthly cycle options from start to end/ongoing
  const cycleOptions: CycleOption[] = useMemo(() => {
    const list: CycleOption[] = [];
    const startYear = safeFullStartDate.getFullYear();
    const startMonth = safeFullStartDate.getMonth();
    const endYear = fullEndDate.getFullYear();
    const endMonth = fullEndDate.getMonth();

    for (let y = startYear; y <= endYear; y++) {
      const mFrom = (y === startYear) ? startMonth : 0;
      const mTo = (y === endYear) ? endMonth : 11;
      for (let m = mFrom; m <= mTo; m++) {
        const mKey = `${y}-${String(m + 1).padStart(2, '0')}`;
        const rawMStart = new Date(y, m, 1);
        const rawMEnd = new Date(y, m + 1, 0); // last day of month

        const cycleStart = isAfter(safeFullStartDate, rawMStart) ? safeFullStartDate : rawMStart;
        const cycleEnd = isAfter(rawMEnd, fullEndDate) ? fullEndDate : rawMEnd;

        const label = format(rawMStart, 'MMM yyyy');
        const fullLabel = `${format(cycleStart, 'dd MMM yyyy')} – ${format(cycleEnd, 'dd MMM yyyy')}`;

        list.push({
          id: `month-${mKey}`,
          type: 'month',
          label,
          fullLabel,
          monthKey: mKey,
          start: cycleStart,
          end: cycleEnd,
          startDateStr: format(cycleStart, 'yyyy-MM-dd'),
          endDateStr: format(cycleEnd, 'yyyy-MM-dd'),
        });
      }
    }

    // Add 'Full Cycle' option
    list.push({
      id: 'full',
      type: 'full',
      label: 'All Days (Full Cycle)',
      fullLabel: `${format(safeFullStartDate, 'dd MMM yyyy')} – ${assignment.end_date ? format(fullEndDate, 'dd MMM yyyy') : 'Ongoing'}`,
      monthKey: 'all',
      start: safeFullStartDate,
      end: fullEndDate,
      startDateStr: format(safeFullStartDate, 'yyyy-MM-dd'),
      endDateStr: format(fullEndDate, 'yyyy-MM-dd'),
    });

    return list;
  }, [assignment.start_date, assignment.assigned_at, assignment.end_date]);

  // Selected cycle state
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    return cycleOptions.length > 0 ? cycleOptions[0].id : 'full';
  });

  const [customStartDate, setCustomStartDate] = useState<string>(() => format(safeFullStartDate, 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(() => format(fullEndDate, 'yyyy-MM-dd'));

  // Determine active effective date range based on selection
  const selectedCycle = cycleOptions.find(c => c.id === selectedCycleId);
  const startDate = useMemo(() => {
    if (selectedCycleId === 'custom' && customStartDate) {
      try { return parseISO(customStartDate); } catch { return safeFullStartDate; }
    }
    return selectedCycle?.start || safeFullStartDate;
  }, [selectedCycleId, customStartDate, selectedCycle, safeFullStartDate]);

  const endDate = useMemo(() => {
    if (selectedCycleId === 'custom' && customEndDate) {
      try { return parseISO(customEndDate); } catch { return fullEndDate; }
    }
    return selectedCycle?.end || fullEndDate;
  }, [selectedCycleId, customEndDate, selectedCycle, fullEndDate]);

  const safeStartDate = isAfter(startDate, endDate) ? endDate : startDate;
  const totalPeriodDays = eachDayOfInterval({ start: safeStartDate, end: endDate }).length;
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

  // Fetch past payroll records for this worker and assignment
  const fetchPastPayrolls = async () => {
    try {
      const { data } = await supabase
        .from('payroll')
        .select('*')
        .eq('worker_id', assignment.employee_id)
        .order('period_start', { ascending: true });

      setPastPayrolls(data || []);
    } catch (e) {
      console.error('Error fetching past payrolls', e);
    }
  };

  useEffect(() => {
    fetchPastPayrolls();
  }, [assignment.employee_id, assignment.id]);

  // Identify if currently selected period has an existing payroll record
  const currentPeriodPayroll = useMemo(() => {
    const sStr = format(safeStartDate, 'yyyy-MM-dd');
    const eStr = format(endDate, 'yyyy-MM-dd');
    return pastPayrolls.find(p => {
      const pStart = p.period_start?.split('T')[0];
      const pEnd = p.period_end?.split('T')[0];
      return pStart === sStr || (pStart && pEnd && pStart <= eStr && pEnd >= sStr);
    });
  }, [pastPayrolls, safeStartDate, endDate]);

  const getCyclePayrollStatus = (cycle: CycleOption) => {
    return pastPayrolls.find(p => {
      const pStart = p.period_start?.split('T')[0];
      const pEnd = p.period_end?.split('T')[0];
      return pStart === cycle.startDateStr || (pStart && pEnd && pStart <= cycle.endDateStr && pEnd >= cycle.startDateStr);
    });
  };

  // Fetch attendance for the currently selected period
  const fetchAttendance = async () => {
    setIsLoadingAttendance(true);
    try {
      const isSyntheticId = assignment.id.startsWith('temp-');
      const startStr = format(safeStartDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

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

      const allDates = eachDayOfInterval({ start: safeStartDate, end: endDate });
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
      const finalPresentDays = (lockedDays != null && effectiveDays === 0 && selectedCycleId === 'full') ? lockedDays : effectiveDays;

      setAttendanceSummary({
        days_full: full,
        days_present: finalPresentDays,
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

  // Re-fetch attendance when dates or assignment change
  useEffect(() => {
    fetchAttendance();
  }, [assignment.id, format(safeStartDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')]);

  const filteredDailyRecords = dailyRecords.filter(d => {
    if (dailyFilter === 'all') return true;
    if (dailyFilter === 'present') return d.status === 'Present';
    if (dailyFilter === 'half') return d.status === 'Half Day';
    if (dailyFilter === 'absent') return d.status === 'Absent' || d.status === 'No Duty';
    return true;
  });

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
        } catch (err) {
          console.error('Failed to convert SVG to PNG', err);
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
    const period = `${format(safeStartDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`;

    // Header (Logo left, Company Right - matching Tax Invoice structure)
    const logoImg = await getLogo();
    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 14, 38, 15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(60, 120, 216); // Accent Blue (#3c78d8)
      doc.text('WORKER PAYSLIP', 14, 35);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text('99 CARE', 14, 25);
      doc.setFontSize(13);
      doc.setTextColor(60, 120, 216); // Accent Blue (#3c78d8)
      doc.text('WORKER PAYSLIP', 14, 33);
    }

    // Company Info (Right)
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

    // Divider Line (matching the blue divider)
    doc.setDrawColor(180, 200, 240);
    doc.setLineWidth(0.8);
    doc.line(14, 42, 196, 42);

    // Worker Details & Payslip Meta
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

    // Right side: Payslip Details
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
    } else if (emp?.preferred_payment_type === 'hourly') {
      doc.text('Shift Hours: set on assignment', 130, 74);
    }

    // Attendance Summary Table
    autoTable(doc, {
      startY: 84,
      theme: 'grid',
      headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' },
      head: [['Attendance Summary', 'Value']],
      body: [
        ['Total Days in Period', `${totalPeriodDays} days`],
        ['Full Days Present', `${attendanceSummary?.days_full ?? (attendanceSummary?.days_present ? Math.max(0, attendanceSummary.days_present - (attendanceSummary.days_half || 0) * 0.5) : 0)} days`],
        ['Half Days', `${attendanceSummary?.days_half || 0} days (0.5 day/each)`],
        ['Days Absent', `${attendanceSummary?.days_absent || 0} days`],
        ['Effective Working Days', `${daysWorked} days`],
      ],
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
    });

    const finalY1 = (doc as any).lastAutoTable.finalY + 8;

    // Earnings Breakdown
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

    // Net Payable Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(14, finalY2, 182, 18, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text('NET AMOUNT PAYABLE TO WORKER:', 20, finalY2 + 11);
    doc.text(`Rs. ${Math.abs(netPayable).toFixed(2)}`, 185, finalY2 + 11, { align: 'right' });

    // Bank Details (Center) & Signatory (Right)
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

    // Signature Box (Right)
    const sigY = finalY2 + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('For 99 CARE', 150, sigY);
    
    doc.line(140, sigY + 16, 190, sigY + 16);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Authorized Signatory', 150, sigY + 20);

    // Notes Section
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

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('99 CARE HOME HEALTHCARE SERVICE • 104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT • +91 9016116564', 14, 285);

    return doc;
  };

  const savePayslipToDB = async (opts?: { whatsappSent?: boolean; markAsPaid?: boolean }) => {
    await supabase.from('worker_assignments').update({
      payslip_generated: true,
      advance_paid: advanceDeduction,
    }).eq('id', assignment.id);

    const isPaid = opts?.whatsappSent || opts?.markAsPaid || netPayable <= 0;
    const status = isPaid ? 'Paid' : 'Pending Payment';

    const genStart = format(safeStartDate, 'yyyy-MM-dd');
    const genEnd = format(endDate, 'yyyy-MM-dd');
    const monthLabel = format(safeStartDate, 'MMMM yyyy');

    let existingQuery = supabase
      .from('payroll')
      .select('id, period_start, period_end, status')
      .eq('worker_id', assignment.employee_id)
      .eq('assignment_id', assignment.id)
      .eq('period_start', genStart);

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
      month: monthLabel,
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
  };

  const handleMarkAsPaid = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsMarkingPaid(true);
    try {
      await savePayslipToDB({ markAsPaid: true });
      const periodLabel = selectedCycle?.fullLabel || `${format(safeStartDate, 'dd MMM')} – ${format(endDate, 'dd MMM yyyy')}`;
      toast.success(`Payslip for ${periodLabel} marked as PAID (₹${Math.abs(netPayable).toLocaleString('en-IN')})! ✅`);
      await fetchPastPayrolls();
      onGenerated();
    } catch (err: any) {
      toast.error('Failed to mark as paid: ' + err.message);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleGeneratePayslip = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsGenerating(true);
    try {
      const doc = await generatePayslipPDF();
      if (!doc) return;
      const startStr = format(safeStartDate, 'yyyyMMdd');
      const endStr = format(endDate, 'yyyyMMdd');
      doc.save(`Payslip_${emp?.full_name?.replace(/\s+/g, '_')}_${startStr}_to_${endStr}.pdf`);
      await savePayslipToDB();
      toast.success('Worker payslip generated and saved!');
      await fetchPastPayrolls();
      onGenerated();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

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
      
      if (autoCloseAssignmentOnGenerate) {
        const { error: closeError } = await supabase.from('worker_assignments')
          .update({ assignment_status: 'completed' })
          .eq('id', assignment.id);
        
        if (!closeError) {
          await supabase.from('employees')
            .update({ status: 'available', assigned_client: null })
            .eq('id', assignment.employee_id);
          toast.success('Worker duty marked as completed and closed!');
        } else {
          console.error('Failed to close assignment:', closeError);
        }
      }
      onGenerated();
    } catch (err: any) {
      toast.error('Failed to dispatch: ' + err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Period Selector Card */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Select Billing Cycle / Period</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {selectedCycle?.fullLabel || `${format(safeStartDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`}
              </span>
            </div>

            {/* Cycle Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {cycleOptions.map(opt => {
                const isSelected = selectedCycleId === opt.id;
                const pastPay = getCyclePayrollStatus(opt);
                const isPaid = pastPay?.status === 'Paid';
                const isPending = pastPay?.status === 'Pending Payment';

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedCycleId(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm scale-102 ring-2 ring-emerald-500/30'
                        : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isPaid && (
                      <span className="text-[9px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Paid
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[9px] bg-amber-500/30 text-amber-200 border border-amber-400/40 px-1.5 py-0.5 rounded font-semibold">
                        Pending
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Custom Range Chip */}
              <button
                type="button"
                onClick={() => setSelectedCycleId('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  selectedCycleId === 'custom'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm scale-102 ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <span>Custom Range</span>
              </button>
            </div>

            {/* Custom Range Inputs */}
            {selectedCycleId === 'custom' && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-4 flex-wrap animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Existing Paid Status Banner */}
          {currentPeriodPayroll?.status === 'Paid' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-emerald-900 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{selectedCycle?.label || 'This period'}</strong> is already recorded as <strong>PAID</strong> (Net: ₹{Number(currentPeriodPayroll.paid_amount || currentPeriodPayroll.total_amount || netPayable).toLocaleString('en-IN')}).
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Paid
              </span>
            </div>
          )}

          {/* Period Details Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Start Date', value: format(safeStartDate, 'dd MMM yyyy') },
              { label: 'End Date', value: format(endDate, 'dd MMM yyyy') },
              { label: 'Period (Days)', value: `${totalPeriodDays} days` },
              {
                label: emp?.preferred_payment_type === 'monthly' ? 'Implied Daily (÷ period)' : 'Staff Rate/Day',
                value: `₹${Math.round(dailyRate).toLocaleString('en-IN')}`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-slate-800 mt-1">{value}</p>
              </div>
            ))}
          </div>

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
                  title="Preview mini attendance record for each date"
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
                  { label: 'Full Days Present', value: attendanceSummary.days_full ?? Math.max(0, attendanceSummary.days_present - (attendanceSummary.days_half || 0) * 0.5), color: 'text-emerald-600' },
                  { label: 'Half Days (0.5d)', value: attendanceSummary.days_half, color: 'text-amber-600' },
                  { label: 'Days Absent', value: attendanceSummary.days_absent, color: 'text-red-500' },
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

                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-inner">
                  {filteredDailyRecords.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      No dates match the selected filter.
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Advance Paid to Worker for this Period (₹)</label>
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
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Worker Payslip ({selectedCycle?.label || 'Custom Period'})
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>Assigned Client</span><span className="font-semibold text-slate-800">{client?.client_name || 'N/A'}</span></div>
                {hoursPerDay != null && hoursPerDay > 0 && (
                  <div className="flex justify-between text-slate-600"><span>Shift Hours (assignment)</span><span className="font-semibold text-slate-800">{hoursPerDay} hours/day</span></div>
                )}
                {hourlyMissingHours && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">Hourly worker: set shift hours on the assignment before generating.</p>
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
              currentPeriodPayroll?.status === 'Paid'
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Mark this selected billing period as Paid in the system"
          >
            {isMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{currentPeriodPayroll?.status === 'Paid' ? 'Paid ✓ (Update)' : 'Mark as Paid'}</span>
          </button>

          {/* Download Action */}
          <button
            type="button"
            onClick={handleGeneratePayslip}
            disabled={isGenerating || isMarkingPaid || !attendanceSummary}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            title="Download PDF payslip for this period"
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
