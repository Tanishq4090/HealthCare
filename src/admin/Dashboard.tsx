import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizePipelineStages } from '../utils/crm';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Users, UserCheck, Wallet, IndianRupee,
    FileText, CheckCircle2, MessageSquare,
    RefreshCw, Clock, Bot, ArrowRight, Globe,
    Calendar, MapPin, Phone, MessageCircle
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
};

type WebsiteBooking = {
    id: string;
    name: string;
    phone: string;
    service: string;
    location?: string;
    patientNotes?: string;
    appointment_datetime?: string;
    pipeline_stage: string;
    created_at: string;
};

export default function Dashboard() {
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        activeStaff: 0,
        availableStaff: 0,
        totalStaff: 0,
        totalCollections: 0,
        monthCollections: 0,
        clientReceivables: 0,
        clientUnpaidCount: 0,
        staffPayables: 0,
        staffPendingCount: 0,
        depositsHeld: 0,
        activeLeadsCount: 0,
        websiteBookingsCount: 0,
    });

    const [monthlyCollectionsTrend, setMonthlyCollectionsTrend] = useState<any[]>([]);
    const [urgentStaffPayouts, setUrgentStaffPayouts] = useState<UrgentStaffPayout[]>([]);
    const [urgentClientBills, setUrgentClientBills] = useState<UrgentClientBill[]>([]);
    const [websiteBookings, setWebsiteBookings] = useState<WebsiteBooking[]>([]);
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecentActivity = async () => {
        const [activityResult, whatsappResult] = await Promise.all([
            supabase
                .from('crm_lead_activity')
                .select('id, lead_id, event_type, description, metadata, created_at')
                .order('created_at', { ascending: false })
                .limit(6),
            supabase
                .from('whatsapp_logs')
                .select('id, status, error_message, payload, created_at')
                .order('created_at', { ascending: false })
                .limit(6),
        ]);

        const activities = activityResult.data || [];
        const whatsappLogs = whatsappResult.error ? [] : (whatsappResult.data || []);

        const leadIds = [...new Set((activities || []).map(item => item.lead_id).filter(Boolean))];
        let leadNames: Record<string, string> = {};

        if (leadIds.length > 0) {
            const { data: leads } = await supabase
                .from('crm_leads')
                .select('id, name')
                .in('id', leadIds);

            if (leads) {
                leadNames = leads.reduce((acc: Record<string, string>, lead: any) => {
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
            let description = 'Automated WhatsApp message.';

            if (payload.pipelineStageUpdate) {
                description = `Moved lead to "${payload.pipelineStageUpdate}".`;
            } else if (payload.templateName === 'post_call_intake') {
                description = `Sent intake form to ${recipient}.`;
            } else if (payload.templateName === 'deposit_request') {
                description = `Sent deposit request to ${recipient}.`;
            } else if (payload.templateName === 'client_monthly_invoice') {
                description = `Sent service invoice to ${recipient}.`;
            } else if (payload.templateName === 'staff_assignment') {
                description = `Sent staff assignment to ${recipient}.`;
            } else if (payload.templateName === 'worker_payslip') {
                description = `Dispatched worker payslip to ${recipient}.`;
            } else if (payload.message) {
                description = `Replied to ${recipient}: "${String(payload.message).slice(0, 50)}..."`;
            }

            return {
                id: `whatsapp-${log.id}`,
                lead_id: payload.leadId,
                event_type: `whatsapp_${templateName}`,
                description,
                metadata: payload,
                created_at: log.created_at,
                leadName: payload.leadName
            };
        });

        setRecentActivity([...leadActivity, ...whatsappActivity]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 6));
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
                { data: bills },
                { data: payrolls },
                { data: webBookingsData },
            ] = await Promise.all([
                supabase.from('crm_leads').select('id, name, pipeline_stage').is('deleted_at', null),
                supabase.from('employees').select('id, full_name, status'),
                supabase.from('automation_settings').select('pipeline_stages').eq('id', 'global').maybeSingle(),
                supabase.from('payments').select('id, amount, payment_type, payment_date'),
                supabase.from('service_bills').select('id, amount, notes, period_start, period_end, services(clients(client_name))'),
                supabase.from('payroll').select('id, worker, client_name, days_worked, net_balance, status, period_start, period_end, type'),
                supabase.from('crm_leads').select('id, name, phone, notes, appointment_datetime, pipeline_stage, created_at, source')
                    .or('source.ilike.%website%,source.ilike.%appointment%,appointment_datetime.not.is.null')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(6)
            ]);

            // 1. Leads
            const pipelineStages = sanitizePipelineStages(
                settings?.pipeline_stages || ['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending']
            );
            const activeLeads = (leads || []).filter(l => pipelineStages.includes(l.pipeline_stage));

            // 2. Staff
            const activeEmployees = (employees || []).filter(e => e.status === 'assigned' || e.status === 'Active');
            const availableEmployees = (employees || []).filter(e => e.status === 'available');

            // 3. Collections
            const allPayments = payments || [];
            const totalCollections = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const depositsHeld = allPayments
                .filter(p => p.payment_type === 'deposit')
                .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            const thisMonthPayments = allPayments.filter(p => {
                if (!p.payment_date) return false;
                const d = new Date(p.payment_date);
                return d >= monthStart && d < nextMonthStart;
            });
            const monthCollections = thisMonthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // 4. Monthly Collections Timeline (Past 6 months)
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const trendMap = new Map<string, { name: string; total: number; deposits: number; service: number }>();

            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                trendMap.set(key, {
                    name: monthNames[targetDate.getMonth()],
                    total: 0,
                    deposits: 0,
                    service: 0
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

            // 5. Client Unpaid Invoices
            const unpaidBillsList: UrgentClientBill[] = [];
            let clientReceivablesSum = 0;

            (bills || []).forEach(b => {
                const amt = Number(b.amount) || 0;
                let isPaid = false;
                if (b.notes) {
                    try {
                        const parsed = JSON.parse(b.notes);
                        if (parsed.status === 'paid' || parsed.status === 'settled') isPaid = true;
                    } catch {
                        // ignore
                    }
                }

                if (!isPaid && amt > 0) {
                    clientReceivablesSum += amt;
                    const sObj: any = Array.isArray(b.services) ? b.services[0] : b.services;
                    const cObj: any = Array.isArray(sObj?.clients) ? sObj.clients[0] : sObj?.clients;
                    unpaidBillsList.push({
                        id: b.id,
                        client_name: cObj?.client_name || 'Client',
                        amount: amt,
                        period_start: b.period_start,
                        period_end: b.period_end,
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
                        worker: p.worker || 'Staff',
                        client_name: p.client_name || 'Client',
                        days_worked: Number(p.days_worked) || 0,
                        net_balance: bal,
                        period_start: p.period_start,
                        period_end: p.period_end,
                        type: p.type
                    });
                }
            });

            // Prioritize relieved staff first
            pendingPayrollsList.sort((a, b) => {
                if (a.type === 'final' && b.type !== 'final') return -1;
                if (b.type === 'final' && a.type !== 'final') return 1;
                return b.net_balance - a.net_balance;
            });
            setUrgentStaffPayouts(pendingPayrollsList);

            // 7. Recent Website Bookings Parsing
            const parsedBookings: WebsiteBooking[] = (webBookingsData || []).map(l => {
                const lines = (l.notes || '').split('\n');
                let service = '';
                let location = '';
                let patientNotes = '';
                lines.forEach((line: string) => {
                    const idx = line.indexOf(':');
                    if (idx !== -1) {
                        const k = line.slice(0, idx).trim().toLowerCase();
                        const v = line.slice(idx + 1).trim();
                        if (k === 'service') service = v;
                        if (k === 'location') location = v;
                        if (k.includes('patient note')) patientNotes = v;
                    }
                });
                return {
                    id: l.id,
                    name: l.name || 'Website Visitor',
                    phone: l.phone || '',
                    service: service || 'Home Healthcare',
                    location: location || undefined,
                    patientNotes: patientNotes && patientNotes.toLowerCase() !== 'no' ? patientNotes : undefined,
                    appointment_datetime: l.appointment_datetime,
                    pipeline_stage: l.pipeline_stage || 'New Inquiry',
                    created_at: l.created_at
                };
            });
            setWebsiteBookings(parsedBookings);

            setStats({
                activeStaff: activeEmployees.length,
                availableStaff: availableEmployees.length,
                totalStaff: (employees || []).length,
                totalCollections,
                monthCollections,
                clientReceivables: clientReceivablesSum,
                clientUnpaidCount: unpaidBillsList.length,
                staffPayables: staffPayablesSum,
                staffPendingCount: pendingPayrollsList.length,
                depositsHeld,
                activeLeadsCount: activeLeads.length,
                websiteBookingsCount: parsedBookings.length,
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

        const sub = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => fetchDashboardData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => fetchDashboardData())
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

    const formatActivityTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const formatApptDateTime = (dateStr?: string) => {
        if (!dateStr) return null;
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const getActivityIcon = (eventType: string) => {
        if (eventType.includes('payment') || eventType.includes('deposit')) return <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />;
        if (eventType.includes('payslip') || eventType.includes('worker')) return <Wallet className="w-3.5 h-3.5 text-blue-600" />;
        if (eventType.includes('invoice') || eventType.includes('sent')) return <MessageSquare className="w-3.5 h-3.5 text-teal-600" />;
        return <Bot className="w-3.5 h-3.5 text-slate-500" />;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] w-full gap-2">
                <RefreshCw className="w-7 h-7 text-teal-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1500px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">
                        Business Dashboard
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Real-time cash collections, website bookings, staff duties, and outstanding balances.
                    </p>
                </div>
                <button
                    onClick={() => fetchDashboardData()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* ── 1. Top Section: Monthly Collections Graph ─────────────────────── */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-900 text-base">Monthly Cash Collections</h2>
                        <p className="text-xs text-slate-500">Total money collected (Security Deposits + Care Service Fees) over the last 6 months.</p>
                    </div>
                    <div className="flex items-center flex-wrap gap-6 sm:gap-8">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Collections</span>
                            <span className="text-lg sm:text-xl font-black text-slate-900">₹{stats.totalCollections.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">This Month</span>
                            <span className="text-lg sm:text-xl font-black text-emerald-600">₹{stats.monthCollections.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deposits in Hand</span>
                            <span className="text-lg sm:text-xl font-black text-indigo-600">₹{stats.depositsHeld.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div className="h-[220px] sm:h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyCollectionsTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                            <Tooltip
                                formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Total Collected']}
                                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorCollections)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── 2. Core Numbers: 6 Dedicated Cards (Opens Exact Tabs!) ─────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* 1. Staff on Duty */}
                <div
                    onClick={() => navigate('/admin/clients')}
                    className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff on Duty</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">{stats.activeStaff}</h3>
                        <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center justify-between">
                            <span>Deployed</span>
                            <ArrowRight className="w-3 h-3 text-teal-600 group-hover:translate-x-1 transition-transform" />
                        </p>
                    </div>
                </div>

                {/* 2. Available Staff */}
                <div
                    onClick={() => navigate('/admin/hr?tab=allocation')}
                    className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Staff</span>
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            <UserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">{stats.availableStaff}</h3>
                        <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center justify-between">
                            <span>Ready to deploy</span>
                            <ArrowRight className="w-3 h-3 text-blue-600 group-hover:translate-x-1 transition-transform" />
                        </p>
                    </div>
                </div>

                {/* 3. Staff Wages Due (Opens HR Payroll Tab Directly!) */}
                <div
                    onClick={() => navigate('/admin/hr?tab=payroll')}
                    className="bg-rose-50/40 p-4 rounded-xl border border-rose-200/90 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Staff Wages Due</span>
                        <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-rose-900">₹{stats.staffPayables.toLocaleString('en-IN')}</h3>
                        <p className="text-[11px] font-bold text-rose-700 mt-1 flex items-center justify-between">
                            <span>{stats.staffPendingCount} pending</span>
                            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                Pay in HR →
                            </span>
                        </p>
                    </div>
                </div>

                {/* 4. Client Invoices Due (Opens Billing Monthly Tab Directly!) */}
                <div
                    onClick={() => navigate('/admin/billing?tab=monthly')}
                    className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Invoices Due</span>
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-amber-900">₹{stats.clientReceivables.toLocaleString('en-IN')}</h3>
                        <p className="text-[11px] font-bold text-amber-700 mt-1 flex items-center justify-between">
                            <span>{stats.clientUnpaidCount} unpaid</span>
                            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                Invoices →
                            </span>
                        </p>
                    </div>
                </div>

                {/* 5. Security Deposits Held (Opens Billing Deposits Tab Directly!) */}
                <div
                    onClick={() => navigate('/admin/billing?tab=deposits')}
                    className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200/90 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Deposits Held</span>
                        <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                            <IndianRupee className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-indigo-900">₹{stats.depositsHeld.toLocaleString('en-IN')}</h3>
                        <p className="text-[11px] font-bold text-indigo-700 mt-1 flex items-center justify-between">
                            <span>In reserve</span>
                            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                Deposits →
                            </span>
                        </p>
                    </div>
                </div>

                {/* 6. Website Bookings */}
                <div
                    onClick={() => navigate('/admin/crm')}
                    className="bg-teal-50/40 p-4 rounded-xl border border-teal-200/90 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-teal-800 uppercase tracking-wider">Web Bookings</span>
                        <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700">
                            <Globe className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-teal-900">{stats.websiteBookingsCount}</h3>
                        <p className="text-[11px] font-bold text-teal-700 mt-1 flex items-center justify-between">
                            <span>Online requests</span>
                            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                View CRM →
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* ── 3. Recent Website Bookings (Prominent Section) ─────────────────── */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                Recent Website Bookings
                                <span className="text-xs font-black bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                                    {websiteBookings.length} Requests
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Real-time home care appointment bookings submitted directly from 99care.org
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/admin/crm')}
                        className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                        View All in CRM →
                    </button>
                </div>

                {websiteBookings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {websiteBookings.map((booking) => (
                            <div
                                key={booking.id}
                                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between gap-3"
                            >
                                <div>
                                    {/* Name and stage */}
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h3 className="text-sm font-bold text-slate-900 truncate">
                                            {booking.name}
                                        </h3>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/70 shrink-0">
                                            {booking.pipeline_stage}
                                        </span>
                                    </div>

                                    {/* Service badge */}
                                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-white border border-slate-200/80 px-2.5 py-1 rounded-md mb-2 shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span className="truncate">{booking.service}</span>
                                    </div>

                                    {/* Appointment time */}
                                    {booking.appointment_datetime && (
                                        <p className="text-xs text-slate-600 flex items-center gap-1.5 mb-1">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-800">
                                                {formatApptDateTime(booking.appointment_datetime)}
                                            </span>
                                        </p>
                                    )}

                                    {/* Location */}
                                    {booking.location && (
                                        <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                            <span className="line-clamp-1">{booking.location}</span>
                                        </p>
                                    )}

                                    {/* Patient Notes */}
                                    {booking.patientNotes && (
                                        <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900 italic line-clamp-2 mt-1.5">
                                            "{booking.patientNotes}"
                                        </div>
                                    )}
                                </div>

                                {/* Bottom action buttons */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => navigate('/admin/crm', { state: { openLeadId: booking.id } })}
                                        className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                                    >
                                        Open in CRM →
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        {booking.phone && (
                                            <>
                                                <a
                                                    href={`tel:${booking.phone}`}
                                                    title={`Call ${booking.phone}`}
                                                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-teal-600 hover:border-teal-300 transition-colors shadow-2xs"
                                                >
                                                    <Phone className="w-3.5 h-3.5" />
                                                </a>
                                                <a
                                                    href={`https://wa.me/91${booking.phone.replace(/\D/g, '').slice(-10)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Message on WhatsApp"
                                                    className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                        <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No website bookings received yet.
                    </div>
                )}
            </div>

            {/* ── 4. Immediate Action Items (Two Clean Side-by-Side Lists) ───────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Relieved Staff Awaiting Payout */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                Staff Awaiting Wage Payment
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Workers who completed duty and need payslip & settlement</p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/hr?tab=payroll')}
                            className="text-xs font-bold text-teal-600 hover:text-teal-700"
                        >
                            Open HR Payroll →
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-2.5">
                        {urgentStaffPayouts.length > 0 ? (
                            urgentStaffPayouts.slice(0, 5).map(item => (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900 truncate">
                                                {item.worker}
                                            </span>
                                            {item.type === 'final' && (
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                                    Relieved
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Client: <span className="font-semibold text-slate-700">{item.client_name}</span> • {item.days_worked} days
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black text-rose-700">
                                            ₹{item.net_balance.toLocaleString('en-IN')}
                                        </div>
                                        <button
                                            onClick={() => navigate('/admin/hr?tab=payroll')}
                                            className="mt-1 px-2.5 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors"
                                        >
                                            Pay in HR →
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-xs">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                All worker payouts are up to date.
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Unpaid Client Invoices */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Client Invoices Pending Payment
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Uncollected service bills issued to clients</p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/billing?tab=monthly')}
                            className="text-xs font-bold text-teal-600 hover:text-teal-700"
                        >
                            Open Billing →
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-2.5">
                        {urgentClientBills.length > 0 ? (
                            urgentClientBills.slice(0, 5).map(bill => (
                                <div
                                    key={bill.id}
                                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
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
                                            className="mt-1 px-2.5 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] transition-colors"
                                        >
                                            Collect →
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-xs">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                All client invoices are collected.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 5. Compact Recent Activity Stream ─────────────────────────────── */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <h3 className="font-bold text-slate-900 text-sm">Recent Activity</h3>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                        Live
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {recentActivity.map(activity => (
                        <div key={activity.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60 shrink-0 mt-0.5">
                                {getActivityIcon(activity.event_type)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {formatActivityTime(activity.created_at)}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-700 mt-1 leading-snug line-clamp-2">
                                    {activity.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
