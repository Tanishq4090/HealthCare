import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Clock, CheckCircle2, Play, Square, AlertCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function DutyTracker() {
    const { id: workerId } = useParams<{ id: string }>();
    const [worker, setWorker] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Attendance State
    const [activeShift, setActiveShift] = useState<any>(null);
    const [todayShifts, setTodayShifts] = useState<any[]>([]);

    // Time tracking
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update live clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchAttendanceData = async () => {
        if (!workerId) return;

        try {
            // 1. Fetch Worker Details
            const { data: workerData, error: workerErr } = await supabase
                .from('workers')
                .select('*')
                .eq('id', workerId)
                .single();

            if (workerErr) throw workerErr;
            setWorker(workerData);

            // 2. Fetch Today's Shifts for this worker
            // Get start of today in local time
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const { data: attendanceData, error: attErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('worker_id', workerId)
                .gte('check_in_time', startOfToday.toISOString())
                .order('check_in_time', { ascending: false });

            if (attErr) throw attErr;

            setTodayShifts(attendanceData || []);

            // 3. Check if there's an ongoing shift (On Duty)
            const ongoing = attendanceData?.find(a => a.status === 'On Duty');
            setActiveShift(ongoing || null);

        } catch (err: any) {
            console.error("Error fetching tracker data:", err);
            toast.error("Failed to load attendance data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendanceData();
    }, [workerId]);

    const handleStartDuty = async () => {
        if (!workerId || activeShift) return;
        setActionLoading(true);

        try {
            const { data, error } = await supabase
                .from('attendance')
                .insert([{
                    worker_id: workerId,
                    status: 'On Duty'
                }])
                .select()
                .single();

            if (error) throw error;

            toast.success("Duty started successfully!");
            setActiveShift(data);
            setTodayShifts(prev => [data, ...prev]);
        } catch (err: any) {
            console.error("Error starting duty:", err);
            toast.error(err.message || "Failed to start duty.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEndDuty = async () => {
        if (!activeShift) return;
        setActionLoading(true);

        try {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('attendance')
                .update({
                    check_out_time: now,
                    status: 'Completed'
                })
                .eq('id', activeShift.id)
                .select()
                .single();

            if (error) throw error;

            toast.success("Duty ended successfully!");
            setActiveShift(null);

            // Update the shift in the list
            setTodayShifts(prev => prev.map(s => s.id === activeShift.id ? data : s));

        } catch (err: any) {
            console.error("Error ending duty:", err);
            toast.error(err.message || "Failed to end duty.");
        } finally {
            setActionLoading(false);
        }
    };

    // Calculate duration for active shift
    const getActiveDuration = () => {
        if (!activeShift?.check_in_time) return "00:00:00";
        const start = new Date(activeShift.check_in_time).getTime();
        const now = currentTime.getTime();
        const diffInSeconds = Math.floor((now - start) / 1000);

        const h = Math.floor(diffInSeconds / 3600);
        const m = Math.floor((diffInSeconds % 3600) / 60);
        const s = diffInSeconds % 60;

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">Loading Duty Tracker...</p>
                </div>
            </div>
        );
    }

    if (!worker) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Access Link</h1>
                    <p className="text-slate-600">We couldn't verify your identity. Please request a new duty link from your administrator.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-6 font-['Plus_Jakarta_Sans']">
            <div className="max-w-md w-full space-y-6">

                {/* Header Profile */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 text-center">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                        <span className="text-2xl font-bold">{worker.name.charAt(0)}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{worker.name}</h1>
                    <p className="text-slate-500 font-medium">{worker.role}</p>

                    {worker.assigned_client && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm bg-slate-50 py-2 px-4 rounded-full border border-slate-100">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span className="text-slate-700 font-medium">Assigned to <span className="text-slate-900">{worker.assigned_client}</span></span>
                        </div>
                    )}
                </div>

                {/* Primary Action Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-8 text-center bg-gradient-to-b from-white to-slate-50">
                        {/* Live Clock / StopWatch */}
                        <div className="mb-8">
                            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">
                                {activeShift ? 'Current Shift Duration' : 'Current Time'}
                            </p>
                            <div className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight">
                                {activeShift ? getActiveDuration() : currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        {/* Big Toggle Button */}
                        {activeShift ? (
                            <button
                                onClick={handleEndDuty}
                                disabled={actionLoading}
                                className="w-full h-24 bg-red-500 hover:bg-red-600 text-white rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl shadow-red-500/30 group"
                            >
                                {actionLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                                    <>
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Square className="w-5 h-5 fill-current" />
                                        </div>
                                        <span className="text-2xl font-bold">End Duty</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartDuty}
                                disabled={actionLoading || worker.status !== 'Active'}
                                className={`w-full h-24 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg group ${worker.status !== 'Active'
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-xl shadow-emerald-500/30'
                                    }`}
                            >
                                {actionLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                                    <>
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${worker.status !== 'Active' ? 'bg-slate-300' : 'bg-white/20 group-hover:scale-110'}`}>
                                            <Play className="w-6 h-6 fill-current ml-1" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-2xl font-bold block">Start Duty</span>
                                            {worker.status !== 'Active' && <span className="text-xs">Awaiting client confirmation</span>}
                                        </div>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Today's Log */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" /> Today's Log
                    </h3>

                    {todayShifts.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-sm">
                            No shifts recorded today yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {todayShifts.map((shift) => (
                                <div key={shift.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-10 rounded-full ${shift.status === 'On Duty' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {new Date(shift.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {' - '}
                                                {shift.check_out_time ? new Date(shift.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {shift.status}
                                            </p>
                                        </div>
                                    </div>
                                    {shift.status === 'Completed' && (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer link */}
                <div className="text-center pb-8 pt-4">
                    <p className="text-sm text-slate-400">
                        Powered by <span className="font-semibold">99 Care</span> CRM
                    </p>
                </div>
            </div>
        </div>
    );
}
