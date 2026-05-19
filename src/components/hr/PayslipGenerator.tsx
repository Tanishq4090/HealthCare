import { useState } from 'react';
import { FileText, X, Loader2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO, isAfter } from 'date-fns';

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
}

export default function PayslipGenerator({ assignment, onClose, onGenerated }: PayslipGeneratorProps) {
  const [advanceAmount, setAdvanceAmount] = useState((assignment.advance_paid || 0).toString());
  const [isGenerating, setIsGenerating] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  const emp = assignment.employees || (assignment as any).employee;
  const client = assignment.clients || (assignment as any).client;

  // Calculate hours per day and daily rate based on type
  const hoursPerDay = assignment.hours_per_day || emp?.shift_hours || 12;
  let dailyRate = emp?.monthly_daily_rate || 0;

  if (emp?.preferred_payment_type === 'hourly') {
    dailyRate = (emp.hourly_rate || 0) * hoursPerDay;
  } else if (emp?.preferred_payment_type === 'short_term') {
    dailyRate = emp.short_term_daily_rate || 0;
  } else {
    // monthly daily rate: prorated based on standard 12 hours
    const baseRate = emp?.monthly_daily_rate || 0;
    dailyRate = (baseRate / 12) * hoursPerDay;
  }

  const fallbackStart = assignment.start_date || assignment.assigned_at || new Date().toISOString();
  const startDate = parseISO(fallbackStart);
  const endDate = assignment.end_date ? parseISO(assignment.end_date) : new Date();
  const safeStartDate = isAfter(startDate, endDate) ? endDate : startDate;

  const totalPeriodDays = eachDayOfInterval({ start: safeStartDate, end: endDate }).length;

  const daysWorked = attendanceSummary ? parseFloat(attendanceSummary.days_present || 0) : 0;
  const totalEarning = daysWorked * dailyRate;
  const advanceDeduction = parseFloat(advanceAmount) || 0;
  const netPayable = totalEarning - advanceDeduction;

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
  useState(() => { fetchAttendance(); });

  const generatePayslipPDF = () => {
    const doc = new jsPDF();
    const dateNow = format(new Date(), 'dd MMM yyyy');
    const period = `${format(startDate, 'dd MMM yyyy')} – ${format(endDate, 'dd MMM yyyy')}`;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('99Care', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Worker Payslip', 14, 28);
    doc.setFontSize(10);
    doc.text(`Issued: ${dateNow}`, 150, 18);
    doc.text(`Period: ${period}`, 150, 28);

    // Worker Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(emp?.full_name || 'Staff Member', 14, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Designation: ${emp?.job_title || 'N/A'}`, 14, 63);
    doc.text(`Assigned Client: ${client?.client_name || 'N/A'}`, 14, 70);
    doc.text(`Phone: ${emp?.phone || 'N/A'}`, 14, 77);

    // Attendance Summary Table
    autoTable(doc, {
      startY: 90,
      theme: 'grid',
      headStyles: { fillColor: [26, 166, 168], textColor: 255, fontStyle: 'bold' },
      head: [['Attendance Summary', 'Value']],
      body: [
        ['Total Days in Period', `${totalPeriodDays} days`],
        ['Days Present', `${attendanceSummary?.days_present || 0} days`],
        ['Half Days', `${attendanceSummary?.days_half || 0} days`],
        ['Days Absent', `${attendanceSummary?.days_absent || 0} days`],
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
        [`Daily Rate (for ${hoursPerDay}h shift) × ${daysWorked} Days`, `₹${dailyRate.toFixed(2)} × ${daysWorked} = ₹${totalEarning.toFixed(2)}`],
        ['Advance / Deductions', `- ₹${advanceDeduction.toFixed(2)}`],
      ],
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
    });

    const finalY2 = (doc as any).lastAutoTable.finalY + 8;

    // Net Payable Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(14, finalY2, 182, 18, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(21, 128, 61);
    doc.text('NET AMOUNT PAYABLE TO WORKER:', 20, finalY2 + 12);
    doc.text(`₹${Math.abs(netPayable).toFixed(2)}`, 185, finalY2 + 12, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated document. Auto-generated by 99Care AI Engine.', 14, 280);

    return doc;
  };

  const handleGeneratePayslip = async () => {
    if (!attendanceSummary) { toast.error('Load attendance first'); return; }
    setIsGenerating(true);
    try {
      const doc = generatePayslipPDF();
      doc.save(`Payslip_${emp?.full_name?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      // Update DB
      await supabase.from('worker_assignments').update({
        payslip_generated: true,
        advance_paid: advanceDeduction,
      }).eq('id', assignment.id);

      await supabase.from('payroll').insert([{
        worker: emp?.full_name || 'Staff',
        worker_id: assignment.employee_id,
        assignment_id: assignment.id,
        client_name: client?.client_name || 'N/A',
        days_worked: daysWorked,
        daily_rate: dailyRate,
        total_amount: totalEarning,
        deposit_received: 0,
        advance_amount: advanceDeduction,
        net_balance: netPayable,
        payslip_type: 'worker',
        status: netPayable > 0 ? 'Pending Payment' : 'Settled',
        period_start: assignment.start_date,
        period_end: assignment.end_date || new Date().toISOString(),
      }]);

      toast.success('Worker payslip generated and saved!');
      onGenerated();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
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
              { label: 'Staff Rate/Day', value: `₹${Math.round(dailyRate).toLocaleString('en-IN')}` },
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
                <div className="flex justify-between text-slate-600"><span>Shift Hours</span><span className="font-semibold text-slate-800">{hoursPerDay} hours/day</span></div>
                <div className="flex justify-between text-slate-600"><span>{daysWorked} days × ₹{Math.round(dailyRate)}/day</span><span>₹{totalEarning.toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>Advance deduction</span><span>- ₹{advanceDeduction.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                  <span>Net Payable</span><span className="text-emerald-600">₹{Math.abs(netPayable).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleGeneratePayslip} disabled={isGenerating || !attendanceSummary}
            className="flex-[2] py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Worker Payslip
          </button>
        </div>
      </div>
    </div>
  );
}
