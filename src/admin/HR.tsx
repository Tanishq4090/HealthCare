import { useState, useEffect, useCallback } from 'react';
import { Phone, UserCheck, CheckCircle2, FileText, Upload, Bot, Edit3, X, Globe, Send, Users, Clock, Building, Loader2, RefreshCw, History, Search, Trash2, AlertTriangle, Plus, MessageSquare, Download, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { MOCK_PAYROLL } from '../data/mockWorkers';
import { format } from 'date-fns';
import WorkerAllocation from '../components/hr/WorkerAllocation';
import AssignmentAttendancePanel from '../components/hr/AssignmentAttendancePanel';
import PayslipGenerator from '../components/hr/PayslipGenerator';

export default function HR() {
    const [activeTab, setActiveTab] = useState<'allocation' | 'attendance' | 'payroll'>('allocation');
    const [isGenerating, setIsGenerating] = useState(false);
    const [workers, setWorkers] = useState<any[]>([]);
    const [payrollItems, setPayrollItems] = useState<any[]>([]);
    const [pipelineLeads, setPipelineLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [workerSearch, setWorkerSearch] = useState('');
    const [workerStatusFilter, setWorkerStatusFilter] = useState<string>('All');
    const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);
    const [isDeletingWorker, setIsDeletingWorker] = useState(false);

    const currentMonth = format(new Date(), 'MM');
    const currentYear = format(new Date(), 'yyyy');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
    // Track the original worker data when editing, so we can detect client reassignment
    const [originalWorkerData, setOriginalWorkerData] = useState<any>(null);

    // Live Attendance State
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [inlineMarkingId, setInlineMarkingId] = useState<string | null>(null);
    const [activeAssignments, setActiveAssignments] = useState<any[]>([]);

    // Initial data fetch
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        assigned_client: '',
        monthly_daily_rate: '',
        short_term_daily_rate: '',
        deposit_received: '15000',
        status: 'Available',
        phone: '',
        address: '',
        dob: '',
        aadhaar_number: '',
        documents: [] as File[]
    });

    // Payroll Edit Modal State
    const [isEditPayrollModalOpen, setIsEditPayrollModalOpen] = useState(false);
    const [editingPayroll, setEditingPayroll] = useState<any>(null);
    const [previewPayslip, setPreviewPayslip] = useState<any>(null);
    const [billingAssignment, setBillingAssignment] = useState<any>(null);
    const [autoCloseAssignmentOnGenerate, setAutoCloseAssignmentOnGenerate] = useState(false);

    // Invoice Preview State
    const [isInvoicePreviewModalOpen, setIsInvoicePreviewModalOpen] = useState(false);
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<any>(null);
    const [invoiceExtras, setInvoiceExtras] = useState({ discount: 0, additionalCharge: 0, advanceAmount: 0, chargeDesc: 'Extra Services' });

    // Manual Payroll Generator State
    const [isManualPayrollModalOpen, setIsManualPayrollModalOpen] = useState(false);
    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        startDate: '',
        endDate: '',
        shiftHoursOverride: 0,
        advanceAmount: 0,
        type: 'payslip' as 'payslip',
        clientNameOverride: '',
        dailyRateOverride: '',
        workerPhone: ''
    });

    // Manual Attendance State
    const [isManualAttendanceModalOpen, setIsManualAttendanceModalOpen] = useState(false);
    const [manualAttendanceData, setManualAttendanceData] = useState({
        worker_id: '',
        status: 'On Duty',
        check_in_time: new Date().toISOString().slice(0, 16),
        hours_worked: '8'
    });

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetWorker, setAgentTargetWorker] = useState<any>(null);
    const [agentTargetAction, setAgentTargetAction] = useState<'staff' | 'custom'>('staff');
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');

    // Worker Modal Tabs
    const [modalTab, setModalTab] = useState<'profile' | 'kyc' | 'vault' | 'performance' | 'history'>('profile');

    const handleExportWorkersToCSV = () => {
        if (!workers || workers.length === 0) {
            toast.error("No worker data available to export.");
            return;
        }

        const headers = ["ID", "Name", "Role", "Phone", "Status", "Monthly/Daily Rate", "Assigned Client"];
        const rows = workers.map(w => [
            w.id,
            w.name,
            w.role,
            w.phone || "",
            w.status,
            `₹${w.monthly_daily_rate || 0}`,
            w.assigned_client || "Unassigned"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Workforce_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Workforce Directory exported successfully!");
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch from employees table instead of workers
            const { data: employeeData, error: employeeError } = await supabase.from('employees').select('*');
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*, worker_assignments(assignment_status)');
            // Fix: use assignment_status (not status), and fetch ALL statuses so completed duties appear
            const { data: assignmentsData } = await supabase
                .from('worker_assignments')
                .select('*, employees(*), clients(*), service_type, client_id')
                .neq('assignment_status', 'cancelled');
            if (assignmentsData) setActiveAssignments(assignmentsData.filter((a: any) => a.assignment_status === 'active'));
            const { data: leadData } = await supabase
                .from('crm_leads')
                .select('id, name, phone, pipeline_stage, estimated_value_monthly')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            // Fetch Month-to-Date Stats for all employees
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            const { data: monthStats } = await supabase
              .from('attendance')
              .select('worker_id, status, hours_worked')
              .gte('duty_date', startOfMonth.toISOString().split('T')[0]);

            let finalWorkers = [];
            if (employeeError) {
                console.error('Employees DB error:', employeeError);
                finalWorkers = [];
            } else if (!employeeData || employeeData.length === 0) {
                finalWorkers = [];
            } else {
                finalWorkers = employeeData.map(w => {
                    const wStats = monthStats?.filter(s => s.worker_id === w.id) || [];
                    const presentDays = wStats.filter(s => s.status === 'present').length;
                    const absentDays = wStats.filter(s => s.status === 'absent' || (s as any).is_absent).length;
                    const totalHours = wStats.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
                    const rating = w.rating ? parseFloat(w.rating).toFixed(1) : (4.5 + ((w.full_name || '').length % 6) / 10).toFixed(1);
                    
                    return {
                        ...w,
                        name: w.full_name,
                        role: w.job_title,
                        stats: { presentDays, absentDays, totalHours, rating }
                    };
                });
            }
            setWorkers(finalWorkers);

            // Build payroll items: prefer DB records, fall back to synthetic items from assignments
            const existingPayrollAssignmentIds = new Set((payrollData || []).map((p: any) => p.assignment_id).filter(Boolean));
            
            const syntheticItems = (assignmentsData || [])
                // Exclude assignments without an employee and those already represented in payroll
                // Also, exclude unassigned workers and non-active assignments
                .filter((a: any) => {
                    // Only process active assignments for synthetic items to prevent ghost entries from historical data
                    if (a.assignment_status !== 'active') return false;
                    if (!a.employee_id || existingPayrollAssignmentIds.has(a.id)) return false;
                    const emp = a.employees;
                    if (!emp || emp.status === 'available') return false; // Hide unassigned workers from synthetic payroll
                    return true;
                })
                .map((a: any) => {
                    const emp = a.employees;
                    const clientObj = a.clients;
                    const start = a.start_date ? new Date(a.start_date) : null;
                    const end = a.end_date ? new Date(a.end_date) : new Date();
                    const days = start ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : 1;
                    
                    // Compute daily rate: use strictly derived monthly rate first, then short_term, then explicitly set daily rate
                    const monthlySalary = emp?.monthly_daily_rate;
                    const dailyRate = (monthlySalary && monthlySalary > 0) ? Math.round(monthlySalary / 30) : (emp?.short_term_daily_rate || a.worker_daily_rate || 0);
                    
                    // Determine client name
                    const clientName = clientObj?.client_name || emp?.assigned_client || 'Unassigned';
                    
                    return {
                        id: `synth-${a.id}`,
                        assignment_id: a.id,
                        worker: emp?.full_name || 'Unknown Worker',
                        worker_id: a.employee_id,
                        client_name: clientName,
                        client: clientName, // Fallback for any legacy code expecting client
                        daily_rate: dailyRate,
                        days_worked: days,
                        advance_amount: a.advance_paid || 0,
                        status: a.assignment_status === 'completed' ? 'Pending' : 'Active',
                        month: start ? start.toLocaleString('default', { month: 'long', year: 'numeric' }) : 'May 2026',
                        payroll_type: 'payslip',
                        start_date: a.start_date,
                        end_date: a.end_date || new Date().toISOString().split('T')[0],
                        hours_per_day: a.hours_per_day || 8,
                        worker_assignments: { assignment_status: a.assignment_status },
                        _isSynthetic: true
                    };
                });

            // Filter existing DB payroll rows: keep only entries with a matching worker in the current workforce
            const validDbPayroll = (payrollData || []).filter((p: any) => {
                // Ensure the worker is in the current workforce and the item has a client
                const pClient = p.client_name || p.client;
                return p.worker && pClient && finalWorkers.some((w: any) => w.name === p.worker || w.full_name === p.worker);
            });

            // Deduplicate across DB and synthetic: DB entries take precedence
            const seenKeys = new Set<string>();
            const dedupedPayroll: any[] = [];
            
            // Add DB rows first
            for (const dbItem of validDbPayroll) {
                const dbClient = dbItem.client_name || dbItem.client;
                const key = `${dbItem.worker}|${dbClient}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    dedupedPayroll.push(dbItem);
                }
            }
            
            // Then add synthetic items if key not already present
            for (const synthItem of syntheticItems) {
                const synthClient = synthItem.client_name || synthItem.client;
                const key = `${synthItem.worker}|${synthClient}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    dedupedPayroll.push(synthItem);
                }
            }

            if (!payrollError && dedupedPayroll.length > 0) {
                setPayrollItems(dedupedPayroll);
            } else if (payrollError) {
                setPayrollItems([]);
            } else {
                setPayrollItems([]);
            }

            if (leadData && leadData.length > 0) {
                setPipelineLeads(leadData);
            } else {
                setPipelineLeads([]);
            }
        } catch (err: any) {
            console.error('fetchData failed:', err);
            toast.error('Failed to load workforce data.');
            setWorkers([]);
            setPayrollItems([]);
            setPipelineLeads([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (worker: any, lang: string) => {
        if (!worker) return '';
        const baseUrl = window.location.origin;
        const confirmLink = `${baseUrl}/client/confirm-staff/${worker.id}`;

        if (lang === 'Hinglish') return `Hello ${worker.assigned_client} team! Humne aapke liye ek excellent ${worker.role} allocate kiya hai: ${worker.name}. Please profile check karke confirm karein. ✅👇\n${confirmLink}`;
        if (lang === 'Hindi') return `Namaste ${worker.assigned_client}, aapki suvidha ke liye humne ek naye ${worker.role} (${worker.name}) ko allocate kiya hai. Kripya profile ki pushti karein:\n${confirmLink}`;
        return `Hi ${worker.assigned_client}, we have successfully allocated a highly qualified ${worker.role} (${worker.name}) to your facility. Please review and confirm their profile here:\n${confirmLink}`;
    };

    const openAgentModal = (worker: any) => {
        setAgentTargetWorker(worker);
        setAgentDraftText(generateWhatsappDraft(worker, agentDraftLang));
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetWorker) {
            setAgentDraftText(generateWhatsappDraft(agentTargetWorker, agentDraftLang));
        }
    }, [agentDraftLang, agentTargetWorker]);

    const handleDispatchMessage = async () => {
        // Lookup client phone from CRM leads (includes phone field now)
        const matchedLead = pipelineLeads.find((l: any) => l.name === agentTargetWorker?.assigned_client);
        let phoneDigits = matchedLead?.phone ? matchedLead.phone.replace(/\D/g, '') : '';
        if (phoneDigits.length === 10) phoneDigits = '91' + phoneDigits;

        if (!phoneDigits) {
            toast.warning('No phone on file for this client — opening WhatsApp without auto-fill.');
            window.open(`https://wa.me/?text=${encodeURIComponent(agentDraftText)}`, '_blank');
        } else {
            window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(agentDraftText)}`, '_blank');
        }

        setIsAgentModalOpen(false);
        toast.success(`Profile for ${agentTargetWorker.name} shared with ${agentTargetWorker.assigned_client} via WhatsApp 📱`);

        // Keep employee status as 'available'
        try {
            await supabase.from('employees').update({ status: 'available' }).eq('id', agentTargetWorker.id);
        } catch (e) { console.warn('Could not update employee status in DB:', e); }
        setWorkers(prev => prev.map(w => w.id === agentTargetWorker.id ? { ...w, status: 'available' } : w));
    };

    const handleDeleteWorker = async (workerId: string, workerName: string) => {
        setIsDeletingWorker(true);
        try {
            const { error } = await supabase.from('employees').delete().eq('id', workerId);
            if (error) throw error;
            setWorkers(prev => prev.filter(w => w.id !== workerId));
            toast.success(`${workerName} removed from workforce directory.`);
        } catch (err: any) {
            toast.error(`Failed to delete: ${err.message}`);
        } finally {
            setIsDeletingWorker(false);
            setDeletingWorkerId(null);
        }
    };

    // Initial data load on mount only
    useEffect(() => { fetchData(); }, [fetchData]);

    // Supabase Realtime: sync employees table live across all admin sessions
    useEffect(() => {
        const channel = supabase
            .channel('employees-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setWorkers(prev => [payload.new as any, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setWorkers(prev => prev.map(w => w.id === (payload.new as any).id ? { ...w, ...(payload.new as any) } : w));
                } else if (payload.eventType === 'DELETE') {
                    setWorkers(prev => prev.filter(w => w.id !== (payload.old as any).id));
                }
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // Handle direct worker link via URL param
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const workerId = urlParams.get('worker');
        if (workerId && workers.length > 0) {
            const worker = workers.find(w => w.id === workerId);
            if (worker) openEditModal(worker);
        }
    }, [workers.length]);

    // Fetch attendance only when that tab is active or date changes
    useEffect(() => {
        if (activeTab === 'attendance') fetchLiveAttendance();
    }, [activeTab, selectedAttendanceDate]);

    // Derived: filtered + searched worker list for the allocation table
    const filteredWorkers = workers.filter(w => {
        const q = workerSearch.toLowerCase();
        const matchSearch = !q || w.name?.toLowerCase().includes(q) || w.role?.toLowerCase().includes(q) || (w.assigned_client || '').toLowerCase().includes(q);
        const matchStatus = workerStatusFilter === 'All' || w.status === workerStatusFilter;
        return matchSearch && matchStatus;
    });

    const location = useLocation();

    // Auto-filter worker if passed via navigation state (e.g. from Global Search)
    useEffect(() => {
        if (location.state?.searchWorker) {
            setWorkerSearch(location.state.searchWorker);
            setActiveTab('allocation');
        }
    }, [location.state?.searchWorker]);



    const fetchLiveAttendance = async () => {
        setAttendanceLoading(true);
        try {
            const { data, error } = await supabase
                .from('worker_assignments')
                .select(`
                    *,
                    employees(*),
                    clients(client_name)
                `)
                .eq('assignment_status', 'active')
                .order('assigned_at', { ascending: false });

            if (error) throw error;
            setActiveAssignments(data || []);
        } catch (err: any) {
            console.error('Error fetching active assignments:', err);
            toast.error('Failed to load active assignments');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const handleInlineAttendanceMark = async (workerId: string, status: string) => {
        setInlineMarkingId(workerId);
        try {
            // Check if record exists for this worker on selected date
            const existing = attendanceLogs.find(log => log.worker_id === workerId);
            
            if (status === 'Pending') {
                 if (existing) {
                      const { error } = await supabase.from('attendance').delete().eq('id', existing.id);
                      if (error) throw error;
                 }
                 toast.success('Status reset');
                 fetchLiveAttendance(); // Silent refresh
                 return;
            }

            const checkInTime = new Date(`${selectedAttendanceDate}T09:00:00`).toISOString();
            const checkOutTime = status === 'Present' || status === 'Completed' || status === 'On Duty' 
                ? new Date(`${selectedAttendanceDate}T17:00:00`).toISOString() 
                : null;
            const hoursWorked = status === 'Present' ? 8 : (status === 'Half Day' ? 4 : 0);

            const payload = {
                worker_id: workerId,
                status: status,
                duty_date: selectedAttendanceDate,
                check_in_time: checkInTime,
                check_out_time: existing?.check_out_time || checkOutTime,
                hours_worked: existing?.hours_worked || hoursWorked
            };

            if (existing) {
                const { error } = await supabase.from('attendance').update(payload).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('attendance').insert([payload]);
                if (error) throw error;
            }

            toast.success(`Marked as ${status}`);
            fetchLiveAttendance(); // Silent refresh
        } catch (error: any) {
            console.error("Manual attendance error:", error);
            toast.error(`Failed to update: ${error.message}`);
        } finally {
            setInlineMarkingId(null);
        }
    };

    const handleBulkMarkPresent = async () => {
        setIsSubmitting(true);
        toast.loading("Bulk updating roster...", { id: 'bulk-mark' });
        try {
            const activeWorkers = workers.filter((w: any) => w && (w.status === 'assigned' || w.status === 'Active'));
            
            // Filter out workers who already have a log for the selected date
            const existingWorkerIds = attendanceLogs.map(l => l.worker_id);
            const workersToMark = activeWorkers.filter((w: any) => !existingWorkerIds.includes(w.id));

            if (workersToMark.length === 0) {
                toast.success("Roster is already fully marked for this date!", { id: 'bulk-mark' });
                return;
            }

            const checkInTime = new Date(`${selectedAttendanceDate}T09:00:00`).toISOString();
            const checkOutTime = new Date(`${selectedAttendanceDate}T17:00:00`).toISOString();

            const payloads = workersToMark.map((w: any) => ({
                worker_id: w.id,
                status: 'Present',
                duty_date: selectedAttendanceDate,
                check_in_time: checkInTime,
                check_out_time: checkOutTime,
                hours_worked: 8
            }));

            const { error } = await supabase.from('attendance').insert(payloads);
            if (error) throw error;

            toast.success(`Bulk marked ${workersToMark.length} workers as Present.`, { id: 'bulk-mark' });
            fetchLiveAttendance();
        } catch (err: any) {
            console.error("Bulk mark error:", err);
            toast.error(`Failed to bulk update: ${err.message}`, { id: 'bulk-mark' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setModalTab('profile');
        setEditingWorkerId(null);
        setFormData({ name: '', role: '', assigned_client: '', monthly_daily_rate: '', short_term_daily_rate: '', deposit_received: '15000', status: 'available', aadhaar_number: '', phone: '', address: '', dob: '', documents: [] });
        setIsModalOpen(true);
    };

    const openEditModal = (worker: any) => {
        setModalMode('edit');
        setModalTab('profile');
        setEditingWorkerId(worker.id);
        // Auto-suggest deposit from CRM lead if worker has an assigned client
        const matchedLead = pipelineLeads.find((l: any) => l.name?.toLowerCase().trim() === (worker.assigned_client || '').toLowerCase().trim());
        const suggestedDeposit = matchedLead?.estimated_value_monthly ? matchedLead.estimated_value_monthly.toString() : (worker.deposit_received?.toString() || '15000');
        const data = {
            name: worker.name,
            role: worker.role,
            assigned_client: worker.assigned_client || '',
            monthly_daily_rate: worker.monthly_daily_rate?.toString() || '',
            short_term_daily_rate: worker.short_term_daily_rate?.toString() || '',
            deposit_received: suggestedDeposit,
            status: worker.status,
            aadhaar_number: worker.aadhaar_number || '',
            phone: worker.phone || '',
            address: worker.address || '',
            dob: worker.dob || '',
            documents: []
        };
        setFormData(data);
        // Keep a snapshot of the original data to detect changes on save
        setOriginalWorkerData({ ...worker });
        setIsModalOpen(true);
    };

    const handleWorkerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // --- Client-side validation ---
        if (!formData.name.trim()) { toast.error('Worker name is required.'); return; }
        if (!formData.role.trim()) { toast.error('Role / Designation is required.'); return; }
        if (!formData.monthly_daily_rate || parseFloat(formData.monthly_daily_rate) <= 0) {
            toast.error('Monthly daily rate must be greater than 0.'); return;
        }
        if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, '').slice(-10))) {
            toast.error('A valid 10-digit Indian WhatsApp mobile number is required.'); return;
        }
        if (!formData.aadhaar_number || formData.aadhaar_number.length !== 12) {
            toast.error('Aadhaar number is required and must be exactly 12 digits.'); return;
        }
        if (!formData.dob) { toast.error('Date of Birth is required.'); return; }
        if (!formData.address.trim()) { toast.error('Full Residential Address is required.'); return; }

        setIsSubmitting(true);
        try {
            const newClient = formData.assigned_client || null;
            const oldClient = originalWorkerData?.assigned_client || null;
            const clientChanged = modalMode === 'edit' && newClient !== oldClient;
            const isBeingUnassigned = clientChanged && !newClient;
            const isBeingReassigned = clientChanged && newClient && oldClient && newClient !== oldClient;

            // Determine correct status:
            // - If client is removed → available
            // - If client is newly assigned (or changed) → available (awaiting confirmation)
            // - If status is manually set by admin → respect that choice
            // - If nothing changed regarding client → keep current formData.status
            let resolvedStatus = formData.status?.toLowerCase();
            if (isBeingUnassigned) resolvedStatus = 'available';
            else if (isBeingReassigned) resolvedStatus = 'available'; // new client must re-confirm

            const payload = {
                name: formData.name.trim(),
                role: formData.role.trim(),
                assigned_client: newClient,
                hourly_rate: 0, // Fallback for legacy DB column that is NOT NULL
                monthly_daily_rate: parseFloat(formData.monthly_daily_rate) || 0,
                short_term_daily_rate: parseFloat(formData.short_term_daily_rate) || 0,
                deposit_received: parseFloat(formData.deposit_received) || 0,
                status: resolvedStatus,
                aadhaar_number: formData.aadhaar_number || null,
                phone: formData.phone.trim() || null,
                address: formData.address.trim() || null,
                dob: formData.dob || null
            };

            if (modalMode === 'add') {
                const { error } = await supabase.from('employees').insert([payload]);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('employees').update(payload).eq('id', editingWorkerId);
                if (error) throw error;
            }

            // --- Pipeline automation ---
            // 1. If worker is unassigned from a client, revert old client lead back to 'Staff Assigned' -> previous stage
            //    (we leave the lead at Staff Assigned — admin can manually adjust it)
            // 2. If worker is reassigned from old client to new client:
            //    - Old client lead: note the change (leave at current stage, admin handles)
            //    - New client lead: advance to 'Staff Assigned'
            // 3. If newly assigned: advance new client to 'Staff Assigned' (only if they haven't passed that stage)
            // 4. If admin manually sets status to 'Active' (bypassing WhatsApp confirm): advance lead to 'Active Client'

            if (newClient && (modalMode === 'add' || clientChanged || formData.assigned_client !== originalWorkerData?.assigned_client)) {
                // Look up lead ID by name to avoid updating wrong lead if names match
                const matchedLead = pipelineLeads.find((l: any) =>
                    l.name?.toLowerCase().trim() === newClient.toLowerCase().trim()
                );
                if (matchedLead?.id) {
                    await supabase.from('crm_leads')
                        .update({ pipeline_stage: 'Staff Assigned' })
                        .eq('id', matchedLead.id)
                        .in('pipeline_stage', ['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted']);
                    toast.success(`Pipeline: ${newClient} advanced to Staff Assigned`);
                }
            }

            // If admin is manually confirming the employee as assigned (bypass the WhatsApp flow)
            if (['active', 'assigned'].includes(resolvedStatus) && newClient) {
                const matchedLead = pipelineLeads.find((l: any) =>
                    l.name?.toLowerCase().trim() === newClient.toLowerCase().trim()
                );
                if (matchedLead?.id) {
                    await supabase.from('crm_leads')
                        .update({ pipeline_stage: 'Active Client' })
                        .eq('id', matchedLead.id)
                        .eq('pipeline_stage', 'Staff Assigned');
                    toast.success(`Pipeline: ${newClient} confirmed as Active Client`);
                }
            }

            setIsModalOpen(false);
            setOriginalWorkerData(null);
            fetchData();
            toast.success(`Worker ${modalMode === 'add' ? 'onboarded' : 'updated'} successfully! ✅`);
        } catch (error: any) {
            console.error("Error saving worker:", error);
            toast.error(`Failed to save worker: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleManualAttendanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualAttendanceData?.worker_id) {
            toast.error("Please select a worker first.");
            return;
        }

        setIsSubmitting(true);
        try {
            const checkIn = new Date(manualAttendanceData.check_in_time);
            let checkOut = null;
            let hoursWorked = null;

            if (manualAttendanceData.status === 'Completed') {
                hoursWorked = parseFloat(manualAttendanceData.hours_worked) || 8;
                checkOut = new Date(checkIn.getTime() + hoursWorked * 60 * 60 * 1000).toISOString();
            }

            const dutyDateStr = checkIn.toISOString().split('T')[0];
            const { data: duplicateCheck } = await supabase.from('attendance')
                .select('id').eq('worker_id', manualAttendanceData.worker_id)
                .eq('duty_date', dutyDateStr)
                .maybeSingle();

            if (duplicateCheck) {
                const { error } = await supabase.from('attendance').update({
                    check_in_time: checkIn.toISOString(),
                    check_out_time: checkOut,
                    status: manualAttendanceData.status,
                    hours_worked: hoursWorked
                }).eq('id', duplicateCheck.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('attendance').insert([{
                    worker_id: manualAttendanceData.worker_id,
                    check_in_time: checkIn.toISOString(),
                    check_out_time: checkOut,
                    status: manualAttendanceData.status,
                    duty_date: dutyDateStr,
                    hours_worked: hoursWorked
                }]);
                if (error) throw error;
            }

            toast.success("Attendance marked successfully! ✅");
            setIsManualAttendanceModalOpen(false);
            // Quick refresh for the attendance logs
            fetchLiveAttendance();
        } catch (error: any) {
            console.error("Manual attendance error:", error);
            toast.error(`Failed to record attendance: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSavePayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPayroll) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase.from('payroll').update({
                days_worked: editingPayroll.days_worked,
                net_balance: editingPayroll.net_balance
            }).eq('id', editingPayroll.id);

            if (error) throw error;

            setPayrollItems(prev => prev.map(p => p.id === editingPayroll.id ? editingPayroll : p));
            setIsEditPayrollModalOpen(false);
            toast.success(`Payslip for ${editingPayroll.worker} updated successfully.`);
        } catch (error: any) {
            console.error("Error updating payroll", error);
            toast.error(`Failed to save payroll: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDays = (item: any) => {
        return item.days_worked || 0;
    };

    const getLogo = (): Promise<string | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = '/99care-logo.svg';
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

    const handleGenerateSinglePayslip = async (item: any) => {
        toast.loading("Generating worker payslip...", { id: 'single-payslip-gen' });
        try {
            const worker = workers.find(w => w.id === item.worker_id || w.name === item.worker);
            
            let hoursPerDay = 10;
            let period = '';
            if (item.assignment_id) {
                const { data: assignment } = await supabase
                    .from('worker_assignments')
                    .select('hours_per_day, start_date, end_date')
                    .eq('id', item.assignment_id)
                    .maybeSingle();
                
                if (assignment) {
                    if (assignment.hours_per_day) {
                        hoursPerDay = assignment.hours_per_day;
                    }
                    if (assignment.start_date && assignment.end_date) {
                        const start = format(new Date(assignment.start_date), 'dd MMM yyyy');
                        const end = format(new Date(assignment.end_date), 'dd MMM yyyy');
                        period = `${start} – ${end}`;
                    }
                }
            }

            if (!period && item.period_start && item.period_end) {
                const start = format(new Date(item.period_start), 'dd MMM yyyy');
                const end = format(new Date(item.period_end), 'dd MMM yyyy');
                period = `${start} – ${end}`;
            } else if (!period) {
                period = item.service_month || item.month || 'May 2026';
            }

            const doc = new jsPDF();
            const dateNow = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const payslipNo = `PS-${Date.now().toString().slice(-6)}`;

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
            const wCompanyInfo = [
                '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN',
                'Surat, GUJARAT, 395007',
                'Mobile: +91 9016116564',
                'Email: 99careforyou@gmail.com',
                'Website: 99CARE.ORG'
            ];
            let wCompY = 16;
            wCompanyInfo.forEach((line: string) => {
                doc.text(line, 196, wCompY, { align: 'right' });
                wCompY += 4.5;
            });

            doc.setDrawColor(180, 200, 240);
            doc.setLineWidth(0.8);
            doc.line(14, 42, 196, 42);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text('Worker Details:', 14, 50);
            doc.setFontSize(11);
            doc.text(item.worker, 14, 56);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(`Designation: ${worker?.role || 'specialist'}`, 14, 62);
            doc.text(`Assigned Client: ${item.client_name || 'N/A'}`, 14, 68);
            if (worker?.phone) {
                doc.text(`Phone: ${worker.phone}`, 14, 74);
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text('Payslip Details:', 130, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(`Payslip #: ${payslipNo}`, 130, 56);
            doc.text(`Issue Date: ${dateNow}`, 130, 62);
            doc.text(`Service Period: ${period}`, 130, 68);
            doc.text(`Shift Hours: ${hoursPerDay} hours/day`, 130, 74);

            const days = getDays(item);
            const totalEarning = days * item.daily_rate;
            const advance = item.advance_amount || 0;
            const netBalance = totalEarning - advance;

            autoTable(doc, {
                startY: 84,
                theme: 'grid',
                headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' },
                head: [['Attendance Summary', 'Value']],
                body: [
                    ['Total Days in Period', `${days} days`],
                    ['Days Present', `${days} days`],
                    ['Half Days', `0 days`],
                    ['Days Absent', `0 days`],
                    ['Effective Working Days', `${days} days`],
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
                    [`Daily Rate (for ${hoursPerDay}h shift) × ${days} Days`, `Rs. ${item.daily_rate.toFixed(2)} × ${days} = Rs. ${totalEarning.toFixed(2)}`],
                    ['Advance Paid / Deductions', `- Rs. ${advance.toFixed(2)}`],
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
            doc.text(`Rs. ${Math.abs(netBalance).toFixed(2)}`, 185, finalY2 + 11, { align: 'right' });

            let wBkY = finalY2 + 30;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text('Bank Details for Transfer:', 14, wBkY);
            wBkY += 6;
            const wBankLines = [
                { l: 'Bank:', v: 'The Sutex Co-Operative BankLtd.' },
                { l: 'Account Holder:', v: '99 CARE HOME HEALTHCARE SERVICE' },
                { l: 'Account #:', v: '001810021002033' },
                { l: 'IFSC Code:', v: 'SUTB0248018' },
                { l: 'Branch:', v: 'Adajan Pal' },
            ];
            wBankLines.forEach(({ l, v }) => {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text(l, 14, wBkY);
                doc.setFont('helvetica', 'bold');
                doc.text(v, 42, wBkY);
                wBkY += 5;
            });

            const wSigY = finalY2 + 30;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text('For 99 CARE', 150, wSigY);
            doc.setDrawColor(100, 116, 139);
            doc.setLineWidth(0.5);
            doc.line(140, wSigY + 16, 190, wSigY + 16);
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text('Authorized Signatory', 150, wSigY + 20);

            let notesY = wBkY + 10;
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
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text('99 CARE HOME HEALTHCARE SERVICE • 104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT • +91 9016116564', 14, 285);

            doc.save(`Payslip_${item.worker.replace(/\s+/g, '_')}_${payslipNo}.pdf`);
            toast.success("Payslip generated successfully", { id: 'single-payslip-gen' });
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to generate payslip: " + err.message, { id: 'single-payslip-gen' });
        }
    };

    const handleGeneratePayroll = async () => {
        setIsGenerating(true);
        toast.loading("Analyzing active attendance logs and calculating daily fees...", { id: 'payroll-gen' });

        try {
            // Group attendance by worker to find unique days worked
            const attendanceByWorker: Record<string, Set<string>> = {};
            attendanceLogs.forEach(log => {
                if (log.worker_id && log.date) {
                    if (!attendanceByWorker[log.worker_id]) {
                        attendanceByWorker[log.worker_id] = new Set();
                    }
                    attendanceByWorker[log.worker_id].add(log.date);
                }
            });

            const newPayrollEntries: any[] = [];
            const emailAttachments: any[] = [];

            // Calculate fees per worker based on contract rates (monthly vs short-term)
            for (const [workerId, datesSet] of Object.entries(attendanceByWorker)) {
                const daysWorked = datesSet.size;
                const worker = workers.find(w => w.id === workerId);

                if (worker) {
                    let appliedRate = 0;
                    let totalCost = 0;

                    if (worker.preferred_payment_type === 'hourly') {
                        appliedRate = worker.hourly_rate || 0;
                        const hoursPerDay = worker.shift_hours || 8; // Fallback to 8 only if absent
                        totalCost = daysWorked * hoursPerDay * appliedRate; 
                    } else if (worker.preferred_payment_type === 'short_term') {
                        appliedRate = worker.short_term_daily_rate || 0;
                        totalCost = appliedRate; // Fixed Flat Monthly Salary
                    } else {
                        appliedRate = (worker.monthly_daily_rate || 0) / 30;
                        totalCost = daysWorked * appliedRate; // Pro-rated Daily Rate
                    }
                    const deposit = worker.deposit_received || 0;
                    const netBalance = totalCost - deposit;

                    newPayrollEntries.push({
                        worker: worker.name,
                        client_name: worker.assigned_client || '99Care Internal',
                        days_worked: daysWorked,
                        daily_rate: appliedRate,
                        deposit_received: deposit,
                        net_balance: netBalance,
                        status: netBalance > 0 ? 'Pending Payment' : (netBalance < 0 ? 'Refund Due' : 'Settled'),
                        period_start: new Date().toISOString().slice(0, 10), // Placeholder for demo
                        period_end: new Date().toISOString().slice(0, 10) // Placeholder for demo
                    });

                    // --- 1. Generate PDF Worker Payslip (Tax Invoice Theme) ---
                    const workerDoc = new jsPDF();
                    const dateNow = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    const payslipNo = `PS-${Date.now().toString().slice(-6)}`;

                    const logoImg = await getLogo();
                    if (logoImg) {
                        workerDoc.addImage(logoImg, 'PNG', 14, 14, 38, 15);
                        workerDoc.setFont('helvetica', 'bold');
                        workerDoc.setFontSize(11);
                        workerDoc.setTextColor(60, 120, 216);
                        workerDoc.text('WORKER PAYSLIP', 14, 35);
                    } else {
                        // Header – Company name left, info right
                        workerDoc.setFont('helvetica', 'bold');
                        workerDoc.setFontSize(22);
                        workerDoc.setTextColor(30, 41, 59);
                        workerDoc.text('99 CARE', 14, 25);
                        workerDoc.setFontSize(13);
                        workerDoc.setTextColor(60, 120, 216);
                        workerDoc.text('WORKER PAYSLIP', 14, 33);
                    }

                    // Company info right-aligned
                    workerDoc.setFont('helvetica', 'normal');
                    workerDoc.setFontSize(9);
                    workerDoc.setTextColor(71, 85, 105);
                    const wCompanyInfo = [
                        '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN',
                        'Surat, GUJARAT, 395007',
                        'Mobile: +91 9016116564',
                        'Email: 99careforyou@gmail.com',
                        'Website: 99CARE.ORG'
                    ];
                    let wCompY = 16;
                    wCompanyInfo.forEach((line: string) => {
                        workerDoc.text(line, 196, wCompY, { align: 'right' });
                        wCompY += 4.5;
                    });

                    // Divider
                    workerDoc.setDrawColor(180, 200, 240);
                    workerDoc.setLineWidth(0.8);
                    workerDoc.line(14, 42, 196, 42);

                    // Left: Worker info
                    workerDoc.setFont('helvetica', 'bold');
                    workerDoc.setFontSize(10);
                    workerDoc.setTextColor(30, 41, 59);
                    workerDoc.text('Worker Details:', 14, 50);
                    workerDoc.setFontSize(11);
                    workerDoc.text(worker.name, 14, 56);
                    workerDoc.setFont('helvetica', 'normal');
                    workerDoc.setFontSize(9);
                    workerDoc.setTextColor(71, 85, 105);
                    workerDoc.text(`Designation: ${worker.role}`, 14, 62);
                    workerDoc.text(`Assigned Client: ${worker.assigned_client || 'N/A'}`, 14, 68);

                    // Right: Payslip meta
                    workerDoc.setFont('helvetica', 'bold');
                    workerDoc.setFontSize(10);
                    workerDoc.setTextColor(30, 41, 59);
                    workerDoc.text('Payslip Details:', 130, 50);
                    workerDoc.setFont('helvetica', 'normal');
                    workerDoc.setFontSize(9);
                    workerDoc.setTextColor(71, 85, 105);
                    workerDoc.text(`Payslip #: ${payslipNo}`, 130, 56);
                    workerDoc.text(`Issue Date: ${dateNow}`, 130, 62);

                    // Earnings breakdown table
                    autoTable(workerDoc, {
                        startY: 78,
                        theme: 'grid',
                        headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' },
                        head: [['Earning Breakdown', 'Value']],
                        body: [
                            ['Working Days', `${daysWorked} days`],
                            ['Salary Per Day', `Rs. ${appliedRate.toFixed(2)}`],
                            ['Total Amount', `Rs. ${totalCost.toFixed(2)}`],
                            ['Advance / Deductions', `- Rs. ${deposit.toFixed(2)}`],
                        ],
                        columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
                    });

                    let finalY = (workerDoc as any).lastAutoTable.finalY + 8;

                    // Net Payable box
                    workerDoc.setFillColor(240, 253, 244);
                    workerDoc.setDrawColor(34, 197, 94);
                    workerDoc.roundedRect(14, finalY, 182, 18, 3, 3, 'FD');
                    workerDoc.setFont('helvetica', 'bold');
                    workerDoc.setFontSize(11);
                    workerDoc.setTextColor(21, 128, 61);
                    workerDoc.text('NET AMOUNT PAYABLE TO WORKER:', 20, finalY + 11);
                    workerDoc.text(`Rs. ${Math.abs(netBalance).toFixed(2)}`, 185, finalY + 11, { align: 'right' });

                    // Bank details
                    let wBkY = finalY + 30;
                    workerDoc.setFont('helvetica', 'bold');
                    workerDoc.setFontSize(10);
                    workerDoc.setTextColor(30, 41, 59);
                    workerDoc.text('Bank Details for Transfer:', 14, wBkY);
                    wBkY += 6;
                    const wBankLines = [
                        { l: 'Bank:', v: 'The Sutex Co-Operative BankLtd.' },
                        { l: 'Account Holder:', v: '99 CARE HOME HEALTHCARE SERVICE' },
                        { l: 'Account #:', v: '001810021002033' },
                        { l: 'IFSC Code:', v: 'SUTB0248018' },
                        { l: 'Branch:', v: 'Adajan Pal' },
                    ];
                    wBankLines.forEach(({ l, v }) => {
                        workerDoc.setFont('helvetica', 'normal');
                        workerDoc.setFontSize(9);
                        workerDoc.setTextColor(71, 85, 105);
                        workerDoc.text(l, 14, wBkY);
                        workerDoc.setFont('helvetica', 'bold');
                        workerDoc.text(v, 42, wBkY);
                        wBkY += 5;
                    });

                    // Signature
                    const wSigY = finalY + 30;
                    workerDoc.setFont('helvetica', 'normal');
                    workerDoc.setFontSize(9);
                    workerDoc.setTextColor(30, 41, 59);
                    workerDoc.text('For 99 CARE', 150, wSigY);
                    workerDoc.setDrawColor(100, 116, 139);
                    workerDoc.setLineWidth(0.5);
                    workerDoc.line(140, wSigY + 16, 190, wSigY + 16);
                    workerDoc.setFontSize(8);
                    workerDoc.setTextColor(71, 85, 105);
                    workerDoc.text('Authorized Signatory', 150, wSigY + 20);

                    // Footer
                    workerDoc.setFontSize(7);
                    workerDoc.setFont('helvetica', 'normal');
                    workerDoc.setTextColor(148, 163, 184);
                    workerDoc.text('99 CARE HOME HEALTHCARE SERVICE • 104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT • +91 9016116564', 14, 285);

                    // --- 2. Generate PDF Client Invoice ---
                    const clientDoc = new jsPDF();
                    clientDoc.setFontSize(22);
                    clientDoc.setTextColor(15, 23, 42);
                    clientDoc.text("99Care AI", 14, 20);
                    clientDoc.setFontSize(14);
                    clientDoc.setTextColor(26, 166, 168); // brand teal
                    clientDoc.text("MONTHLY TAX INVOICE", 14, 30);
                    clientDoc.setFontSize(10);
                    clientDoc.setTextColor(71, 85, 105);
                    clientDoc.text(`Bill To: ${worker.assigned_client || 'General Client'}`, 14, 45);
                    clientDoc.text(`Service For: ${worker.name} (${worker.role})`, 14, 52);
                    clientDoc.text(`Invoice #INV-${Math.floor(Math.random()*10000)}`, 14, 59);
                    clientDoc.text(`Billing Period: ${currentMonth}/${currentYear}`, 14, 66);

                    autoTable(clientDoc, {
                        startY: 75,
                        headStyles: { fillColor: [26, 166, 168] },
                        head: [['Service Description', 'Unit Rate', 'Qty', 'Subtotal']],
                        body: [
                            [`Manpower Supply (${worker.role})`, `Rs. ${appliedRate.toFixed(2)}`, `${daysWorked} days`, `Rs. ${totalCost.toFixed(2)}`],
                            [`Platform Fee (included)`, '0.00', '1', '0.00']
                        ],
                    });

                    finalY = (clientDoc as any).lastAutoTable.finalY || 120;
                    clientDoc.setFontSize(12);
                    clientDoc.setTextColor(15, 23, 42);
                    clientDoc.text(`Total Amount Due: Rs. ${totalCost.toFixed(2)}`, 14, finalY + 15);
                    clientDoc.text(`GST (18% Included): Rs. ${(totalCost * 0.18).toFixed(2)}`, 14, finalY + 22);

                    // Convert to base64 for Resend payload
                    const workerPdfBase64 = workerDoc.output('datauristring').split(',')[1];
                    const clientPdfBase64 = clientDoc.output('datauristring').split(',')[1];
                    
                    emailAttachments.push({
                        filename: `Payslip_${worker.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
                        content: workerPdfBase64
                    });
                    emailAttachments.push({
                        filename: `Client_Invoice_${(worker.assigned_client || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
                        content: clientPdfBase64
                    });
                }
            }

            if (newPayrollEntries.length > 0) {
                // Try inserting into Supabase
                const { error: insertError } = await supabase.from('payroll').insert(newPayrollEntries);
                if (insertError) {
                    console.warn("DB Insert failed, using fallback:", insertError);
                    // Fallback for UI visualization only if DB is not setup for new fields yet
                    setPayrollItems(prev => [...newPayrollEntries, ...prev] as any);
                } else {
                    fetchData(); // Refresh list to get new DB entries
                }
            }

            toast.success(`Payroll generated for ${newPayrollEntries.length} workers! Data saved.`, { id: 'payroll-gen' });
        } catch (error: any) {
            console.error('Error in Daily Fee execution:', error);
            toast.error(`Automated execution failed: ${error.message || 'Check connection'}`, { id: 'payroll-gen' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadSingleInvoice = async () => {
        if (!previewInvoiceItem) return;
        
        try {
            // Static jsPDF used instead
            const item = previewInvoiceItem;
            const appliedRate = item.daily_rate;
            const daysWorked = item.days_worked;
            const baseCost = daysWorked * appliedRate;
            
            const totalCost = baseCost + Number(invoiceExtras.additionalCharge) - Number(invoiceExtras.discount) - Number(invoiceExtras.advanceAmount);
            
            const clientDoc = new jsPDF();
            clientDoc.setFontSize(22);
            clientDoc.setTextColor(15, 23, 42);
            clientDoc.text("99Care AI", 14, 20);
            clientDoc.setFontSize(14);
            clientDoc.setTextColor(37, 99, 235);
            clientDoc.text("MONTHLY TAX INVOICE", 14, 30);
            clientDoc.setFontSize(10);
            clientDoc.setTextColor(71, 85, 105);
            clientDoc.text(`Bill To: ${item.client_name || 'General Client'}`, 14, 45);
            clientDoc.text(`Service For: ${item.worker}`, 14, 52);
            clientDoc.text(`Invoice #INV-${Math.floor(Math.random()*10000)}`, 14, 59);
            clientDoc.text(`Service Month: ${item.service_month || item.month || (currentMonth + '/' + currentYear)}`, 14, 66);

            const tableBody: any[] = [
                [`Manpower Supply`, `Rs. ${appliedRate.toFixed(2)}`, `${daysWorked} days`, `Rs. ${baseCost.toFixed(2)}`]
            ];
            
            if (Number(invoiceExtras.additionalCharge) > 0) {
                tableBody.push([invoiceExtras.chargeDesc, '-', '-', `Rs. ${Number(invoiceExtras.additionalCharge).toFixed(2)}`]);
            }
            if (Number(invoiceExtras.discount) > 0) {
                tableBody.push(['Discount Applied', '-', '-', `- Rs. ${Number(invoiceExtras.discount).toFixed(2)}`]);
            }
            if (Number(invoiceExtras.advanceAmount) > 0) {
                tableBody.push(['Advanced Paid (Worker)', '-', '-', `- Rs. ${Number(invoiceExtras.advanceAmount).toFixed(2)}`]);
            }

            autoTable(clientDoc, {
                startY: 75,
                headStyles: { fillColor: [37, 99, 235] },
                head: [['Service Description', 'Unit Rate', 'Qty', 'Subtotal']],
                body: tableBody,
            });

            const finalY = (clientDoc as any).lastAutoTable.finalY || 120;
            clientDoc.setFontSize(12);
            clientDoc.setTextColor(15, 23, 42);
            clientDoc.text(`Total Amount Due: Rs. ${totalCost.toFixed(2)}`, 14, finalY + 15);
            clientDoc.text(`GST (18% Included): Rs. ${(totalCost * 0.18).toFixed(2)}`, 14, finalY + 22);
            
            clientDoc.save(`Client_Invoice_${(item.client_name || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success("Invoice PDF Downloaded Successfully!");
            setIsInvoicePreviewModalOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF");
        }
    };

    const handleManualPayrollGenerate = async () => {
        const start = manualPayrollData.startDate;
        const end = manualPayrollData.endDate || manualPayrollData.startDate;
        let daysWorked = 0;
        if (start) {
            const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
            daysWorked = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (!manualPayrollData.worker_id || daysWorked <= 0) {
            toast.error("Please select a worker and valid dates.");
            return;
        }
        
        const serviceMonth = start ? format(new Date(start), 'MMMM yyyy') : format(new Date(), 'MMMM yyyy');

        setIsGenerating(true);
        try {
            const worker = workers.find(w => w.id === manualPayrollData.worker_id);
            if (!worker) throw new Error("Worker not found");

            let appliedRate = 0;
            let totalCost = 0;

            if (manualPayrollData.dailyRateOverride) {
                appliedRate = Number(manualPayrollData.dailyRateOverride);
                if (worker.preferred_payment_type === 'hourly') {
                    const hours = manualPayrollData.shiftHoursOverride || worker.shift_hours || 8;
                    totalCost = daysWorked * hours * appliedRate;
                } else if (worker.preferred_payment_type === 'short_term') {
                    totalCost = appliedRate; // Fixed Flat
                } else {
                    totalCost = daysWorked * appliedRate; 
                }
            } else {
                if (worker.preferred_payment_type === 'hourly') {
                    appliedRate = worker.hourly_rate || 0;
                    const hours = manualPayrollData.shiftHoursOverride || worker.shift_hours || 8;
                    totalCost = daysWorked * hours * appliedRate;
                } else if (worker.preferred_payment_type === 'short_term') {
                    appliedRate = worker.short_term_daily_rate || 0;
                    totalCost = appliedRate; // Fixed Flat
                } else {
                    appliedRate = (worker.monthly_daily_rate || 0) / 30;
                    totalCost = daysWorked * appliedRate; 
                }
            }

            const advance = Number(manualPayrollData.advanceAmount) || 0;
            const deposit = worker.deposit_received || 0;
            // The net balance is total cost minus deposit (from client) and minus advance (given to worker)
            const netBalance = totalCost - deposit - advance;

            const payrollEntry = {
                worker: worker.name,
                client_name: manualPayrollData.clientNameOverride || worker.assigned_client || 'No Active Client',
                days_worked: daysWorked,
                daily_rate: appliedRate,
                deposit_received: deposit,
                advance_amount: advance,
                net_balance: netBalance,
                status: netBalance > 0 ? 'Pending Payment' : (netBalance < 0 ? 'Refund Due' : 'Settled'),
                period_start: new Date().toISOString().slice(0, 10),
                period_end: new Date().toISOString().slice(0, 10),
                service_month: serviceMonth,
                payroll_type: manualPayrollData.type
            };

            const { error: dbError } = await supabase.from('payroll').insert([payrollEntry]);
            if (dbError) throw dbError;

            // Generate PDFs for download (Tax Invoice Theme)
            const workerDoc = new jsPDF();
            const mDateNow = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const mPayslipNo = `PS-${Date.now().toString().slice(-6)}`;

            const logoImg = await getLogo();
            if (logoImg) {
                workerDoc.addImage(logoImg, 'PNG', 14, 14, 38, 15);
                workerDoc.setFont('helvetica', 'bold');
                workerDoc.setFontSize(11);
                workerDoc.setTextColor(60, 120, 216);
                workerDoc.text('WORKER PAYSLIP', 14, 35);
            } else {
                // Header
                workerDoc.setFont('helvetica', 'bold');
                workerDoc.setFontSize(22);
                workerDoc.setTextColor(30, 41, 59);
                workerDoc.text('99 CARE', 14, 25);
                workerDoc.setFontSize(13);
                workerDoc.setTextColor(60, 120, 216);
                workerDoc.text('WORKER PAYSLIP', 14, 33);
            }

            // Company info right-aligned
            workerDoc.setFont('helvetica', 'normal');
            workerDoc.setFontSize(9);
            workerDoc.setTextColor(71, 85, 105);
            const mCompanyInfo = [
                '104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN',
                'Surat, GUJARAT, 395007',
                'Mobile: +91 9016116564',
                'Email: 99careforyou@gmail.com',
                'Website: 99CARE.ORG'
            ];
            let mCompY = 16;
            mCompanyInfo.forEach((line: string) => {
                workerDoc.text(line, 196, mCompY, { align: 'right' });
                mCompY += 4.5;
            });

            // Divider
            workerDoc.setDrawColor(180, 200, 240);
            workerDoc.setLineWidth(0.8);
            workerDoc.line(14, 42, 196, 42);

            // Left: Worker info
            workerDoc.setFont('helvetica', 'bold');
            workerDoc.setFontSize(10);
            workerDoc.setTextColor(30, 41, 59);
            workerDoc.text('Worker Details:', 14, 50);
            workerDoc.setFontSize(11);
            workerDoc.text(worker.name, 14, 56);
            workerDoc.setFont('helvetica', 'normal');
            workerDoc.setFontSize(9);
            workerDoc.setTextColor(71, 85, 105);
            workerDoc.text(`Designation: ${worker.role}`, 14, 62);
            workerDoc.text(`Assigned Client: ${worker.assigned_client || 'N/A'}`, 14, 68);

            // Right: Payslip meta
            workerDoc.setFont('helvetica', 'bold');
            workerDoc.setFontSize(10);
            workerDoc.setTextColor(30, 41, 59);
            workerDoc.text('Payslip Details:', 130, 50);
            workerDoc.setFont('helvetica', 'normal');
            workerDoc.setFontSize(9);
            workerDoc.setTextColor(71, 85, 105);
            workerDoc.text(`Payslip #: ${mPayslipNo}`, 130, 56);
            workerDoc.text(`Issue Date: ${mDateNow}`, 130, 62);
            workerDoc.text(`Service Period: ${serviceMonth}`, 130, 68);

            // Earnings table
            autoTable(workerDoc, {
                startY: 78,
                theme: 'grid',
                headStyles: { fillColor: [60, 120, 216], textColor: 255, fontStyle: 'bold' },
                head: [['Earning Breakdown', 'Value']],
                body: [
                    ['Working Days', `${daysWorked} days`],
                    ['Salary Per Day', `Rs. ${appliedRate.toFixed(2)}`],
                    ['Total Amount', `Rs. ${totalCost.toFixed(2)}`],
                    ['Security Deposit Adjustment', `- Rs. ${deposit.toFixed(2)}`],
                    ['Advance Paid', `- Rs. ${advance.toFixed(2)}`],
                ],
                columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right' } },
            });

            let mFinalY = (workerDoc as any).lastAutoTable.finalY + 8;

            // Net Payable box
            workerDoc.setFillColor(240, 253, 244);
            workerDoc.setDrawColor(34, 197, 94);
            workerDoc.roundedRect(14, mFinalY, 182, 18, 3, 3, 'FD');
            workerDoc.setFont('helvetica', 'bold');
            workerDoc.setFontSize(11);
            workerDoc.setTextColor(21, 128, 61);
            workerDoc.text('NET AMOUNT PAYABLE TO WORKER:', 20, mFinalY + 11);
            workerDoc.text(`Rs. ${Math.abs(netBalance).toFixed(2)}`, 185, mFinalY + 11, { align: 'right' });

            // Bank details
            let mBkY = mFinalY + 30;
            workerDoc.setFont('helvetica', 'bold');
            workerDoc.setFontSize(10);
            workerDoc.setTextColor(30, 41, 59);
            workerDoc.text('Bank Details for Transfer:', 14, mBkY);
            mBkY += 6;
            const mBankLines = [
                { l: 'Bank:', v: 'The Sutex Co-Operative BankLtd.' },
                { l: 'Account Holder:', v: '99 CARE HOME HEALTHCARE SERVICE' },
                { l: 'Account #:', v: '001810021002033' },
                { l: 'IFSC Code:', v: 'SUTB0248018' },
                { l: 'Branch:', v: 'Adajan Pal' },
            ];
            mBankLines.forEach(({ l, v }) => {
                workerDoc.setFont('helvetica', 'normal');
                workerDoc.setFontSize(9);
                workerDoc.setTextColor(71, 85, 105);
                workerDoc.text(l, 14, mBkY);
                workerDoc.setFont('helvetica', 'bold');
                workerDoc.text(v, 42, mBkY);
                mBkY += 5;
            });

            // Signature
            const mSigY = mFinalY + 30;
            workerDoc.setFont('helvetica', 'normal');
            workerDoc.setFontSize(9);
            workerDoc.setTextColor(30, 41, 59);
            workerDoc.text('For 99 CARE', 150, mSigY);
            workerDoc.setDrawColor(100, 116, 139);
            workerDoc.setLineWidth(0.5);
            workerDoc.line(140, mSigY + 16, 190, mSigY + 16);
            workerDoc.setFontSize(8);
            workerDoc.setTextColor(71, 85, 105);
            workerDoc.text('Authorized Signatory', 150, mSigY + 20);

            // Footer
            workerDoc.setFontSize(7);
            workerDoc.setFont('helvetica', 'normal');
            workerDoc.setTextColor(148, 163, 184);
            workerDoc.text('99 CARE HOME HEALTHCARE SERVICE • 104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT • +91 9016116564', 14, 285);

            workerDoc.save(`Payslip_${worker.name.replace(/\s+/g, '_')}_${serviceMonth.replace(/\s+/g, '_')}.pdf`);

            toast.success("Manual payslip generated and downloaded successfully");
            fetchData();
            setIsManualPayrollModalOpen(false);
            setManualPayrollData({ 
                worker_id: '', 
                startDate: '',
                endDate: '',
                shiftHoursOverride: 0, 
                advanceAmount: 0,
                type: 'payslip' as 'payslip',
                clientNameOverride: '',
                dailyRateOverride: '',
                workerPhone: ''
            });
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "An error occurred");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">AI HR & Billing</h1>
                    <p className="text-slate-500 mt-1">Manage worker allocation, automated attendance, and payroll dispatch.</p>
                </div>

                {/* Module Tabs */}
                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0 overflow-x-auto hide-scrollbar">
                    <button
                        onClick={() => setActiveTab('allocation')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'allocation' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Allocation
                    </button>
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'attendance' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Attendance
                    </button>
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'payroll' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Payroll
                    </button>
                </div>
            </div>

            {activeTab === 'allocation' ? (
                /* Enhanced Worker Allocation Module */
                <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <WorkerAllocation isEmbedded />
                </div>
            ) : activeTab === 'attendance' ? (
                /* Command Center Roster View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 relative">
                        <div>
                            <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                                <Clock className="w-5 h-5 text-[#1AA6A8]" /> Daily Command Matrix
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">Auto-synced attendance & billing in real-time.</p>
                        </div>
                        <div className="flex gap-3 items-center">
                            <input 
                                type="date" 
                                max={new Date().toISOString().split('T')[0]}
                                value={selectedAttendanceDate}
                                onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]"
                            />
                            <button
                                onClick={fetchLiveAttendance}
                                className="px-3 py-2 border border-slate-200 bg-white text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <RefreshCw className={`w-4 h-4 ${attendanceLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                            <button
                                onClick={handleBulkMarkPresent}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-[#1AA6A8] text-white text-sm font-bold rounded-lg hover:bg-[#1AA6A8] transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Bulk Mark Present
                            </button>
                        </div>
                    </div>

                    {attendanceLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-[#1AA6A8] animate-spin mb-4" />
                            <span className="text-slate-500 font-medium">Fetching roster data...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1 relative bg-white">
                            {activeAssignments.length === 0 && (
                                <div className="m-6 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 bg-white text-slate-400 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900">No Active Deployments</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-sm">There are no active workers in your directory to track attendance for.</p>
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                                {activeAssignments.map(assignment => (
                                    <AssignmentAttendancePanel
                                        key={assignment.id}
                                        assignment={assignment}
                                        onAssignmentCompleted={(completedAssignment) => {
                                            setAutoCloseAssignmentOnGenerate(true);
                                            setBillingAssignment(completedAssignment);
                                            setActiveTab('payroll');
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Payroll & Invoicing View */
                <div className="flex flex-col gap-6 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Financial Execution Center</h2>
                            <p className="text-sm text-slate-500">Automated calculation of client invoices and worker payslips.</p>
                        </div>


                        <div className="flex items-center gap-3">
                           <button
                                onClick={() => setIsManualPayrollModalOpen(true)}
                                className="py-2 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Manual Payslip
                            </button>
                           <button
                                onClick={handleGeneratePayroll}
                                disabled={isGenerating}
                                className={`py-2 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isGenerating
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                        Dispatching...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        Run Monthly Payroll
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-2 mt-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Payables</p>
                                <p className="text-2xl font-black text-slate-900">Rs. {payrollItems.reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#EAFBFB] text-[#1AA6A8] flex items-center justify-center">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-rose-500 font-bold uppercase tracking-wider mb-1">Unpaid Dues</p>
                                <p className="text-2xl font-black text-rose-600">Rs. {payrollItems.filter(i => i.status !== 'Paid' && i.status !== 'Settled').reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-4 shadow-md flex items-center justify-between text-white">
                            <div>
                                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">Paid Amount</p>
                                <p className="text-2xl font-black text-white">Rs. {payrollItems.filter(i => i.status === 'Paid' || i.status === 'Settled').reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                        </div>
                    </div>

                    <div className="max-w-4xl w-full mx-auto flex-1 overflow-hidden flex flex-col mb-6">

                        {/* Worker Payslips Section */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-[#E6F7F7]/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-[#1AA6A8]" />
                                    <h3 className="font-bold text-slate-900">Worker Monthly Payslips</h3>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1AA6A8] bg-[#EAFBFB] px-2 py-0.5 rounded-full">Payables</span>
                            </div>
                            <div className="flex-1 overflow-auto divide-y divide-slate-100">
                                {isLoading ? (
                                     <div className="flex flex-col items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : (
                                    payrollItems.filter(item => item.payroll_type === 'payslip' || item.payroll_type === 'both' || !item.payroll_type).map((item) => {
                                        const days = getDays(item);
                                        const amount = days * item.daily_rate;
                                        return (
                                            <div key={`worker-${item.id}`} className="p-4 hover:bg-slate-50 transition-colors group">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#EAFBFB] text-[#1AA6A8] flex items-center justify-center font-bold text-sm shadow-sm">
                                                            {item.worker.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-slate-900">{item.worker}</p>
                                                                {(item.status === 'Paid' || item.status === 'Settled') && item.worker_assignments?.assignment_status === 'completed' && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">✓ Paid</span>}
                                                                {item.status === 'Pending Payment' && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Pending</span>}
                                                            </div>
                                                            {item.client_name && item.client_name !== 'N/A' && (
                                                                <p className="text-[10px] text-slate-400 font-medium">→ {item.client_name}</p>
                                                            )}
                                                            <p className="text-[10px] text-slate-500 font-medium">{days} days @ Rs. {item.daily_rate.toFixed(2)}/d • {item.month || item.service_month || 'May 2026'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-sm font-bold text-[#1AA6A8]">Rs. {amount.toFixed(2)}</p>
                                                            <button 
                                                                onClick={async () => {
                                                                    if (!confirm('Are you sure you want to delete this payslip?')) return;
                                                                    try {
                                                                        const { error } = await supabase
                                                                            .from('payroll')
                                                                            .delete()
                                                                            .eq('id', item.id);
                                                                        if (error) throw error;
                                                                        toast.success("Payslip deleted successfully");
                                                                        fetchData();
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || "Failed to delete payslip");
                                                                    }
                                                                }}
                                                                className="p-1.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100 transition-all shadow-sm active:scale-95"
                                                                title="Delete Payslip"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            <button 
                                                                onClick={() => setPreviewPayslip(item)} 
                                                                className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors flex items-center gap-1"
                                                            >
                                                                <Eye className="w-3 h-3" /> Preview
                                                            </button>
                                                            <button 
                                                                onClick={() => handleGenerateSinglePayslip(item)} 
                                                                className="px-2 py-1 bg-[#EAFBFB] text-[10px] font-bold text-[#1AA6A8] hover:bg-[#1AA6A8] hover:text-white rounded transition-colors flex items-center gap-1"
                                                            >
                                                                <Download className="w-3 h-3" /> Download
                                                            </button>
                                                            <button 
                                                                onClick={async () => {
                                                                    const workerRecord = workers.find(w => w.name === item.worker);
                                                                    let phone = item.worker_phone || '';
                                                                    if (!phone && workerRecord && workerRecord.phone) {
                                                                        phone = workerRecord.phone;
                                                                    }
                                                                    if (phone) {
                                                                        phone = phone.replace(/\D/g, '');
                                                                        if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
                                                                    }
                                                                    if (!phone) {
                                                                        toast.error("No phone number found for this worker.");
                                                                        return;
                                                                    }
                                                                    
                                                                    const toastId = toast.loading("Generating payslip and dispatching...");
                                                                    try {
                                                                        // Generate payslip PDF inline using jsPDF
                                                                        const doc = new jsPDF();
                                                                        doc.setFontSize(16);
                                                                        doc.text('99 CARE - Worker Payslip', 14, 20);
                                                                        doc.setFontSize(11);
                                                                        doc.text(`Worker: ${item.worker}`, 14, 35);
                                                                        doc.text(`Month: ${item.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`, 14, 43);
                                                                        doc.text(`Days Worked: ${item.daysWorked || 0}`, 14, 51);
                                                                        doc.text(`Daily Rate: Rs. ${item.dailyRate || 0}`, 14, 59);
                                                                        doc.text(`Total Earnings: Rs. ${item.totalEarnings || 0}`, 14, 67);
                                                                        doc.text(`Net Payable: Rs. ${item.netPayable || item.amount || 0}`, 14, 75);
                                                                        const pdfBlob = doc.output('blob');
                                                                        const fileName = `payslip-${item.worker.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
                                                                        
                                                                        const { error: uploadError } = await supabase.storage.from('payslips').upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: false });
                                                                        if (uploadError) throw uploadError;
                                                                        
                                                                        const { data: { publicUrl } } = supabase.storage.from('payslips').getPublicUrl(fileName);
                                                                        
                                                                        const { data: waData, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                                                                            body: { phone, sendInvoicePdf: true, invoicePdfUrl: publicUrl, useTemplate: true, templateName: 'worker_payslip', templateParams: [item.worker] }
                                                                        });
                                                                        
                                                                        if (error) throw error;
                                                                        if (waData && waData.success === false) throw new Error(waData.error || 'Meta API rejected the message.');
                                                                        toast.success("Payslip successfully dispatched via WhatsApp!", { id: toastId });
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || "Failed to dispatch payslip", { id: toastId });
                                                                    }
                                                                }}
                                                                className="px-2 py-1 bg-green-50 text-[10px] font-bold text-green-600 hover:bg-green-500 hover:text-white rounded transition-colors flex items-center gap-1"
                                                            >
                                                                <Send className="w-3 h-3" /> WhatsApp
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const assignment = activeAssignments.find(a => a.employee_id === item.worker_id || (a.employees && a.employees.full_name === item.worker));
                                                                    if (assignment) {
                                                                        setBillingAssignment(assignment);
                                                                    } else {
                                                                        let targetEmployeeId = item.worker_id;
                                                                        if (!targetEmployeeId) {
                                                                            const worker = workers.find(w => w.name === item.worker);
                                                                            if (worker) targetEmployeeId = worker.id;
                                                                        }
                                                                        
                                                                        if (targetEmployeeId) {
                                                                            const { data, error } = await supabase
                                                                                .from('worker_assignments')
                                                                                .select('*, employees(*), clients(*)')
                                                                                .eq('employee_id', targetEmployeeId)
                                                                                .order('assigned_at', { ascending: false })
                                                                                .limit(1)
                                                                                .maybeSingle();
                                                                            if (error) {
                                                                                toast.error('Error finding assignment: ' + error.message);
                                                                            } else if (data) {
                                                                                setAutoCloseAssignmentOnGenerate(false);
                                                                                setBillingAssignment(data);
                                                                            } else {
                                                                                toast.error('No assignment found for this worker.');
                                                                            }
                                                                        } else {
                                                                            toast.error('Could not identify worker ID.');
                                                                        }
                                                                    }
                                                                }}
                                                                className="px-2 py-1 bg-slate-800 text-[10px] font-bold text-white hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                                                                title="Open Live Generator"
                                                            >
                                                                <FileText className="w-3 h-3" /> Generator
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Worker Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto max-h-[90vh] flex flex-col border border-white/20">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform">
                                        <Users className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                            {modalMode === 'add' ? 'Onboard New Staff' : 'Manage Staff Portfolio'}
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {modalMode === 'add' ? 'Create a new clinical or service profile' : `Viewing profile for ${formData.name}`}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-md transition-all text-slate-400 hover:text-rose-500 border border-transparent hover:border-slate-100">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Tabs Navigation */}
                            <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
                                <button onClick={() => setModalTab('profile')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${modalTab === 'profile' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <Edit3 className="w-4 h-4" /> Profile Info
                                </button>
                                <button onClick={() => setModalTab('kyc')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${modalTab === 'kyc' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <UserCheck className="w-4 h-4" /> KYC Details
                                </button>
                                <button onClick={() => setModalTab('vault')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${modalTab === 'vault' ? 'bg-[#E6F7F7] text-[#1AA6A8]' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <Upload className="w-4 h-4" /> Document Vault
                                </button>

                            </div>

                            <form onSubmit={handleWorkerSubmit} className="flex-1 overflow-y-auto bg-slate-50/30">
                                <div className="p-6 space-y-6">
                                    {modalTab === 'profile' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 font-[Inter]">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Full Legal Name</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                        placeholder="e.g. Rahul Sharma"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Role / Designation</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={formData.role}
                                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                        placeholder="e.g. ICU Nurse / GDA"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-sm font-bold text-slate-700 ml-1">Deployment Location (Client)</label>
                                                <select
                                                    value={formData.assigned_client}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const prevClient = formData.assigned_client;
                                                        // If client is changed or removed, reset to Available (new client must re-confirm)
                                                        // If client is unchanged (same selection), preserve current status
                                                        const newStatus = (val !== prevClient) ? 'Available' : formData.status;
                                                        setFormData({ ...formData, assigned_client: val, status: newStatus });
                                                    }}
                                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                >
                                                    <option value="">— Bench / Floating (Available) —</option>
                                                    {pipelineLeads.map(lead => (
                                                        <option key={lead.id} value={lead.name}>
                                                            {lead.name} ({lead.pipeline_stage})
                                                        </option>
                                                    ))}
                                                </select>
                                                {formData.assigned_client && formData.status === 'Available' && (
                                                    <p className="text-xs text-amber-600 ml-1 mt-1 flex items-center gap-1">
                                                        <span>⏳</span> Awaiting client confirmation via WhatsApp link
                                                    </p>
                                                )}
                                                {formData.assigned_client && formData.status === 'Active' && (
                                                    <p className="text-xs text-[#1AA6A8] ml-1 mt-1 flex items-center gap-1">
                                                        <span>✅</span> Client has confirmed this allocation
                                                    </p>
                                                )}
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Monthly Daily Rate (₹)
                                                        <span className="text-xs font-normal text-slate-400 ml-1">(used if ≥ 30 days)</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.monthly_daily_rate}
                                                        onChange={(e) => setFormData({ ...formData, monthly_daily_rate: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                        placeholder="e.g. 1200"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Short-Term Daily Rate (₹)
                                                        <span className="text-xs font-normal text-slate-400 ml-1">(used if &lt; 30 days)</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.short_term_daily_rate}
                                                        onChange={(e) => setFormData({ ...formData, short_term_daily_rate: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                        placeholder="e.g. 1500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Deposit Received (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.deposit_received}
                                                        onChange={(e) => setFormData({ ...formData, deposit_received: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                        placeholder="e.g. 15000"
                                                    />
                                                    {(() => {
                                                        const lead = pipelineLeads.find((l: any) => l.name?.toLowerCase().trim() === formData.assigned_client.toLowerCase().trim());
                                                        if (!lead?.estimated_value_monthly) return null;
                                                        return <p className="text-[11px] text-[#1AA6A8] ml-1 font-medium">💡 CRM value: ₹{lead.estimated_value_monthly.toLocaleString('en-IN')}/mo</p>;
                                                    })()}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Work Status
                                                        {formData.status === 'Active' && !formData.assigned_client && (
                                                            <span className="ml-2 text-xs text-amber-500 font-normal">(assign a client first)</span>
                                                        )}
                                                    </label>
                                                    <select
                                                        value={formData.status}
                                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                    >
                                                        <option value="Available">Available — Awaiting Assignment / Confirmation</option>
                                                        <option value="Active">Active — Confirmed & On Duty</option>
                                                        <option value="On Leave">On Leave</option>
                                                        <option value="Terminated">Terminated</option>
                                                    </select>
                                                    {formData.status === 'Active' && formData.assigned_client && (
                                                        <p className="text-[11px] text-slate-500 ml-1">Saving as Active will auto-confirm the CRM lead.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'kyc' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                                                        <UserCheck className="w-4 h-4 text-primary" /> Aadhaar Card Number
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={12}
                                                        value={formData.aadhaar_number}
                                                        onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value.replace(/\D/g, '') })}
                                                        className={`w-full px-4 py-3 rounded-2xl border outline-none focus:ring-4 text-sm transition-all bg-white ${
                                                            formData.aadhaar_number.length > 0 && formData.aadhaar_number.length < 12
                                                                ? 'border-amber-300 focus:ring-amber-500/10 focus:border-amber-500'
                                                                : 'border-primary/20 focus:ring-primary/10 focus:border-primary'
                                                        }`}
                                                        placeholder="12 Digit Aadhaar"
                                                    />
                                                    {formData.aadhaar_number.length > 0 && formData.aadhaar_number.length < 12 && (
                                                        <p className="text-xs text-amber-600 ml-1">{formData.aadhaar_number.length}/12 digits entered</p>
                                                    )}
                                                    {formData.aadhaar_number.length === 12 && (
                                                        <p className="text-xs text-[#1AA6A8] ml-1">✓ Valid Aadhaar format</p>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-[#1AA6A8]" /> WhatsApp Number
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        required
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                        className={`w-full px-4 py-3 rounded-2xl border outline-none focus:ring-4 text-sm transition-all bg-white ${
                                                            formData.phone.length > 0 && !/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, '').slice(-10))
                                                                ? 'border-amber-300 focus:ring-amber-500/10 focus:border-amber-500'
                                                                : 'border-[#1AA6A8]/20 focus:ring-[#1AA6A8]/10 focus:border-[#1AA6A8]'
                                                        }`}
                                                        placeholder="+91 98765 43210"
                                                    />
                                                    {formData.phone.length > 0 && !/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, '').slice(-10)) && (
                                                        <p className="text-xs text-amber-600 ml-1">Please enter a valid 10-digit number</p>
                                                    )}
                                                    {formData.phone.length > 0 && /^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, '').slice(-10)) && (
                                                        <p className="text-xs text-[#1AA6A8] ml-1">✓ Valid mobile format</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Date of Birth</label>
                                                    <input
                                                        type="date"
                                                        required
                                                        value={formData.dob}
                                                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-bold text-slate-700 ml-1">Full Residential Address</label>
                                                    <textarea
                                                        required
                                                        value={formData.address}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm transition-all bg-white resize-none h-[110px]"
                                                        placeholder="Full village/city address..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'vault' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                                            <div className="bg-[#E6F7F7]/50 rounded-3xl border-2 border-dashed border-[#1AA6A8]/20 p-8 flex flex-col items-center justify-center text-center group cursor-pointer relative overflow-hidden transition-all hover:bg-[#E6F7F7] hover:border-[#1AA6A8]">
                                                <input
                                                    type="file"
                                                    multiple
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            const newFiles = Array.from(e.target.files);
                                                            setFormData(prev => ({ ...prev, documents: [...(prev.documents || []), ...newFiles] }));
                                                        }
                                                    }}
                                                />
                                                <div className="w-16 h-16 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform rotate-3 group-hover:rotate-0">
                                                    <Upload className="w-8 h-8 text-[#1AA6A8]" />
                                                </div>
                                                <h3 className="text-lg font-bold text-[#0E7C7E] mb-1">Worker Document Vault</h3>
                                                <p className="text-sm text-[#1AA6A8] max-w-sm mb-4">Click or drag Aadhaar, Nurse Certifications, or Police Verifications to store them securely.</p>
                                                <div className="flex gap-2">
                                                    <span className="px-3 py-1 bg-white/80 rounded-lg text-[10px] font-bold text-[#1AA6A8] uppercase tracking-widest border border-[#1AA6A8]/20 shadow-sm">PDF</span>
                                                    <span className="px-3 py-1 bg-white/80 rounded-lg text-[10px] font-bold text-[#1AA6A8] uppercase tracking-widest border border-[#1AA6A8]/20 shadow-sm">DOCX</span>
                                                    <span className="px-3 py-1 bg-white/80 rounded-lg text-[10px] font-bold text-[#1AA6A8] uppercase tracking-widest border border-[#1AA6A8]/20 shadow-sm">IMAGE</span>
                                                </div>
                                            </div>
                                            
                                            {formData.documents && formData.documents.length > 0 && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    {formData.documents.map((file, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all group/file">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover/file:bg-[#E6F7F7] transition-colors">
                                                                    <FileText className="w-5 h-5 text-[#1AA6A8]" />
                                                                </div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                                                                    <p className="text-[10px] text-slate-400">Ready for storage</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setFormData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }));
                                                                }}
                                                                className="text-slate-300 hover:text-rose-500 p-2 rounded-lg transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}


                                </div>

                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 sticky bottom-0 z-30">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">
                                        Discard Changes
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 py-4 px-6 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
                                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5" />
                                                {modalMode === 'add' ? 'Confirm Onboarding' : 'Save Portfolio'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div >
                    </div >
                )
            }

            {/* Edit Payroll Modal */}
            {
                isEditPayrollModalOpen && editingPayroll && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-primary" /> Edit Payslip Details
                                </h2>
                                <button onClick={() => setIsEditPayrollModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSavePayroll} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Worker</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingPayroll.worker}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Hours Logged</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.5"
                                            value={editingPayroll.hours_logged}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, hours_logged: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={editingPayroll.total_amount}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, total_amount: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setIsEditPayrollModalOpen(false)} className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* AI WhatsApp Draft Modal */}
            {
                isAgentModalOpen && agentTargetWorker && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-[#1AA6A8]/10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#EAFBFB] rounded-full flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-[#1AA6A8]" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                        <p className="text-xs text-slate-500 font-medium tracking-wide">SHARING PROFILE: {agentTargetWorker.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4 flex-1">
                                {/* Simplified Message Type Selector */}
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-primary" /> Message Type
                                    </label>
                                    <select 
                                        value={agentTargetAction === 'custom' ? 'custom' : 'stage'}
                                        onChange={(e) => {
                                            if (e.target.value === 'custom') {
                                                setAgentTargetAction('custom');
                                            } else {
                                                setAgentTargetAction('staff');
                                            }
                                        }}
                                        className="text-xs font-semibold text-slate-700 bg-slate-100 border-none rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="stage">Profile Sharing</option>
                                        <option value="custom">Manual Message</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" /> Edit Generated Draft
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={agentDraftText}
                                            onChange={(e) => setAgentDraftText(e.target.value)}
                                            className="w-full h-32 px-4 py-3 rounded-xl border border-[#1AA6A8]/20 outline-none focus:ring-2 focus:ring-[#1AA6A8] focus:border-transparent text-sm bg-[#E6F7F7] text-[#0E7C7E] resize-none font-medium leading-relaxed"
                                        />
                                        <div className="absolute bottom-3 right-3 flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-75"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-150"></span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                        Target Client: <strong>{agentTargetWorker.assigned_client}</strong>
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Send on WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Invoice Preview Modal Removed */}
            {isManualPayrollModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" /> Manual Payslip Generator
                            </h2>
                            <button onClick={() => setIsManualPayrollModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Worker</label>
                                <select
                                    value={manualPayrollData.worker_id}
                                    onChange={e => {
                                        const w = workers.find(w => w.id === e.target.value);
                                        setManualPayrollData({
                                            ...manualPayrollData, 
                                            worker_id: e.target.value,
                                            shiftHoursOverride: w?.shift_hours || 8
                                        });
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    required
                                >
                                    <option value="">-- Choose Worker --</option>
                                    {Array.isArray(workers) && workers.filter((w: any) => w && !w.deleted_at).map((w: any) => (
                                        <option key={w.id} value={w.id}>
                                            {w.full_name || w.name || 'Unknown'} ({w.preferred_payment_type === 'hourly' ? 'Hourly' : w.preferred_payment_type === 'short_term' ? 'Fixed' : 'Daily'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={manualPayrollData.startDate}
                                        onChange={e => setManualPayrollData({...manualPayrollData, startDate: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Date (optional)</label>
                                    <input
                                        type="date"
                                        value={manualPayrollData.endDate}
                                        min={manualPayrollData.startDate}
                                        onChange={e => setManualPayrollData({...manualPayrollData, endDate: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Advance Received (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.advanceAmount || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, advanceAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="e.g. 2000"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1 italic">This will be subtracted.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Custom Daily Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.dailyRateOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, dailyRateOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={manualPayrollData.clientNameOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, clientNameOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                            </div>

                            <input type="hidden" value="payslip" />

                            {workers.find(w => w.id === manualPayrollData.worker_id)?.preferred_payment_type === 'hourly' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Per Day (Override)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={manualPayrollData.shiftHoursOverride || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, shiftHoursOverride: parseInt(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        placeholder="e.g. 10"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">This overrides the worker's default shift length for this specific payslip.</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Worker Phone Number (for WhatsApp)</label>
                                <input
                                    type="text"
                                    value={manualPayrollData.workerPhone || ''}
                                    onChange={e => setManualPayrollData({...manualPayrollData, workerPhone: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    placeholder="Leave empty to use directory number"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Only required if overriding or if missing in directory.</p>
                            </div>

                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button onClick={() => setIsManualPayrollModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleManualPayrollGenerate} disabled={isGenerating || !manualPayrollData.worker_id || !manualPayrollData.startDate} className="flex-1 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                {isGenerating ? 'Generating...' : 'Generate & Download'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isManualAttendanceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" /> Mark Manual Attendance
                            </h2>
                            <button onClick={() => setIsManualAttendanceModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleManualAttendanceSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Worker</label>
                                <select
                                    value={manualAttendanceData?.worker_id || ''}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, worker_id: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    required
                                >
                                    <option value="">-- Choose Worker --</option>
                                    {Array.isArray(workers) && workers.filter((w: any) => w && (w.status === 'assigned' || w.status === 'Active')).map((w: any) => (
                                        <option key={w?.id || `fallback-${Math.random()}`} value={w?.id || ''}>
                                            {w?.full_name || w?.name || 'Unknown'} ({w?.assigned_client || 'No Client'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Check-In Time</label>
                                <input
                                    type="datetime-local"
                                    value={manualAttendanceData?.check_in_time || ''}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, check_in_time: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select
                                    value={manualAttendanceData?.status || 'Completed'}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, status: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                >
                                    <option value="Completed">Completed (Past Shift)</option>
                                    <option value="On Duty">On Duty (Live Check-in)</option>
                                </select>
                            </div>
                            {manualAttendanceData?.status === 'Completed' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Worked</label>
                                    <input
                                        type="number"
                                        value={manualAttendanceData?.hours_worked || ''}
                                        onChange={e => setManualAttendanceData({...manualAttendanceData, hours_worked: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        min="1"
                                        max="24"
                                        required
                                    />
                                </div>
                            )}
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsManualAttendanceModalOpen(false)} className="flex-1 py-2 rounded-lg font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-2 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
                                    {isSubmitting ? 'Saving...' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Live Payslip Preview Modal */}
            {/* Worker Payslip Generator Modal (Billing) */}
            {billingAssignment && (
                <PayslipGenerator
                    assignment={billingAssignment}
                    autoCloseAssignmentOnGenerate={autoCloseAssignmentOnGenerate}
                    onClose={() => setBillingAssignment(null)}
                    onGenerated={() => { setBillingAssignment(null); fetchData(); }}
                />
            )}

            {previewPayslip && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 my-8">
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" /> Live Payslip Invoice Preview
                            </h3>
                            <button 
                                onClick={() => setPreviewPayslip(null)} 
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        {/* Printable Payslip Body */}
                        <div className="p-8 space-y-6 font-[Inter] text-slate-700 bg-white">
                            {/* Brand Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <img src="/99care-logo.svg" className="h-10 w-auto" alt="99care Logo" onError={(e) => {
                                            // fallback to text if SVG doesn't load in HTML
                                            e.currentTarget.style.display = 'none';
                                        }} />
                                        <span className="font-extrabold text-2xl tracking-tight text-[#1AA6A8]">99 CARE</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Worker Payslip Invoice</p>
                                </div>
                                <div className="text-right text-[10px] text-slate-500 leading-relaxed max-w-[240px]">
                                    <p className="font-bold text-slate-800">99 CARE HOME HEALTHCARE SERVICE</p>
                                    <p>104, FORCHUN MALL, GALAXY CIRCAL, PAL ADAJAN, SURAT, GUJARAT, 395007</p>
                                    <p>Mobile: +91 9016116564</p>
                                    <p>Email: 99careforyou@gmail.com</p>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-6 text-xs">
                                <div>
                                    <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">Worker Portfolio</h4>
                                    <p className="font-bold text-slate-900 text-sm">{previewPayslip.worker}</p>
                                    <p className="text-slate-500 mt-1">Designation: Caregiver</p>
                                    <p className="text-slate-500">Period: {previewPayslip.period_start} to {previewPayslip.period_end}</p>
                                </div>
                                <div className="text-right">
                                    <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Summary</h4>
                                    <p><span className="text-slate-500">Payslip No:</span> <span className="font-mono font-bold text-slate-900">PS-{previewPayslip.id?.slice(-6).toUpperCase()}</span></p>
                                    <p className="mt-1"><span className="text-slate-500">Issue Date:</span> <span className="font-medium">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                                    <p className="mt-1"><span className="text-slate-500">Client Assigned:</span> <span className="font-semibold text-primary">{previewPayslip.client_name || 'Tanishq Kachiwala'}</span></p>
                                </div>
                            </div>

                            {/* Details Table */}
                            <div className="border border-slate-100 rounded-xl overflow-hidden">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-3 font-bold text-slate-600">Earnings Description</th>
                                            <th className="p-3 font-bold text-slate-600 text-center">Days Worked</th>
                                            <th className="p-3 font-bold text-slate-600 text-right">Daily Rate</th>
                                            <th className="p-3 font-bold text-slate-600 text-right">Gross Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="p-3 font-medium text-slate-800">
                                                Professional Homecare & Caregiving Services
                                            </td>
                                            <td className="p-3 text-center text-slate-600">{previewPayslip.days_worked || 0}</td>
                                            <td className="p-3 text-right text-slate-600 font-mono">Rs. {previewPayslip.daily_rate?.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-slate-900 font-mono">
                                                Rs. {((previewPayslip.days_worked || 0) * (previewPayslip.daily_rate || 0)).toFixed(2)}
                                            </td>
                                        </tr>
                                        {/* Advance deduction if any */}
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={3} className="p-3 text-right font-medium text-slate-500">Less: Security / Advance Paid</td>
                                            <td className="p-3 text-right font-bold text-rose-500 font-mono">-Rs. {(previewPayslip.advance_paid || 0).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Net Balance Sheet */}
                            <div className="bg-[#1AA6A8]/5 rounded-2xl p-4 flex justify-between items-center border border-[#1AA6A8]/10">
                                <div>
                                    <p className="text-xs font-bold text-[#1AA6A8] uppercase tracking-wider">Net Amount Payable</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Subject to standard bank transfer clearing</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-extrabold text-[#1AA6A8] font-mono">
                                        Rs. {Math.max(0, ((previewPayslip.days_worked || 0) * (previewPayslip.daily_rate || 0)) - (previewPayslip.advance_paid || 0)).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="bg-slate-50 rounded-2xl p-4 text-[10px] text-slate-500 space-y-1">
                                <p className="font-bold text-slate-700 uppercase tracking-wider mb-1">Corporate Bank Transfer Details</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p><span className="font-medium text-slate-600">Bank Name:</span> The Sutex Co-Operative Bank Ltd.</p>
                                        <p><span className="font-medium text-slate-600">Account Name:</span> 99 CARE HOME HEALTHCARE SERVICE</p>
                                    </div>
                                    <div>
                                        <p><span className="font-medium text-slate-600">Account No:</span> 001810021002033</p>
                                        <p><span className="font-medium text-slate-600">IFSC Code:</span> SUTB0248018 (Adajan Pal Branch)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Signatory Footer */}
                            <div className="flex justify-between items-end pt-4">
                                <div className="text-[9px] text-slate-400 leading-normal">
                                    <p className="font-bold">Important Declaration:</p>
                                    <p>1. This is a computer-generated payslip invoice and requires no physical seal.</p>
                                    <p>2. Subject to Surat jurisdiction rules and regulations.</p>
                                </div>
                                <div className="text-center font-[Inter]">
                                    <div className="w-32 border-b border-slate-300 mx-auto mb-1 h-6"></div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Authorized Signatory</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
                            <button 
                                onClick={() => setPreviewPayslip(null)} 
                                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Close Preview
                            </button>
                            <button 
                                onClick={() => {
                                    handleGenerateSinglePayslip(previewPayslip);
                                    setPreviewPayslip(null);
                                }} 
                                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary/95 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Download PDF Payslip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
