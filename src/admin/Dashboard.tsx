import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizePipelineStages } from '../utils/crm';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Users, UserCheck, TrendingUp, Wallet, IndianRupee,
    FileText, AlertCircle, ShieldCheck, ArrowUpRight, ChevronRight,
    Clock, Phone, Calendar, CheckCircle2, MessageSquare, AlertTriangle,
    PlusCircle, RefreshCw, ExternalLink, Briefcase, Loader2, Bot, Sparkles, Info
} from 'lucide-react';

type ActivityItem = {
    id: string;
    lead_id?: string;
    event_type: string;
    description: string;
    metadata?: Record<string, any>;
    created_at: string;
    leadName?: string;
};

type UrgentStaffPayout = {
    id: string;
    worker: string;
    worker_phone?: string;
    client_name: string;
    days_worked: number;
    net_balance: number;
    period_start?: string;
    period_end?: string;
    type?: string;
};

type UrgentClientBill = {
    id: string;
    client_name: string;
    amount: number;
    period_start: string;
    period_end: string;
    service_id?: string;
};

type DutyEndingSoon = {
    id: string;
    client_name: string;
    worker_name: string;
    end_date: string;
    days_remaining: number;
};

type HotLead = {
    id: string;
    name: string;
    phone?: string;
    pipeline_stage: string;
    estimated_value?: number;
    created_at: string;
};

