import { useState, useEffect } from 'react';
import { Calendar, Users, CheckCircle, XCircle, Clock, AlertCircle, Save, ChevronLeft, Search, Filter, X, User, Phone, BadgeCheck, Star, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBulkSaveAttendance } from '../../hooks/useAttendance';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const ATTENDANCE_STATUSES = [
  { id: 'present', label: 'Present', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle },
  { id: 'absent', label: 'Absent', color: 'text-rose-600 bg-rose-50', icon: XCircle },
  { id: 'half_day', label: 'Half Day', color: 'text-amber-600 bg-amber-50', icon: Clock },
  { id: 'paid_leave', label: 'Paid Leave', color: 'text-blue-600 bg-blue-50', icon: AlertCircle },
  { id: 'unpaid_leave', label: 'Unpaid Leave', color: 'text-slate-600 bg-slate-50', icon: AlertCircle },
  { id: 'holiday', label: 'Holiday', color: 'text-indigo-600 bg-indigo-50', icon: Filter },
  { id: 'weekly_off', label: 'Weekly Off', color: 'text-violet-600 bg-violet-50', icon: Calendar },
];

interface Worker {
  id: string;
  name: string;
  role: string;
  status: string;
  assigned_client?: string;
  monthly_daily_rate?: number;
  short_term_daily_rate?: number;
  deposit_received?: number;
  aadhaar_number?: string;
  phone?: string;
  address?: string;
  dob?: string;
  stats?: {
    presentDays: number;
    totalHours: number;
    rating: number;
    absentDays: number;
  };
}

