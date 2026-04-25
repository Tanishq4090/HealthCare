import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, CheckCircle2, Loader2, Phone, Sparkles, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { AdminPage, IconFrame, SectionHeader, Surface, TrendPill } from './AdminPrimitives';

type Stats = {
    activeLeads: { value: number; trend: string };
    activeWorkers: { value: number; trend: string };
    totalMrr: { value: string; trend: string };
    aiVoiceCalls: { value: number; trend: string };
};

type RevenuePoint = {
    name: string;
    revenue: number;
};

function StatCard({
    label,
    value,
    trend,
    icon,
    tone,
}: {
    label: string;
    value: string | number;
    trend: string;
    icon: LucideIcon;
    tone: 'cyan' | 'emerald' | 'amber' | 'blue';
}) {
    return (
        <Surface className="transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <span className="text-xs font-bold uppercase text-slate-400">{label}</span>
                    <p className="mt-8 text-3xl font-extrabold leading-none text-slate-950">{value}</p>
                </div>
                <IconFrame icon={icon} tone={tone} />
            </div>
            <div className="mt-5">
                <TrendPill value={trend} />
            </div>
        </Surface>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats>({
        activeLeads: { value: 0, trend: '+0%' },
        activeWorkers: { value: 0, trend: '+0%' },
        totalMrr: { value: '₹0', trend: '+0%' },
        aiVoiceCalls: { value: 48, trend: '+12%' },
    });
    const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [{ data: leads }, { data: employees }, { data: settings }] = await Promise.all([
                    supabase.from('crm_leads').select('id, pipeline_stage, estimated_value_monthly, created_at'),
                    supabase.from('employees').select('id, status, monthly_daily_rate'),
                    supabase.from('automation_settings').select('pipeline_stages').eq('id', 'global').maybeSingle(),
                ]);

                const pipelineStages = settings?.pipeline_stages || ['New Lead', 'New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending'];
                const activeLeads = leads?.filter((lead) => pipelineStages.includes(lead.pipeline_stage)) || [];
                const activeWorkersList = employees?.filter((worker) => worker.status === 'assigned' || worker.status === 'Active') || [];

                let mrr = 0;
                activeWorkersList.forEach((worker) => {
                    mrr += (Number(worker.monthly_daily_rate) || 0) * 30;
                });

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
                const generatedRevenue = months.map((month, idx) => ({
                    name: month,
                    revenue: Math.floor(mrr * (0.3 + idx * 0.14)),
                }));

                setStats({
                    activeLeads: { value: activeLeads.length, trend: '+0%' },
                    activeWorkers: { value: activeWorkersList.length, trend: '+0%' },
                    totalMrr: { value: `₹${mrr.toLocaleString()}`, trend: '+0%' },
                    aiVoiceCalls: { value: 0, trend: '0%' },
                });

                setRevenueData(generatedRevenue);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <div className="clinical-surface p-6">
                    <div className="clinical-content flex items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
                        <span className="text-sm font-semibold text-slate-500">Loading live command center...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AdminPage>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
                <Surface className="bg-gradient-to-br from-white via-cyan-50/50 to-emerald-50/70">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase text-cyan-700">Clinical Intelligence Layer</p>
                            <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Care operations are trending healthy.</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                AI voice capture, deployment signals, and finance movement are consolidated into one calm operating view.
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            {[
                                { value: 'Live', label: 'Sync status' },
                                { value: stats.activeWorkers.value, label: 'Workers live' },
                                { value: stats.activeLeads.value, label: 'Open leads' },
                            ].map((item) => (
                                <div key={item.label} className="rounded-lg border border-white/80 bg-white/75 px-4 py-3 shadow-sm">
                                    <p className="text-xl font-extrabold text-slate-950">{item.value}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </Surface>

                <Surface>
                    <div className="flex items-center gap-3">
                        <IconFrame icon={Sparkles} tone="emerald" />
                        <div>
                            <p className="text-sm font-bold text-slate-950">AI Watchlist</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">Follow-ups, worker deployment, and billing cues stay visible without exposing private records.</p>
                        </div>
                    </div>
                </Surface>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Active Leads" value={stats.activeLeads.value} trend={stats.activeLeads.trend} icon={TrendingUp} tone="cyan" />
                <StatCard label="Active Deployments" value={stats.activeWorkers.value} trend={stats.activeWorkers.trend} icon={Users} tone="emerald" />
                <StatCard label="Platform MRR" value={stats.totalMrr.value} trend={stats.totalMrr.trend} icon={Activity} tone="blue" />
                <StatCard label="AI Voice Calls" value={stats.aiVoiceCalls.value} trend={stats.aiVoiceCalls.trend} icon={Phone} tone="amber" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Surface className="xl:col-span-2">
                    <SectionHeader
                        title="Monthly Recurring Revenue"
                        description="Projected trajectory based on active worker deployments."
                    />
                    <div className="mt-6 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0891B2" stopOpacity={0.22} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(value) => `₹${Number(value) / 1000}k`} dx={-10} />
                                <Tooltip
                                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'MRR']}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255,255,255,0.96)',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '8px',
                                        boxShadow: '0 16px 34px rgba(15, 23, 42, 0.12)',
                                    }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#0891B2" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Surface>

                <Surface>
                    <SectionHeader
                        title="Recent AI Activity"
                        action={<span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Live Stream</span>}
                    />
                    <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/60 p-6 text-center">
                        <div>
                            <IconFrame icon={CheckCircle2} tone="slate" className="mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-700">No recent activity.</p>
                            <p className="mt-1 text-xs text-slate-400">Waiting for new AI events...</p>
                        </div>
                    </div>
                </Surface>
            </div>
        </AdminPage>
    );
}
