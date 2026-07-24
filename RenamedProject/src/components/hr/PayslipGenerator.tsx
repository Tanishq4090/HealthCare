import { useEffect, useState } from 'react';
import { FileText, X, Loader2, Download, Send } from 'lucide-react';
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
    employees: {
      id: string;
      full_name: string;
      job_title: string;
      phone?: string;
      monthly_daily_rate: number;
      short_term_daily_rate?: number;
      preferred_payment_type?: string;
      hourly_rate?: number;
      shift_hours?: number;
    } | null;
    clients: { client_name: string; phone_number?: string } | null;
  };
  onClose: () => void;
  onGenerated: () => void;
  autoCloseAssignmentOnGenerate?: boolean;
}

export default function PayslipGenerator({ assignment, onClose, onGenerated, autoCloseAssignmentOnGenerate }: PayslipGeneratorProps) {
  const [advanceAmount, setAdvanceAmount] = useState((assignment.advance_paid || 0).toString());
  const [isGenerating, setIsGenerating] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  const emp = assignment.employees || (assignment as any).employee;
  const client = assignment.clients || (assignment as any).client;

  const fallbackStart = assignment.start_date || assignment.assigned_at || new Date().toISOString();
  const startDate = parseISO(fallbackStart);
  const endDate = assignment.end_date ? parseISO(assignment.end_date) : new Date();
  const safeStartDate = isAfter(startDate, endDate) ? endDate : startDate;

  const totalPeriodDays = eachDayOfInterval({ start: safeStartDate, end: endDate }).length;
  const assignmentHours = resolveAssignmentHoursPerDay(assignment.hours_per_day);
  const daysWorked = attendanceSummary ? parseFloat(attendanceSummary.days_present || 0) : 0;

  const payCalc = calculateWorkerPay({
    preferred_payment_type: emp?.preferred_payment_type,
    monthly_daily_rate: emp?.monthly_daily_rate,
    short_term_daily_rate: emp?.short_term_daily_rate,
    hourly_rate: emp?.hourly_rate,
    daysWorked,
    periodDays: totalPeriodDays,
    hoursPerDay: assignmentHours,
  });

  const hoursPerDay = payCalc.hoursPerDay;
  const dailyRate = payCalc.dailyRateForDisplay;
  const totalEarning = payCalc.gross;
  const advanceDeduction = parseFloat(advanceAmount) || 0;
  const netPayable = totalEarning - advanceDeduction;
  const hourlyMissingHours =
    emp?.preferred_payment_type === 'hourly' && assignmentHours == null;

  const fetchAttendance = async () => {
    setIsLoadingAttendance(true);
    try {
      const { data, error } = await supabase.rpc('get_assignment_attendance_summary', {
        p_assignment_id: assignment.id
      });
      if (error) throw error;
      setAttendanceSummary(data?.[0] || null);
    } catch (err: any) {
      // Fallback: manual count
      const { data, error: fetchErr } = await supabase
        .from('attendance')
        .select('status, is_half_day, duty_date')
        .eq('assignment_id', assignment.id);
      if (fetchErr) { toast.error('Failed to fetch attendance'); return; }
      const present = (data || []).filter(r => !r.is_half_day && (r.status === 'Present' || r.status === 'present' || r.status === 'On Duty')).length;
      const half = (data || []).filter(r => r.is_half_day).length;
      const absent = (data || []).filter(r => r.status === 'Absent' || r.status === 'absent').length;
      setAttendanceSummary({ days_present: present + half * 0.5, days_absent: absent, days_half: half, total_days: totalPeriodDays });
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => { fetchAttendance(); }, [assignment.id]);

  const getLogo = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = '/healthcare-logo.svg';
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
    const period = `${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`;

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
      'Email: info@healthcare.com',
      'Website: HEALTHCARE.ORG'
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
    // Left side: Worker info
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
      headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' }, // Matching #3c78d8 Blue
      head: [['Attendance Summary', 'Value']],
      body: [
        ['Total Days in Period', `${totalPeriodDays} days`],
        ['Days Present', `${attendanceSummary?.days_present || 0} days`],
        ['Half Days', `${attendanceSummary?.days_half || 0} days`],
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

  const savePayslipToDB = async (opts?: { whatsappSent?: boolean }) => {
    await supabase.from('worker_assignments').update({
      payslip_generated: true,
      advance_paid: advanceDeduction,
    }).eq('id', assignment.id);

    const status = opts?.whatsappSent
      ? PAYSLIP_SENT_STATUS
      : netPayable > 0
        ? 'Pending Payment'
        : 'Settled';

    const { data: existing } = await supabase
      .from('payroll')
      .select('id')
      .eq('assignment_id', assignment.id)
      .maybeSingle();

    const row = {
      days_worked: daysWorked,
      daily_rate: dailyRate,
      total_amount: totalEarning,
      advance_amount: advanceDeduction,
      net_balance: netPayable,
      status,
      worker_phone: emp?.phone || '',
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
        period_start: assignment.start_date,
        period_end: assignment.end_date || new Date().toISOString(),
        ...row,
      }]);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('payroll').update(row).eq('id', existing.id);
      if (error) throw error;
    }
  };

  const handleGeneratePayslip = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsGenerating(true);
    try {
      const doc = await generatePayslipPDF();
      if (!doc) return;
      doc.save(`Payslip_${emp?.full_name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      await savePayslipToDB();
      toast.success('Worker payslip generated and saved!');
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
      
      if (autoCloseAssignmentOnGenerate) {
        const { error: closeError } = await supabase.from('worker_assignments')
          .update({ assignment_status: 'completed' })
          .eq('id', assignment.id);
        
        // Also reset the employee's status back to 'available'
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
      toast.error(err.message || 'Failed to dispatch', { id: toastId });
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
          {/* Assignment Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Start Date', value: format(startDate, 'dd MMM yyyy') },
              { label: 'End Date', value: assignment.end_date ? format(endDate, 'dd MMM yyyy') : 'Ongoing' },
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
              <h3 className="font-semibold text-slate-900 text-sm">Attendance Summary</h3>
              <button onClick={fetchAttendance} disabled={isLoadingAttendance}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                {isLoadingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Refresh
              </button>
            </div>
            {isLoadingAttendance ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : attendanceSummary ? (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Days Present', value: attendanceSummary.days_present, color: 'text-emerald-600' },
                  { label: 'Half Days', value: attendanceSummary.days_half, color: 'text-amber-600' },
                  { label: 'Days Absent', value: attendanceSummary.days_absent, color: 'text-red-500' },
                  { label: 'Effective Days', value: daysWorked, color: 'text-primary font-bold' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-3">Loading attendance data...</p>
            )}
          </div>

          {/* Deduction Input */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Advance Paid to Worker (₹)</label>
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
            {/* Worker Payslip */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Worker Payslip
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

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0 flex-wrap">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleGeneratePayslip} disabled={isGenerating || !attendanceSummary}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download
          </button>
          <button onClick={handleSendWhatsApp} disabled={isGenerating || !attendanceSummary}
            className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
