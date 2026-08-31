import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, LogOut, Bell, Search, Landmark, Settings, CreditCard, Menu, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, type AccessModule } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateMonthlyBilling } from '../services/serviceLifecycle';

const ATTENTION_EVENT_TYPES = new Set([
    'lead_created',
    'form_filled',
    'quote_question',
    'quote_call_requested',
    'needs_attention',
    'call_received',
    'automation_error',
    'whatsapp_deposit_invoice_alert_failed',
]);

const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const buildAttentionNotification = (activity: any) => {
    const metadata = activity?.metadata || {};
    const leadName = metadata.lead_name || metadata.name || 'Lead';
    const service = metadata.service || metadata.detected_service || metadata.service_category;
    const source = metadata.source || 'CRM';
    const preview = metadata.message_preview ? ` Message: "${String(metadata.message_preview).slice(0, 80)}"` : '';

    switch (activity?.event_type) {
        case 'lead_created':
            return {
                title: source === 'AI Phone Call' ? 'New Voice Lead' : 'New Lead Needs Review',
                body: `${leadName} from ${source}${service ? ` for ${service}` : ''}.`,
            };
        case 'form_filled':
            return { title: 'New Intake Form Submitted', body: `${leadName}${service ? ` requested ${service}` : ' submitted service details'}.` };
        case 'quote_question':
            return { title: 'Quote Question Needs Reply', body: `${leadName} tapped Ask a question.${preview}` };
        case 'quote_call_requested':
            return { title: 'Call Requested From Quote', body: `${leadName} tapped Schedule a call.${preview}` };
        case 'call_received':
            return { title: 'Voice Call Needs Review', body: `${leadName} completed an AI call${service ? ` about ${service}` : ''}.` };
        case 'automation_error':
        case 'whatsapp_deposit_invoice_alert_failed':
            return { title: 'Automation Needs Attention', body: activity.description || metadata.reason || 'An automated workflow failed.' };
        case 'needs_attention':
            return { title: 'Lead Needs Attention', body: `${leadName}: ${metadata.reason || activity.description || 'Manual review required.'}` };
        default:
            return null;
    }
};

const buildLeadNotification = (lead: any, oldLead?: any) => {
    if (!lead || lead.deleted_at || lead.pipeline_stage === 'Manual Invoice') return null;
    const source = lead.source || 'CRM';
    const service = lead.service_interest || lead.service || '';

    if (!oldLead) {
        return {
            title: source.includes('Phone') ? 'New Voice Lead' : 'New Lead',
            body: `${lead.name || 'New lead'}${service ? ` needs ${service}` : ` came in from ${source}`}.`,
        };
    }

    if (lead.needs_attention && !oldLead.needs_attention) {
        return {
            title: 'Lead Needs Attention',
            body: `${lead.name || 'Lead'} needs review${service ? ` for ${service}` : ''}.`,
        };
    }

    return null;
};

