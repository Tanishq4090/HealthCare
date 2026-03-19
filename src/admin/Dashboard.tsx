export default function Dashboard() {
    const stats = [
        { label: 'Active Leads', value: '24', trend: '+12%', isPositive: true },
        { label: 'Active Workers', value: '18', trend: '+2', isPositive: true },
        { label: 'Total MRR', value: '₹8,450', trend: '+15.2%', isPositive: true },
        { label: 'AI Voice Calls', value: '48', trend: '+12%', isPositive: true },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Platform Overview</h1>
                    <p className="text-slate-500 mt-1">Welcome back. Here's what's happening today.</p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {stat.trend}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* AI CRM Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">Recent CRM Activity</h2>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">AI Active</span>
                    </div>
                    <div className="p-5 flex-1 p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-primary">AI</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-900"><span className="font-semibold">Auto-responder sent</span> Folio to "Sarah Jenkins" for "Service Inquiry".</p>
                                <p className="text-xs text-slate-500 mt-0.5">2 minutes ago</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-primary">IN</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-900"><span className="font-semibold">New Lead Captured</span> from AI Voice Call - "Mark Johnson".</p>
                                <p className="text-xs text-slate-500 mt-0.5">15 minutes ago</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-amber-600">AI</span>
                            </div>
                            <div>
                                <p className="text-sm text-slate-900"><span className="font-semibold">Meeting Booked</span> via AI Assistant for tomorrow at 2:00 PM.</p>
                                <p className="text-xs text-slate-500 mt-0.5">1 hour ago</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI HR Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">HR Automations</h2>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">AI Scheduled</span>
                    </div>
                    <div className="p-5 flex-1 p-5 space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Upcoming Payroll Run</p>
                                <p className="text-xs text-slate-500 mt-0.5">18 employees scheduled for auto-payslip dispatch.</p>
                            </div>
                            <span className="text-sm font-bold text-slate-900">Oct 1st</span>
                        </div>

                        <div className="space-y-3 mt-4">
                            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Worker Allocation Hub</h3>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Active Deployments</span>
                                <span className="text-sm font-medium text-slate-900">14/18 workers</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-primary h-2 rounded-full" style={{ width: '78%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
