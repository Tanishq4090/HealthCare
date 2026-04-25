import { useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    Bell,
    Bot,
    Briefcase,
    ExternalLink,
    Landmark,
    LayoutDashboard,
    LogOut,
    Menu,
    Search,
    Settings,
    ShieldCheck,
    Sparkles,
    Stethoscope,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const pageCopy: Record<string, { title: string; subtitle: string }> = {
    '/admin': { title: 'Analytics Command Center', subtitle: 'Real-time business performance and AI automation metrics.' },
    '/admin/crm': { title: 'AI CRM Center', subtitle: 'AI-powered lead intelligence and care-partner pipeline.' },
    '/admin/clients': { title: 'Client Directory', subtitle: 'Manage healthcare clients and service history.' },
    '/admin/hr': { title: 'AI HR Center', subtitle: 'Healthcare worker deployment and payroll automation.' },
    '/admin/billing': { title: 'Finance Center', subtitle: 'Invoicing, payroll, and revenue tracking.' },
    '/admin/settings': { title: 'Access Control', subtitle: 'Manage team roles and permissions.' },
};

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, hasAccess } = useAuth();
    const [isGlobalNotificationsOpen, setIsGlobalNotificationsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, requiredModule: 'dashboard' as AccessModule },
        { name: 'AI CRM', href: '/admin/crm', icon: Bot, requiredModule: 'crm' as AccessModule },
        { name: 'Clients', href: '/admin/clients', icon: Users, requiredModule: 'clients' as AccessModule },
        { name: 'AI HR', href: '/admin/hr', icon: Briefcase, requiredModule: 'hr' as AccessModule },
        { name: 'Finance', href: '/admin/billing', icon: Landmark, requiredModule: 'finance' as AccessModule },
    ];

    const filteredNavigation = navigation.filter((item) => hasAccess(item.requiredModule));

    if (location.pathname === '/admin' && !hasAccess('dashboard')) {
        const firstAllowed = filteredNavigation.find((item) => item.href !== '/admin');
        if (firstAllowed) {
            return <Navigate to={firstAllowed.href} replace />;
        }
    }

    const pageInfo = pageCopy[location.pathname] || pageCopy['/admin'];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const renderNav = (mobile = false) => (
        <nav className={cn('flex-1 overflow-y-auto px-3 pb-4', mobile && 'pt-4')}>
            {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                    <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => mobile && setIsMobileMenuOpen(false)}
                        className={cn(
                            'group mb-1 flex items-center justify-between rounded-lg border border-transparent px-3 py-3 text-sm font-semibold transition-all',
                            isActive
                                ? 'border-cyan-100 bg-cyan-50 text-cyan-800 shadow-sm'
                                : 'text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800'
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-cyan-700' : 'text-slate-400 group-hover:text-cyan-700')} />
                            <span className="truncate">{item.name}</span>
                        </span>
                    </Link>
                );
            })}

            {user?.role === 'admin' && (
                <Link
                    to="/admin/settings"
                    onClick={() => mobile && setIsMobileMenuOpen(false)}
                    className={cn(
                        'group mt-3 flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-sm font-semibold transition-all',
                        location.pathname === '/admin/settings'
                            ? 'border-cyan-100 bg-cyan-50 text-cyan-800 shadow-sm'
                            : 'text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800'
                    )}
                >
                    <Settings className={cn('h-5 w-5 shrink-0', location.pathname === '/admin/settings' ? 'text-cyan-700' : 'text-slate-400 group-hover:text-cyan-700')} />
                    Access Control
                </Link>
            )}
        </nav>
    );

    return (
        <div className="clinical-canvas min-h-screen">
            <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                    'fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-sm transition-opacity lg:hidden',
                    isMobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
            />

            <aside
                className={cn(
                    'fixed bottom-4 left-4 top-4 z-50 flex w-[280px] flex-col rounded-lg border border-slate-200/80 bg-white/95 shadow-soft backdrop-blur-xl transition-all duration-300',
                    isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]',
                    'lg:translate-x-0'
                )}
            >
                <div className="flex h-[72px] items-center justify-between border-b border-slate-100 px-4">
                    <Link to="/admin" className="flex min-w-0 items-center gap-3" title="Dashboard">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-50 ring-1 ring-cyan-100">
                            <img src="/99care-logo.svg" alt="99Care Logo" className="h-8 w-8 object-contain" />
                        </div>
                        <div className="min-w-0">
                            <span className="block truncate text-sm font-extrabold text-slate-950">99Care</span>
                            <span className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                Operations OS
                            </span>
                        </div>
                    </Link>
                    <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 lg:hidden">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-4 py-4">
                    <div className="rounded-lg border border-cyan-100 bg-cyan-50/70 p-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-cyan-700 shadow-sm">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-slate-800">Care Ops Live</p>
                                <p className="truncate text-[11px] text-slate-500">AI triage and workforce sync</p>
                            </div>
                        </div>
                    </div>
                </div>

                {renderNav()}

                <div className="mx-4 border-t border-slate-100" />

                <div className="p-4">
                    <div className="flex items-center gap-3 rounded-lg bg-slate-50/80 p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-emerald-500 text-white shadow-glow">
                            <Stethoscope className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">{user?.name || 'System User'}</span>
                            <span className="text-xs capitalize text-slate-400">{user?.role?.replace('_', ' ') || 'Guest'}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="min-h-screen pt-[104px] transition-all duration-300 lg:pl-[304px]">
                <header className="clinical-header fixed left-4 right-4 top-4 z-30 flex h-[72px] items-center justify-between gap-3 px-3 sm:px-5 lg:left-[304px]">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 sm:flex">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-base font-extrabold text-slate-950 sm:text-xl">{pageInfo.title}</h1>
                            <p className="hidden truncate text-sm text-slate-500 md:block">{pageInfo.subtitle}</p>
                        </div>
                    </div>

                    <div className="hidden flex-1 justify-center px-4 md:flex">
                        <div className="relative w-full max-w-lg">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search clients, workers, invoices..."
                                className="field-control w-full pl-10 pr-4"
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsGlobalNotificationsOpen(!isGlobalNotificationsOpen)}
                                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-all hover:border-cyan-200 hover:text-cyan-700"
                                aria-label="Notifications"
                            >
                                <Bell className="h-5 w-5" />
                                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                            </button>

                            {isGlobalNotificationsOpen && (
                                <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-soft">
                                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4">
                                        <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                                        <span className="rounded-full border border-cyan-100 bg-white px-2 py-0.5 text-[10px] font-bold text-cyan-700">3 New</span>
                                    </div>
                                    <div className="max-h-[300px] divide-y divide-slate-50 overflow-y-auto">
                                        {[
                                            { title: 'System Update', copy: 'Operations OS has a refreshed clinical dashboard experience.', time: 'Just now' },
                                            { title: 'AI Weekly Report', copy: 'AI agents handled recent calls and summarized follow-up work.', time: '2 hours ago' },
                                            { title: 'Payment Recorded', copy: 'A new collection was logged for the finance team review queue.', time: '5 hours ago' },
                                        ].map((item) => (
                                            <div key={item.title} className="cursor-pointer bg-cyan-50/25 p-4 transition-colors hover:bg-slate-50">
                                                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.copy}</p>
                                                <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">{item.time}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-slate-50 bg-slate-50/50 p-3 text-center">
                                        <button type="button" className="text-xs font-bold text-cyan-700 hover:underline">Mark all as read</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <Link to="/" target="_blank" rel="noopener noreferrer" className="btn-secondary hidden py-2 text-cyan-700 sm:inline-flex">
                            <ExternalLink className="h-4 w-4" />
                            <span className="hidden xl:inline">View Public Site</span>
                            <span className="xl:hidden">Public Site</span>
                        </Link>
                    </div>
                </header>

                <div className="px-4 pb-8 sm:px-6 lg:pr-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