const buildWhatsAppFailureNotification = (log: any) => {
    const payload = log?.payload || {};
    const template = payload.templateName || payload.type || 'WhatsApp message';
    const recipient = payload.original_recipient || payload.phone || 'client';
    return {
        title: 'WhatsApp Send Failed',
        body: `${template} failed for ${recipient}. ${log.error_message || 'Check delivery logs.'}`,
    };
};

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, hasAccess } = useAuth();
    const [isGlobalNotificationsOpen, setIsGlobalNotificationsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{clients: any[], workers: any[], invoices: any[]}>({ clients: [], workers: [], invoices: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const notifiedAlertIds = useRef<Set<string>>(new Set());
    const notificationAudioRef = useRef<AudioContext | null>(null);
    const canSearchClients = hasAccess('crm') || hasAccess('clients');
    const canSearchWorkers = hasAccess('hr');
    const canSearchInvoices = hasAccess('finance');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unlockNotificationAudio = () => {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!notificationAudioRef.current) {
            notificationAudioRef.current = new AudioContextClass();
        }
        if (notificationAudioRef.current.state === 'suspended') {
            notificationAudioRef.current.resume().catch(() => {});
        }
    };

    const playNotificationSound = () => {
        try {
            unlockNotificationAudio();
            const audioContext = notificationAudioRef.current;
            if (!audioContext) return;

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1175, audioContext.currentTime + 0.09);
            gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (err) {
            console.warn('Notification sound blocked:', err);
        }
    };

    const pushGlobalAlert = (key: string, title: string, body: string, options?: { route?: string; severity?: 'attention' | 'error' }) => {
        if (!key || notifiedAlertIds.current.has(key)) return;
        notifiedAlertIds.current.add(key);

        const alert = {
            id: key,
            title,
            body,
            route: options?.route || '/admin/crm',
            severity: options?.severity || 'attention',
            created_at: new Date().toISOString(),
        };

        setGlobalAlerts(prev => [alert, ...prev.filter(item => item.id !== key)].slice(0, 25));
        playNotificationSound();
        toast(title, {
            description: body,
            duration: 9000,
            action: {
                label: 'Open',
                onClick: () => navigate(alert.route),
            },
        });

        if ('Notification' in window && Notification.permission === 'granted') {
            const browserNotification = new Notification(title, { body, icon: '/favicon.ico' });
            browserNotification.onclick = () => {
                window.focus();
                navigate(alert.route);
                browserNotification.close();
            };
        }
    };

    useEffect(() => {
        const unlock = () => unlockNotificationAudio();
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
        return () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (searchQuery.length < 2) {
                setSearchResults({ clients: [], workers: [], invoices: [] });
                setIsSearchOpen(false);
                return;
            }

            setIsSearching(true);
            if (isInputFocused) setIsSearchOpen(true);

            try {
                const [clients, workers, invoices] = await Promise.all([
                    canSearchClients ? supabase
                        .from('crm_leads')
                        .select('id, name, phone, pipeline_stage')
                        .is('deleted_at', null)
                        .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
                        .limit(5)
                        .then(({ data }) => data || []) : Promise.resolve([]),
                    canSearchWorkers ? supabase
                        .from('employees')
                        .select('id, full_name, phone, job_title')
                        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
                        .limit(5)
                        .then(({ data }) => data || []) : Promise.resolve([]),
                    canSearchInvoices ? supabase
                        .from('worker_assignments')
                        .select('id, final_invoice_number, clients(client_name)')
                        .not('final_invoice_number', 'is', null)
                        .ilike('final_invoice_number', `%${searchQuery}%`)
                        .limit(5)
                        .then(({ data }) => data || []) : Promise.resolve([])
                ]);

                setSearchResults({
                    clients,
                    workers,
                    invoices
                });
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(fetchResults, 300);
        return () => clearTimeout(debounceTimer);
    }, [searchQuery, isInputFocused, canSearchClients, canSearchWorkers, canSearchInvoices]);

    useEffect(() => {
        const fetchRecentAlerts = async () => {
            const [activityResult, failuresResult, attentionLeadsResult] = await Promise.all([
                supabase
                    .from('crm_lead_activity')
                    .select('id, event_type, description, metadata, created_at')
                    .in('event_type', Array.from(ATTENTION_EVENT_TYPES))
                    .order('created_at', { ascending: false })
                    .limit(15),
                supabase
                    .from('whatsapp_logs')
                    .select('id, status, error_message, payload, created_at')
                    .or('status.eq.failed,status.eq.error,error_message.not.is.null')
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('crm_leads')
                    .select('id, name, source, service_interest, pipeline_stage, needs_attention, created_at, deleted_at')
                    .eq('needs_attention', true)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(10),
            ]);

            const activityAlerts = (activityResult.data || []).map((activity: any) => {
                const notification = buildAttentionNotification(activity);
                if (!notification) return null;
                return {
                    id: `activity:${activity.id}`,
                    title: notification.title,
                    body: notification.body,
                    route: '/admin/crm',
                    severity: 'attention',
                    created_at: activity.created_at,
                };
            }).filter(Boolean);

            const failureAlerts = (failuresResult.data || []).map((log: any) => {
                const notification = buildWhatsAppFailureNotification(log);
                return {
                    id: `whatsapp:${log.id}`,
                    title: notification.title,
                    body: notification.body,
                    route: '/admin/crm',
                    severity: 'error',
                    created_at: log.created_at,
                };
            });

            const leadAlerts = (attentionLeadsResult.data || []).map((lead: any) => ({
                id: `lead_attention:${lead.id}`,
                title: 'Lead Needs Attention',
                body: `${lead.name || 'Lead'} needs review${lead.service_interest ? ` for ${lead.service_interest}` : ''}.`,
                route: '/admin/crm',
                severity: 'attention',
                created_at: lead.created_at,
            }));

            setGlobalAlerts([...activityAlerts, ...failureAlerts, ...leadAlerts]
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 25));
        };

        fetchRecentAlerts().catch(err => console.warn('Failed to fetch global alerts:', err));

        // Month-End Billing Auto-Check
        const checkMonthEndBilling = async () => {
            try {
                const now = new Date();
                const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const isLastDay = now.getDate() === lastDayOfCurrentMonth.getDate();
                const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
                const monthEnd = format(lastDayOfCurrentMonth, 'yyyy-MM-dd');
                const monthName = format(now, 'MMMM yyyy');

                if (isLastDay) {
                    // Check if recurring monthly billing has been generated for this month
                    const { data: existingBills } = await supabase
                        .from('service_bills')
                        .select('id')
                        .eq('period_end', monthEnd)
                        .eq('type', 'recurring')
                        .limit(1);

                    const billsCount = existingBills?.length || 0;

                    // If not generated, run generateMonthlyBilling automatically
                    if (billsCount === 0) {
                        try {
                            await generateMonthlyBilling(monthStart, monthEnd);
                        } catch (bErr) {
                            console.warn('Auto month-end billing generation error:', bErr);
                        }
                    }

                    // Register in global alerts bell list (without pop toast)
                    const alertKey = `month_end_billing:${monthEnd}`;
                    const monthEndAlert = {
                        id: alertKey,
                        title: `📅 Month-End Billing Active: ${monthName}`,
                        body: `Today is the last day of the month (${now.getDate()} ${format(now, 'MMM')}). Monthly client invoices & staff payout ledgers have been generated.`,
                        route: '/admin/billing?tab=monthly',
                        severity: 'attention' as const,
                        created_at: new Date().toISOString(),
                    };
                    setGlobalAlerts(prev => [monthEndAlert, ...prev.filter(item => item.id !== alertKey)].slice(0, 25));
                }
            } catch (err) {
                console.warn('Failed to check month end billing:', err);
            }
        };

        checkMonthEndBilling().catch(err => console.warn('checkMonthEndBilling error:', err));

        const leadsSub = supabase.channel('global_alert_leads_v1')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_leads' }, (payload) => {
                const lead = payload.new as any;
                const notification = buildLeadNotification(lead);
                if (notification) {
                    pushGlobalAlert(`lead:${lead.id}`, notification.title, notification.body, { route: '/admin/crm' });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_leads' }, (payload) => {
                const lead = payload.new as any;
                const oldLead = payload.old as any;
                const notification = buildLeadNotification(lead, oldLead);
                if (notification) {
                    pushGlobalAlert(`lead_attention:${lead.id}:${lead.updated_at || Date.now()}`, notification.title, notification.body, { route: '/admin/crm' });
                }
            })
            .subscribe();

        const activitySub = supabase.channel('global_alert_activity_v1')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_lead_activity' }, (payload) => {
                const activity = payload.new as any;
                if (!ATTENTION_EVENT_TYPES.has(activity.event_type)) return;
                const notification = buildAttentionNotification(activity);
                if (notification) {
                    pushGlobalAlert(`activity:${activity.id}`, notification.title, notification.body, { route: '/admin/crm' });
                }
            })
            .subscribe();

        const callSub = supabase.channel('global_alert_calls_v1')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_transcripts' }, (payload) => {
                const call = payload.new as any;
                pushGlobalAlert(
                    `call:${call.conversation_id || call.id}`,
                    'Voice Call Ended',
                    `New AI call from ${call.phone_number || 'unknown number'} needs review.`,
                    { route: '/admin/crm' }
                );
            })
            .subscribe();

        const whatsappSub = supabase.channel('global_alert_whatsapp_failures_v1')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_logs' }, (payload) => {
                const log = payload.new as any;
                if (log?.status === 'failed' || log?.status === 'error' || log?.error_message) {
                    const notification = buildWhatsAppFailureNotification(log);
                    pushGlobalAlert(`whatsapp:${log.id}`, notification.title, notification.body, { route: '/admin/crm', severity: 'error' });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_logs' }, (payload) => {
                const log = payload.new as any;
                if (log?.status === 'failed' || log?.status === 'error' || log?.error_message) {
                    const notification = buildWhatsAppFailureNotification(log);
                    pushGlobalAlert(`whatsapp:${log.id}:updated`, notification.title, notification.body, { route: '/admin/crm', severity: 'error' });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(leadsSub);
            supabase.removeChannel(activitySub);
            supabase.removeChannel(callSub);
            supabase.removeChannel(whatsappSub);
        };
    }, []);

    // Show Month-End billing popup ONCE per session, ONLY in Finance or Dashboard
    useEffect(() => {
        const now = new Date();
        const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const isLastDay = now.getDate() === lastDayOfCurrentMonth.getDate();
        if (!isLastDay) return;

        const monthEnd = format(lastDayOfCurrentMonth, 'yyyy-MM-dd');
        const sessionKey = `month_end_toast_shown_${monthEnd}`;
        if (sessionStorage.getItem(sessionKey)) return;

        const isFinanceOrDashboard = 
            location.pathname === '/admin' || 
            location.pathname === '/admin/' || 
            location.pathname.startsWith('/admin/dashboard') || 
            location.pathname.startsWith('/admin/billing');

        if (!isFinanceOrDashboard) return;

        sessionStorage.setItem(sessionKey, 'true');
        playNotificationSound();

        toast.custom((t) => (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-4 max-w-sm w-full flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <h4 className="text-sm font-bold text-slate-900">Month-End Billing Active: {format(now, 'MMMM yyyy')}</h4>
                    </div>
                    <button
                        onClick={() => toast.dismiss(t)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors -mr-1 -mt-1"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                    Today is the last day of the month ({now.getDate()} {format(now, 'MMM')}). Monthly client invoices & staff payout ledgers have been generated.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                    <button
                        onClick={() => toast.dismiss(t)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(t);
                            navigate('/admin/billing?tab=monthly');
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                    >
                        Open
                    </button>
                </div>
            </div>
        ), { duration: 12000 });
    }, [location.pathname]);

    // Navigation items linked to their required module (null means always visible)
    const navigation = [
        { name: 'Dashboard',          href: '/admin',                    icon: LayoutDashboard, requiredModule: 'dashboard' as AccessModule },
        { name: 'AI CRM',             href: '/admin/crm',                icon: Users,           requiredModule: 'crm' as AccessModule },
        { name: 'Clients',            href: '/admin/clients',            icon: Users,           requiredModule: 'clients' as AccessModule },
        { name: 'AI HR',              href: '/admin/hr',                 icon: UserCog,         requiredModule: 'hr' as AccessModule },
        { name: 'Finance',            href: '/admin/billing',            icon: Landmark,        requiredModule: 'finance' as AccessModule },
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
                            src="/99care-logo.png"
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
                                            src="/99care-logo.png"
                                            alt="99Care Logo" 
                                            className="w-10 h-10 object-contain"
                                        />
                                        <span className="font-bold text-xl text-[#1aa6a8] font-['Plus_Jakarta_Sans']">99Care</span>
                                    </div>
                                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                                    {/* Mobile Search (in Drawer) */}
                                    <div className="mb-4 sm:hidden">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onFocus={() => {
                                                    setIsInputFocused(true);
                                                    if (searchQuery.length >= 2) setIsSearchOpen(true);
                                                }}
                                                onBlur={() => {
                                                    setTimeout(() => {
                                                        setIsInputFocused(false);
                                                        setIsSearchOpen(false);
                                                    }, 150);
                                                }}
                                                placeholder="Search OS..."
                                                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            />
                                            {isSearchOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-[300px] overflow-y-auto z-[110]">
                                                    {isSearching ? (
                                                        <div className="p-4 flex items-center justify-center text-slate-500">
                                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                            <span className="text-sm font-medium">Searching...</span>
                                                        </div>
                                                    ) : (searchResults.clients.length === 0 && searchResults.workers.length === 0 && searchResults.invoices.length === 0) ? (
                                                        <div className="p-4 text-center text-slate-500 text-sm font-medium">
                                                            No results found for "{searchQuery}"
                                                        </div>
                                                    ) : (
                                                        <div className="py-2">
                                                            {/* We only render clients and workers for brevity in mobile search */}
                                                            {searchResults.clients.length > 0 && (
                                                                <div className="mb-2">
                                                                    <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Clients</div>
                                                                    {searchResults.clients.map(client => (
                                                                        <button
                                                                            key={client.id}
                                                                            onClick={() => {
                                                                                setIsSearchOpen(false);
                                                                                setIsMobileMenuOpen(false);
                                                                                navigate('/admin/crm', { state: { openLeadId: client.id } });
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                                        >
                                                                            <span className="text-sm font-semibold text-slate-900">{client.name}</span>
                                                                            <span className="text-xs text-slate-500">{client.phone}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {searchResults.workers.length > 0 && (
                                                                <div>
                                                                    <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Workers</div>
                                                                    {searchResults.workers.map(worker => (
                                                                        <button
                                                                            key={worker.id}
                                                                            onClick={() => {
                                                                                setIsSearchOpen(false);
                                                                                setIsMobileMenuOpen(false);
                                                                                navigate('/admin/hr', { state: { searchWorker: worker.full_name } });
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                                        >
                                                                            <span className="text-sm font-semibold text-slate-900">{worker.full_name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

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
                                    <hr className="my-2 border-slate-100" />
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
                    <div ref={searchRef} className="hidden sm:flex flex-1 max-w-lg mx-auto lg:mx-0 relative z-40">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => {
                                setIsInputFocused(true);
                                if (searchQuery.length >= 2) setIsSearchOpen(true);
                            }}
                            onBlur={() => {
                                // Small delay so clicks on results register before closing
                                setTimeout(() => {
                                    setIsInputFocused(false);
                                    setIsSearchOpen(false);
                                }, 150);
                            }}
                            placeholder="Search clients, workers, or invoices..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                        
                        {isSearchOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                {isSearching ? (
                                    <div className="p-4 flex items-center justify-center text-slate-500">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        <span className="text-sm font-medium">Searching...</span>
                                    </div>
                                ) : (searchResults.clients.length === 0 && searchResults.workers.length === 0 && searchResults.invoices.length === 0) ? (
                                    <div className="p-4 text-center text-slate-500 text-sm font-medium">
                                        No results found for "{searchQuery}"
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        {searchResults.clients.length > 0 && (
                                            <div className="mb-2">
                                                <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                                    Clients & Leads
                                                </div>
                                                {searchResults.clients.map(client => (
                                                    <button
                                                        key={client.id}
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            navigate('/admin/crm', { state: { openLeadId: client.id } });
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <span className="text-sm font-semibold text-slate-900">{client.name}</span>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span>{client.phone}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-primary font-medium">{client.pipeline_stage}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {searchResults.workers.length > 0 && (
                                            <div>
                                                <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                                    Care Workers
                                                </div>
                                                {searchResults.workers.map(worker => (
                                                    <button
                                                        key={worker.id}
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            navigate('/admin/hr', { state: { searchWorker: worker.full_name } });
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <span className="text-sm font-semibold text-slate-900">{worker.full_name}</span>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span>{worker.phone}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-emerald-600 font-medium">{worker.job_title}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {searchResults.invoices.length > 0 && (
                                            <div>
                                                <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                                    Invoices
                                                </div>
                                                {searchResults.invoices.map(invoice => (
                                                    <button
                                                        key={invoice.id}
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            navigate('/admin/billing');
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <span className="text-sm font-semibold text-slate-900">{invoice.final_invoice_number}</span>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="text-primary font-medium">Client: {(invoice as any).clients?.client_name || 'Unknown'}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-4 ml-auto">
                        <div className="relative">
                            <button 
                                onClick={() => setIsGlobalNotificationsOpen(!isGlobalNotificationsOpen)}
                                className={`relative p-2 transition-colors rounded-full ${isGlobalNotificationsOpen ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Bell className="w-5 h-5" />
                                {globalAlerts.length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                                )}
                            </button>
                            
                            {isGlobalNotificationsOpen && (
                                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 border border-slate-200 rounded-full shadow-sm">{globalAlerts.length} Live</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
                                        {globalAlerts.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <p className="text-sm font-semibold text-slate-600">No live alerts right now.</p>
                                                <p className="text-xs text-slate-400 mt-1">New leads and attention items will pop here.</p>
                                            </div>
                                        ) : globalAlerts.map((alert) => (
                                            <button
                                                key={alert.id}
                                                type="button"
                                                onClick={() => {
                                                    setIsGlobalNotificationsOpen(false);
                                                    navigate(alert.route || '/admin/crm');
                                                }}
                                                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors cursor-pointer ${alert.severity === 'error' ? 'bg-red-50/60' : 'bg-primary/5'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alert.severity === 'error' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                                                        <Bell className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{alert.title}</p>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.body}</p>
                                                        <p className="text-[10px] text-slate-400 mt-2 font-medium">{formatNotificationTime(alert.created_at)}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 text-center bg-slate-50/50 border-t border-slate-50">
                                        <button onClick={() => setGlobalAlerts([])} className="text-xs font-bold text-primary hover:underline transition-transform inline-block">Clear alerts</button>
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
                <div className="flex-1 overflow-auto pb-16 lg:pb-0">
                    <Outlet />
                </div>

                {/* Mobile Bottom Navigation */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe z-50 h-16 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    {filteredNavigation.map((item) => {
                        const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
                        // Simplify names for mobile space
                        let mobileName = item.name;
                        if (mobileName === 'Dashboard') mobileName = 'Home';
                        else if (mobileName.startsWith('AI ')) mobileName = mobileName.replace('AI ', '');

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <div className={`p-1.5 rounded-full mb-0.5 transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                                </div>
                                <span className={`text-[10px] truncate w-full text-center transition-all ${isActive ? 'font-bold' : 'font-medium'}`}>{mobileName}</span>
                            </Link>
                        );
                    })}
                </nav>
            </main>
        </div>
    );
}
