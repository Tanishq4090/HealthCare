import { useState, useEffect } from 'react';
import { Search, Star, Edit2, Users, Building, MessageSquare, X, Phone, Wallet, History as HistoryIcon } from 'lucide-react';
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

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const openEditModal = (client: any) => {
        setEditingClient({ ...client });
        setIsEditModalOpen(true);
    };

    const handleRequestReview = async (client: any) => {
        const message = `Hi ${client.contact}, thank you for choosing HealthFirst. We would love to hear about your experience! Please leave us a review here: [Google Local Link]`;
        console.log('Sending message:', message); // Use message
        
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: `Sending WhatsApp to ${client.name}...`,
                success: 'Review request sent successfully!',
                error: 'Failed to send request'
            }
        );
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Update Client (Simulated for now, would need SQL column 'service_rating')
            // const { error } = await supabase.from('clients').update({ service_rating: editingClient.service_rating }).eq('name', editingClient.name);

            // 2. Sync with Workers (As requested: Worker gets rating from Client's company service review)
            const { error: workerError } = await supabase
                .from('workers')
                .update({ rating: editingClient.service_rating })
                .eq('assigned_client', editingClient.name);

            if (workerError) throw workerError;

            setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c));
            setIsEditModalOpen(false);
            toast.success(`${editingClient.name} service review updated. Worker ratings synchronized!`);
            fetchClients();
        } catch (err: any) {
            console.error('Error syncing ratings:', err);
            toast.error('Failed to sync worker ratings');
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchClients = async () => {
        try {
            // Fetch all workers to derive clients
            const { data: workerData, error: workerError } = await supabase
                .from('workers')
                .select('id, name, assigned_client, status');
            
            if (workerError) throw workerError;

            // Group workers by client
            const clientMap: Record<string, any> = {};
            (workerData || []).forEach(w => {
                if (!w.assigned_client) return;
                
                if (!clientMap[w.assigned_client]) {
                    clientMap[w.assigned_client] = {
                        id: w.assigned_client,
                        name: w.assigned_client,
                        contact: 'Main Admin', // Fallback
                        email: '-',
                        status: 'Active',
                        workerCount: 0,
                        activeWorkerCount: 0,
                        lifetimeValue: '₹0'
                    };
                }
                
                clientMap[w.assigned_client].workerCount++;
                if (w.status === 'Active') {
                    clientMap[w.assigned_client].activeWorkerCount++;
                }
            });

            setClients(Object.values(clientMap));
        } catch (error) {
            console.error('Error fetching clients:', error);
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
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search clients..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {clients.map(client => (
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
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {client.status}
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
                                        <p className="text-sm font-bold text-emerald-700">₹15,000</p>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRequestReview(client); }}
                                            className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> WhatsApp Review
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); openEditModal(client); }} 
                                            className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/20"
                                            title="Edit Profile"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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

                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                            <MessageSquare className="w-5 h-5 text-slate-500" />
                            Recent Reviews
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                <div className="flex text-amber-500 mb-1">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                </div>
                                <p className="text-sm text-slate-700 line-clamp-2">"Excellent staff provided by HealthFirst. Very professional tracking."</p>
                                <p className="text-xs text-slate-400 mt-2">- Apex Medical Corp</p>
                            </div>
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
        </div>
    );
}
