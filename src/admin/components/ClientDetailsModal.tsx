import { useState, useEffect } from 'react';
import { X, Phone, Users, MapPin, Calendar, Clock, Activity, FileText, ClipboardList, Briefcase, ChevronRight, User, History, Wallet, CheckCircle2, RotateCcw, Receipt, ShieldCheck, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClientDetailsModalProps {
    client: any;
    onClose: () => void;
}

export default function ClientDetailsModal({ client, onClose }: ClientDetailsModalProps) {
    const clientId = client?.id;
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [serviceBills, setServiceBills] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedPastCycles, setExpandedPastCycles] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Lead (including consents)
                const { data: leadData } = await supabase.from('crm_leads').select('*, client_consents(*)').eq('id', clientId).single();
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

                // 5. Fetch Services and Invoices
                const { data: svcData } = await supabase
                    .from('services')
                    .select('*, service_bills(*), service_worker_assignments(*, employees(full_name, job_title))')
                    .or(`client_id.eq.${clientId},lead_id.eq.${clientId}`)
                    .order('created_at', { ascending: false });
                setServices(svcData || []);

                const allBills = (svcData || []).flatMap((s: any) => s.service_bills || []);
                setServiceBills(allBills);
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

    const formatServiceLabel = (type?: string, notes?: string) => {
        if (type && type !== 'date_range' && type !== 'open_ended' && type !== 'one_day' && type.trim() !== '') {
            return type;
        }
        if (lead?.assigned_worker_role) return lead.assigned_worker_role;
        if (lead?.notes) {
            const match = lead.notes.match(/Service:\s*([^\n\r]+)/i);
            if (match && match[1]?.trim()) return match[1].trim();
        }
        if (notes) {
            const match = notes.match(/Service:\s*([^\n\r]+)/i);
            if (match && match[1]?.trim()) return match[1].trim();
        }
        return 'Home Care Service';
    };

    const activeService = services.find(s => s.status === 'active');
    const pastServices = services.filter(s => s.status !== 'active');

    const togglePastCycle = (id: string) => {
        setExpandedPastCycles(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Helper to get staff for a specific service cycle
    const getStaffForService = (svc: any) => {
        if (svc.service_worker_assignments && svc.service_worker_assignments.length > 0) {
            return svc.service_worker_assignments.map((swa: any) => ({
                name: swa.employees?.full_name || 'Staff Member',
                role: swa.employees?.job_title || 'Care Specialist',
                status: svc.status === 'active' ? 'Active' : 'Completed',
                startDate: swa.start_date || svc.start_date,
                endDate: swa.end_date || svc.end_date,
            }));
        }
        if (svc.status === 'active') {
            const activeAsgns = assignments.filter((a: any) => a.assignment_status === 'active');
            if (activeAsgns.length > 0) {
                return activeAsgns.map((a: any) => ({
                    name: a.employees?.full_name || 'Staff Member',
                    role: a.employees?.job_title || 'Care Specialist',
                    status: 'Active',
                    startDate: a.start_date || svc.start_date,
                    endDate: a.end_date,
                }));
            }
        }
        return [];
    };

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-900/40 backdrop-blur-sm justify-end overflow-hidden">
            <div className="w-full max-w-3xl bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
                
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-xl font-bold text-slate-900">{client?.name || lead?.name || 'Client Details'}</h2>
                            <span className={`inline-flex items-center font-bold text-xs px-2.5 py-0.5 rounded-full ${
                                lead?.pipeline_stage === 'Active Client' ? 'bg-teal-100 text-teal-800' :
                                lead?.pipeline_stage === 'Closed Won' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {lead?.pipeline_stage || 'Client'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-medium"><Phone className="w-3.5 h-3.5 text-slate-400" /> {client?.phone || lead?.phone || 'No phone'}</span>
                            •
                            <span className="text-xs text-slate-400">Client ID: {clientId?.substring(0, 8)}...</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full"></div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                        
                        {/* ========================================================================= */}
                        {/* SECTION 1: ACTIVE SERVICE CYCLE (SCOPED DETAILS)                         */}
                        {/* ========================================================================= */}
                        {activeService ? (
                            <div className="bg-white rounded-2xl border-2 border-emerald-300/80 shadow-sm overflow-hidden">
                                <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    Current Active Service
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-500">
                                                    {activeService.hours_per_day || 10}-Hour Shift
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                                                {formatServiceLabel(activeService.service_type, activeService.notes)}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Deposit</span>
                                        <p className="text-base font-extrabold text-slate-800">
                                            ₹{Number(activeService.deposit_amount || 5000).toLocaleString('en-IN')}
                                            <span className={`ml-1.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                activeService.deposit_status === 'collected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {activeService.deposit_status === 'collected' ? 'Paid' : 'Pending'}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-5 space-y-5">
                                    {/* Active Service Meta Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                        {/* Staff Assigned for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Assigned Staff (This Service)</span>
                                            </div>
                                            {(() => {
                                                const staffList = getStaffForService(activeService);
                                                if (staffList.length === 0) {
                                                    return <p className="text-xs text-slate-400 italic">No staff assigned to this service cycle.</p>;
                                                }
                                                return (
                                                    <div className="space-y-2">
                                                        {staffList.map((st: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-100">
                                                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                                                                    {st.name.charAt(0)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-bold text-slate-800 truncate">{st.name}</p>
                                                                    <p className="text-[10px] text-slate-400">{st.role} • Active</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Key Dates for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Key Dates (This Service)</span>
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Service Started:</span>
                                                    <span className="font-bold text-slate-800">{formatDate(activeService.start_date)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Expected End:</span>
                                                    <span className="font-bold text-slate-800">{activeService.end_date ? formatDate(activeService.end_date) : 'Ongoing (Open-Ended)'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Shift Hours:</span>
                                                    <span className="font-bold text-slate-800">{activeService.hours_per_day || 10} Hours/day</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Agreed Rates for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Agreed Rates (This Service)</span>
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Complete Month:</span>
                                                    <span className="font-bold text-slate-800">₹{Number(activeService.complete_month_daily_rate || 800).toLocaleString('en-IN')}/day</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Partial / Incomplete:</span>
                                                    <span className="font-bold text-slate-800">₹{Number(activeService.incomplete_month_daily_rate || 1500).toLocaleString('en-IN')}/day</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Monthly Est:</span>
                                                    <span className="font-bold text-slate-800">₹{((Number(activeService.complete_month_daily_rate) || 800) * 30).toLocaleString('en-IN')}/mo</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Billing Ledger for this active service */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Monthly Billing Ledger (This Active Service)
                                            </h4>
                                            {activeService.service_bills && activeService.service_bills.length > 0 && (
                                                <span className="text-xs font-bold text-emerald-700">
                                                    Cycle Total: ₹{activeService.service_bills.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </div>

                                        {(!activeService.service_bills || activeService.service_bills.length === 0) ? (
                                            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span>Active service cycle in progress. Next monthly invoice will generate upon 30-day mark or service completion.</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {activeService.service_bills.map((bill: any, i: number) => {
                                                    let noteData: any = {};
                                                    try { noteData = bill.notes ? JSON.parse(bill.notes) : {}; } catch { noteData = {}; }
                                                    const pdfUrl = noteData.invoice_pdf_url;
                                                    const invNo = noteData.invoice_number || `INV-${bill.id?.substring(0, 6)}`;

                                                    return (
                                                        <div key={bill.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                                                            <div>
                                                                <p className="font-bold text-slate-800">
                                                                    {formatDate(bill.period_start)} To {formatDate(bill.period_end)}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                                    {invNo} • {bill.total_days} days @ ₹{bill.daily_rate_used}/day
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-extrabold text-sm text-slate-900">
                                                                    ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                                                                </span>
                                                                {pdfUrl && (
                                                                    <a
                                                                        href={pdfUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="px-2.5 py-1 text-xs font-bold bg-white text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors inline-flex items-center gap-1 shadow-2xs"
                                                                    >
                                                                        <FileText className="w-3 h-3" /> PDF
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                                No active service currently. Click "Restart Service" on the client card to launch a new service cycle.
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* SECTION 2: PREVIOUS SERVICE CYCLES & HISTORICAL LEDGERS                   */}
                        {/* ========================================================================= */}
                        {pastServices.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-slate-800 text-sm">
                                            Previous Service Cycles &amp; Historical Ledgers ({pastServices.length})
                                        </h3>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400">
                                        Archived &amp; Settled
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {pastServices.map((pastSvc: any) => {
                                        const isExpanded = expandedPastCycles[pastSvc.id] ?? true;
                                        const pastStaff = getStaffForService(pastSvc);
                                        const bills = pastSvc.service_bills || [];

                                        return (
                                            <div key={pastSvc.id} className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden text-xs">
                                                {/* Cycle Header */}
                                                <div
                                                    onClick={() => togglePastCycle(pastSvc.id)}
                                                    className="p-3.5 flex items-center justify-between bg-slate-100/80 cursor-pointer hover:bg-slate-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-bold text-sm text-slate-800">
                                                            {formatServiceLabel(pastSvc.service_type, pastSvc.notes)}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                                                            Ended &amp; Settled
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            ({formatDate(pastSvc.start_date)} to {formatDate(pastSvc.end_date)})
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-slate-700">
                                                            Deposit: ₹{Number(pastSvc.deposit_amount || 5000).toLocaleString('en-IN')} (Settled)
                                                        </span>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                </div>

                                                {/* Cycle Details */}
                                                {isExpanded && (
                                                    <div className="p-3.5 space-y-3 bg-white">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400">Staff Assigned for this Cycle:</span>
                                                                <p className="font-semibold text-slate-700 mt-0.5">
                                                                    {pastStaff.length > 0
                                                                        ? pastStaff.map((s: any) => `${s.name} (${s.role})`).join(', ')
                                                                        : 'Past staff record archived'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400">Billing Terms Used:</span>
                                                                <p className="font-semibold text-slate-700 mt-0.5">
                                                                    ₹{pastSvc.complete_month_daily_rate || 800}/day full • ₹{pastSvc.incomplete_month_daily_rate || 1500}/day partial
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Invoices & Settlement Bills for this cycle */}
                                                        <div className="pt-2 border-t border-slate-100 space-y-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                Invoices &amp; Final Settlement Ledger for this Cycle ({bills.length}):
                                                            </span>
                                                            {bills.length === 0 ? (
                                                                <p className="text-slate-400 italic">No invoices recorded for this cycle.</p>
                                                            ) : (
                                                                bills.map((bill: any, bi: number) => {
                                                                    let noteData: any = {};
                                                                    try { noteData = bill.notes ? JSON.parse(bill.notes) : {}; } catch { noteData = {}; }
                                                                    const pdfUrl = noteData.invoice_pdf_url;
                                                                    const invNo = noteData.invoice_number || (bill.type === 'final' ? 'FINAL-SETTLEMENT' : `INV-${bi + 1}`);

                                                                    return (
                                                                        <div key={bill.id || bi} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                                                                            <div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="font-bold text-slate-800">{formatDate(bill.period_start)} To {formatDate(bill.period_end)}</span>
                                                                                    {bill.type === 'final' && (
                                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 text-[#1AA6A8] uppercase">
                                                                                            Final Settlement
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                                    {invNo} • {bill.total_days} days @ ₹{bill.daily_rate_used}/day
                                                                                    {noteData.previously_billed ? ` (Less ₹${Number(noteData.previously_billed).toLocaleString('en-IN')} prev billed)` : ''}
                                                                                </p>
                                                                                {noteData.refund_amount > 0 && (
                                                                                    <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                                                                                        • Refund Due: ₹{Number(noteData.refund_amount).toLocaleString('en-IN')} (Deposit settled)
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-extrabold text-slate-900 text-sm">
                                                                                    ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                                                                                </span>
                                                                                {pdfUrl && (
                                                                                    <a
                                                                                        href={pdfUrl}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="px-2 py-0.5 text-xs font-bold bg-white text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors inline-flex items-center gap-1 shadow-2xs"
                                                                                    >
                                                                                        <FileText className="w-3 h-3" /> PDF
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* SECTION 3: INTAKE PROFILE & PATIENT CARE DETAILS                         */}
                        {/* ========================================================================= */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Service Requirements (Initial Intake) */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-sm">
                                    <ClipboardList className="w-4 h-4 text-primary" /> Initial Inquiry Requirements
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-400 uppercase">Original Service</span>
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

                            {/* Patient & Care Details (from consent) */}
                            {lead?.client_consents && lead.client_consents.length > 0 && (() => {
                                const consent = [...lead.client_consents].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                                return (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-sm">
                                            <User className="w-4 h-4 text-primary" /> Patient Care Details (Consent)
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Patient Name</span>
                                                <span className="text-sm font-medium text-slate-800">{consent.patient_name || '—'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Age &amp; Weight</span>
                                                <span className="text-sm font-medium text-slate-800">
                                                    {consent.age ? `${consent.age} ${consent.age_unit?.toLowerCase() === 'months' ? 'months' : 'yrs'}` : '—'}
                                                    {consent.weight ? `, ${consent.weight} kg` : ''}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Relative / Guardian</span>
                                                <span className="text-sm font-medium text-slate-800">{consent.relative_name || '—'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Contact Number</span>
                                                <span className="text-sm font-medium text-slate-800">{consent.contact_number || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* All Notes & Requirements */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm">
                                <FileText className="w-4 h-4 text-primary" /> Intake Form Raw Notes
                            </h3>
                            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {lead?.notes || 'No raw notes available.'}
                            </pre>
                        </div>

                        {/* Complete Activity Timeline */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-sm">
                                <Activity className="w-4 h-4 text-primary" /> Complete Activity Timeline
                            </h3>
                            <div className="relative pl-3 space-y-5 before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
                                {activities.length === 0 ? (
                                    <p className="text-xs text-slate-400 pl-4 italic">No activity recorded yet.</p>
                                ) : (
                                    activities.map((act, i) => (
                                        <div key={i} className="relative pl-6 text-xs">
                                            {/* Timeline Dot */}
                                            <span className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-white" />
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                                                <h4 className="font-bold text-slate-800">
                                                    {act.event_type === 'form_filled' ? 'Form Submitted' :
                                                     act.event_type === 'call_received' ? 'Call Received' :
                                                     act.event_type === 'quotation_sent' ? 'Quotation Sent' :
                                                     act.event_type === 'stage_changed' ? 'Stage Changed' :
                                                     act.event_type === 'payment_recorded' ? 'Payment Recorded' :
                                                     act.event_type.replace(/_/g, ' ')}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                                                    {formatDate(act.created_at)} • {formatTime(act.created_at)}
                                                </span>
                                            </div>
                                            
                                            <p className="text-slate-600 leading-relaxed">{act.description}</p>
                                            
                                            {/* Metadata Chips */}
                                            {act.metadata && Object.keys(act.metadata).length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {Object.entries(act.metadata).map(([k, v]) => {
                                                        if (k === 'reason' || k === 'lead_name' || !v || typeof v === 'object') return null;
                                                        return (
                                                            <span key={k} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
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
