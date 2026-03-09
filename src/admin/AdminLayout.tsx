import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, LogOut, Bell, Search, Receipt, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule } from '../contexts/AuthContext';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, hasAccess } = useAuth();

    // Navigation items linked to their required module (null means always visible)
    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, requiredModule: null },
        { name: 'AI CRM', href: '/admin/crm', icon: Users, requiredModule: 'crm' as AccessModule },
        { name: 'Clients', href: '/admin/clients', icon: Users, requiredModule: 'clients' as AccessModule },
        { name: 'AI HR', href: '/admin/hr', icon: UserCog, requiredModule: 'hr' as AccessModule },
        { name: 'Finance', href: '/admin/billing', icon: Receipt, requiredModule: 'finance' as AccessModule },
    ];

    const filteredNavigation = navigation.filter(item => {
        if (!item.requiredModule) return true; // Everyone sees Dashboard
        return hasAccess(item.requiredModule);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-slate-100">
                    <Link to="/" className="flex items-center gap-2" title="Go back to public site">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg leading-none">H</span>
                        </div>
                        <span className="font-bold text-xl text-primary font-['Plus_Jakarta_Sans']">HealthFirst OS</span>
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
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                                {item.name}
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
                    {/* Mobile menu button (placeholder) */}
                    <div className="lg:hidden">
                        <span className="font-bold text-primary font-['Plus_Jakarta_Sans']">HF OS</span>
                    </div>

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
                        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <Link to="/" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors hidden sm:block">
                            View Public Site
                        </Link>
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