export default function MarkAttendance() {
  const { user, hasAccess, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workers, setWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeHours, setEmployeeHours] = useState<Record<string, string>>({});
  const [checkInTimes, setCheckInTimes] = useState<Record<string, string>>({});
  const [checkOutTimes, setCheckOutTimes] = useState<Record<string, string>>({});
  const [draftChanges, setDraftChanges] = useState<Record<string, string | null>>({});
  
  // Worker Detail Modal State
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFormData, setModalFormData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const bulkSaveMutation = useBulkSaveAttendance();

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">Initializing attendance module...</p>
      </div>
    );
  }

  // Role Guard
  if (!hasAccess('hr')) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <XCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only HR personnel can mark or edit attendance.</p>
        <button onClick={() => navigate('/admin/hr')} className="mt-6 px-4 py-2 bg-primary text-white rounded-lg">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      // Fetch Active Workers
      const { data: workerData, error: workerError } = await supabase.from('workers').select('*').neq('status', 'Inactive').order('name');
      if (workerError) throw workerError;

      // Fetch Attendance for selected date
      const { data: attendanceData } = await supabase.from('attendance').select('*').eq('duty_date', selectedDate);

      // Mock Leave Check (using 'leaves' table date column)
      const { data: leaveData } = await supabase.from('leaves').select('worker_id, leave_type').eq('date', selectedDate).eq('status', 'Approved');

      const workersWithData = (workerData || []).map(w => {
        const leave = leaveData?.find(l => l.worker_id === w.id);
        const attendance = attendanceData?.find(a => a.worker_id === w.id);
        
        return {
          ...w,
          currentStatus: attendance?.status || null,
          autoStatus: leave ? (leave.leave_type === 'Paid' ? 'paid_leave' : 'unpaid_leave') : null
        };
      });

      setWorkers(workersWithData);
    } catch (err) {
      console.error('Error fetching workers:', err);
      toast.error('Failed to load employee list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [selectedDate]); // Refetch when date changes to get leaves

  const combineDateTime = (date: string, time: string | null) => {
    if (!time) return null;
    return `${date}T${time}:00`;
  };

  const handleMark = (employeeId: string, status: string, currentStatus?: string | null) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (selectedDate > todayStr) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const effectiveStatus = draftChanges[employeeId] !== undefined ? draftChanges[employeeId] : currentStatus;

    if (effectiveStatus === status) {
      // Toggle off
      setDraftChanges(prev => ({ ...prev, [employeeId]: null }));
    } else {
      setDraftChanges(prev => ({ ...prev, [employeeId]: status }));
      // Set default times if presenting
      if (status === 'present' && !checkInTimes[employeeId]) {
         setCheckInTimes(prev => ({ ...prev, [employeeId]: '09:00' }));
         setCheckOutTimes(prev => ({ ...prev, [employeeId]: '17:00' }));
         setEmployeeHours(prev => ({ ...prev, [employeeId]: '8' }));
      } else if (status === 'half_day' && !checkInTimes[employeeId]) {
         setCheckInTimes(prev => ({ ...prev, [employeeId]: '09:00' }));
         setCheckOutTimes(prev => ({ ...prev, [employeeId]: '13:00' }));
         setEmployeeHours(prev => ({ ...prev, [employeeId]: '4' }));
      }
    }
  };

  const handleSaveAll = async () => {
    const records = Object.entries(draftChanges)
      .filter(([_, status]) => status !== undefined)
      .map(([employeeId, status]) => ({
        workerId: employeeId,
        status: status as string,
        hoursWorked: parseFloat(employeeHours[employeeId] || '0'),
        checkInTime: combineDateTime(selectedDate, checkInTimes[employeeId]),
        checkOutTime: combineDateTime(selectedDate, checkOutTimes[employeeId])
      }));

    if (records.length === 0) {
      toast.error("No changes to save");
      return;
    }

    toast.loading(`Saving ${records.length} changes...`, { id: 'bulk-save' });
    try {
      await bulkSaveMutation.mutateAsync({
        date: selectedDate,
        records,
        markedBy: user?.id || 'unknown'
      });
      setDraftChanges({});
      fetchWorkers();
      toast.success('All changes saved successfully', { id: 'bulk-save' });
    } catch (e) {
      toast.error('Failed to save changes', { id: 'bulk-save' });
    }
  };

  const handleBulkMark = (status: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (selectedDate > todayStr) {
      toast.error('Cannot mark attendance for future dates');
      return;
    }

    const newDrafts = { ...draftChanges };
    filteredWorkers.forEach(w => {
        newDrafts[w.id] = status;
    });
    setDraftChanges(newDrafts);
    toast.success(`Applied ${status} to ${filteredWorkers.length} employees (Draft)`);
  };

  const handleSaveRow = async (employeeId: string) => {
    const status = draftChanges[employeeId];
    if (status === undefined) return;

    const record = {
      workerId: employeeId,
      status: status as string,
      hoursWorked: parseFloat(employeeHours[employeeId] || '0'),
      checkInTime: combineDateTime(selectedDate, checkInTimes[employeeId]),
      checkOutTime: combineDateTime(selectedDate, checkOutTimes[employeeId])
    };

    toast.loading(`Saving change...`, { id: `save-${employeeId}` });
    try {
      await bulkSaveMutation.mutateAsync({
        date: selectedDate,
        records: [record],
        markedBy: user?.id || 'unknown'
      });
      setDraftChanges(prev => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
      fetchWorkers();
      toast.success('Saved', { id: `save-${employeeId}` });
    } catch (e) {
      toast.error('Failed', { id: `save-${employeeId}` });
    }
  };

  const handleResetRow = (employeeId: string) => {
    setDraftChanges(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  const updateHours = (employeeId: string, val: string) => {
    setEmployeeHours(prev => ({ ...prev, [employeeId]: val }));
  };

  const updateTiming = (employeeId: string, type: 'in' | 'out', val: string) => {
    if (type === 'in') setCheckInTimes(prev => ({ ...prev, [employeeId]: val }));
    else setCheckOutTimes(prev => ({ ...prev, [employeeId]: val }));

    // Auto-calculate duration if both exist
    const cin = type === 'in' ? val : checkInTimes[employeeId];
    const cout = type === 'out' ? val : checkOutTimes[employeeId];

    if (cin && cout) {
        const [h1, m1] = cin.split(':').map(Number);
        const [h2, m2] = cout.split(':').map(Number);
        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff > 0) {
            const hrs = (diff / 60).toFixed(1);
            setEmployeeHours(prev => ({ ...prev, [employeeId]: hrs }));
        }
    }
  };

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setModalFormData({
      name: worker.name,
      role: worker.role,
      assigned_client: worker.assigned_client || '',
      monthly_daily_rate: worker.monthly_daily_rate?.toString() || '',
      short_term_daily_rate: worker.short_term_daily_rate?.toString() || '',
      deposit_received: worker.deposit_received?.toString() || '15000',
      status: worker.status,
      aadhaar_number: worker.aadhaar_number || '',
      phone: worker.phone || '',
      address: worker.address || '',
      dob: worker.dob || ''
    });
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;
    setIsSubmitting(true);

    try {
      const payload = {
        name: modalFormData.name,
        role: modalFormData.role,
        assigned_client: modalFormData.assigned_client || null,
        monthly_daily_rate: parseFloat(modalFormData.monthly_daily_rate) || 0,
        short_term_daily_rate: parseFloat(modalFormData.short_term_daily_rate) || 0,
        deposit_received: parseFloat(modalFormData.deposit_received) || 0,
        status: modalFormData.status,
        aadhaar_number: modalFormData.aadhaar_number,
        phone: modalFormData.phone,
        address: modalFormData.address,
        dob: modalFormData.dob || null
      };

      const { error } = await supabase.from('workers').update(payload).eq('id', selectedWorker.id);
      if (error) throw error;

      toast.success('Worker details updated successfully');
      setIsModalOpen(false);
      fetchWorkers(); // Refresh data
    } catch (err: any) {
      console.error('Error updating worker:', err);
      toast.error(`Failed to update worker: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button onClick={() => navigate('/admin/hr')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to HR Module
          </button>
          <h1 className="text-3xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Mark Attendance</h1>
          <p className="text-slate-500 mt-1">Daily status reporting for {format(new Date(selectedDate), 'MMMM do, yyyy')}</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
          <Calendar className="w-5 h-5 text-primary ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="border-none focus:ring-0 text-sm font-medium outline-none"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-slate-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300">Quick Bulk Actions</p>
            <p className="text-xs text-slate-500">Apply to all filtered employees</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUSES.slice(0, 3).map(status => (
            <button
              key={status.id}
              onClick={() => handleBulkMark(status.id)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-semibold rounded-lg transition-all border border-slate-700 shadow-sm"
            >
              All {status.label}
            </button>
          ))}
          <div className="w-px h-8 bg-slate-700 mx-2 hidden sm:block" />
          <button 
            onClick={handleSaveAll}
            disabled={Object.keys(draftChanges).length === 0 || bulkSaveMutation.isPending}
            className={`px-6 py-2 text-white text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                Object.keys(draftChanges).length > 0 
                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 animate-pulse' 
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" /> 
            {bulkSaveMutation.isPending ? 'Saving...' : `Save ${Object.keys(draftChanges).length > 0 ? `(${Object.keys(draftChanges).length})` : ''} Changes`}
          </button>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search employees by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight">Employee Details</th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight text-center">Check In</th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight text-center">Check Out</th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight text-center">Hours</th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight">Today's Status</th>
                <th className="py-4 px-6 text-sm font-bold text-slate-600 uppercase tracking-tight text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                      Loading workforce directory...
                    </div>
                  </td>
                </tr>
              ) : filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-20 text-center text-slate-500">
                    No employees found matching your search.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(worker => (
                  <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center font-bold text-primary group-hover:scale-110 transition-transform">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-lg leading-tight">{worker.name}</p>
                          <p className="text-sm text-slate-500 mt-0.5">{worker.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <input 
                        type="time" 
                        value={checkInTimes[worker.id] || ''}
                        onChange={(e) => updateTiming(worker.id, 'in', e.target.value)}
                        className="w-full px-2 py-1.5 text-center text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-6">
                      <input 
                        type="time" 
                        value={checkOutTimes[worker.id] || ''}
                        onChange={(e) => updateTiming(worker.id, 'out', e.target.value)}
                        className="w-full px-2 py-1.5 text-center text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-6">
                      <input 
                        type="number" 
                        value={employeeHours[worker.id] || ''}
                        onChange={(e) => updateHours(worker.id, e.target.value)}
                        placeholder="Hours"
                        className="w-20 px-2 py-1.5 text-center text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex flex-wrap gap-2">
                        {ATTENDANCE_STATUSES.map(status => {
                          const isDraft = draftChanges[worker.id] !== undefined;
                          const effectiveStatus = isDraft ? draftChanges[worker.id] : worker.currentStatus;
                          const isActive = effectiveStatus === status.id;
                          
                          return (
                            <button
                              key={status.id}
                              onClick={() => handleMark(worker.id, status.id, worker.currentStatus)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 border ${
                                isActive 
                                  ? 'bg-primary text-white border-primary shadow-md scale-105 shadow-primary/20' 
                                  : status.color + ' border-transparent hover:border-current'
                              } group/btn relative`}
                              title={status.label}
                            >
                              <status.icon className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-tight hidden sm:inline-block">{status.label}</span>
                              {isActive && (
                                <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-primary rounded-full ${isDraft ? 'animate-ping' : ''}`} />
                              )}
                              {isDraft && isActive && (
                                 <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 border-2 border-white rounded-full" title="Unsaved Change" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {draftChanges[worker.id] !== undefined && (
                          <>
                            <button 
                              onClick={() => handleResetRow(worker.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Discard Draft"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleSaveRow(worker.id)}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Save Only This Row"
                            >
                              <Save className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleOpenModal(worker)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                          title="View Details"
                        >
                          <ChevronLeft className="w-5 h-5 rotate-180" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worker Detail Modal */}
      {isModalOpen && selectedWorker && modalFormData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight">Worker Details</h2>
                  <p className="text-sm text-slate-500 font-medium">Edit profile and performance review</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-2.5 rounded-xl hover:bg-slate-100 transition-all active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={modalFormData.name}
                        onChange={(e) => setModalFormData({ ...modalFormData, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-slate-50/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Role / Specialization</label>
                    <div className="relative">
                      <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={modalFormData.role}
                        onChange={(e) => setModalFormData({ ...modalFormData, role: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-slate-50/30"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">WhatsApp Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={modalFormData.phone}
                        onChange={(e) => setModalFormData({ ...modalFormData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-slate-50/30"
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Status</label>
                    <select
                      value={modalFormData.status}
                      onChange={(e) => setModalFormData({ ...modalFormData, status: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-white"
                    >
                      <option value="Available">Available</option>
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Performance Section */}
              <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <TrendingUp className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Performance Insights (Monthly)</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center hover:bg-white/20 transition-colors">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Rating</p>
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-base font-bold">{selectedWorker?.stats?.rating || '5.0'}</span>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center hover:bg-white/20 transition-colors">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Present</p>
                      <p className="text-base font-bold text-emerald-400">{selectedWorker?.stats?.presentDays || 0}d</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center hover:bg-white/20 transition-colors">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Absent</p>
                      <p className="text-base font-bold text-rose-400">{selectedWorker?.stats?.absentDays || 0}d</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-center hover:bg-white/20 transition-colors">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Hours</p>
                      <p className="text-base font-bold text-blue-400">{selectedWorker?.stats?.totalHours || 0}h</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Monthly Daily Rate (₹)</label>
                    <input
                      type="number"
                      required
                      value={modalFormData.monthly_daily_rate}
                      onChange={(e) => setModalFormData({ ...modalFormData, monthly_daily_rate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-slate-50/30 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Short Term Rate (₹)</label>
                    <input
                      type="number"
                      required
                      value={modalFormData.short_term_daily_rate}
                      onChange={(e) => setModalFormData({ ...modalFormData, short_term_daily_rate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium bg-slate-50/30 font-mono"
                    />
                  </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