export default function Dashboard() {
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        activeDeployments: 0,
        activeClients: 0,
        benchAvailable: 0,
        totalFleet: 0,
        monthlyRunRate: 0,
        totalCollections: 0,
        monthCollections: 0,
        clientReceivables: 0,
        clientUnpaidCount: 0,
        staffPayables: 0,
        staffPendingCount: 0,
        depositsHeld: 0,
        depositsCount: 0,
        activeLeadsCount: 0,
    });

    const [monthlyCollectionsTrend, setMonthlyCollectionsTrend] = useState<any[]>([]);
    const [urgentStaffPayouts, setUrgentStaffPayouts] = useState<UrgentStaffPayout[]>([]);
    const [urgentClientBills, setUrgentClientBills] = useState<UrgentClientBill[]>([]);
    const [dutiesEndingSoon, setDutiesEndingSoon] = useState<DutyEndingSoon[]>([]);
    const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
    const [roleDistribution, setRoleDistribution] = useState<Record<string, number>>({});
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [activeActionTab, setActiveActionTab] = useState<'staff_payouts' | 'client_bills' | 'ending_soon' | 'hot_leads'>('staff_payouts');
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecentActivity = async () => {
        const [activityResult, whatsappResult] = await Promise.all([
            supabase
                .from('crm_lead_activity')
                .select('id, lead_id, event_type, description, metadata, created_at')
                .order('created_at', { ascending: false })
                .limit(8),
            supabase
                .from('whatsapp_logs')
                .select('id, status, error_message, payload, created_at')
                .order('created_at', { ascending: false })
                .limit(8),
        ]);

        if (activityResult.error) throw activityResult.error;
        if (whatsappResult.error) {
            console.warn('Dashboard WhatsApp activity unavailable:', whatsappResult.error.message);
        }

        const activities = activityResult.data || [];
        const whatsappLogs = whatsappResult.error ? [] : (whatsappResult.data || []);

        const leadIds = [...new Set((activities || []).map(item => item.lead_id).filter(Boolean))];
        let leadNames: Record<string, string> = {};

        if (leadIds.length > 0) {
            const { data: leads, error: leadsError } = await supabase
                .from('crm_leads')
                .select('id, name')
                .in('id', leadIds);

            if (leadsError) {
                console.warn('Dashboard activity lead names unavailable:', leadsError.message);
            } else {
                leadNames = (leads || []).reduce((acc: Record<string, string>, lead: any) => {
                    acc[lead.id] = lead.name;
                    return acc;
                }, {});
            }
        }

        const leadActivity = activities.map((item: any) => ({
            ...item,
            leadName: leadNames[item.lead_id]
        }));

        const whatsappActivity = whatsappLogs.map((log: any) => {
            const payload = log.payload || {};
            const templateName = payload.templateName || payload.type || 'message';
            const recipient = payload.leadName || payload.original_recipient || payload.phone || 'client';
            let description = 'AI performed an automated WhatsApp action.';

            if (payload.pipelineStageUpdate) {
                description = `Moved lead to "${payload.pipelineStageUpdate}".`;
            } else if (payload.templateName === 'post_call_intake') {
                description = `Sent intake form prompt to ${recipient}.`;
            } else if (payload.templateName === 'deposit_request') {
                description = `Sent deposit invoice request to ${recipient}.`;
            } else if (payload.templateName === 'client_monthly_invoice') {
                description = `Sent client service invoice to ${recipient}.`;
            } else if (payload.templateName === 'staff_assignment') {
                description = `Sent staff assignment confirmation to ${recipient}.`;
            } else if (payload.templateName === 'worker_payslip') {
                description = `Dispatched worker payslip to ${recipient}.`;
            } else if (payload.templateName) {
                description = `Sent ${payload.templateName} to ${recipient}.`;
            } else if (payload.message) {
                description = `AI replied to ${recipient}: "${String(payload.message).slice(0, 60)}${String(payload.message).length > 60 ? '...' : ''}"`;
            } else if (log.error_message) {
                description = `WhatsApp automation error: ${log.error_message}`;
            }

            return {
                id: `whatsapp-${log.id}`,
                lead_id: payload.leadId,
                event_type: log.status === 'error' ? 'automation_error' : `whatsapp_${templateName}`,
                description,
                metadata: payload,
                created_at: log.created_at,
                leadName: payload.leadName
            };
        });

        setRecentActivity([...leadActivity, ...whatsappActivity]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 8));
    };

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            const [
                { data: leads },
                { data: employees },
                { data: settings },
                { data: payments },
                { data: assignments },
                { data: bills },
                { data: payrolls },
                { data: servicesList }
            ] = await Promise.all([
                supabase.from('crm_leads').select('id, name, phone, pipeline_stage, estimated_value_monthly, created_at').is('deleted_at', null),
                supabase.from('employees').select('id, full_name, phone, job_title, status'),
                supabase.from('automation_settings').select('pipeline_stages').eq('id', 'global').maybeSingle(),
                supabase.from('payments').select('id, client_name, amount, payment_type, payment_date, transaction_ref, created_at'),
                supabase.from('worker_assignments').select('id, client_id, employee_id, assignment_status, total_bill_amount, start_date, end_date, clients(id, client_name), employees(full_name)'),
                supabase.from('service_bills').select('id, service_id, amount, notes, period_start, period_end, created_at, services(id, client_id, clients(client_name, phone_number))'),
                supabase.from('payroll').select('id, worker, client_name, days_worked, daily_rate, total_amount, advance_amount, net_balance, status, period_start, period_end, payslip_type, type, worker_phone'),
                supabase.from('services').select('id, client_id, status, complete_month_daily_rate, incomplete_month_daily_rate, deposit_amount')
            ]);

            // 1. Leads
            const pipelineStages = sanitizePipelineStages(
                settings?.pipeline_stages || ['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending']
            );
            const activeLeads = (leads || []).filter(l => pipelineStages.includes(l.pipeline_stage));

            // 2. Employees & Deployments
            const activeEmployees = (employees || []).filter(e => e.status === 'assigned' || e.status === 'Active');
            const availableEmployees = (employees || []).filter(e => e.status === 'available');
            const totalFleet = (employees || []).length;

            const roleCounts: Record<string, number> = {};
            (employees || []).forEach(e => {
                let role = e.job_title || 'Attendant';
                if (role.toLowerCase().includes('old age') || role.toLowerCase().includes('elderly')) role = 'Elderly Care';
                else if (role.toLowerCase().includes('baby') || role.toLowerCase().includes('maternity')) role = 'Baby Care';
                else if (role.toLowerCase().includes('nurse')) role = 'Bedside Nurse';
                roleCounts[role] = (roleCounts[role] || 0) + 1;
            });
            setRoleDistribution(roleCounts);

            // 3. Payments & Collections
            const allPayments = payments || [];
            const totalCollections = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const depositPayments = allPayments.filter(p => p.payment_type === 'deposit');
            const totalDepositsHeld = depositPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            const thisMonthPayments = allPayments.filter(p => {
                if (!p.payment_date) return false;
                const d = new Date(p.payment_date);
                return d >= monthStart && d < nextMonthStart;
            });
            const monthCollections = thisMonthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // 4. Monthly Collections Trend (Real 6-Month Timeline)
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const trendMap = new Map<string, { name: string; deposits: number; service: number; total: number }>();

            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                trendMap.set(key, {
                    name: monthNames[targetDate.getMonth()],
                    deposits: 0,
                    service: 0,
                    total: 0
                });
            }

            allPayments.forEach(p => {
                if (!p.payment_date) return;
                const d = new Date(p.payment_date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (trendMap.has(key)) {
                    const entry = trendMap.get(key)!;
                    const amt = Number(p.amount) || 0;
                    if (p.payment_type === 'deposit') entry.deposits += amt;
                    else entry.service += amt;
                    entry.total += amt;
                }
            });
            setMonthlyCollectionsTrend(Array.from(trendMap.values()));

            // 5. Client Unpaid Invoices (Receivables)
            const unpaidBillsList: UrgentClientBill[] = [];
            let clientReceivablesSum = 0;

            (bills || []).forEach(b => {
                const amt = Number(b.amount) || 0;
                let isSettledOrPaid = false;
                if (b.notes) {
                    try {
                        const parsed = JSON.parse(b.notes);
                        if (parsed.status === 'paid' || parsed.status === 'settled') isSettledOrPaid = true;
                    } catch {
                        // ignore parse error
                    }
                }

                if (!isSettledOrPaid && amt > 0) {
                    clientReceivablesSum += amt;
                    const sObj: any = Array.isArray(b.services) ? b.services[0] : b.services;
                    const cObj: any = Array.isArray(sObj?.clients) ? sObj.clients[0] : sObj?.clients;
                    const clientName = cObj?.client_name || 'Client';
                    unpaidBillsList.push({
                        id: b.id,
                        client_name: clientName,
                        amount: amt,
                        period_start: b.period_start,
                        period_end: b.period_end,
                        service_id: b.service_id
                    });
                }
            });
            setUrgentClientBills(unpaidBillsList);

            // 6. Staff Payables (Wages Due)
            const pendingPayrollsList: UrgentStaffPayout[] = [];
            let staffPayablesSum = 0;

            (payrolls || []).forEach(p => {
                if (p.status === 'Pending Payment') {
                    const bal = Number(p.net_balance) || 0;
                    staffPayablesSum += bal;
                    pendingPayrollsList.push({
                        id: p.id,
                        worker: p.worker || 'Care Worker',
                        worker_phone: p.worker_phone,
                        client_name: p.client_name || 'Client',
                        days_worked: Number(p.days_worked) || 0,
                        net_balance: bal,
                        period_start: p.period_start,
                        period_end: p.period_end,
                        type: p.type
                    });
                }
            });
            // Prioritize final/relieved workers first
            pendingPayrollsList.sort((a, b) => {
                if (a.type === 'final' && b.type !== 'final') return -1;
                if (b.type === 'final' && a.type !== 'final') return 1;
                return b.net_balance - a.net_balance;
            });
            setUrgentStaffPayouts(pendingPayrollsList);

            // 7. Duties Ending Soon (Next 7 Days)
            const endingList: DutyEndingSoon[] = [];
            const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            (assignments || []).forEach(a => {
                if (a.assignment_status === 'active' && a.end_date) {
                    const endDateObj = new Date(a.end_date);
                    const diffTime = endDateObj.getTime() - todayMid.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 7) {
                        const clientObj: any = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                        const empObj: any = Array.isArray(a.employees) ? a.employees[0] : a.employees;
                        endingList.push({
                            id: a.id,
                            client_name: clientObj?.client_name || 'Client',
                            worker_name: empObj?.full_name || 'Care Staff',
                            end_date: a.end_date,
                            days_remaining: diffDays
                        });
                    }
                }
            });
            endingList.sort((a, b) => a.days_remaining - b.days_remaining);
            setDutiesEndingSoon(endingList);

            // 8. Hot Leads Needing Staff Allocation
            const hotLeadsList: HotLead[] = (leads || [])
                .filter(l => ['New Inquiry', 'In Discussion', 'Deposit Pending', 'Form Submitted'].includes(l.pipeline_stage))
                .map(l => ({
                    id: l.id,
                    name: l.name,
                    phone: l.phone,
                    pipeline_stage: l.pipeline_stage,
                    estimated_value: Number(l.estimated_value_monthly) || 0,
                    created_at: l.created_at
                }))
                .slice(0, 10);
            setHotLeads(hotLeadsList);

            // 9. Active Run Rate calculation (estimate based on active services)
            let activeRunRate = 0;
            (servicesList || []).forEach(s => {
                if (s.status === 'active') {
                    const daily = Number(s.complete_month_daily_rate) || 0;
                    activeRunRate += daily > 0 ? daily * 30 : 25000; // fallback standard month rate
                }
            });
            if (activeRunRate === 0 && activeEmployees.length > 0) {
                activeRunRate = activeEmployees.length * 20000;
            }

            // Distinct active clients
            const activeClientIds = new Set<string>();
            (assignments || []).forEach(a => {
                const clientObj: any = Array.isArray(a.clients) ? a.clients[0] : a.clients;
                if (a.assignment_status === 'active' && clientObj?.id) {
                    activeClientIds.add(clientObj.id);
                }
            });

            setStats({
                activeDeployments: activeEmployees.length,
                activeClients: activeClientIds.size || activeEmployees.length,
                benchAvailable: availableEmployees.length,
                totalFleet,
                monthlyRunRate: activeRunRate,
                totalCollections,
                monthCollections,
                clientReceivables: clientReceivablesSum,
                clientUnpaidCount: unpaidBillsList.length,
                staffPayables: staffPayablesSum,
                staffPendingCount: pendingPayrollsList.length,
                depositsHeld: totalDepositsHeld,
                depositsCount: depositPayments.length,
                activeLeadsCount: activeLeads.length
            });

            await fetchRecentActivity();
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        const activitySub = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_lead_activity' }, () => {
                fetchRecentActivity().catch(err => console.error('Dashboard activity refresh error:', err));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
                fetchDashboardData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_logs' }, () => {
                fetchRecentActivity().catch(err => console.error('Dashboard WhatsApp activity refresh error:', err));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(activitySub);
        };
    }, []);

    const formatActivityTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const getActivityIcon = (eventType: string) => {
        if (eventType.includes('payment') || eventType.includes('deposit')) return <IndianRupee className="w-4 h-4 text-emerald-600" />;
        if (eventType.includes('payslip') || eventType.includes('worker')) return <Wallet className="w-4 h-4 text-blue-600" />;
        if (eventType.includes('sent') || eventType.includes('invoice')) return <MessageSquare className="w-4 h-4 text-teal-600" />;
        if (eventType.includes('form') || eventType.includes('consent')) return <FileText className="w-4 h-4 text-indigo-600" />;
        if (eventType.includes('stage')) return <CheckCircle2 className="w-4 h-4 text-purple-600" />;
        return <Bot className="w-4 h-4 text-slate-600" />;
    };

    const getActivityLabel = (eventType: string) => {
        return eventType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] w-full gap-3">
                <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
                <p className="text-sm font-semibold text-slate-500">Loading live business command center...</p>
            </div>
        );
    }

    const fleetUtilizationPct = stats.totalFleet > 0 
        ? Math.round((stats.activeDeployments / stats.totalFleet) * 100) 
        : 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header with Live Status & Quick Action Shortcuts */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
                            Executive Command Center
                        </h1>
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Telemetry
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                        Real-time business performance, cashflow, and active caregiver operations.
                    </p>
                </div>

                <div className="flex items-center flex-wrap gap-2.5">
                    <button
                        onClick={() => navigate('/admin/crm')}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-sm shadow-teal-700/20"
                    >
                        <PlusCircle className="w-3.5 h-3.5" />
                        New Patient Intake
                    </button>
                    <button
                        onClick={() => navigate('/admin/billing?tab=monthly')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs transition-colors shadow-sm"
                    >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        Client Invoices
                    </button>
                    <button
                        onClick={() => navigate('/admin/hr')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs transition-colors shadow-sm"
                    >
                        <Wallet className="w-3.5 h-3.5 text-slate-500" />
                        Staff Payouts
                    </button>
                    <button
                        onClick={() => fetchDashboardData()}
                        title="Refresh metrics"
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ── Top Executive KPI Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Active Deployments */}
                <div 
                    onClick={() => navigate('/admin/clients')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Deployments</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{stats.activeDeployments}</h2>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                Staff on Duty
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center justify-between">
                            <span>Serving {stats.activeClients} Active Patients</span>
                            <span className="text-teal-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                View Fleet <ChevronRight className="w-3 h-3" />
                            </span>
                        </p>
                    </div>
                </div>

                {/* 2. Staff on Bench (Available) */}
                <div 
                    onClick={() => navigate('/admin/hr')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bench Availability</span>
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                            <UserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{stats.benchAvailable}</h2>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                                Ready to Deploy
                            </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center justify-between">
                            <span>Fleet Utilization: {fleetUtilizationPct}%</span>
                            <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                Staff Directory <ChevronRight className="w-3 h-3" />
                            </span>
                        </p>
                    </div>
                </div>

                {/* 3. Monthly Contracted Run Rate */}
                <div 
                    onClick={() => navigate('/admin/billing?tab=monthly')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Contracted Monthly Value</span>
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition-colors">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">₹{stats.monthlyRunRate.toLocaleString('en-IN')}</h2>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center justify-between">
                            <span>Active Care Run-Rate</span>
                            <span className="text-teal-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                Care Billing <ChevronRight className="w-3 h-3" />
                            </span>
                        </p>
                    </div>
                </div>

                {/* 4. Total Collections */}
                <div 
                    onClick={() => navigate('/admin/billing?tab=history')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cash Collections</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                            <IndianRupee className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">₹{stats.totalCollections.toLocaleString('en-IN')}</h2>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center justify-between">
                            <span>₹{stats.monthCollections.toLocaleString('en-IN')} this month</span>
                            <span className="text-emerald-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                Ledger <ChevronRight className="w-3 h-3" />
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Financial Clarity Row (Client Receivables vs Staff Payables vs Deposits) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Client Receivables (Money to Collect) */}
                <div 
                    onClick={() => navigate('/admin/billing?tab=monthly')}
                    className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-5 rounded-2xl border border-amber-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">Client Dues Pending</span>
                                <p className="text-[11px] font-semibold text-amber-700/80">Receivables (Money Clients Owe Us)</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                            {stats.clientUnpaidCount} Bills
                        </span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-3xl font-black text-amber-950 tracking-tight">
                            ₹{stats.clientReceivables.toLocaleString('en-IN')}
                        </h3>
                        <div className="flex items-center justify-between mt-3 text-xs font-bold text-amber-800">
                            <span>Uncollected service invoices</span>
                            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                Collect Invoices <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Staff Payables (Money to Pay Workers) */}
                <div 
                    onClick={() => navigate('/admin/hr')}
                    className="bg-gradient-to-br from-rose-50/50 to-red-50/30 p-5 rounded-2xl border border-rose-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-rose-100/80 text-rose-700">
                                <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900">Staff Wages Due</span>
                                <p className="text-[11px] font-semibold text-rose-700/80">Payables (Wages We Owe Workers)</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-full">
                            {stats.staffPendingCount} Ledgers
                        </span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-3xl font-black text-rose-950 tracking-tight">
                            ₹{stats.staffPayables.toLocaleString('en-IN')}
                        </h3>
                        <div className="flex items-center justify-between mt-3 text-xs font-bold text-rose-800">
                            <span>Pending settlement upon duty end</span>
                            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                Settle in HR <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Security Deposits Held */}
                <div 
                    onClick={() => navigate('/admin/billing?tab=deposits')}
                    className="bg-gradient-to-br from-indigo-50/50 to-blue-50/30 p-5 rounded-2xl border border-indigo-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-indigo-100/80 text-indigo-700">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900">Deposits in Escrow</span>
                                <p className="text-[11px] font-semibold text-indigo-700/80">Safeguards Active Patient Duties</p>
                            </div>
                        </div>
                        <span className="text-xs font-black bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-full">
                            {stats.depositsCount} Deposits
                        </span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-3xl font-black text-indigo-950 tracking-tight">
                            ₹{stats.depositsHeld.toLocaleString('en-IN')}
                        </h3>
                        <div className="flex items-center justify-between mt-3 text-xs font-bold text-indigo-800">
                            <span>Adjusted against final bills</span>
                            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                View Deposits <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── "Needs Attention Today" — Executive Action Center ──────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <h2 className="text-lg font-bold text-slate-900">Needs Attention Today</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Immediate operational actions requiring owner review and follow-up.
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveActionTab('staff_payouts')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeActionTab === 'staff_payouts'
                                    ? 'bg-white text-rose-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Wages to Pay</span>
                            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full text-[10px]">
                                {urgentStaffPayouts.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveActionTab('client_bills')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeActionTab === 'client_bills'
                                    ? 'bg-white text-amber-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Invoices to Collect</span>
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full text-[10px]">
                                {urgentClientBills.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveActionTab('ending_soon')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeActionTab === 'ending_soon'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Duties Ending Soon</span>
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px]">
                                {dutiesEndingSoon.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveActionTab('hot_leads')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeActionTab === 'hot_leads'
                                    ? 'bg-white text-teal-700 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Hot Inquiries</span>
                            <span className="px-1.5 py-0.2 bg-teal-100 text-teal-700 rounded-full text-[10px]">
                                {hotLeads.length}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="p-5 sm:p-6">
                    {/* Tab 1: Wages to Pay */}
                    {activeActionTab === 'staff_payouts' && (
                        <div>
                            {urgentStaffPayouts.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">
                                            Workers pending WhatsApp payslip and wage settlement:
                                        </p>
                                        <button
                                            onClick={() => navigate('/admin/hr')}
                                            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        >
                                            Open Full HR Ledger →
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {urgentStaffPayouts.slice(0, 6).map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-900 truncate">
                                                            {item.worker}
                                                        </span>
                                                        {item.type === 'final' && (
                                                            <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                                                Relieved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Client: <span className="font-semibold text-slate-700">{item.client_name}</span> • {item.days_worked} Days Duty
                                                    </p>
                                                    {item.period_start && item.period_end && (
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {item.period_start} → {item.period_end}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-black text-rose-600">
                                                        ₹{item.net_balance.toLocaleString('en-IN')}
                                                    </div>
                                                    <button
                                                        onClick={() => navigate('/admin/hr')}
                                                        className="mt-1.5 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200/60 transition-colors"
                                                    >
                                                        Settle in HR →
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-800">All worker payouts are settled!</p>
                                    <p className="text-xs text-slate-500 mt-1">No relieved staff awaiting wage settlement.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Client Invoices to Collect */}
                    {activeActionTab === 'client_bills' && (
                        <div>
                            {urgentClientBills.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">
                                            Invoices issued to clients awaiting payment collection:
                                        </p>
                                        <button
                                            onClick={() => navigate('/admin/billing?tab=monthly')}
                                            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        >
                                            Open Billing Center →
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {urgentClientBills.map((bill) => (
                                            <div
                                                key={bill.id}
                                                className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50/50 transition-colors flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-sm font-bold text-slate-900 truncate block">
                                                        {bill.client_name}
                                                    </span>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Period: <span className="font-medium text-slate-700">{bill.period_start} to {bill.period_end}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-black text-amber-900">
                                                        ₹{bill.amount.toLocaleString('en-IN')}
                                                    </div>
                                                    <button
                                                        onClick={() => navigate('/admin/billing?tab=monthly')}
                                                        className="mt-1.5 px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-colors"
                                                    >
                                                        Collect Payment →
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-800">All client invoices are fully paid!</p>
                                    <p className="text-xs text-slate-500 mt-1">No outstanding receivables detected.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Duties Ending Soon */}
                    {activeActionTab === 'ending_soon' && (
                        <div>
                            {dutiesEndingSoon.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
                                        Patient care contracts finishing in the next 7 days (call family to extend or replace staff):
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {dutiesEndingSoon.map((duty) => (
                                            <div
                                                key={duty.id}
                                                className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/30 flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-sm font-bold text-slate-900 truncate block">
                                                        {duty.client_name}
                                                    </span>
                                                    <p className="text-xs text-slate-600 mt-0.5">
                                                        Caregiver: <span className="font-semibold text-slate-800">{duty.worker_name}</span>
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        Duty concludes on {duty.end_date}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800">
                                                        {duty.days_remaining === 0 ? 'Ends Today' : `${duty.days_remaining}d left`}
                                                    </span>
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => navigate('/admin/clients')}
                                                            className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:text-indigo-900"
                                                        >
                                                            Manage Duty →
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-800">No duties expiring this week!</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        All current active duties are ongoing or have &gt; 7 days remaining.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 4: Hot Inquiries */}
                    {activeActionTab === 'hot_leads' && (
                        <div>
                            {hotLeads.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500">
                                            Recent inquiries awaiting caregiver placement:
                                        </p>
                                        <button
                                            onClick={() => navigate('/admin/crm')}
                                            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                                        >
                                            Open CRM Pipeline →
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {hotLeads.map((lead) => (
                                            <div
                                                key={lead.id}
                                                className="p-4 rounded-xl border border-slate-200/90 bg-white flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <span className="text-sm font-bold text-slate-900 truncate block">
                                                        {lead.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                                                            {lead.pipeline_stage}
                                                        </span>
                                                        {lead.phone && (
                                                            <span className="text-xs text-slate-400 font-mono">
                                                                {lead.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    {lead.estimated_value ? (
                                                        <span className="text-xs font-black text-slate-900 block">
                                                            ₹{lead.estimated_value.toLocaleString('en-IN')}/mo
                                                        </span>
                                                    ) : null}
                                                    <button
                                                        onClick={() => navigate('/admin/crm')}
                                                        className="mt-1 px-3 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs transition-colors"
                                                    >
                                                        Match Staff →
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm font-bold text-slate-800">No pending inquiries!</p>
                                    <p className="text-xs text-slate-500 mt-1">All leads have been processed.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Financial & Operations Visualizations ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Real Collections Trend (Left 2 cols) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[380px]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg">Cash Collections Timeline</h2>
                            <p className="text-xs text-slate-500">Verified receipts (Security Deposits + Patient Service Fees) over past 6 months.</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-teal-700">
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                                Total Cash In
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyCollectionsTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCashflow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35}/>
                                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                                <Tooltip 
                                    formatter={(value: number, name: string) => [`₹${value.toLocaleString('en-IN')}`, name === 'total' ? 'Total Collected' : name]} 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                                />
                                <Area type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorCashflow)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fleet Breakdown & Live Activity Stream (Right col) */}
                <div className="space-y-6">
                    {/* Fleet Capacity Status */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-900 text-sm">Fleet Capacity & Roles</h3>
                            <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                                {stats.totalFleet} Verified Staff
                            </span>
                        </div>

                        {/* Visual Capacity Bar */}
                        <div className="space-y-1.5 mb-4">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Deployed ({stats.activeDeployments})</span>
                                <span>Bench ({stats.benchAvailable})</span>
                            </div>
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div 
                                    style={{ width: `${fleetUtilizationPct}%` }} 
                                    className="bg-teal-500 h-full transition-all duration-500" 
                                    title={`Deployed: ${stats.activeDeployments}`}
                                />
                                <div 
                                    style={{ width: `${100 - fleetUtilizationPct}%` }} 
                                    className="bg-blue-400 h-full transition-all duration-500" 
                                    title={`Available: ${stats.benchAvailable}`}
                                />
                            </div>
                        </div>

                        {/* Top Specializations */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            {Object.entries(roleDistribution).slice(0, 4).map(([role, count]) => (
                                <div key={role} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                                    <span className="truncate">{role}</span>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {count} Staff
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live Operations Stream */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm">Recent Operations</h3>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md border border-teal-200/60">
                                Live
                            </span>
                        </div>
                        <div className="p-3 max-h-[320px] overflow-auto space-y-2.5">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(activity => (
                                    <div key={activity.id} className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 hover:bg-slate-50 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/70 flex items-center justify-center shrink-0">
                                            {getActivityIcon(activity.event_type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                                                    {getActivityLabel(activity.event_type)}
                                                </p>
                                                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-0.5 shrink-0">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatActivityTime(activity.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-tight line-clamp-2">
                                                {activity.description}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                                    No recent activity recorded today.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
