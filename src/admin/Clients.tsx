import { useState, useEffect } from 'react';
import { Search, Star, Edit2, Users, Building, MessageSquare, X, Phone, Wallet, History as HistoryIcon, RotateCcw, ChevronLeft, ChevronRight, UserMinus, Calendar, Plus, Trash2, ArchiveRestore, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ClientDetailsModal from './components/ClientDetailsModal';
import { restartClientService } from '../services/serviceLifecycle';

const GOOGLE_PLACE_ID = 'ChIJnbC9IuxN4DsRXEWEnUc0HF8';
const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;
const GOOGLE_MAPS_URL = `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`;

export default function Clients() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<any[]>([]);

    const [workflows, setWorkflows] = useState({
        reviewCollection: true,
    });

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [inspectingClient, setInspectingClient] = useState<any>(null);

    // Search and View All filters
    const [searchQuery, setSearchQuery] = useState('');
    const [viewAllMonths, setViewAllMonths] = useState(true);

    // Monthly slider state
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Restart Service modal state
    const [restartModal, setRestartModal] = useState<any>(null);
    const [restartServiceType, setRestartServiceType] = useState('Old Age Care');
    const [restartShiftHours, setRestartShiftHours] = useState(10);
    const [restartStartDate, setRestartStartDate] = useState('');
    const [restartEndDate, setRestartEndDate] = useState('');
    const [restartIsOngoing, setRestartIsOngoing] = useState(true);
    const [restartCompleteRate, setRestartCompleteRate] = useState<number | ''>(800);
    const [restartIncompleteRate, setRestartIncompleteRate] = useState<number | ''>(1500);
    const [restartDepositAmount, setRestartDepositAmount] = useState<number | ''>(5000);
    const [restartDepositStatus, setRestartDepositStatus] = useState<'collected' | 'pending'>('collected');
    const [restartDepositMethod, setRestartDepositMethod] = useState('UPI');
    const [restartWorkers, setRestartWorkers] = useState<any[]>([]);
    const [restartWorkerSearch, setRestartWorkerSearch] = useState('');
    const [restartSelectedWorker, setRestartSelectedWorker] = useState<any>(null);
    const [restartWorkerPayout, setRestartWorkerPayout] = useState<number | ''>('');
    const [restartNotes, setRestartNotes] = useState('');
    const [isRestartSubmitting, setIsRestartSubmitting] = useState(false);
    // Track which clients have had review sent this session
    const [reviewSentIds, setReviewSentIds] = useState<Set<string>>(new Set());
    const [googleReviews, setGoogleReviews] = useState<any>(null);
    const [isLoadingGoogleReviews, setIsLoadingGoogleReviews] = useState(false);

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const monthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const prevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const nextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const now = new Date();
        const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const next = new Date(y, m, 1);
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        if (nextKey <= nowKey) setSelectedMonth(nextKey);
    };

    const isClientInMonth = (client: any, ym: string) => {
        // 1. Client registered / joined in this month (UTC or local)
        if (client.created_at) {
            const utcKey = client.created_at.slice(0, 7);
            if (utcKey === ym) return true;
        }

        // 2. Client started a service in this specific month
        if (client.services && client.services.length > 0) {
            for (const s of client.services) {
                const sStart = s.start_date ? s.start_date.slice(0, 7) : '';
                if (sStart === ym) return true;
            }
        }

        return false;
    };

    // Remove from pipeline confirmation state
    const [removeConfirmClient, setRemoveConfirmClient] = useState<any>(null);
    const [deleteConfirmClient, setDeleteConfirmClient] = useState<any>(null);
    const [viewingTrash, setViewingTrash] = useState(false);

    const handleRemoveFromPipeline = async (client: any) => {
        const isArchived = client.status === 'Archived';

        if (isArchived) {
            // Add back to pipeline — move to Closed Won
            try {
                await supabase.from('crm_leads').update({ pipeline_stage: 'Closed Won' }).eq('id', client.id);
                setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Closed Won' } : c));
                toast.success(`${client.name} added back to pipeline as Closed Won.`);
            } catch (err: any) {
                toast.error(`Failed: ${err.message}`);
            }
            return;
        }

        // Show inline confirmation modal
        setRemoveConfirmClient(client);
    };

    const confirmRemoveFromPipeline = async () => {
        if (!removeConfirmClient) return;
        const client = removeConfirmClient;
        setRemoveConfirmClient(null);
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Archived' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Archived' } : c));
            toast.success(`${client.name} removed from pipeline. Still visible in Client Master.`);
        } catch (err: any) {
            toast.error(`Failed: ${err.message}`);
        }
    };

    const confirmTemporaryDelete = async () => {
        if (!deleteConfirmClient) return;
        const client = deleteConfirmClient;
        setDeleteConfirmClient(null);
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Trash' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Trash' } : c));
            toast.success(`${client.name} moved to trash.`);
        } catch (err: any) {
            toast.error(`Failed to move to trash: ${err.message}`);
        }
    };
    
    const handleRestoreClient = async (client: any) => {
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Archived' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Archived' } : c));
            toast.success(`${client.name} restored from trash.`);
        } catch (err: any) {
            toast.error(`Failed to restore: ${err.message}`);
        }
    };

    const confirmDeleteClient = async () => {
        if (!deleteConfirmClient) return;
        const client = deleteConfirmClient;
        setDeleteConfirmClient(null);
        try {
            // First attempt to delete from crm_leads in case it's a foreign key parent
            await supabase.from('crm_leads').delete().eq('id', client.id);
            // Then delete from clients table
            const { error } = await supabase.from('clients').delete().eq('id', client.id);
            if (error) throw error;
            
            setClients(prev => prev.filter(c => c.id !== client.id));
            toast.success(`${client.name} permanently deleted from master database.`);
        } catch (err: any) {
            toast.error(`Failed to delete: ${err.message}`);
        }
    };

    const openRestartModal = async (client: any) => {
        setRestartModal(client);

        // Extract previous service configuration if available
        const services = client.services || [];
        const lastService = services.length > 0 ? services[services.length - 1] : null;

        let leadInterest = '';
        let leadQuotedRate = 0;
        try {
            const { data: leadData } = await supabase
                .from('crm_leads')
                .select('service_interest, quoted_monthly_rate')
                .eq('id', client.id)
                .maybeSingle();
            if (leadData) {
                leadInterest = leadData.service_interest || '';
                leadQuotedRate = leadData.quoted_monthly_rate || 0;
            }
        } catch {}

        const initialService = lastService?.service_type || leadInterest || 'Old Age Care';
        const initialHours = lastService?.hours_per_day || 10;
        const initialComplete = lastService?.complete_month_daily_rate || (leadQuotedRate ? Math.round(leadQuotedRate / 30) : 800);
        const initialIncomplete = lastService?.incomplete_month_daily_rate || 1500;
        const todayStr = new Date().toISOString().split('T')[0];

        setRestartServiceType(initialService);
        setRestartShiftHours(initialHours);
        setRestartStartDate(todayStr);
        setRestartEndDate('');
        setRestartIsOngoing(true);
        setRestartCompleteRate(initialComplete);
        setRestartIncompleteRate(initialIncomplete);
        setRestartDepositAmount(5000);
        setRestartDepositStatus('collected');
        setRestartDepositMethod('UPI');
        setRestartWorkerSearch('');
        setRestartSelectedWorker(null);
        setRestartWorkerPayout('');
        setRestartNotes('');

        // Fetch workers (available first, then all active)
        const { data } = await supabase
            .from('employees')
            .select('id, full_name, job_title, status, photo_url')
            .order('full_name');
        setRestartWorkers(data || []);
    };

    const handleRestartService = async () => {
        if (!restartStartDate) return toast.error('Please select a service start date.');
        if (!restartServiceType.trim()) return toast.error('Please specify the service name.');
        if (!restartCompleteRate || Number(restartCompleteRate) <= 0) return toast.error('Please enter a valid complete month daily rate.');
        if (!restartIncompleteRate || Number(restartIncompleteRate) <= 0) return toast.error('Please enter a valid incomplete month daily rate.');
        if (!restartSelectedWorker) return toast.error('Please select a staff member to assign.');

        setIsRestartSubmitting(true);
        try {
            const result = await restartClientService({
                clientId: restartModal.id,
                clientName: restartModal.name,
                serviceType: restartServiceType.trim(),
                hoursPerDay: Number(restartShiftHours) || 10,
                startDate: restartStartDate,
                endDate: restartIsOngoing ? null : (restartEndDate || null),
                completeMonthDailyRate: Number(restartCompleteRate),
                incompleteMonthDailyRate: Number(restartIncompleteRate),
                depositAmount: Number(restartDepositAmount) || 0,
                depositStatus: restartDepositStatus,
                depositPaymentMethod: restartDepositMethod,
                workerId: restartSelectedWorker.id,
                workerPayoutRate: restartWorkerPayout ? Number(restartWorkerPayout) : undefined,
                notes: restartNotes.trim() || undefined,
            });

            if (!result.success) throw new Error(result.error);

            toast.success(`Service restarted for ${restartModal.name}! 🎉 Moved back to Active Client.`);
            setRestartModal(null);
            fetchClients();
        } catch (err: any) {
            console.error('Failed to restart service:', err);
            toast.error(`Failed to restart service: ${err.message || 'Unknown error'}`);
        } finally {
            setIsRestartSubmitting(false);
        }
    };

    const openEditModal = (client: any) => {
        setEditingClient({ ...client });
        setIsEditModalOpen(true);
    };

    const handleRequestReview = async (client: any) => {
        if (!client.phone) {
            toast.error("No phone number found for this client. Please update the profile.");
            return;
        }

        const toastId = toast.loading(`Sending WhatsApp Review request to ${client.name}...`);
        
        try {
            // Standardize phone
            let phoneDigits = client.phone.replace(/\D/g, '');
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;

            const firstName = client.name.split(' ')[0] || 'there';

            const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                body: {
                    phone: phoneDigits,
                    useTemplate: true,
                    templateName: 'client_review_request',
                    templateParams: [firstName]
                }
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data.error || "Meta API error");

            toast.success('Review request sent successfully! ✅', { id: toastId });
            setReviewSentIds(prev => new Set(prev).add(client.id));
        } catch (err: any) {
            console.error('WhatsApp Review fail:', err);
            toast.error(`WhatsApp failed: ${err.message || 'Check connection'}`, { id: toastId });
        }
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Update Client (including phone)
            const { error: clientError } = await supabase
                .from('clients')
                .update({ 
                    client_name: editingClient.name,
                    phone_number: editingClient.phone,
                    email: editingClient.email
                })
                .eq('id', editingClient.id);

            if (clientError) throw clientError;

            // 2. Sync with Employees (As requested: Employee gets rating from Client's company service review)
            const { error: workerError } = await supabase
                .from('employees')
                .update({ rating: editingClient.service_rating })
                .eq('assigned_client', editingClient.name);

            if (workerError) throw workerError;

            setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c));
            setIsEditModalOpen(false);
            toast.success(`${editingClient.name} updated. Worker ratings synchronized!`);
            fetchClients();
        } catch (err: any) {
            console.error('Error syncing ratings:', err);
            toast.error(`Failed to save: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchClients = async () => {
        try {
            // 1. Fetch leads in client stages WITH their pipeline_stage
            // Also include leads with null pipeline_stage (removed from pipeline but still clients)
            const [activeLeadsResult, archivedLeadsResult, trashLeadsResult] = await Promise.all([
                supabase.from('crm_leads').select('id, pipeline_stage')
                    .in('pipeline_stage', ['Active Client', 'Monthly Billing', 'Closed Won']),
                supabase.from('crm_leads').select('id, pipeline_stage')
                    .eq('pipeline_stage', 'Archived'),
                supabase.from('crm_leads').select('id, pipeline_stage')
                    .eq('pipeline_stage', 'Trash')
            ]);

            if (activeLeadsResult.error) throw activeLeadsResult.error;

            const allLeads = [...(activeLeadsResult.data || []), ...(archivedLeadsResult.data || []), ...(trashLeadsResult.data || [])];
            const clientIds = allLeads.map(l => l.id);
            // Build a map of lead_id -> pipeline_stage for status badge
            const stageMap: Record<string, string> = {};
            allLeads.forEach(l => { stageMap[l.id] = l.pipeline_stage || 'Archived'; });

            // 2. Fetch records from the clients table
            const { data: allClientsRes, error: clientError } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (clientError) throw clientError;
            const clientData = allClientsRes || [];

            // 3. Fetch worker_assignments with employee status & dates
            const { data: allAssignmentsData, error: assignAllError } = await supabase
                .from('worker_assignments')
                .select('client_id, assignment_status, employee_id, deposit_amount, deposit_paid, start_date, end_date, employees(status)');

            if (assignAllError) throw assignAllError;

            // 4. Fetch payment data for deposit fallback & all services for monthly activity
            const [{ data: depositPaymentsData, error: paymentsError }, { data: allServicesData }] = await Promise.all([
                supabase
                    .from('payments')
                    .select('client_name, amount, payment_type')
                    .eq('payment_type', 'deposit'),
                supabase
                    .from('services')
                    .select('client_id, start_date, end_date, status')
            ]);

            if (paymentsError) throw paymentsError;

            const assignments = allAssignmentsData || [];
            const depositPayments = depositPaymentsData || [];
            const services = allServicesData || [];

            // Build workerMap keyed by client_id from worker_assignments (reliable source of truth)
            const workerMap: Record<string, { workerCount: number, activeWorkerCount: number }> = {};
            assignments.forEach((a: any) => {
                if (!a.client_id) return;
                if (!workerMap[a.client_id]) {
                    workerMap[a.client_id] = { workerCount: 0, activeWorkerCount: 0 };
                }
                workerMap[a.client_id].workerCount++;
                // Count as active if assignment is active AND employee is still assigned/active
                const empStatus = a.employees?.status;
                if (a.assignment_status === 'active' && (empStatus === 'assigned' || empStatus === 'Active' || empStatus === 'available')) {
                    workerMap[a.client_id].activeWorkerCount++;
                }
            });

            const normalizeClientName = (name?: string | null) => (name || '').trim().toLowerCase();

            // Map deposits by client ID. Prefer money actually marked as paid, then fall
            // back to the requested deposit amount for older assignment records.
            const paidDepositByClientId: Record<string, number> = {};
            const requestedDepositByClientId: Record<string, number> = {};
            assignments.forEach(a => {
                paidDepositByClientId[a.client_id] = (paidDepositByClientId[a.client_id] || 0) + (Number(a.deposit_paid) || 0);
                requestedDepositByClientId[a.client_id] = (requestedDepositByClientId[a.client_id] || 0) + (Number(a.deposit_amount) || 0);
            });

            // Collection history stores client_name rather than client_id, so keep it as
            // a fallback for deposits recorded before deposit_paid was backfilled.
            const paidDepositByClientName: Record<string, number> = {};
            depositPayments.forEach(p => {
                const clientName = normalizeClientName(p.client_name);
                if (!clientName) return;
                paidDepositByClientName[clientName] = (paidDepositByClientName[clientName] || 0) + (Number(p.amount) || 0);
            });

            // 5. Map database clients to UI structure
            const enrichedClients = (clientData || []).map(c => ({
                id: c.id,
                name: c.client_name,
                phone: c.phone_number,
                email: c.email || '-',
                contact: c.client_name,
                status: stageMap[c.id] || 'Active',
                workerCount: workerMap[c.id]?.workerCount || 0,
                activeWorkerCount: workerMap[c.id]?.activeWorkerCount || 0,
                lifetimeValue: '₹0',
                securityDeposit: paidDepositByClientId[c.id]
                    || paidDepositByClientName[normalizeClientName(c.client_name)]
                    || requestedDepositByClientId[c.id]
                    || 0,
                created_at: c.created_at,
                services: services.filter(s => s.client_id === c.id),
                assignments: assignments.filter(a => a.client_id === c.id),
            }));

            setClients(enrichedClients);
        } catch (error) {
            console.error('Error fetching client data:', error);
            toast.error('Failed to load dynamic client data');
        }
    };

    const fetchGoogleReviews = async () => {
        setIsLoadingGoogleReviews(true);
        try {
            const { data, error } = await supabase.functions.invoke('get-google-reviews');
            if (error) throw error;
            setGoogleReviews(data);
        } catch (error) {
            console.warn('Google reviews unavailable:', error);
            setGoogleReviews({ success: false, error: 'Unable to load Google reviews.' });
        } finally {
            setIsLoadingGoogleReviews(false);
        }
    };

    useEffect(() => {
        fetchClients();
        fetchGoogleReviews();
    }, []);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Client Master Database</h1>
                    <p className="text-slate-500 mt-1">Manage permanent clients, lifetime value, and automated review collection.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/billing?tab=history')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                    <HistoryIcon className="w-4 h-4 text-primary" />
                    View Global Payment history
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 flex-1">
                {/* Client List */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search clients by name, phone..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        {/* View Controls: All Clients vs By Month toggle + ALWAYS-VISIBLE Month Navigator + Trash */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                                onClick={() => setViewingTrash(!viewingTrash)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                                    viewingTrash 
                                        ? 'bg-red-50 text-red-600 border-red-200 font-bold' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {viewingTrash ? 'Exit Trash' : 'View Trash'}
                            </button>

                            {/* All vs By Month segmented tabs */}
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                                <button
                                    onClick={() => setViewAllMonths(true)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                        viewAllMonths
                                            ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                                >
                                    All Clients ({clients.filter(c => c.status !== 'Trash').length})
                                </button>
                                {(() => {
                                    const mCount = clients.filter(c => c.status !== 'Trash' && isClientInMonth(c, selectedMonth)).length;
                                    return (
                                        <button
                                            onClick={() => setViewAllMonths(false)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                !viewAllMonths
                                                    ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                            }`}
                                        >
                                            By Month ({mCount})
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Month Navigator: ALWAYS VISIBLE */}
                            <div className={`flex items-center bg-white border rounded-lg overflow-hidden transition-all ${
                                !viewAllMonths 
                                    ? 'border-[#1AA6A8] ring-2 ring-[#1AA6A8]/20 shadow-xs' 
                                    : 'border-slate-200 opacity-80 hover:opacity-100'
                            }`}>
                                <button 
                                    onClick={() => {
                                        setViewAllMonths(false);
                                        prevMonth();
                                    }} 
                                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors font-bold text-sm"
                                    title="Previous Month"
                                >
                                    ‹
                                </button>
                                <span 
                                    onClick={() => setViewAllMonths(false)}
                                    className={`px-3 py-1.5 text-xs font-bold min-w-[125px] text-center border-x border-slate-200 select-none cursor-pointer transition-colors ${
                                        !viewAllMonths ? 'text-[#1AA6A8] bg-teal-50/50' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                    title="Click to view by this month"
                                >
                                    {monthLabel(selectedMonth)}
                                </span>
                                <button 
                                    onClick={() => {
                                        setViewAllMonths(false);
                                        nextMonth();
                                    }} 
                                    className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors font-bold text-sm disabled:opacity-30 disabled:hover:bg-transparent"
                                    disabled={selectedMonth === (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })()}
                                    title="Next Month"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {(() => {
                            const filtered = clients.filter(c => {
                                if (viewingTrash) {
                                    return c.status === 'Trash';
                                }
                                if (c.status === 'Trash') return false;

                                if (searchQuery.trim()) {
                                    const q = searchQuery.toLowerCase();
                                    const nameMatch = (c.name || '').toLowerCase().includes(q);
                                    const phoneMatch = (c.phone || '').toLowerCase().includes(q);
                                    const emailMatch = (c.email || '').toLowerCase().includes(q);
                                    if (!nameMatch && !phoneMatch && !emailMatch) return false;
                                }

                                if (viewAllMonths) return true;

                                return isClientInMonth(c, selectedMonth);
                            });
                            if (filtered.length === 0) return (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Calendar className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm font-semibold text-slate-600">
                                        {viewingTrash ? 'Trash is empty' : searchQuery ? 'No matching clients found' : `No clients joined in ${monthLabel(selectedMonth)}`}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                        {viewingTrash ? '' : searchQuery ? 'Try clearing your search query.' : `No new client registrations recorded in ${monthLabel(selectedMonth)}. You can view all clients or browse previous months.`}
                                    </p>
                                    {!viewAllMonths && !viewingTrash && (
                                        <div className="flex items-center gap-2 mt-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedMonth('2026-08');
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors shadow-2xs"
                                            >
                                                Browse August 2026 (4 clients)
                                            </button>
                                            <button
                                                onClick={() => setViewAllMonths(true)}
                                                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1AA6A8] hover:bg-[#15898A] rounded-lg transition-colors shadow-2xs"
                                            >
                                                View All Clients ({clients.filter(c => c.status !== 'Trash').length})
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                            return filtered.map(client => (
                            <div key={client.id} onClick={() => setInspectingClient(client)} className="p-4 rounded-lg border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all bg-white group cursor-pointer">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Building className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{client.name}</h3>
                                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5" /> {client.activeWorkerCount} Active / {client.workerCount} Total Workers
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        client.status === 'Closed Won' ? 'bg-emerald-100 text-emerald-700' :
                                        client.status === 'Monthly Billing' ? 'bg-blue-100 text-blue-700' :
                                        client.status === 'Active Client' ? 'bg-teal-100 text-teal-700' :
                                        client.status === 'Archived' ? 'bg-slate-100 text-slate-500' :
                                        client.status === 'Trash' ? 'bg-red-100 text-red-600' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                        {client.status === 'Closed Won' ? 'Closed' :
                                         client.status === 'Monthly Billing' ? 'Billing' :
                                         client.status === 'Active Client' ? 'Active' :
                                         client.status === 'Archived' ? 'Archived' :
                                         client.status === 'Trash' ? 'Trash' :
                                         client.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-slate-100">
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> Contact
                                        </p>
                                        <p className="text-sm font-bold text-slate-700 truncate">{client.phone || 'N/A'}</p>
                                    </div>
                                    <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-center">
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Wallet className="w-3 h-3" /> Security Deposit
                                        </p>
                                        <p className="text-sm font-bold text-emerald-700">₹{client.securityDeposit.toLocaleString()}</p>
                                    </div>
                                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-center gap-2 flex-wrap">
                                        {client.status === 'Trash' ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRestoreClient(client); }}
                                                    className="flex-1 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                >
                                                    <ArchiveRestore className="w-3.5 h-3.5" /> Restore Client
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmClient(client); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRequestReview(client); }}
                                                    className={`flex-1 min-w-[100px] px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                                        reviewSentIds.has(client.id)
                                                            ? 'text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200'
                                                            : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                    {reviewSentIds.has(client.id) ? 'Resend Review' : 'Review'}
                                                </button>
                                                {client.status === 'Closed Won' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openRestartModal(client); }}
                                                        className="flex-1 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" /> Restart Service
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveFromPipeline(client); }}
                                                    className={`p-2 rounded-xl transition-all border ${
                                                        client.status === 'Archived'
                                                            ? 'text-emerald-600 hover:bg-emerald-50 border-transparent hover:border-emerald-100'
                                                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-100'
                                                    }`}
                                                    title={client.status === 'Archived' ? 'Add back to pipeline' : 'Remove from pipeline'}
                                                >
                                                    {client.status === 'Archived'
                                                        ? <Plus className="w-4 h-4" />
                                                        : <UserMinus className="w-4 h-4" />
                                                    }
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/20"
                                                    title="Edit Profile"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmClient(client); }}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ));
                        })()}
                    </div>
                </div>

                {/* Automation Panel */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="font-bold text-slate-900">Client Automations</h2>
                            <p className="text-sm text-slate-500 mt-1">Post-conversion workflows.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className={`p-4 rounded-lg border transition-colors ${workflows.reviewCollection ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Star className={`w-5 h-5 ${workflows.reviewCollection ? 'text-amber-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.reviewCollection ? 'text-amber-700' : 'text-slate-600'}`}>Auto-Review Collection</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('reviewCollection')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.reviewCollection ? 'bg-amber-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.reviewCollection ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">Automatically sends a feedback request to clients 14 days after joining, requesting a review.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                Google Reviews
                            </h3>
                            <a href={googleReviews?.googleMapsUri || GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-primary hover:underline">
                                View All →
                            </a>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                    <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 text-sm">{googleReviews?.displayName || '99 Care'} — Google Reviews</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {isLoadingGoogleReviews ? (
                                            <span className="text-xs text-slate-500">Loading live reviews...</span>
                                        ) : googleReviews?.success ? (
                                            <>
                                                <span className="text-sm font-bold text-slate-900">{Number(googleReviews.rating || 0).toFixed(1)}</span>
                                                <span className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Star
                                                            key={star}
                                                            className={`w-3.5 h-3.5 ${star <= Math.round(googleReviews.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
                                                        />
                                                    ))}
                                                </span>
                                                <span className="text-xs text-slate-500">{googleReviews.userRatingCount || 0} reviews</span>
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-500">Connect Google API key to show live reviews</span>
                                        )}
                                    </div>
                                </div>
                                <a href={googleReviews?.googleMapsUri || GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                                    Open
                                </a>
                            </div>

                            {googleReviews?.success && googleReviews.reviews?.length > 0 ? (
                                <div className="space-y-3">
                                    {googleReviews.reviews.slice(0, 3).map((review: any, index: number) => (
                                        <div key={`${review.publishTime || index}-${review.name}`} className="p-4 bg-white rounded-xl border border-slate-200">
                                            <div className="flex items-start gap-3">
                                                {review.photoUri ? (
                                                    <img src={review.photoUri} alt={review.name} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                        {String(review.name || 'G').charAt(0)}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{review.name}</p>
                                                        <span className="text-[10px] text-slate-400 shrink-0">{review.relativePublishTimeDescription}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 mt-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`w-3 h-3 ${star <= Number(review.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                    {review.text && (
                                                        <p className="text-xs text-slate-600 leading-relaxed mt-2 line-clamp-3">"{review.text}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-400 text-center">
                                    {googleReviews?.error || 'Live Google reviews will appear here after the Google Places API key is configured.'}
                                </p>
                            )}
                        </div>
                        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-500">Tap "View All" to see all Google reviews</p>
                            <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Leave a Review
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Client Modal */}
            {isEditModalOpen && editingClient && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Building className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Edit Client Details</h2>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveClient} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingClient.name}
                                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Primary Contact Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingClient.contact}
                                    onChange={(e) => setEditingClient({ ...editingClient, contact: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={editingClient.email}
                                        onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                                    <select
                                        value={editingClient.status}
                                        onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between">
                                    <span>Service Quality Rating</span>
                                    <span className="text-primary font-bold">{editingClient.service_rating || 0} Stars</span>
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEditingClient({ ...editingClient, service_rating: star })}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                                (editingClient.service_rating || 0) >= star 
                                                ? 'bg-amber-100 text-amber-500 border-amber-200' 
                                                : 'bg-slate-50 text-slate-300 border-slate-100'
                                            } border hover:scale-110`}
                                        >
                                            <Star className={`w-5 h-5 ${(editingClient.service_rating || 0) >= star ? 'fill-current' : ''}`} />
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">Note: This rating will automatically apply to all workers currently assigned to this client.</p>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSubmitting && <Star className="w-4 h-4 animate-spin" />}
                                    Save & Sync Ratings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Comprehensive Restart Service Modal */}
            {restartModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shadow-xs">
                                    <RotateCcw className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Restart Service Onboarding</h2>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                                        <span className="font-bold text-slate-800">{restartModal.name}</span>
                                        {restartModal.phone && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{restartModal.phone}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setRestartModal(null)} 
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body: Scrollable */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                            {/* 1. Service Selection & Shift Duration */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <Clock className="w-4 h-4 text-teal-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Service &amp; Shift Configuration</h3>
                                </div>

                                {/* Preset Service Buttons */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Service Category</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {['Old Age Care', 'New Born Baby Care', 'Japa Maid / Mother Care', 'Patient Care', 'Nursing Services'].map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setRestartServiceType(cat)}
                                                className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all ${
                                                    restartServiceType === cat
                                                        ? 'bg-teal-500 text-white border-teal-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={restartServiceType}
                                        onChange={e => setRestartServiceType(e.target.value)}
                                        placeholder="Or type custom service name..."
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8]"
                                    />
                                </div>

                                {/* Shift Hours & Start Date */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Shift Duration</label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { h: 10, label: '10h Shift' },
                                                { h: 12, label: '12h Shift' },
                                                { h: 24, label: '24h Live-in' }
                                            ].map(s => (
                                                <button
                                                    key={s.h}
                                                    type="button"
                                                    onClick={() => setRestartShiftHours(s.h)}
                                                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                                                        restartShiftHours === s.h
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Start Date *</label>
                                        <input
                                            type="date"
                                            value={restartStartDate}
                                            onChange={e => setRestartStartDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8]"
                                        />
                                    </div>
                                </div>

                                {/* Duration: Ongoing vs Fixed End Date */}
                                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-700">Duration Format</label>
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-teal-600 hover:opacity-80">
                                            <input
                                                type="checkbox"
                                                checked={restartIsOngoing}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setRestartIsOngoing(checked);
                                                    if (checked) setRestartEndDate('');
                                                }}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                            />
                                            <span>Ongoing (No End Date)</span>
                                        </label>
                                    </div>

                                    {restartIsOngoing ? (
                                        <div 
                                            onClick={() => setRestartIsOngoing(false)}
                                            className="w-full px-3 py-2 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 text-teal-800 text-xs font-semibold flex items-center justify-between cursor-pointer hover:bg-teal-50 transition-colors"
                                            title="Click to specify a custom end date"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                                Active ongoing service with automatic monthly billing cycles
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-teal-200 px-2 py-0.5 rounded text-teal-700">
                                                Ongoing
                                            </span>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">Service End Date</label>
                                            <input
                                                type="date"
                                                value={restartEndDate}
                                                onChange={e => setRestartEndDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Service Quoting & Daily Rates */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <Wallet className="w-4 h-4 text-indigo-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Service Quoting &amp; Daily Rates</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-800">Complete Month Rate *</label>
                                            <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">≥ 30 Days</span>
                                        </div>
                                        <div className="relative mt-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartCompleteRate}
                                                onChange={e => setRestartCompleteRate(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 800"
                                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                            ≈ ₹{((Number(restartCompleteRate) || 0) * 30).toLocaleString('en-IN')}/month standard cycle
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-800">Partial Month Rate *</label>
                                            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">&lt; 30 Days</span>
                                        </div>
                                        <div className="relative mt-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartIncompleteRate}
                                                onChange={e => setRestartIncompleteRate(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 1500"
                                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                            Applied if care concludes before 30 days
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Security Deposit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">3. Security Deposit Collection</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Amount (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartDepositAmount}
                                                onChange={e => setRestartDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 5000"
                                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Status</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setRestartDepositStatus('collected')}
                                                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                                                    restartDepositStatus === 'collected'
                                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                Already Collected
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRestartDepositStatus('pending')}
                                                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                                                    restartDepositStatus === 'pending'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                Pending / Bill Later
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {restartDepositStatus === 'collected' && (
                                    <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-emerald-900 mb-1">Payment Method</label>
                                            <select
                                                value={restartDepositMethod}
                                                onChange={e => setRestartDepositMethod(e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold bg-white text-slate-800"
                                            >
                                                <option value="UPI">UPI / GPay / PhonePe</option>
                                                <option value="Cash">Cash</option>
                                                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                                                <option value="Cheque">Cheque</option>
                                            </select>
                                        </div>
                                        <div className="text-xs text-emerald-800 font-medium pt-4">
                                            ₹{(Number(restartDepositAmount) || 0).toLocaleString('en-IN')} will be recorded in deposit ledger
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Staff Member Assignment */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-purple-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">4. Assign Staff Member *</h3>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-500">
                                        {restartWorkers.filter(w => w.status === 'available').length} available in directory
                                    </span>
                                </div>

                                {/* Worker Search */}
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={restartWorkerSearch}
                                        onChange={e => setRestartWorkerSearch(e.target.value)}
                                        placeholder="Search available caregivers by name or role..."
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>

                                {/* Worker List */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {restartWorkers
                                        .filter(w => {
                                            if (!restartWorkerSearch.trim()) return true;
                                            const q = restartWorkerSearch.toLowerCase();
                                            return (w.full_name || '').toLowerCase().includes(q) || (w.job_title || '').toLowerCase().includes(q);
                                        })
                                        .map(w => {
                                            const isSelected = restartSelectedWorker?.id === w.id;
                                            const isAvail = w.status === 'available';
                                            return (
                                                <button
                                                    key={w.id}
                                                    type="button"
                                                    onClick={() => setRestartSelectedWorker(w)}
                                                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                                        isSelected
                                                            ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-600/20'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                                        isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {w.full_name?.charAt(0) || 'W'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-xs text-slate-900 truncate">{w.full_name}</p>
                                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] text-slate-500 truncate">{w.job_title || 'Caregiver'}</span>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                                                isAvail ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                {w.status || 'Active'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>

                                {restartSelectedWorker && (
                                    <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                                        <span className="font-medium text-purple-900">
                                            Assigned: <strong>{restartSelectedWorker.full_name}</strong> ({restartSelectedWorker.job_title})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 text-[11px]">Worker Payout (₹/day):</span>
                                            <input
                                                type="number"
                                                value={restartWorkerPayout}
                                                onChange={e => setRestartWorkerPayout(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 400"
                                                className="w-24 px-2 py-1 rounded border border-purple-200 text-xs font-bold bg-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 5. Additional Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Care Notes &amp; Special Instructions (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={restartNotes}
                                    onChange={e => setRestartNotes(e.target.value)}
                                    placeholder="Doctor guidelines, shift timings, patient conditions..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-500">
                                {restartSelectedWorker ? (
                                    <span>Caregiver: <strong className="text-slate-800">{restartSelectedWorker.full_name}</strong> • Rate: <strong className="text-slate-800">₹{restartCompleteRate}/day</strong></span>
                                ) : (
                                    <span className="text-amber-600 font-medium">⚠️ Please select a staff member to proceed</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setRestartModal(null)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestartService}
                                    disabled={isRestartSubmitting || !restartStartDate || !restartSelectedWorker || !restartServiceType}
                                    className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isRestartSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Confirm &amp; Restart Service
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Remove from Pipeline Confirmation Modal */}
            {removeConfirmClient && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                                <UserMinus className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Remove from Pipeline?</h2>
                                <p className="text-xs text-slate-500">{removeConfirmClient.name} will stay in Client Master Database</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-slate-600">This will remove <strong>{removeConfirmClient.name}</strong> from the CRM pipeline. Their record, billing history, and all data will remain in the Client Master Database.</p>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setRemoveConfirmClient(null)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                <button onClick={confirmRemoveFromPipeline} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Remove</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmClient && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Delete Permanently?</h2>
                                <p className="text-xs text-slate-500">{deleteConfirmClient.name} will be removed completely.</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-slate-600">This will permanently delete <strong>{deleteConfirmClient.name}</strong> from the entire database. This action cannot be undone.</p>
                            <div className="flex gap-3 pt-1 flex-col sm:flex-row">
                                <button onClick={() => setDeleteConfirmClient(null)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                {deleteConfirmClient.status !== 'Trash' && (
                                    <button onClick={confirmTemporaryDelete} className="flex-1 py-2.5 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shadow-sm">Move to Trash</button>
                                )}
                                <button onClick={confirmDeleteClient} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Delete Forever</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {inspectingClient && (
                <ClientDetailsModal 
                    client={inspectingClient} 
                    onClose={() => setInspectingClient(null)} 
                />
            )}
        </div>
    );
}
