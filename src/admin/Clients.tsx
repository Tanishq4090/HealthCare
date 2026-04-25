import { useEffect, useState } from 'react';
import { Building2, Edit2, History as HistoryIcon, Mail, MessageSquare, Phone, Search, Star, Users, Wallet, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { AdminPage, IconFrame, SectionHeader, StatusBadge, Surface } from './AdminPrimitives';

type ClientRecord = {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    contact?: string;
    status: 'Active' | 'Inactive';
    workerCount: number;
    activeWorkerCount: number;
    lifetimeValue: string;
    service_rating?: number;
};

type ClientRow = {
    id: string;
    client_name: string;
    phone_number?: string | null;
    email?: string | null;
    service_rating?: number | null;
};

type EmployeeRow = {
    assigned_client?: string | null;
    status?: string | null;
};

type WhatsAppResponse = {
    success?: boolean;
    error?: string;
};

function getErrorMessage(error: unknown, fallback = 'Check connection') {
    return error instanceof Error ? error.message : fallback;
}

export default function Clients() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<ClientRecord[]>([]);
    const [search, setSearch] = useState('');
    const [workflows, setWorkflows] = useState({
        reviewCollection: true,
    });

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const openEditModal = (client: ClientRecord) => {
        setEditingClient({ ...client });
        setIsEditModalOpen(true);
    };

    const handleRequestReview = async (client: ClientRecord) => {
        if (!client.phone) {
            toast.error('No phone number found for this client. Please update the profile.');
            return;
        }

        const toastId = toast.loading(`Sending WhatsApp review request to ${client.name}...`);

        try {
            let phoneDigits = client.phone.replace(/\D/g, '');
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;

            const firstName = client.name.split(' ')[0] || 'there';

            const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                body: {
                    phone: phoneDigits,
                    useTemplate: true,
                    templateName: 'customer_review_request',
                    templateParams: [firstName],
                },
            });

            if (error) throw error;
            const response = data as WhatsAppResponse | null;
            if (response?.success === false) throw new Error(response.error || 'Meta API error');

            toast.success('Review request sent successfully.', { id: toastId });
        } catch (err: unknown) {
            console.error('WhatsApp Review fail:', err);
            toast.error(`WhatsApp failed: ${getErrorMessage(err)}`, { id: toastId });
        }
    };

    const fetchClients = async () => {
        try {
            const { data: leads, error: leadsError } = await supabase
                .from('crm_leads')
                .select('id')
                .in('pipeline_stage', ['Active Client', 'Monthly Billing', 'Closed Won']);

            if (leadsError) throw leadsError;

            const clientIds = (leads || []).map((lead) => lead.id);
            let clientData: ClientRow[] = [];

            if (clientIds.length > 0) {
                const { data, error } = await supabase
                    .from('clients')
                    .select('*')
                    .in('id', clientIds)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                clientData = (data || []) as ClientRow[];
            }

            const { data: employeeData, error: empError } = await supabase
                .from('employees')
                .select('id, full_name, assigned_client, status');

            if (empError) throw empError;

            const workerMap: Record<string, { workerCount: number; activeWorkerCount: number }> = {};
            ((employeeData || []) as EmployeeRow[]).forEach((worker) => {
                if (!worker.assigned_client) return;

                if (!workerMap[worker.assigned_client]) {
                    workerMap[worker.assigned_client] = { workerCount: 0, activeWorkerCount: 0 };
                }

                workerMap[worker.assigned_client].workerCount++;
                if (worker.status === 'assigned' || worker.status === 'Active') {
                    workerMap[worker.assigned_client].activeWorkerCount++;
                }
            });

            const enrichedClients = (clientData || []).map((client) => ({
                id: client.id,
                name: client.client_name,
                phone: client.phone_number || undefined,
                email: client.email || '-',
                contact: client.client_name,
                status: 'Active' as const,
                workerCount: workerMap[client.client_name]?.workerCount || 0,
                activeWorkerCount: workerMap[client.client_name]?.activeWorkerCount || 0,
                lifetimeValue: '₹0',
                service_rating: client.service_rating || undefined,
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

    const filteredClients = clients.filter((client) => {
        const query = search.toLowerCase();
        return (
            client.name.toLowerCase().includes(query) ||
            (client.email || '').toLowerCase().includes(query) ||
            (client.phone || '').toLowerCase().includes(query)
        );
    });

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingClient) return;
        setIsSubmitting(true);

        try {
            const { error: clientError } = await supabase
                .from('clients')
                .update({
                    client_name: editingClient.name,
                    phone_number: editingClient.phone,
                    email: editingClient.email,
                })
                .eq('id', editingClient.id);

            if (clientError) throw clientError;

            const { error: workerError } = await supabase
                .from('employees')
                .update({ rating: editingClient.service_rating })
                .eq('assigned_client', editingClient.name);

            if (workerError) throw workerError;

            setClients((prev) => prev.map((client) => (client.id === editingClient.id ? editingClient : client)));
            setIsEditModalOpen(false);
            toast.success(`${editingClient.name} updated. Worker ratings synchronized.`);
            fetchClients();
        } catch (err: unknown) {
            console.error('Error syncing ratings:', err);
            toast.error(`Failed to save: ${getErrorMessage(err, 'Unable to save client')}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminPage>
            <Surface className="bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/60">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase text-cyan-700">Client intelligence</p>
                        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Care network overview</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                            Search and manage client accounts with deployment, review, and revenue context.
                        </p>
                    </div>
                    <button type="button" onClick={() => navigate('/admin/billing?tab=history')} className="btn-secondary">
                        <HistoryIcon className="h-4 w-4 text-cyan-700" />
                        View Payment History
                    </button>
                </div>
            </Surface>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_0.8fr]">
                <div className="space-y-4">
                    <div className="relative w-full lg:max-w-sm">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search clients..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="field-control w-full pl-10 pr-4"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                        {filteredClients.length === 0 ? (
                            <Surface className="2xl:col-span-2">
                                <div className="py-8 text-center">
                                    <IconFrame icon={Building2} tone="slate" className="mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-700">No clients found.</p>
                                    <p className="mt-1 text-xs text-slate-400">Client records will appear here after conversion.</p>
                                </div>
                            </Surface>
                        ) : (
                            filteredClients.map((client) => (
                                <article key={client.id} className="clinical-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                                    <div className="clinical-content">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-emerald-500 text-sm font-extrabold text-white shadow-glow">
                                                    {client.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-base font-extrabold text-slate-950">{client.name}</h3>
                                                    <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                        <Users className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate">{client.activeWorkerCount} Active / {client.workerCount} Total Workers</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusBadge className="border-emerald-100 bg-emerald-50 text-emerald-700">{client.status}</StatusBadge>
                                        </div>

                                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg bg-cyan-50/60 p-3">
                                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-cyan-700">
                                                    <Phone className="h-3.5 w-3.5" />
                                                    Contact
                                                </div>
                                                <p className="mt-2 truncate text-sm font-bold text-slate-700">{client.phone || 'N/A'}</p>
                                            </div>
                                            <div className="rounded-lg bg-emerald-50/70 p-3">
                                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-700">
                                                    <Wallet className="h-3.5 w-3.5" />
                                                    Value
                                                </div>
                                                <p className="mt-2 text-sm font-bold text-slate-700">{client.lifetimeValue}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500">
                                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                                            <span className="truncate">{client.email || '-'}</span>
                                        </div>

                                        <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleRequestReview(client); }}
                                                className="btn-secondary flex-1 px-3 py-2 text-xs"
                                            >
                                                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                                WhatsApp Review
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-cyan-200 hover:text-cyan-700"
                                                title="Edit Profile"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-5">
                    <Surface>
                        <SectionHeader
                            title="Client Automations"
                            description="Post-conversion workflows and review collection."
                            action={<IconFrame icon={Star} tone="amber" className="h-10 w-10" />}
                        />
                        <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/80 p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Star className="h-5 w-5 text-amber-600" />
                                    <h3 className="font-bold text-amber-800">Auto-Review Collection</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleWorkflow('reviewCollection')}
                                    className={`relative h-5 w-10 rounded-full transition-colors ${workflows.reviewCollection ? 'bg-amber-500' : 'bg-slate-200'}`}
                                >
                                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${workflows.reviewCollection ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <p className="text-sm leading-6 text-slate-600">Automatically sends a feedback request after onboarding milestones.</p>
                        </div>
                    </Surface>

                    <Surface>
                        <SectionHeader
                            title="Recent Reviews"
                            action={<IconFrame icon={MessageSquare} tone="cyan" className="h-10 w-10" />}
                        />
                        <div className="mt-5 rounded-lg border border-slate-100 bg-white/75 p-4 shadow-sm">
                            <div className="mb-2 flex text-amber-500">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star key={star} className="h-4 w-4 fill-current" />
                                ))}
                            </div>
                            <p className="line-clamp-2 text-sm text-slate-700">"Professional staff coordination and clear tracking throughout the service."</p>
                            <p className="mt-2 text-xs text-slate-400">- Demo Care Network</p>
                        </div>
                    </Surface>
                </div>
            </div>

            {isEditModalOpen && editingClient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md">
                    <div className="w-full max-w-md overflow-hidden rounded-lg border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-white/50 p-5">
                            <div className="flex items-center gap-3">
                                <IconFrame icon={Building2} tone="cyan" className="h-10 w-10" />
                                <h2 className="text-lg font-bold text-slate-900">Edit Client Details</h2>
                            </div>
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveClient} className="space-y-4 p-5">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingClient.name}
                                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                                    className="field-control w-full px-4"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Primary Contact Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingClient.contact || editingClient.name}
                                    onChange={(e) => setEditingClient({ ...editingClient, contact: e.target.value })}
                                    className="field-control w-full px-4"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
                                    <input
                                        type="email"
                                        value={editingClient.email}
                                        onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                                        className="field-control w-full px-4"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Status</label>
                                    <select
                                        value={editingClient.status}
                                        onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as ClientRecord['status'] })}
                                        className="field-control w-full px-4"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 flex justify-between text-sm font-semibold text-slate-700">
                                    <span>Service Quality Rating</span>
                                    <span className="font-bold text-cyan-700">{editingClient.service_rating || 0} Stars</span>
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setEditingClient({ ...editingClient, service_rating: star })}
                                            className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all hover:scale-105 ${
                                                (editingClient.service_rating || 0) >= star
                                                    ? 'border-amber-200 bg-amber-100 text-amber-500'
                                                    : 'border-slate-100 bg-slate-50 text-slate-300'
                                            }`}
                                        >
                                            <Star className={`h-5 w-5 ${(editingClient.service_rating || 0) >= star ? 'fill-current' : ''}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 disabled:opacity-50">
                                    Save & Sync
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminPage>
    );
}
