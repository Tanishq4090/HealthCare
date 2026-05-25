import { useState, useEffect } from 'react';
import { Search, Star, Edit2, Users, Building, MessageSquare, X, Phone, Wallet, History as HistoryIcon, RotateCcw, ChevronLeft, ChevronRight, UserMinus, Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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

    // Monthly slider state
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Restart Service modal state
    const [restartModal, setRestartModal] = useState<any>(null);
    const [restartStartDate, setRestartStartDate] = useState('');
    const [restartEndDate, setRestartEndDate] = useState('');
    const [restartWorkers, setRestartWorkers] = useState<any[]>([]);
    const [restartSelectedWorker, setRestartSelectedWorker] = useState<any>(null);
    const [isRestartSubmitting, setIsRestartSubmitting] = useState(false);
    // Track which clients have had review sent this session
    const [reviewSentIds, setReviewSentIds] = useState<Set<string>>(new Set());

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const monthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const prevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 2);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const nextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const now = new Date();
        const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const next = new Date(y, m);
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        if (nextKey <= nowKey) setSelectedMonth(nextKey);
    };

    // Remove from pipeline confirmation state
    const [removeConfirmClient, setRemoveConfirmClient] = useState<any>(null);

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

    const openRestartModal = async (client: any) => {
        setRestartModal(client);
        setRestartStartDate('');
        setRestartEndDate('');
        setRestartSelectedWorker(null);
        // Fetch available workers
        const { data } = await supabase.from('employees').select('id, full_name, job_title, status').eq('status', 'available');
        setRestartWorkers(data || []);
    };

    const handleRestartService = async () => {
        if (!restartStartDate) return toast.error('Please select a start date.');
        if (!restartSelectedWorker) return toast.error('Please select a staff member.');
        setIsRestartSubmitting(true);
        try {
            // 1. Move lead back to Active Client
            await supabase.from('crm_leads').update({ pipeline_stage: 'Active Client' }).eq('id', restartModal.id);
            // 2. Create new worker assignment
            await supabase.from('worker_assignments').insert([{
                client_id: restartModal.id,
                employee_id: restartSelectedWorker.id,
                start_date: restartStartDate,
                end_date: restartEndDate || null,
                assignment_status: 'active',
                assigned_at: new Date().toISOString(),
            }]);
            // 3. Update worker status
            await supabase.from('employees').update({ status: 'assigned', assigned_client: restartModal.name }).eq('id', restartSelectedWorker.id);
            setClients(prev => prev.map(c => c.id === restartModal.id ? { ...c, status: 'Active Client' } : c));
            toast.success(`Service restarted for ${restartModal.name}! Moved to Active Client. ✅`);
            setRestartModal(null);
            fetchClients();
        } catch (err: any) {
            toast.error(`Failed to restart service: ${err.message}`);
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
            const [activeLeadsResult, archivedLeadsResult] = await Promise.all([
                supabase.from('crm_leads').select('id, pipeline_stage')
                    .in('pipeline_stage', ['Active Client', 'Monthly Billing', 'Closed Won']),
                supabase.from('crm_leads').select('id, pipeline_stage')
                    .eq('pipeline_stage', 'Archived')
            ]);

            if (activeLeadsResult.error) throw activeLeadsResult.error;

            const allLeads = [...(activeLeadsResult.data || []), ...(archivedLeadsResult.data || [])];
            const clientIds = allLeads.map(l => l.id);
            // Build a map of lead_id -> pipeline_stage for status badge
            const stageMap: Record<string, string> = {};
            allLeads.forEach(l => { stageMap[l.id] = l.pipeline_stage || 'Archived'; });

            // 2. Fetch records from the clients table for these lead IDs
            let clientData = [];
            if (clientIds.length > 0) {
                const { data, error } = await supabase
                    .from('clients')
                    .select('*')
                    .in('id', clientIds)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                clientData = data || [];
            }

            // 3. Fetch all employees to derive worker counts
            const { data: employeeData, error: empError } = await supabase
                .from('employees')
                .select('id, full_name, assigned_client, status');
            
            if (empError) throw empError;

            // 4. Fetch assignment/payment data to show the actual collected deposit.
            const [assignmentsResult, paymentsResult] = await Promise.all([
                supabase
                    .from('worker_assignments')
                    .select('client_id, deposit_amount, deposit_paid'),
                supabase
                    .from('payments')
                    .select('client_name, amount, payment_type')
                    .eq('payment_type', 'deposit'),
            ]);

            if (assignmentsResult.error) throw assignmentsResult.error;
            if (paymentsResult.error) throw paymentsResult.error;

            const assignments = assignmentsResult.data || [];
            const depositPayments = paymentsResult.data || [];

            // Group employees by client name
            const workerMap: Record<string, { workerCount: number, activeWorkerCount: number }> = {};
            (employeeData || []).forEach(w => {
                if (!w.assigned_client) return;
                
                if (!workerMap[w.assigned_client]) {
                    workerMap[w.assigned_client] = { workerCount: 0, activeWorkerCount: 0 };
                }
                
                workerMap[w.assigned_client].workerCount++;
                if (w.status === 'assigned' || w.status === 'Active') {
                    workerMap[w.assigned_client].activeWorkerCount++;
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
                workerCount: workerMap[c.client_name]?.workerCount || 0,
                activeWorkerCount: workerMap[c.client_name]?.activeWorkerCount || 0,
                lifetimeValue: '₹0',
                securityDeposit: paidDepositByClientId[c.id]
                    || paidDepositByClientName[normalizeClientName(c.client_name)]
                    || requestedDepositByClientId[c.id]
                    || 0,
                created_at: c.created_at,
            }));

            setClients(enrichedClients);
        } catch (error) {
            console.error('Error fetching client data:', error);
            toast.error('Failed to load dynamic client data');
        }
    };

    useEffect(() => {
        fetchClients();
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
                                placeholder="Search clients..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        {/* Month slider */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0">
                            <button onClick={prevMonth} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-sm">‹</button>
                            <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 min-w-[120px] text-center border-x border-slate-200">{monthLabel(selectedMonth)}</span>
                            <button onClick={nextMonth} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors font-bold text-sm disabled:opacity-30"
                                disabled={selectedMonth === (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })()}>›</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {(() => {
                            const filtered = clients.filter(c => {
                                if (!c.created_at) return true;
                                const d = new Date(c.created_at);
                                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                                return key === selectedMonth;
                            });
                            if (filtered.length === 0) return (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Calendar className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm font-semibold text-slate-500">No clients joined in {monthLabel(selectedMonth)}</p>
                                    <p className="text-xs text-slate-400 mt-1">Use the arrows to browse other months.</p>
                                </div>
                            );
                            return filtered.map(client => (
                            <div key={client.id} className="p-4 rounded-lg border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all bg-white group cursor-pointer">
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
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                        {client.status === 'Closed Won' ? 'Closed' :
                                         client.status === 'Monthly Billing' ? 'Billing' :
                                         client.status === 'Active Client' ? 'Active' :
                                         client.status === 'Archived' ? 'Archived' :
                                         client.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> Contact
                                        </p>
                                        <p className="text-sm font-bold text-slate-700 truncate">{client.phone || 'N/A'}</p>
                                    </div>
                                    <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <Wallet className="w-3 h-3" /> Security Deposit
                                        </p>
                                        <p className="text-sm font-bold text-emerald-700">₹{client.securityDeposit.toLocaleString()}</p>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRequestReview(client); }}
                                            className={`flex-1 px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm ${
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
                            <a href="https://g.page/r/CVxFhJ1HNBxfEAE/review" target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-primary hover:underline">
                                View All →
                            </a>
                        </div>
                        {/* Google Reviews - direct link card since Maps embed requires Place ID */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                    <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 text-sm">99 Care — Google Reviews</p>
                                    <p className="text-xs text-slate-500 mt-0.5">View all client reviews on Google</p>
                                </div>
                                <a href="https://g.page/r/CVxFhJ1HNBxfEAE/review" target="_blank" rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                                    Open
                                </a>
                            </div>
                            <p className="text-[11px] text-slate-400 text-center">
                                To embed live Google reviews, enable the Maps Embed API in Google Cloud Console and add the Place ID.
                            </p>
                        </div>
                        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-500">Tap "View All" to see all Google reviews</p>
                            <a href="https://g.page/r/CVxFhJ1HNBxfEAE/review" target="_blank" rel="noopener noreferrer"
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

            {/* Restart Service Modal */}
            {restartModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-emerald-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <RotateCcw className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Restart Service</h2>
                                    <p className="text-xs text-slate-500">{restartModal.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setRestartModal(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/50 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Start Date *</label>
                                    <input type="date" value={restartStartDate} onChange={e => setRestartStartDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                    <input type="date" value={restartEndDate} onChange={e => setRestartEndDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Assign Staff Member *</label>
                                {restartWorkers.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic py-2">No available staff members. Please mark a worker as available in HR first.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {restartWorkers.map(w => (
                                            <button key={w.id} onClick={() => setRestartSelectedWorker(w)}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-2 ${restartSelectedWorker?.id === w.id ? 'border-primary bg-primary/5 text-primary font-bold' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                                    {w.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{w.full_name}</p>
                                                    <p className="text-xs text-slate-400">{w.job_title}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setRestartModal(null)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleRestartService} disabled={isRestartSubmitting || !restartStartDate || !restartSelectedWorker}
                                className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                                {isRestartSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                Restart Service
                            </button>
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
        </div>
    );
}
