import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, LogOut, Bell, Search, Landmark, Settings, CreditCard, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule } from '../contexts/AuthContext';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, hasAccess } = useAuth();
    const [isGlobalNotificationsOpen, setIsGlobalNotificationsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Navigation items linked to their required module (null means always visible)
    const navigation = [
        { name: 'Dashboard',          href: '/admin',                    icon: LayoutDashboard, requiredModule: 'dashboard' as AccessModule },
        { name: 'AI CRM',             href: '/admin/crm',                icon: Users,           requiredModule: 'crm' as AccessModule },
        { name: 'Clients',            href: '/admin/clients',            icon: Users,           requiredModule: 'clients' as AccessModule },
        { name: 'AI HR',              href: '/admin/hr',                 icon: UserCog,         requiredModule: 'hr' as AccessModule },
        { name: 'Finance',            href: '/admin/billing',            icon: Landmark,        requiredModule: 'finance' as AccessModule, status: 'construction' },
    ];

    const filteredNavigation = navigation.filter(item => {
        if (!item.requiredModule) return true;
        return hasAccess(item.requiredModule);
    });

    // If user is at /admin but doesn't have dashboard access, redirect to first allowed module
    if (location.pathname === '/admin' && !hasAccess('dashboard')) {
        const firstAllowed = filteredNavigation.find(item => item.href !== '/admin');
        if (firstAllowed) {
            return <Navigate to={firstAllowed.href} replace />;
        }
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
                {/* Logo */}
                <div className="h-20 flex items-center px-6 border-b border-slate-100">
                    <Link to="/admin" className="flex items-center gap-3" title="Dashboard">
                        <img 
                            src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" 
                            alt="99Care Logo" 
                            className="w-10 h-10 object-contain"
                        />
                        <div className="flex flex-col">
                            <span className="font-bold text-xl text-[#1aa6a8] font-['Plus_Jakarta_Sans'] leading-tight">99Care</span>
                            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase leading-tight">Operations OS</span>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {filteredNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                                    {item.name}
                                </div>
                                {(item as any).status === 'construction' && (
                                    <span className="text-[9px] font-bold tracking-wider uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">Coming Soon</span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Settings Link for Admins */}
                {user?.role === 'admin' && (
                    <div className="px-4 pb-2">
                        <Link
                            to="/admin/settings"
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${location.pathname === '/admin/settings'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <Settings className={`w-5 h-5 ${location.pathname === '/admin/settings' ? 'text-primary' : 'text-slate-400'}`} />
                            Access Control
                        </Link>
                    </div>
                )}

                {/* User Info & Logout */}
                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="font-semibold text-slate-600 text-sm">{user?.avatar || 'U'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
                            <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ') || 'Guest'}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Mobile menu button */}
                    <div className="lg:hidden flex items-center gap-3">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="font-bold text-[#1aa6a8] font-['Plus_Jakarta_Sans']">99Care OS</span>
                    </div>

                    {/* Mobile Drawer Overlay */}
                    {isMobileMenuOpen && (
                        <div className="fixed inset-0 z-[100] lg:hidden">
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                            <div className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <img 
                                            src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" 
                                            alt="99Care Logo" 
                                            className="w-10 h-10 object-contain"
                                        />
                                        <span className="font-bold text-xl text-[#1aa6a8] font-['Plus_Jakarta_Sans']">99Care</span>
                                    </div>
                                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <nav className="flex-1 p-4 space-y-1">
                                    {filteredNavigation.map((item) => {
                                        const isActive = location.pathname === item.href;
                                        return (
                                            <Link
                                                key={item.name}
                                                to={item.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isActive
                                                    ? 'bg-primary/10 text-primary scale-[1.02] shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                                                    {item.name}
                                                </div>
                                                {(item as any).status === 'construction' && (
                                                    <span className="text-[9px] font-bold tracking-wider uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">Coming Soon</span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                    {user?.role === 'admin' && (
                                        <Link
                                            to="/admin/settings"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`flex items-center gap-3 px-3 py-3 rounded-xl font-semibold transition-all ${location.pathname === '/admin/settings'
                                                    ? 'bg-primary/10 text-primary scale-[1.02] shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <Settings className={`w-5 h-5 ${location.pathname === '/admin/settings' ? 'text-primary' : 'text-slate-400'}`} />
                                            Access Control
                                        </Link>
                                    )}
                                    <hr className="my-4 border-slate-100" />
                                    <Link 
                                        to="/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-primary hover:bg-primary/5 transition-all"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <Landmark className="w-5 h-5" />
                                        </div>
                                        View Public Site
                                    </Link>
                                </nav>
                                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-3 py-3 rounded-xl bg-white border border-slate-200 text-red-600 font-bold shadow-sm hover:bg-red-50 transition-all">
                                        <LogOut className="w-5 h-5" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Global Search */}
                    <div className="hidden sm:flex flex-1 max-w-lg mx-auto lg:mx-0 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search clients, workers, or invoices..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-4 ml-auto">
                        <div className="relative">
                            <button 
                                onClick={() => setIsGlobalNotificationsOpen(!isGlobalNotificationsOpen)}
                                className={`relative p-2 transition-colors rounded-full ${isGlobalNotificationsOpen ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            
                            {isGlobalNotificationsOpen && (
                                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 border border-slate-200 rounded-full shadow-sm">3 New</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
                                        <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer bg-primary/5">
                                            <p className="text-sm font-semibold text-slate-900">System Update</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">99Care OS has been updated to v2.1 with new CRM features.</p>
                                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Just now</p>
                                        </div>
                                        <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer bg-primary/5">
                                            <p className="text-sm font-semibold text-slate-900">AI Weekly Report</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">Your AI Agents have handled 48 calls and booked 12 appointments this week.</p>
                                            <p className="text-[10px] text-slate-400 mt-2 font-medium">2 hours ago</p>
                                        </div>
                                        <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer bg-primary/5">
                                            <p className="text-sm font-semibold text-slate-900">Payment Received</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">A new deposit of ₹15,000 has been recorded for active worker deployment.</p>
                                            <p className="text-[10px] text-slate-400 mt-2 font-medium">5 hours ago</p>
                                        </div>
                                    </div>
                                    <div className="p-3 text-center bg-slate-50/50 border-t border-slate-50">
                                        <button className="text-xs font-bold text-primary hover:underline transition-transform inline-block">Mark all as read</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <a 
                            href={import.meta.env.DEV ? "http://localhost:5174" : "https://healthcare-website-ecru-delta.vercel.app"} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors hidden sm:block"
                        >
                            View Public Site
                        </a>
                    </div>
                </header>

                {/* Dynamic Page Content */}
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
