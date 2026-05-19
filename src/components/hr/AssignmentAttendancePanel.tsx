import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { format, eachDayOfInterval, parseISO, isAfter, isToday } from 'date-fns';

interface AttendanceDay {
  date: string; // 'YYYY-MM-DD'
  status: 'Present' | 'Absent' | 'Half Day' | null;
  attendanceId: string | null;
  isHalfDay: boolean;
}

interface AssignmentAttendancePanelProps {
  assignment: {
    id: string;
    employee_id: string;
    start_date: string;
    end_date: string | null;
    employees: { full_name: string; job_title: string } | null;
    clients: { client_name: string } | null;
  };
  onSummaryChange?: (summary: { daysPresent: number; daysAbsent: number; daysHalf: number }) => void;
}

export default function AssignmentAttendancePanel({ assignment, onSummaryChange }: AssignmentAttendancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [markingDate, setMarkingDate] = useState<string | null>(null);
  const [isBulkMarking, setIsBulkMarking] = useState(false);

  const startDate = parseISO(assignment.start_date);
  const endDate = assignment.end_date ? parseISO(assignment.end_date) : new Date();
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  const pastDays = allDays.filter(d => !isAfter(d, new Date()));

  const daysPresent = days.filter(d => d.status === 'Present').length;
  const daysHalf = days.filter(d => d.status === 'Half Day').length;
  const daysAbsent = days.filter(d => d.status === 'Absent').length;
  const effectiveDays = daysPresent + daysHalf * 0.5;

  const fetchAttendance = useCallback(async () => {
    if (!isExpanded) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, duty_date, status, is_half_day')
        .eq('assignment_id', assignment.id);

      if (error) throw error;

      const attendanceMap: Record<string, typeof data[0]> = {};
      (data || []).forEach(r => { attendanceMap[r.duty_date] = r; });

      const mapped = allDays.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const rec = attendanceMap[dateStr];
        return {
          date: dateStr,
          status: rec ? (rec.is_half_day ? 'Half Day' : rec.status === 'present' || rec.status === 'Present' || rec.status === 'On Duty' ? 'Present' : 'Absent') as AttendanceDay['status'] : null,
          attendanceId: rec?.id || null,
          isHalfDay: rec?.is_half_day || false,
        };
      });

      setDays(mapped);
      const summary = {
        daysPresent: mapped.filter(d => d.status === 'Present').length,
        daysAbsent: mapped.filter(d => d.status === 'Absent').length,
        daysHalf: mapped.filter(d => d.status === 'Half Day').length,
      };
      onSummaryChange?.(summary);
    } catch (err: any) {
      toast.error('Failed to load attendance: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isExpanded, assignment.id]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const markDay = async (dateStr: string, status: 'Present' | 'Absent' | 'Half Day' | null) => {
    setMarkingDate(dateStr);
    try {
      const existing = days.find(d => d.date === dateStr);
      const isHalfDay = status === 'Half Day';
      const dbStatus = status === null ? null : (status === 'Half Day' ? 'Present' : status);

      if (status === null) {
        // Clear record
        if (existing?.attendanceId) {
          const { error } = await supabase.from('attendance').delete().eq('id', existing.attendanceId);
          if (error) throw error;
        }
      } else if (existing?.attendanceId) {
        const { error } = await supabase.from('attendance').update({
          status: dbStatus,
          is_half_day: isHalfDay,
          hours_worked: status === 'Present' ? 8 : (status === 'Half Day' ? 4 : 0),
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: status !== 'Absent' ? new Date(`${dateStr}T${status === 'Half Day' ? '13' : '17'}:00:00`).toISOString() : null,
        }).eq('id', existing.attendanceId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance').insert([{
          worker_id: assignment.employee_id,
          assignment_id: assignment.id,
          duty_date: dateStr,
          status: dbStatus,
          is_half_day: isHalfDay,
          hours_worked: status === 'Present' ? 8 : (status === 'Half Day' ? 4 : 0),
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: status !== 'Absent' ? new Date(`${dateStr}T${status === 'Half Day' ? '13' : '17'}:00:00`).toISOString() : null,
        }]);
        if (error) throw error;
      }

      await fetchAttendance();
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

      if (unmarkedPast.length === 0) {
        toast.success('All past days already marked!', { id: 'bulk-assign' });
        return;
      }

      const inserts = unmarkedPast.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        return {
          worker_id: assignment.employee_id,
          assignment_id: assignment.id,
          duty_date: dateStr,
          status: 'Present',
          is_half_day: false,
          hours_worked: 8,
          check_in_time: new Date(`${dateStr}T09:00:00`).toISOString(),
          check_out_time: new Date(`${dateStr}T17:00:00`).toISOString(),
        };
      });

      const { error } = await supabase.from('attendance').insert(inserts);
      if (error) throw error;

      toast.success(`Marked ${inserts.length} days as Present`, { id: 'bulk-assign' });
      await fetchAttendance();
    } catch (err: any) {
      toast.error('Bulk mark failed: ' + err.message, { id: 'bulk-assign' });
    } finally {
      setIsBulkMarking(false);
    }
  };

  const getDayColor = (status: AttendanceDay['status']) => {
    if (status === 'Present') return 'bg-emerald-100 border-emerald-300 text-emerald-800';
    if (status === 'Half Day') return 'bg-amber-100 border-amber-300 text-amber-800';
    if (status === 'Absent') return 'bg-red-100 border-red-300 text-red-800';
    return 'bg-slate-50 border-slate-200 text-slate-400';
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
              {format(startDate, 'dd MMM yyyy')} – {assignment.end_date ? format(parseISO(assignment.end_date), 'dd MMM yyyy') : 'Ongoing'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Summary Badges */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {effectiveDays} days worked
            </span>
            {daysAbsent > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <XCircle className="w-3.5 h-3.5" />
                {daysAbsent} absent
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
          {/* Bulk Action + Summary Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> {daysPresent} Present
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                <Clock className="w-4 h-4" /> {daysHalf} Half Day
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-red-500">
                <XCircle className="w-4 h-4" /> {daysAbsent} Absent
              </span>
            </div>
            <button
              onClick={bulkMarkPresent}
              disabled={isBulkMarking}
              className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {isBulkMarking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Mark All Past Days Present
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {allDays.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const dayData = days.find(x => x.date === dateStr);
                const isFuture = isAfter(d, new Date()) && !isToday(d);
                const isMarking = markingDate === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`relative rounded-lg border p-2 text-center transition-all ${isFuture ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100' : 'cursor-pointer hover:scale-105'} ${getDayColor(dayData?.status || null)}`}
                  >
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
                        <button
                          title="Present"
                          onClick={() => markDay(dateStr, dayData?.status === 'Present' ? null : 'Present')}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Present' ? 'bg-emerald-500 text-white' : 'bg-white/60 hover:bg-emerald-200 text-emerald-600'}`}
                        >P</button>
                        <button
                          title="Half Day"
                          onClick={() => markDay(dateStr, dayData?.status === 'Half Day' ? null : 'Half Day')}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Half Day' ? 'bg-amber-500 text-white' : 'bg-white/60 hover:bg-amber-200 text-amber-600'}`}
                        >H</button>
                        <button
                          title="Absent"
                          onClick={() => markDay(dateStr, dayData?.status === 'Absent' ? null : 'Absent')}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${dayData?.status === 'Absent' ? 'bg-red-500 text-white' : 'bg-white/60 hover:bg-red-200 text-red-500'}`}
                        >A</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Earnings Preview */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Days Worked</span>
              <p className="font-bold text-slate-900">{effectiveDays} days</p>
            </div>
            <div className="border-l border-slate-100 pl-4">
              <span className="text-slate-500 text-xs">Days in Period</span>
              <p className="font-bold text-slate-900">{allDays.length} days</p>
            </div>
            <div className="border-l border-slate-100 pl-4">
              <span className="text-slate-500 text-xs">Completion</span>
              <p className="font-bold text-slate-900">{Math.round((days.filter(d => d.status !== null).length / Math.max(pastDays.length, 1)) * 100)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
