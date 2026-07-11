import { useState, useEffect } from 'react';
import { X, Phone, Users, MapPin, Calendar, Clock, Activity, FileText, ClipboardList, Briefcase, ChevronRight, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClientDetailsModalProps {
    clientId: string;
    onClose: () => void;
}

export default function ClientDetailsModal({ clientId, onClose }: ClientDetailsModalProps) {
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Lead
                const { data: leadData } = await supabase.from('crm_leads').select('*').eq('id', clientId).single();
                setLead(leadData);

                // 2. Fetch Activities
                const { data: actData } = await supabase.from('crm_lead_activity').select('*').eq('lead_id', clientId).order('created_at', { ascending: false });
                setActivities(actData || []);

                // 3. Fetch Quotations
                const { data: quoteData } = await supabase.from('crm_quotations').select('*').eq('lead_id', clientId).order('created_at', { ascending: false });
                setQuotations(quoteData || []);

                // 4. Fetch Assignments
                const { data: assignData } = await supabase.from('worker_assignments').select('*, employees(full_name, job_title)').eq('client_id', clientId).order('assigned_at', { ascending: false });
                setAssignments(assignData || []);
            } catch (err) {
                console.error("Error fetching client details:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [clientId]);

    if (!lead && !isLoading) return null;

    // Parse Notes for Form Details
    const parsedNotes: Record<string, string> = {};
    if (lead?.notes) {
        const lines = lead.notes.split('\n');
        lines.forEach((line: string) => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length > 0) {
                parsedNotes[key.trim()] = rest.join(':').trim();
            }
        });
    }

    const formatDate = (dStr: string) => {
        if (!dStr) return 'N/A';
        return new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (dStr: string) => {
        if (!dStr) return '';
        return new Date(dStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-900/40 backdrop-blur-sm justify-end overflow-hidden">
            <div className="w-full max-w-2xl bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
                
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{lead?.name || 'Client Details'}</h2>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead?.phone || 'No phone'}</span>
                            •
                            <span className="inline-flex items-center font-medium px-2 py-0.5 rounded-full bg-slate-100">{lead?.pipeline_stage}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full"></div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Profile Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Service Requirements */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <ClipboardList className="w-4 h-4 text-primary" /> Service Requirements
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">Service Type</span>
                                        <span className="text-sm font-medium text-slate-700">{parsedNotes['Service'] || lead?.service_interest || 'Not specified'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">Shift Preference</span>
                                        <span className="text-sm font-medium text-slate-700">{parsedNotes['Shift'] || 'Not specified'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">Care For</span>
                                        <span className="text-sm font-medium text-slate-700">{parsedNotes['Care for'] || 'Not specified'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">Location</span>
                                        <span className="text-sm font-medium text-slate-700 flex items-start gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                            {parsedNotes['Location'] || 'Not specified'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Operational Details */}
                            <div className="flex flex-col gap-4">
                                {/* Worker Assignment */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                        <Users className="w-4 h-4 text-primary" /> Assigned Staff
                                    </h3>
                                    {assignments.length > 0 ? (
                                        <div className="space-y-3">
                                            {assignments.slice(0, 3).map((a, i) => (
                                                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 bg-slate-50">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                                                        {a.employees?.full_name?.charAt(0) || 'S'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">{a.employees?.full_name}</p>
                                                        <p className="text-[11px] text-slate-500">{a.assignment_status === 'active' ? 'Active' : 'Past Assignment'} • {formatDate(a.start_date)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">No staff assigned yet.</p>
                                    )}
                                </div>

                                {/* Quotations & Dates */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                                        <Calendar className="w-4 h-4 text-primary" /> Key Dates
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Lead Entered</span>
                                            <span className="font-medium text-slate-700">{formatDate(lead?.created_at)}</span>
                                        </div>
                                        {quotations.length > 0 && quotations[0].start_date && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Service Start</span>
                                                <span className="font-medium text-slate-700">{formatDate(quotations[0].start_date)}</span>
                                            </div>
                                        )}
                                        {parsedNotes['Start Date'] && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Requested Start</span>
                                                <span className="font-medium text-slate-700">{parsedNotes['Start Date']}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Full Notes Fallback (if they typed custom notes) */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-primary" /> All Notes & Requirements
                            </h3>
                            <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {lead?.notes || 'No raw notes available.'}
                            </pre>
                        </div>

                        {/* Activity Timeline */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                                <Activity className="w-4 h-4 text-primary" /> Complete Activity Timeline
                            </h3>
                            <div className="relative pl-3 space-y-6 before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
                                {activities.length === 0 ? (
                                    <p className="text-sm text-slate-500 pl-4 italic">No activity recorded yet.</p>
                                ) : (
                                    activities.map((act, i) => (
                                        <div key={i} className="relative pl-6">
                                            {/* Timeline Dot */}
                                            <span className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-white" />
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                                                <h4 className="font-semibold text-slate-800 text-sm">
                                                    {act.event_type === 'form_filled' ? 'Form Submitted' :
                                                     act.event_type === 'call_received' ? 'Call Received' :
                                                     act.event_type === 'quotation_sent' ? 'Quotation Sent' :
                                                     act.event_type === 'stage_changed' ? 'Stage Changed' :
                                                     act.event_type.replace(/_/g, ' ')}
                                                </h4>
                                                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                                                    {formatDate(act.created_at)} • {formatTime(act.created_at)}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-slate-600 leading-relaxed">{act.description}</p>
                                            
                                            {/* Metadata Chips */}
                                            {act.metadata && Object.keys(act.metadata).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {Object.entries(act.metadata).map(([k, v]) => {
                                                        if (k === 'reason' || k === 'lead_name' || !v || typeof v === 'object') return null;
                                                        return (
                                                            <span key={k} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                                <span className="capitalize mr-1 text-slate-400">{k.replace(/_/g, ' ')}:</span> {String(v)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
