import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Loader2, Users, ChevronLeft, ChevronRight, AlertTriangle, UserMinus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO, isAfter, isToday, isBefore, startOfDay } from 'date-fns';

interface AttendanceDay {
  date: string;
  status: 'Present' | 'Absent' | 'Half Day' | null;
  attendanceId: string | null;
  isHalfDay: boolean;
}

interface AssignmentAttendancePanelProps {
  assignment: {
    id: string;
    employee_id: string;
    start_date?: string | null;
    assigned_at?: string;
    end_date: string | null;
    service_type?: string | null;
    employees: { full_name: string; job_title: string } | null;
    clients: { client_name: string; id?: string } | null;
    client_id?: string;
  };
  onSummaryChange?: (summary: { daysPresent: number; daysAbsent: number; daysHalf: number }) => void;
  onAssignmentCompleted?: (assignment: any) => void;
}

export default function AssignmentAttendancePanel({ assignment, onSummaryChange, onAssignmentCompleted }: AssignmentAttendancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingDate, setMarkingDate] = useState<string | null>(null);
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const today = startOfDay(new Date());

    const { startDate, safeStartDate, endDate, allDays, isAssignmentOver, isOpenEnded } = useMemo(() => {
        const fallbackStart = assignment.start_date || assignment.assigned_at;
        const startDate = fallbackStart ? parseISO(fallbackStart) : new Date();

        // Fixed end_date → bounded assignment. one_day → single day. No end_date → open-ended (CRM "Open-ended").
        const openEnded = !assignment.end_date && assignment.service_type !== 'one_day';

        let endDate: Date;
        if (assignment.end_date) {
            endDate = parseISO(assignment.end_date);
        } else if (assignment.service_type === 'one_day') {
            endDate = new Date(startDate);
        } else {
            endDate = new Date(); // open-ended: attendance window grows daily up to today
        }

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const safeStartDate = isAfter(startDate, endDate) ? endDate : startDate;
        const allDays = eachDayOfInterval({ start: safeStartDate, end: endDate });

        const isAssignmentOver = assignment.end_date
            ? isBefore(endDate, startOfDay(new Date()))
            : false;

        return { startDate, safeStartDate, endDate, allDays, isAssignmentOver, isOpenEnded: openEnded };
    }, [assignment.start_date, assignment.assigned_at, assignment.end_date, assignment.service_type]);

  const pastDays = useMemo(() => {
    return allDays.filter(d => !isAfter(d, today));
  }, [allDays, today]);

  const pageSize = 6;
  const totalPages = Math.ceil(allDays.length / pageSize);

  const initialPage = useMemo(() => {
    if (allDays.length <= pageSize) return 0;
    const todayIndex = allDays.findIndex(d => isToday(d));
    if (todayIndex !== -1) return Math.floor(todayIndex / pageSize);
    if (allDays[0] && isAfter(today, allDays[0])) return totalPages - 1;
    return 0;
  }, [allDays, totalPages, today]);

  const [currentPage, setCurrentPage] = useState(initialPage);
  useEffect(() => { setCurrentPage(initialPage); }, [initialPage]);

  const visibleDays = useMemo(() => {
    const startIdx = currentPage * pageSize;
    return allDays.slice(startIdx, startIdx + pageSize);
  }, [allDays, currentPage]);

  const onSummaryChangeRef = useRef(onSummaryChange);
  useEffect(() => { onSummaryChangeRef.current = onSummaryChange; }, [onSummaryChange]);

  const daysPresent = days.filter(d => d.status === 'Present').length;
  const daysHalf = days.filter(d => d.status === 'Half Day').length;
  const daysAbsent = days.filter(d => d.status === 'Absent').length;
  const effectiveDays = daysPresent + daysHalf * 0.5;

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, duty_date, status, is_half_day, assignment_id')
        .eq('worker_id', assignment.employee_id)
        .gte('duty_date', format(safeStartDate, 'yyyy-MM-dd'))
        .lte('duty_date', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;

      const attendanceMap: Record<string, typeof data[0]> = {};
      (data || []).forEach(r => { attendanceMap[r.duty_date] = r; });

      const mapped = allDays.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const rec = attendanceMap[dateStr];
        return {
          date: dateStr,
          status: rec
            ? (rec.is_half_day ? 'Half Day' : (rec.status === 'present' || rec.status === 'Present' || rec.status === 'On Duty') ? 'Present' : 'Absent') as AttendanceDay['status']
            : null,
          attendanceId: rec?.id || null,
          isHalfDay: rec?.is_half_day || false,
        };
      });

      setDays(mapped);
      onSummaryChangeRef.current?.({
        daysPresent: mapped.filter(d => d.status === 'Present').length,
        daysAbsent: mapped.filter(d => d.status === 'Absent').length,
        daysHalf: mapped.filter(d => d.status === 'Half Day').length,
      });
    } catch (err: any) {
      toast.error('Failed to load attendance: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [assignment.employee_id, safeStartDate, endDate, allDays]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const markDay = async (dateStr: string, status: 'Present' | 'Absent' | 'Half Day' | null) => {
    setMarkingDate(dateStr);
    try {
      const existing = days.find(d => d.date === dateStr);
      const isHalfDay = status === 'Half Day';
      const dbStatus = status === null ? null : (status === 'Half Day' ? 'Present' : status);

      if (status === null) {
        if (existing?.attendanceId) {
          const { error } = await supabase.from('attendance').delete().eq('id', existing.attendanceId);
          if (error) throw error;
        }
      } else if (existing?.attendanceId) {
        const { error } = await supabase.from('attendance').update({
          assignment_id: assignment.id, status: dbStatus, is_half_day: isHalfDay,
          hours_worked: status === 'Present' ? 8 : (status === 'Half Day' ? 4 : 0),
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: status !== 'Absent' ? new Date(`${dateStr}T${status === 'Half Day' ? '13' : '17'}:00:00`).toISOString() : null,
          is_absent: status === 'Absent', is_leave: false
        }).eq('id', existing.attendanceId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance').insert([{
          worker_id: assignment.employee_id, assignment_id: assignment.id, duty_date: dateStr,
          status: dbStatus, is_half_day: isHalfDay,
          hours_worked: status === 'Present' ? 8 : (status === 'Half Day' ? 4 : 0),
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: status !== 'Absent' ? new Date(`${dateStr}T${status === 'Half Day' ? '13' : '17'}:00:00`).toISOString() : null,
          is_absent: status === 'Absent', is_leave: false
        }]);
        if (error) throw error;
      }

      await fetchAttendance();
      const prevMarked = days.filter(d => d.status !== null).length;
      if (status !== null && prevMarked + 1 >= allDays.length) setShowCompletionPopup(true);
    } catch (err: any) {
      toast.error('Failed to update attendance: ' + err.message);
    } finally {
      setMarkingDate(null);
    }
  };

  const bulkMarkPresent = async () => {
    setIsBulkMarking(true);
    toast.loading('Bulk marking past days as Present...', { id: 'bulk-assign' });
    try {
      const unmarkedPast = pastDays.filter(d => {
        const ds = format(d, 'yyyy-MM-dd');
        return !days.find(x => x.date === ds && x.status !== null);
      });

      if (unmarkedPast.length === 0) { toast.success('All past days already marked!', { id: 'bulk-assign' }); return; }

      const inserts = unmarkedPast.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          worker_id: assignment.employee_id, assignment_id: assignment.id, duty_date: dateStr,
          status: 'Present', is_half_day: false, hours_worked: 8,
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: new Date(`${dateStr}T17:00:00`).toISOString(),
          is_absent: false, is_leave: false
        };
      });

      const { error } = await supabase.from('attendance').insert(inserts);
      if (error) throw error;

      toast.success(`Marked ${inserts.length} days as Present`, { id: 'bulk-assign' });
      await fetchAttendance();
      const prevMarked = days.filter(d => d.status !== null).length;
      if (prevMarked + unmarkedPast.length >= allDays.length) setShowCompletionPopup(true);
    } catch (err: any) {
      toast.error('Bulk mark failed: ' + err.message, { id: 'bulk-assign' });
    } finally {
      setIsBulkMarking(false);
    }
  };

  // ── Release Worker ─────────────────────────────────────────
  const handleReleaseWorker = async () => {
    if (!window.confirm(`Release ${assignment.employees?.full_name} from this assignment?\n\nThis will:\n• Mark the assignment as completed\n• Return the worker to the available pool\n• Move the client to "Monthly Billing" stage`)) return;

    setIsReleasing(true);
    const toastId = toast.loading('Releasing worker...');
    try {
      // 1. Mark assignment completed
      await supabase.from('worker_assignments').update({ assignment_status: 'completed' }).eq('id', assignment.id);

      // 2. Deactivate ID card link
      await supabase.from('id_card_links').update({ is_active: false }).eq('assignment_id', assignment.id);

      // 3. Return employee to available
      await supabase.from('employees').update({ status: 'available', assigned_client: null, updated_at: new Date().toISOString() }).eq('id', assignment.employee_id);

      // 4. Move CRM lead to "Monthly Billing"
      const clientId = assignment.client_id || (assignment.clients as any)?.id;
      if (clientId) {
        await supabase.from('crm_leads').update({
          pipeline_stage: 'Monthly Billing',
          assigned_worker_name: null,
          assigned_worker_role: null
        }).eq('id', clientId);
      }

      toast.success(`${assignment.employees?.full_name} released! Client moved to Monthly Billing.`, { id: toastId, duration: 5000 });

      // Trigger invoice generation prompt via parent
      onAssignmentCompleted?.(assignment);
    } catch (err: any) {
      toast.error('Failed to release worker: ' + err.message, { id: toastId });
    } finally {
      setIsReleasing(false);
    }
  };

  const getDayColor = (status: AttendanceDay['status']) => {
    if (status === 'Present') return 'bg-emerald-100 border-emerald-300 text-emerald-800';
    if (status === 'Half Day') return 'bg-amber-100 border-amber-300 text-amber-800';
    if (status === 'Absent') return 'bg-red-100 border-red-300 text-red-800';
    return 'bg-slate-50 border-slate-200 text-slate-400';
  };

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${isAssignmentOver ? 'border-amber-300' : 'border-slate-200'}`}>
      {/* Overdue Banner */}
      {isAssignmentOver && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs font-bold text-amber-800">
              Assignment period ended on {format(endDate, 'dd MMM yyyy')}. Please mark attendance and release the worker.
            </p>
          </div>
          <button
            onClick={handleReleaseWorker}
            disabled={isReleasing}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 shadow-sm"
          >
            {isReleasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
            Release Worker
          </button>
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full p-4 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-900 text-sm">{assignment.employees?.full_name || 'Unknown'}</h3>
            <p className="text-xs text-slate-500">{assignment.employees?.job_title} → {assignment.clients?.client_name || 'Unknown Client'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {format(startDate, 'dd MMM yyyy')} – {assignment.end_date ? format(parseISO(assignment.end_date), 'dd MMM yyyy') : 'Open-ended'}
              {isOpenEnded
                ? ` · ${allDays.length} ${allDays.length === 1 ? 'day' : 'days'} to mark so far`
                : ` (${allDays.length} ${allDays.length === 1 ? 'day' : 'days'} assigned)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />{effectiveDays} days worked
            </span>
            {daysAbsent > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <XCircle className="w-3.5 h-3.5" />{daysAbsent} absent
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {days.filter(d => d.status !== null).length}/{allDays.length} marked
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Attendance Grid */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600"><CheckCircle2 className="w-4 h-4" /> {daysPresent} Present</span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-600"><Clock className="w-4 h-4" /> {daysHalf} Half Day</span>
              <span className="flex items-center gap-1.5 font-semibold text-red-500"><XCircle className="w-4 h-4" /> {daysAbsent} Absent</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={bulkMarkPresent}
                disabled={isBulkMarking}
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isBulkMarking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Mark All Past Days Present
              </button>
              {/* Release button also accessible from expanded view even if not overdue */}
              {!isAssignmentOver && (
                <button
                  onClick={handleReleaseWorker}
                  disabled={isReleasing}
                  className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isReleasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                  Release
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {totalPages > 1 && visibleDays.length > 0 && (
                <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))} disabled={currentPage === 0} className="flex items-center gap-0.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-slate-600 font-medium">
                    Days {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, allDays.length)} of {allDays.length}
                  </span>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))} disabled={currentPage === totalPages - 1} className="flex items-center gap-0.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {visibleDays.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const dayData = days.find(x => x.date === dateStr);
                  const isFuture = isAfter(d, today) && !isToday(d);
                  const isMarking = markingDate === dateStr;

                  return (
                    <div key={dateStr} className={`relative rounded-lg border p-2 text-center transition-all ${isFuture ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100' : 'cursor-pointer hover:scale-105'} ${getDayColor(dayData?.status || null)}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wide">{format(d, 'EEE')}</div>
                      <div className="text-sm font-bold mt-0.5">{format(d, 'd')}</div>
                      <div className="text-[9px] text-current/70">{format(d, 'MMM')}</div>
                      {isMarking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        </div>
                      )}
                      {!isFuture && !isMarking && (
                        <div className="mt-1.5 flex justify-center gap-1">
                          <button title="Present" onClick={() => markDay(dateStr, dayData?.status === 'Present' ? null : 'Present')} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Present' ? 'bg-emerald-500 text-white' : 'bg-white/60 hover:bg-emerald-200 text-emerald-600'}`}>P</button>
                          <button title="Half Day" onClick={() => markDay(dateStr, dayData?.status === 'Half Day' ? null : 'Half Day')} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Half Day' ? 'bg-amber-500 text-white' : 'bg-white/60 hover:bg-amber-200 text-amber-600'}`}>H</button>
                          <button title="Absent" onClick={() => markDay(dateStr, dayData?.status === 'Absent' ? null : 'Absent')} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Absent' ? 'bg-red-500 text-white' : 'bg-white/60 hover:bg-red-200 text-red-500'}`}>A</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-4 text-sm">
            <div><span className="text-slate-500 text-xs">Days Worked</span><p className="font-bold text-slate-900">{effectiveDays} days</p></div>
            <div className="border-l border-slate-100 pl-4">
              <span className="text-slate-500 text-xs">Service Duration</span>
              <p className="font-bold text-slate-900">
                {isOpenEnded ? 'Open-ended' : `${allDays.length} days`}
              </p>
              {isOpenEnded && (
                <p className="text-[10px] text-slate-400 mt-0.5">{allDays.length} days elapsed since start</p>
              )}
            </div>
            <div className="border-l border-slate-100 pl-4"><span className="text-slate-500 text-xs">Completion</span><p className="font-bold text-slate-900">{Math.round((days.filter(d => d.status !== null).length / Math.max(allDays.length, 1)) * 100)}%</p></div>
          </div>
        </div>
      )}

      {/* Completion Popup */}
      {showCompletionPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-emerald-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Duty 100% Completed! 🎉</h2>
              <p className="text-slate-500 mb-6">
                All {allDays.length} assigned days for <strong>{assignment.employees?.full_name}</strong> have been marked. Would you like to release the worker and generate invoices now?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowCompletionPopup(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                  No, Later
                </button>
                <button
                  onClick={async () => { setShowCompletionPopup(false); await handleReleaseWorker(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                  Release & Generate Invoices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
