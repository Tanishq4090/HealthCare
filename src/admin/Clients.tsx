import { useState, useEffect } from 'react';
import { Users, Star, MessageSquare, Search, Building } from 'lucide-react';

export default function Clients() {
    const [clients, setClients] = useState<any[]>([]);

    const [workflows, setWorkflows] = useState({
        reviewCollection: true,
    });

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const fetchClients = async () => {
        try {
            // Fetch dummy clients or from DB if available. 
            // We'll use static data for visualization based on the "Client Master Entry" concept.
            setClients([
                { id: 1, name: 'Apex Medical Corp', contact: 'Sarah Jenkins', email: 'sarah@apexmed.com', phone: '+1 (555) 123-4567', status: 'Active', joined: 'Oct 12, 2026', lifetimeValue: '₹45,000' },
                { id: 2, name: 'Downtown Physio', contact: 'Michael Ross', email: 'mross@dtphysio.com', phone: '+1 (555) 987-6543', status: 'Active', joined: 'Sep 28, 2026', lifetimeValue: '₹12,500' },
                { id: 3, name: 'Wellness Clinic Inc', contact: 'David Chen', email: 'david@wellnessclinic.com', phone: '+1 (555) 456-7890', status: 'Inactive', joined: 'Aug 15, 2026', lifetimeValue: '₹8,000' },
            ]);
        } catch (error) {
            console.error('Error fetching clients:', error);
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
                                            <p className="text-sm text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {client.contact}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {client.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase mb-1">Email</p>
                                        <p className="text-sm text-slate-700 truncate" title={client.email}>{client.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase mb-1">Phone</p>
                                        <p className="text-sm text-slate-700 truncate">{client.phone}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase mb-1">Joined</p>
                                        <p className="text-sm text-slate-700">{client.joined}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium uppercase mb-1">LTV</p>
                                        <p className="text-sm font-semibold text-emerald-600">{client.lifetimeValue}</p>
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
        </div>
    );
}
