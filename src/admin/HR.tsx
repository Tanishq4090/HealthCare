import { useState, useEffect, useCallback } from 'react';
import { Phone, UserCheck, CheckCircle2, FileText, Upload, Bot, Edit3, X, Globe, Send, Users, Clock, Building, Loader2, RefreshCw, History, Search, Trash2, AlertTriangle, Plus, MessageSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { MOCK_WORKERS, MOCK_PAYROLL } from '../data/mockWorkers';
import { format } from 'date-fns';
import WorkerAllocation from '../components/hr/WorkerAllocation';

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

    // Invoice Preview State
    const [isInvoicePreviewModalOpen, setIsInvoicePreviewModalOpen] = useState(false);
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<any>(null);
    const [invoiceExtras, setInvoiceExtras] = useState({ discount: 0, additionalCharge: 0, advanceAmount: 0, chargeDesc: 'Extra Services' });

    // Manual Payroll Generator State
    const [isManualPayrollModalOpen, setIsManualPayrollModalOpen] = useState(false);
    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        daysWorked: 0,
        shiftHoursOverride: 0,
        serviceMonth: format(new Date(), 'MMMM yyyy'),
        advanceAmount: 0,
        type: 'both' as 'both' | 'invoice' | 'payslip'
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
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*');
            const { data: leadData } = await supabase.from('crm_leads').select('id, name, phone, pipeline_stage, estimated_value_monthly').order('created_at', { ascending: false });

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

            if (payrollError || !payrollData || payrollData.length === 0) {
                setPayrollItems([]);
            } else {
                setPayrollItems(payrollData);
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



    const fetchLiveAttendance = async () => {
        setAttendanceLoading(true);
        try {
            // Fetch attendance logs with joined worker details for the selected date
            const { data, error } = await supabase
                .from('attendance')
                .select(`
                    id,
                    check_in_time,
                    check_out_time,
                    status,
                    worker_id,
                    employees (
                        full_name,
                        job_title,
                        assigned_client
                    )
                `)
                .eq('duty_date', selectedAttendanceDate)
                .order('check_in_time', { ascending: false });

            if (error) throw error;
            setAttendanceLogs(data || []);
        } catch (err: any) {
            console.error('Error fetching live attendance:', err);
            toast.error('Failed to load recent attendance logs');
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
                // Advance new client lead to Staff Assigned (only from earlier stages)
                await supabase.from('crm_leads')
                    .update({ pipeline_stage: 'Staff Assigned' })
                    .eq('name', newClient)
                    .in('pipeline_stage', ['New Lead', 'New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted']);
                toast.success(`Pipeline: ${newClient} advanced to Staff Assigned`);
            }

            // If admin is manually confirming the employee as assigned (bypass the WhatsApp flow)
            if (['active', 'assigned'].includes(resolvedStatus) && newClient) {
                await supabase.from('crm_leads')
                    .update({ pipeline_stage: 'Active Client' })
                    .eq('name', newClient)
                    .eq('pipeline_stage', 'Staff Assigned');
                toast.success(`Pipeline: ${newClient} confirmed as Active Client`);
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
            // Optimistic Update
            setPayrollItems(prev => prev.map(p => p.id === editingPayroll.id ? editingPayroll : p));
            setIsEditPayrollModalOpen(false);

            // Try saving to DB if it's connected
            await supabase.from('payroll').update({
                days_worked: editingPayroll.days_worked,
                net_balance: editingPayroll.net_balance
            }).eq('id', editingPayroll.id);

            toast.success(`Payslip for ${editingPayroll.worker} updated successfully.`);
        } catch (error: any) {
            console.error("Error updating payroll", error);
            // It might fail if DB is disconnected, but since we optimistically updated, it's fine for the demo.
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGeneratePayroll = async () => {
        const testEmail = window.prompt("Resend Sandbox limits testing to your verified email. Enter the email you used to sign up for Resend:");
        if (!testEmail) return;

        // Static jsPDF used instead

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
                        appliedRate = worker.monthly_daily_rate || 0;
                        totalCost = daysWorked * appliedRate; // Standard Daily Rate
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

                    // --- 1. Generate PDF Worker Payslip ---
                    const workerDoc = new jsPDF();
                    workerDoc.setFontSize(22);
                    workerDoc.setTextColor(15, 23, 42); 
                    workerDoc.text("99Care AI", 14, 20);
                    workerDoc.setFontSize(14);
                    workerDoc.setTextColor(100, 116, 139); 
                    workerDoc.text("Official Worker Payslip", 14, 30);
                    workerDoc.setFontSize(10);
                    workerDoc.setTextColor(71, 85, 105);
                    workerDoc.text(`Worker Name: ${worker.name}`, 14, 45);
                    workerDoc.text(`Role: ${worker.role}`, 14, 52);
                    workerDoc.text(`Assigned Client: ${worker.assigned_client || 'N/A'}`, 14, 59);
                    workerDoc.text(`Date Issued: ${new Date().toLocaleDateString()}`, 14, 66);

                    autoTable(workerDoc, {
                        startY: 75,
                        headStyles: { fillColor: [26, 166, 168] },
                        head: [['Description', 'Amount']],
                        body: [
                            [`working days`, `${daysWorked} days`],
                            [`Salary per day`, `₹${appliedRate.toFixed(2)}`],
                            [`Total Amount :`, `₹${totalCost.toFixed(2)}`],
                            [`Advanced IF any :`, `- ₹${deposit.toFixed(2)}`],
                        ],
                    });

                    let finalY = (workerDoc as any).lastAutoTable.finalY || 120;
                    workerDoc.setFontSize(14);
                    workerDoc.setTextColor(15, 23, 42);
                    workerDoc.setFont("helvetica", "bold");
                    workerDoc.text(`Pay Amount: ₹${Math.abs(netBalance).toFixed(2)}`, 14, finalY + 15);
                    workerDoc.setFontSize(10);
                    workerDoc.setFont("helvetica", "normal");
                    workerDoc.setTextColor(148, 163, 184);
                    workerDoc.text(`Auto-Generated by 99Care AI Engine`, 14, finalY + 30);

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
                            [`Manpower Supply (${worker.role})`, `₹${appliedRate.toFixed(2)}`, `${daysWorked} days`, `₹${totalCost.toFixed(2)}`],
                            [`Platform Fee (included)`, '0.00', '1', '0.00']
                        ],
                    });

                    finalY = (clientDoc as any).lastAutoTable.finalY || 120;
                    clientDoc.setFontSize(12);
                    clientDoc.setTextColor(15, 23, 42);
                    clientDoc.text(`Total Amount Due: ₹${totalCost.toFixed(2)}`, 14, finalY + 15);
                    clientDoc.text(`GST (18% Included): ₹${(totalCost * 0.18).toFixed(2)}`, 14, finalY + 22);

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

            // Fire off the dispatch email using the Edge Function
            const { error: emailError } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: testEmail,
                    subject: '99Care AI - Daily Fee Invoices & Payslips',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #0f172a;">99Care AI Payroll Execution</h2>
                            <p style="color: #475569;">This is an automated message from the 99Care Admin Dashboard.</p>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0; color: #10b981; font-weight: bold;">Status: Success</p>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">
                                    Processed ${newPayrollEntries.length} worker daily fee calculations.
                                </p>
                            </div>
                            <p style="color: #334155; font-size: 15px;">Please find the attached auto-generated PDF Payslips detailing the Daily Fee calculation algorithms for this cycle.</p>
                        </div>
                    `,
                    attachments: emailAttachments
                },
            });

            if (emailError) throw emailError;

            toast.success(`Payroll generated for ${newPayrollEntries.length} workers! Data saved and ${emailAttachments.length} PDFs dispatched.`, { id: 'payroll-gen' });
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
                [`Manpower Supply`, `₹${appliedRate.toFixed(2)}`, `${daysWorked} days`, `₹${baseCost.toFixed(2)}`]
            ];
            
            if (Number(invoiceExtras.additionalCharge) > 0) {
                tableBody.push([invoiceExtras.chargeDesc, '-', '-', `₹${Number(invoiceExtras.additionalCharge).toFixed(2)}`]);
            }
            if (Number(invoiceExtras.discount) > 0) {
                tableBody.push(['Discount Applied', '-', '-', `- ₹${Number(invoiceExtras.discount).toFixed(2)}`]);
            }
            if (Number(invoiceExtras.advanceAmount) > 0) {
                tableBody.push(['Advanced Paid (Worker)', '-', '-', `- ₹${Number(invoiceExtras.advanceAmount).toFixed(2)}`]);
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
            clientDoc.text(`Total Amount Due: ₹${totalCost.toFixed(2)}`, 14, finalY + 15);
            clientDoc.text(`GST (18% Included): ₹${(totalCost * 0.18).toFixed(2)}`, 14, finalY + 22);
            
            clientDoc.save(`Client_Invoice_${(item.client_name || 'Client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success("Invoice PDF Downloaded Successfully!");
            setIsInvoicePreviewModalOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF");
        }
    };

    const handleManualPayrollGenerate = async () => {
        if (!manualPayrollData.worker_id || manualPayrollData.daysWorked <= 0) {
            toast.error("Please select a worker and enter valid days worked.");
            return;
        }

        setIsGenerating(true);
        try {
            const worker = workers.find(w => w.id === manualPayrollData.worker_id);
            if (!worker) throw new Error("Worker not found");

            let appliedRate = 0;
            let totalCost = 0;

            if (worker.preferred_payment_type === 'hourly') {
                appliedRate = worker.hourly_rate || 0;
                const hours = manualPayrollData.shiftHoursOverride || worker.shift_hours || 8;
                totalCost = manualPayrollData.daysWorked * hours * appliedRate;
            } else if (worker.preferred_payment_type === 'short_term') {
                appliedRate = worker.short_term_daily_rate || 0;
                totalCost = appliedRate; // Fixed Flat
            } else {
                appliedRate = worker.monthly_daily_rate || 0;
                totalCost = manualPayrollData.daysWorked * appliedRate; 
            }

            const advance = Number(manualPayrollData.advanceAmount) || 0;
            const deposit = worker.deposit_received || 0;
            // The net balance is total cost minus deposit (from client) and minus advance (given to worker)
            const netBalance = totalCost - deposit - advance;

            const payrollEntry = {
                worker: worker.name,
                client_name: worker.assigned_client || 'No Active Client',
                days_worked: manualPayrollData.daysWorked,
                daily_rate: appliedRate,
                deposit_received: deposit,
                advance_amount: advance,
                net_balance: netBalance,
                status: netBalance > 0 ? 'Pending Payment' : (netBalance < 0 ? 'Refund Due' : 'Settled'),
                period_start: new Date().toISOString().slice(0, 10),
                period_end: new Date().toISOString().slice(0, 10),
                service_month: manualPayrollData.serviceMonth,
                payroll_type: manualPayrollData.type
            };

            const { error: dbError } = await supabase.from('payroll').insert([payrollEntry]);
            if (dbError) throw dbError;

            // Static jsPDF used instead

            // Generate PDFs for download
            if (manualPayrollData.type === 'both' || manualPayrollData.type === 'payslip') {
                const workerDoc = new jsPDF();
                workerDoc.setFontSize(22);
                workerDoc.setTextColor(15, 23, 42); 
                workerDoc.text("99Care AI", 14, 20);
                workerDoc.setFontSize(14);
                workerDoc.setTextColor(100, 116, 139); 
                workerDoc.text("Official Worker Payslip (Manual Entry)", 14, 30);
                workerDoc.setFontSize(10);
                workerDoc.setTextColor(71, 85, 105);
                workerDoc.text(`Worker Name: ${worker.name}`, 14, 45);
                workerDoc.text(`Role: ${worker.role}`, 14, 52);
                workerDoc.text(`Service Month: ${manualPayrollData.serviceMonth}`, 14, 59);
                workerDoc.text(`Assigned Client: ${worker.assigned_client || 'N/A'}`, 14, 66);

                autoTable(workerDoc, {
                    startY: 75,
                    head: [['Description', 'Value']],
                    body: [
                        ['working days', `${manualPayrollData.daysWorked} days`],
                        ['Salary per day', `Rs ${appliedRate.toFixed(2)}`],
                        ['Total Amount :', `Rs ${totalCost.toFixed(2)}`],
                        ['Security Deposit Adjustment :', `- Rs ${deposit.toFixed(2)}`],
                        ['Advance Taken :', `- Rs ${advance.toFixed(2)}`],
                        ['Net Payable Salary:', `Rs ${netBalance.toFixed(2)}`],
                    ],
                    theme: 'striped',
                    headStyles: { fillColor: [26, 166, 168] },
                });
                workerDoc.save(`Payslip_${worker.name.replace(/\s+/g, '_')}_${manualPayrollData.serviceMonth.replace(/\s+/g, '_')}.pdf`);
            }

            if (manualPayrollData.type === 'both' || manualPayrollData.type === 'invoice') {
                const clientDoc = new jsPDF();
                clientDoc.setFontSize(22);
                clientDoc.setTextColor(15, 23, 42); 
                clientDoc.text("99Care AI", 14, 20);
                clientDoc.setFontSize(14);
                clientDoc.setTextColor(100, 116, 139); 
                clientDoc.text("Official Client Invoice (Manual Entry)", 14, 30);
                clientDoc.setFontSize(10);
                clientDoc.setTextColor(71, 85, 105);
                clientDoc.text(`Client Name: ${worker.assigned_client || 'Unassigned'}`, 14, 45);
                clientDoc.text(`Service Provided By: ${worker.name} (${worker.role})`, 14, 52);
                clientDoc.text(`Service Month: ${manualPayrollData.serviceMonth}`, 14, 59);

                autoTable(clientDoc, {
                    startY: 65,
                    head: [['Service Description', 'Calculation', 'Subtotal']],
                    body: [
                        [
                            `Professional Services (${manualPayrollData.daysWorked} days)`,
                            `${manualPayrollData.daysWorked} days @ Rs${appliedRate.toFixed(2)}`,
                            `Rs ${totalCost.toFixed(2)}`
                        ]
                    ],
                    theme: 'grid',
                    headStyles: { fillColor: [15, 23, 42] },
                });
                
                autoTable(clientDoc, {
                    startY: (clientDoc as any).lastAutoTable.finalY + 10,
                    head: [['Billing Summary', 'Amount']],
                    body: [
                        ['Gross Service Value', `Rs ${totalCost.toFixed(2)}`],
                        ['Less: Initial Deposit', `- Rs ${deposit.toFixed(2)}`],
                        [`Net Payable Amount`, `Rs ${netBalance.toFixed(2)}`]
                    ],
                    theme: 'plain',
                    styles: { fontSize: 11 },
                    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
                });
                clientDoc.save(`Invoice_${worker.assigned_client?.replace(/\s+/g, '_') || 'Client'}_${manualPayrollData.serviceMonth.replace(/\s+/g, '_')}.pdf`);
            }

            toast.success("Manual payslip generated and downloaded successfully");
            fetchData();
            setIsManualPayrollModalOpen(false);
            setManualPayrollData({ 
                worker_id: '', 
                daysWorked: 0, 
                shiftHoursOverride: 0, 
                serviceMonth: format(new Date(), 'MMMM yyyy'),
                advanceAmount: 0,
                type: 'both'
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
                        <div className="flex flex-col flex-1 relative">
                            {workers.filter((w: any) => w.status === 'assigned' || w.status === 'Active').length === 0 && (
                                <div className="m-6 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 bg-white text-slate-400 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900">No Active Workers</h3>
                                    <p className="text-sm text-slate-500 mt-1 max-w-sm">There are no active workers in your directory to mark attendance for.</p>
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto bg-white flex flex-col h-[calc(100vh-280px)] border-t border-slate-200">
                                {/* Minimalist Stats Header */}
                                {(() => {
                                    const activeWorkersList = workers.filter((w: any) => w.status === 'assigned' || w.status === 'Active');
                                    const total = activeWorkersList.length;
                                    const present = activeWorkersList.filter(w => ['Present', 'Completed', 'On Duty'].includes(attendanceLogs.find(l => l.worker_id === w.id)?.status || '')).length;
                                    const absentLeave = activeWorkersList.filter(w => ['Absent', 'Paid Leave', 'Unpaid Leave', 'Half Day', 'Weekly Off'].includes(attendanceLogs.find(l => l.worker_id === w.id)?.status || '')).length;
                                    const pending = total - present - absentLeave;

                                    return (
                                        <div className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between text-sm sticky top-0 z-20">
                                            <div className="flex items-center gap-6 text-slate-600 font-semibold">
                                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Total: {total}</span>
                                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Present: {present}</span>
                                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Leaves/Absent: {absentLeave}</span>
                                            </div>
                                            {pending > 0 && (
                                                <div className="flex items-center gap-4">
                                                    <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md border border-amber-100">{pending} Pending</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Minimalist Linear-style List */}
                                <div className="flex flex-col divide-y divide-slate-100 pb-10">
                                    {workers.filter((w: any) => w.status === 'assigned' || w.status === 'Active').map((worker: any) => {
                                        const logForDay = attendanceLogs.find(l => l.worker_id === worker.id);
                                        const currentStatus = logForDay ? logForDay.status : 'Pending';

                                        return (
                                            <div key={worker.id} className={`flex items-center justify-between px-6 py-4 transition-colors group ${currentStatus === 'Pending' ? 'bg-white hover:bg-primary/5' : 'bg-slate-50/30 hover:bg-slate-50'}`}>
                                                {/* Meta Info */}
                                                <div className="flex items-center gap-4 min-w-[300px]">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${currentStatus === 'Pending' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-400 border-slate-200'}`}>
                                                        {worker.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className={`font-semibold ${currentStatus === 'Pending' ? 'text-slate-900' : 'text-slate-600'}`}>{worker.name}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 font-medium">{worker.role} • <span className="text-slate-400">{worker.assigned_client || 'No Active Client'}</span></div>
                                                    </div>
                                                </div>

                                                {/* Logs */}
                                                <div className="flex-1 px-4 hidden md:block text-slate-500 justify-center">
                                                    {logForDay?.check_in_time ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm"><Clock className="w-3.5 h-3.5 text-slate-400"/> {new Date(logForDay.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    ) : <span className="text-slate-300 font-bold">—</span>}
                                                </div>

                                                {/* Status & Actions */}
                                                <div className="flex justify-end min-w-[280px]">
                                                    {currentStatus === 'Pending' ? (
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => handleInlineAttendanceMark(worker.id, 'Present')}
                                                                disabled={inlineMarkingId === worker.id}
                                                                className="px-4 py-2 bg-slate-100 hover:bg-[#E6F7F7] hover:text-[#1AA6A8] hover:border-[#1AA6A8]/20 border border-transparent text-slate-700 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5"
                                                            >
                                                                {inlineMarkingId === worker.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} Present
                                                            </button>
                                                            <button 
                                                                onClick={() => handleInlineAttendanceMark(worker.id, 'Absent')}
                                                                disabled={inlineMarkingId === worker.id}
                                                                className="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-transparent text-slate-700 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5"
                                                            >
                                                                <X className="w-4 h-4"/> Absent
                                                            </button>
                                                            <select 
                                                                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg outline-none cursor-pointer shadow-sm transition-all focus:ring-2 focus:ring-[#1AA6A8] appearance-none text-center"
                                                                onChange={(e) => handleInlineAttendanceMark(worker.id, e.target.value)}
                                                                value=""
                                                                disabled={inlineMarkingId === worker.id}
                                                                title="Other Statuses"
                                                            >
                                                                <option value="" disabled>Other...</option>
                                                                <option value="Half Day">Half Day</option>
                                                                <option value="Paid Leave">Paid Leave</option>
                                                                <option value="Unpaid Leave">Unpaid Leave</option>
                                                                <option value="Weekly Off">Weekly Off</option>
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            {currentStatus === 'Present' || currentStatus === 'Completed' || currentStatus === 'On Duty' ? (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E6F7F7] text-[#1AA6A8] border border-[#1AA6A8]/20 rounded-md text-sm font-bold shadow-sm"><CheckCircle2 className="w-4 h-4"/> Present</span>
                                                            ) : currentStatus === 'Absent' ? (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-sm font-bold shadow-sm"><X className="w-4 h-4"/> Absent</span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm font-bold shadow-sm"><Clock className="w-4 h-4"/> {currentStatus}</span>
                                                            )}
                                                            <button 
                                                                onClick={() => handleInlineAttendanceMark(worker.id, 'Pending')}
                                                                disabled={inlineMarkingId === worker.id}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all shadow-sm"
                                                                title="Undo"
                                                            >
                                                                <RefreshCw className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
                                        <Send className="w-4 h-4" />
                                        Generate & Dispatch All
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                        {/* Client Invoices Section */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-primary/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building className="w-5 h-5 text-primary" />
                                    <h3 className="font-bold text-slate-900">Client Monthly Invoices</h3>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Receivables</span>
                            </div>
                            <div className="flex-1 overflow-auto divide-y divide-slate-100">
                                {isLoading ? (
                                     <div className="flex flex-col items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : (
                                    payrollItems.filter(item => item.payroll_type === 'invoice' || item.payroll_type === 'both' || !item.payroll_type).map((item) => (
                                        <div key={`client-${item.id}`} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-slate-900">{item.client_name}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">Service: {item.worker} ({item.days_worked} days)</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-slate-900">₹{(item.days_worked * item.daily_rate).toFixed(2)}</p>
                                                    <p className="text-[10px] text-slate-400">Total Service Cost</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 relative group/invoice bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                               <div>
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Deposit Adjustment</p>
                                                  <p className="text-xs font-medium text-slate-600">- ₹{item.deposit_received}</p>
                                               </div>
                                               <div className="text-right relative z-10 transition-opacity group-hover/invoice:opacity-0">
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Net {item.net_balance >= 0 ? 'To Pay' : 'Refund'}</p>
                                                  <p className={`text-sm font-bold ${item.net_balance >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                                                     ₹{Math.abs(item.net_balance).toFixed(2)}
                                                  </p>
                                               </div>
                                               <button 
                                                   onClick={() => { 
                                                       setPreviewInvoiceItem(item); 
                                                       setInvoiceExtras({ discount: 0, additionalCharge: 0, advanceAmount: 0, chargeDesc: 'Extra Services' }); 
                                                       setIsInvoicePreviewModalOpen(true); 
                                                   }} 
                                                   className="absolute inset-0 z-20 bg-primary text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover/invoice:opacity-100 transition-opacity rounded-lg gap-2 cursor-pointer shadow-sm"
                                               >
                                                   <FileText className="w-4 h-4" /> Review & Generate Invoice
                                               </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

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
                                    payrollItems.filter(item => item.payroll_type === 'payslip' || item.payroll_type === 'both' || !item.payroll_type).map((item) => (
                                        <div key={`worker-${item.id}`} className="p-4 hover:bg-slate-50 transition-colors group">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-[#EAFBFB] text-[#1AA6A8] flex items-center justify-center font-bold text-sm shadow-sm">
                                                        {item.worker.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-900">{item.worker}</p>
                                                            {item.status === 'Paid' && <span className="text-[9px] font-bold bg-[#EAFBFB] text-[#1AA6A8] px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Paid</span>}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 font-medium">{item.days_worked} days @ ₹{item.daily_rate}/d • {item.month}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-[#1AA6A8]">₹{(item.days_worked * item.daily_rate).toFixed(2)}</p>
                                                        <button onClick={() => { setEditingPayroll({ ...item }); setIsEditPayrollModalOpen(true); }} className="text-[10px] font-bold text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                                                           Adjust
                                                        </button>
                                                    </div>
                                                    {item.status !== 'Paid' ? (
                                                        <button 
                                                            onClick={async () => {
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('payroll')
                                                                        .update({ status: 'Paid', paid_at: new Date().toISOString() })
                                                                        .eq('id', item.id);
                                                                    
                                                                    if (error) throw error;
                                                                    toast.success(`Salary marked as paid for ${item.worker}`);
                                                                    fetchData(); // Refresh list
                                                                } catch (err) {
                                                                    toast.error("Failed to mark salary as paid");
                                                                    // Fallback for demo
                                                                    item.status = 'Paid';
                                                                    toast.success("Demo: Salary marked as paid!");
                                                                }
                                                            }}
                                                            className="p-2 rounded-lg bg-[#1AA6A8] text-white hover:bg-[#1AA6A8] transition-all shadow-sm active:scale-95"
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
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

            {/* Invoice Preview Modal */}
            {isInvoicePreviewModalOpen && previewInvoiceItem && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Invoice Preview: {previewInvoiceItem.client_name || 'Client'}</h2>
                                <p className="text-sm text-slate-500 mt-1">Review and modify invoice details before generating PDF.</p>
                            </div>
                            <button onClick={() => setIsInvoicePreviewModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 bg-white shadow-sm border border-slate-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                            <div className="bg-white border text-sm border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg">99Care AI</h3>
                                        <p className="text-slate-500">Invoice #INV-{Math.floor(Math.random()*10000)}</p>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="font-bold text-primary text-lg mb-1">Tax Invoice</h3>
                                        <p className="text-slate-500">Bill To: <span className="font-medium text-slate-800">{previewInvoiceItem.client_name}</span></p>
                                    </div>
                                </div>
                                <table className="w-full text-left mb-6">
                                    <thead className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="pb-2 font-semibold">Service</th>
                                            <th className="pb-2 font-semibold text-center">Days</th>
                                            <th className="pb-2 font-semibold text-right">Rate</th>
                                            <th className="pb-2 font-semibold text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-3 font-medium text-slate-900">{previewInvoiceItem.worker}</td>
                                            <td className="py-3 text-center text-slate-600">{previewInvoiceItem.days_worked}</td>
                                            <td className="py-3 text-right text-slate-600">₹{previewInvoiceItem.daily_rate}</td>
                                            <td className="py-3 text-right font-bold text-slate-900">₹{(previewInvoiceItem.days_worked * previewInvoiceItem.daily_rate).toFixed(2)}</td>
                                        </tr>
                                        {Number(invoiceExtras.additionalCharge) > 0 && (
                                            <tr>
                                                <td className="py-3 font-medium text-slate-900">{invoiceExtras.chargeDesc}</td>
                                                <td className="py-3 text-center">-</td>
                                                <td className="py-3 text-right">-</td>
                                                <td className="py-3 text-right font-bold text-slate-900">₹{Number(invoiceExtras.additionalCharge).toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {Number(invoiceExtras.discount) > 0 && (
                                            <tr>
                                                <td className="py-3 font-medium text-[#1AA6A8]">Discount Applied</td>
                                                <td className="py-3 text-center">-</td>
                                                <td className="py-3 text-right">-</td>
                                                <td className="py-3 text-right font-bold text-[#1AA6A8]">- ₹{Number(invoiceExtras.discount).toFixed(2)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-lg">
                                    <span className="font-bold text-slate-600">Final Total Due:</span>
                                    <span className="font-black text-primary tracking-tight">
                                        ₹{((previewInvoiceItem.days_worked * previewInvoiceItem.daily_rate) + Number(invoiceExtras.additionalCharge) - Number(invoiceExtras.discount) - Number(invoiceExtras.advanceAmount)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-slate-700 mb-3 ml-1 text-sm uppercase tracking-wider">Add Custom Line Items</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Additional Charge (₹)</label>
                                    <input type="number" min="0" value={invoiceExtras.additionalCharge || ''} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, additionalCharge: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="e.g. 500" />
                                </div>
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Charge Description</label>
                                    <input type="text" value={invoiceExtras.chargeDesc} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, chargeDesc: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="Platform fee, overtimes..." />
                                </div>
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Discount Amount (₹)</label>
                                    <input type="number" min="0" value={invoiceExtras.discount || ''} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, discount: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="e.g. 1000" />
                                </div>
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-[#1AA6A8] ml-1">Advanced Paid (₹)</label>
                                    <input type="number" min="0" value={invoiceExtras.advanceAmount || ''} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, advanceAmount: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-[#1AA6A8]/30 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#1AA6A8]/20 focus:border-[#1AA6A8] outline-none transition-shadow shadow-sm" placeholder="Advance subtracted from final pay" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-4 bg-white relative z-20">
                            <button onClick={() => setIsInvoicePreviewModalOpen(false)} className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDownloadSingleInvoice} className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <FileText className="w-5 h-5" />
                                Download Custom PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Total Days Worked</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={manualPayrollData.daysWorked || ''}
                                    onChange={e => setManualPayrollData({...manualPayrollData, daysWorked: parseFloat(e.target.value) || 0})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    placeholder="e.g. 21.5"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Service Month</label>
                                    <input
                                        type="text"
                                        value={manualPayrollData.serviceMonth}
                                        onChange={e => setManualPayrollData({...manualPayrollData, serviceMonth: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="e.g. April 2026"
                                        required
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
                                    <p className="text-[9px] text-slate-400 mt-1 italic">This will be subtracted from worker salary.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Type</label>
                                <select
                                    value={manualPayrollData.type}
                                    onChange={e => setManualPayrollData({...manualPayrollData, type: e.target.value as any})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-primary font-bold bg-slate-50 border-primary/20"
                                >
                                    <option value="both">Both (Client Invoice & Worker Payslip)</option>
                                    <option value="invoice">Only Client Invoice (Receivable)</option>
                                    <option value="payslip">Only Worker Salary (Payable)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Determines which list this appears in.
                                </p>
                            </div>

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

                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button onClick={() => setIsManualPayrollModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleManualPayrollGenerate} disabled={isGenerating || !manualPayrollData.worker_id || manualPayrollData.daysWorked <= 0} className="flex-1 px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
        </div>
    );
}
