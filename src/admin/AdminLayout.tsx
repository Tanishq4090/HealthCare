import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, CalendarDays, Clock, FileText, Wallet, Banknote, UserPlus, LogOut, Bell, Search, Landmark, Settings, CreditCard, Menu, X, Loader2, ShieldAlert, AlertCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, type AccessModule } from '../contexts/AuthContext';
import { maskPhoneNumber } from '../utils/phoneMask';
import { AdminDeletionRequestsModal } from './components/AdminDeletionRequestsModal';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

const DISMISSED_ALERTS_KEY = '99care_dismissed_alert_ids';
const ALERTS_CLEARED_AT_KEY = '99care_alerts_cleared_at';

// Module-level in-memory cache to prevent flashing / refetch spikes when switching tabs
let cachedGlobalAlerts: any[] | null = null;

const getDismissedAlertIds = (): Set<string> => {
    try {
        const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
};

const saveDismissedAlertIds = (ids: string[]) => {
    try {
        if (!ids || ids.length === 0) return;
        const set = getDismissedAlertIds();
        ids.forEach(id => {
            if (id) set.add(id);
        });
        const arr = Array.from(set).slice(-500);
        localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(arr));
    } catch (err) {
        console.warn('Failed to save dismissed alerts:', err);
    }
};

const getAlertsClearedAt = (): number => {
    try {
        const val = localStorage.getItem(ALERTS_CLEARED_AT_KEY);
        if (!val) return 0;
        const time = new Date(val).getTime();
        return isNaN(time) ? 0 : time;
    } catch {
        return 0;
    }
};

const setAlertsClearedAt = (isoString: string) => {
    try {
        localStorage.setItem(ALERTS_CLEARED_AT_KEY, isoString);
    } catch (err) {
        console.warn('Failed to set alerts cleared at:', err);
    }
};

const isAlertDismissed = (alertId: string, createdAt?: string | null): boolean => {
    if (!alertId) return false;
    const dismissed = getDismissedAlertIds();
    if (dismissed.has(alertId)) return true;
    const clearedAt = getAlertsClearedAt();
    if (clearedAt > 0) {
        if (!createdAt) return true;
        const alertTime = new Date(createdAt).getTime();
        if (isNaN(alertTime) || alertTime <= clearedAt) {
            return true;
        }
    }
    return false;
};

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
                severity: 'attention' as const,
            };
        case 'form_filled':
            return { 
                title: 'New Intake Form Submitted', 
                body: `${leadName}${service ? ` requested ${service}` : ' submitted service details'}.`,
                severity: 'attention' as const,
            };
        case 'quote_question':
            return { 
                title: 'Quote Question Needs Reply', 
                body: `${leadName} tapped Ask a question.${preview}`,
                severity: 'urgent' as const,
            };
        case 'quote_call_requested':
            return { 
                title: 'Call Requested From Quote', 
                body: `${leadName} tapped Schedule a call.${preview}`,
                severity: 'urgent' as const,
            };
        case 'call_received':
            return { 
                title: 'Voice Call Needs Review', 
                body: `${leadName} completed an AI call${service ? ` about ${service}` : ''}.`,
                severity: 'attention' as const,
            };
        case 'automation_error':
        case 'whatsapp_deposit_invoice_alert_failed':
            return { 
                title: 'Automation Needs Attention', 
                body: activity.description || metadata.reason || 'An automated workflow failed.',
                severity: 'error' as const,
            };
        case 'needs_attention':
            return { 
                title: 'Lead Needs Attention', 
                body: `${leadName}: ${metadata.reason || activity.description || 'Manual review required.'}`,
                severity: 'urgent' as const,
            };
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
            severity: 'attention' as const,
        };
    }

    if (lead.needs_attention && !oldLead.needs_attention) {
        return {
            title: 'Lead Needs Attention',
            body: `${lead.name || 'Lead'} needs review${service ? ` for ${service}` : ''}.`,
            severity: 'urgent' as const,
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
    const { user, logout, hasAccess, canViewPhoneNumbers } = useAuth();
    const [isGlobalNotificationsOpen, setIsGlobalNotificationsOpen] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<'all' | 'urgent'>('all');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [globalAlerts, setGlobalAlerts] = useState<any[]>(() => {
        if (cachedGlobalAlerts !== null) {
            return cachedGlobalAlerts.filter(a => !isAlertDismissed(a.id, a.created_at));
        }
        return [];
    });
    const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
    const [pendingDeletionCount, setPendingDeletionCount] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{clients: any[], workers: any[], invoices: any[]}>({ clients: [], workers: [], invoices: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
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
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setIsGlobalNotificationsOpen(false);
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

    const handleDismissAlert = (alertId: string) => {
        saveDismissedAlertIds([alertId]);
        cachedGlobalAlerts = (cachedGlobalAlerts || []).filter(item => item.id !== alertId);
        setGlobalAlerts(prev => prev.filter(item => item.id !== alertId));
    };

    const handleClearAllAlerts = () => {
        const nowIso = new Date().toISOString();
        setAlertsClearedAt(nowIso);
        saveDismissedAlertIds(globalAlerts.map(a => a.id));
        cachedGlobalAlerts = [];
        setGlobalAlerts([]);
        setIsGlobalNotificationsOpen(false);
    };

    const pushGlobalAlert = (key: string, title: string, body: string, options?: { route?: string; severity?: 'attention' | 'error' | 'urgent' }) => {
        const nowIso = new Date().toISOString();
        if (!key || notifiedAlertIds.current.has(key) || isAlertDismissed(key, nowIso)) return;
        notifiedAlertIds.current.add(key);

        const alert = {
            id: key,
            title,
            body,
            route: options?.route || '/admin/crm',
            severity: options?.severity || 'attention',
            created_at: nowIso,
        };

        setGlobalAlerts(prev => {
            const next = [alert, ...prev.filter(item => item.id !== key)].slice(0, 25);
            cachedGlobalAlerts = next;
            return next;
        });
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
                    canSearchClients ? (async () => {
                        const trimmed = searchQuery.trim();
                        const strippedUuid = trimmed.replace(/^(client\s*id|id)\s*[:#-]?\s*/i, '').trim();
                        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strippedUuid);

                        if (isUuid) {
                            const { data: leadMatch } = await supabase
                                .from('crm_leads')
                                .select('id, name, phone, pipeline_stage')
                                .eq('id', strippedUuid)
                                .limit(5);

                            if (leadMatch && leadMatch.length > 0) return leadMatch;

                            const { data: clientMatch } = await supabase
                                .from('clients')
                                .select('id, client_name, phone_number')
                                .eq('id', strippedUuid)
                                .limit(5);

                            if (clientMatch && clientMatch.length > 0) {
                                return clientMatch.map((c: any) => ({
                                    id: c.id,
                                    name: c.client_name,
                                    phone: c.phone_number,
                                    pipeline_stage: 'Client'
                                }));
                            }
                        }

                        const { data } = await supabase
                            .from('crm_leads')
                            .select('id, name, phone, pipeline_stage')
                            .is('deleted_at', null)
                            .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
                            .limit(5);

                        return data || [];
                    })() : Promise.resolve([]),
                    canSearchWorkers ? supabase
                        .from('employees')
                        .select('id, full_name, phone, job_title')
                        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
                        .limit(5)
                        .then(({ data }) => data || []) : Promise.resolve([]),
                    canSearchInvoices ? Promise.all([
                        supabase
                            .from('worker_assignments')
                            .select('id, final_invoice_number, clients(client_name)')
                            .not('final_invoice_number', 'is', null)
                            .ilike('final_invoice_number', `%${searchQuery}%`)
                            .limit(5)
                            .then(({ data }) => (data || []).map((inv: any) => ({
                                id: inv.id,
                                title: inv.final_invoice_number,
                                subtitle: `Client: ${inv.clients?.client_name || 'Unknown'}`,
                                type: 'assignment',
                                targetTab: 'monthly'
                            }))),
                        supabase
                            .from('payments')
                            .select('id, transaction_ref, client_name, amount')
                            .ilike('transaction_ref', `%${searchQuery}%`)
                            .limit(5)
                            .then(({ data }) => (data || []).map((pay: any) => ({
                                id: pay.id,
                                title: pay.transaction_ref,
                                subtitle: `${pay.client_name || 'Client'} • ₹${parseFloat(pay.amount || 0).toLocaleString('en-IN')}`,
                                type: 'payment',
                                targetTab: 'history',
                                searchVal: pay.transaction_ref
                            })))
                    ]).then(([assigns, pays]) => [...assigns, ...pays].slice(0, 5)) : Promise.resolve([])
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
                    .select('id, name, source, pipeline_stage, needs_attention, created_at, deleted_at, work_form_data')
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
                    severity: notification.severity || 'attention',
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

            const leadAlerts = (attentionLeadsResult.data || []).map((lead: any) => {
                const serviceName = lead.work_form_data?.service_interest || lead.work_form_data?.service || lead.work_form_data?.service_type || '';
                return {
                    id: `lead_attention:${lead.id}`,
                    title: 'Lead Needs Attention',
                    body: `${lead.name || 'Lead'} needs review${serviceName ? ` for ${serviceName}` : ''}.`,
                    route: '/admin/crm',
                    severity: 'urgent' as const,
                    created_at: lead.created_at,
                };
            });

            const allRawAlerts = [...activityAlerts, ...failureAlerts, ...leadAlerts].filter((a): a is any => Boolean(a && a.id));
            const activeAlerts = allRawAlerts.filter(a => !isAlertDismissed(a.id, a.created_at));
            const sorted = activeAlerts
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 25);
            cachedGlobalAlerts = sorted;
            setGlobalAlerts(sorted);
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

                    // We notify the admin to review and generate, instead of silently running in background
                    const alertKey = `month_end_billing:${monthEnd}`;
                    const monthEndAlert = {
                        id: alertKey,
                        title: `📅 Month-End Billing Due: ${monthName}`,
                        body: `Today is the last day of the month (${now.getDate()} ${format(now, 'MMM')}). Click here to review and generate monthly client invoices & staff payslips.`,
                        route: '/admin/billing?tab=monthly',
                        severity: 'attention' as const,
                        created_at: monthStart,
                    };
                    if (!isAlertDismissed(alertKey, monthEndAlert.created_at)) {
                        setGlobalAlerts(prev => {
                            const next = [monthEndAlert, ...prev.filter(item => item.id !== alertKey)].slice(0, 25);
                            cachedGlobalAlerts = next;
                            return next;
                        });
                    }
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
                    pushGlobalAlert(`lead:${lead.id}`, notification.title, notification.body, { route: '/admin/crm', severity: notification.severity });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_leads' }, (payload) => {
                const lead = payload.new as any;
                const oldLead = payload.old as any;
                const notification = buildLeadNotification(lead, oldLead);
                if (notification) {
                    pushGlobalAlert(`lead_attention:${lead.id}:${lead.updated_at || Date.now()}`, notification.title, notification.body, { route: '/admin/crm', severity: notification.severity });
                }
            })
            .subscribe();

        const activitySub = supabase.channel('global_alert_activity_v1')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_lead_activity' }, (payload) => {
                const activity = payload.new as any;
                if (!ATTENTION_EVENT_TYPES.has(activity.event_type)) return;
                const notification = buildAttentionNotification(activity);
                if (notification) {
                    pushGlobalAlert(`activity:${activity.id}`, notification.title, notification.body, { route: '/admin/crm', severity: notification.severity });
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

    // Fetch and subscribe to pending deletion requests for System Admins
    useEffect(() => {
        if (user?.role !== 'admin') return;

        const fetchPendingCount = async () => {
            const { count, error } = await supabase
                .from('deletion_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            if (!error && count !== null) {
                setPendingDeletionCount(count);
            }
        };

        fetchPendingCount();

        const deletionSub = supabase.channel('admin_deletion_requests_count_v1')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deletion_requests' }, () => {
                fetchPendingCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(deletionSub);
        };
    }, [user?.role]);

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

    interface NavItem {
        name: string;
        href: string;
        icon: any;
        requiredModule?: AccessModule | null;
    }

    interface NavSection {
        title?: string;
        items: NavItem[];
    }

    const navSections: NavSection[] = [
        {
            title: 'Overview',
            items: [
                { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, requiredModule: 'dashboard' },
            ],
        },
        {
            title: 'Operations & Care',
            items: [
                { name: 'Client Master', href: '/admin/clients', icon: Users, requiredModule: 'clients' },
                { name: 'Caregiver Deployments', href: '/admin/hr?tab=allocation&subtab=assignments', icon: CalendarDays, requiredModule: 'hr' },
                { name: 'Live Attendance', href: '/admin/hr?tab=attendance', icon: Clock, requiredModule: 'hr' },
                { name: 'Caregivers & Staff', href: '/admin/hr?tab=allocation', icon: UserCog, requiredModule: 'hr' },
            ],
        },
        {
            title: 'Finance & Billing',
            items: [
                { name: 'Invoices & Billing', href: '/admin/billing?tab=monthly', icon: FileText, requiredModule: 'finance' },
                { name: 'Security Deposits', href: '/admin/billing?tab=deposits', icon: Wallet, requiredModule: 'finance' },
                { name: 'Caregiver Payroll', href: '/admin/hr?tab=payroll', icon: Banknote, requiredModule: 'hr' },
            ],
        },
        {
            title: 'Growth & Intake',
            items: [
                { name: 'Leads & Inquiries', href: '/admin/crm', icon: UserPlus, requiredModule: 'crm' },
            ],
        },
    ];

    const isItemActive = (href: string) => {
        const [targetPath, targetQueryString] = href.split('?');
        if (location.pathname !== targetPath) {
            return false;
        }

        if (targetPath === '/admin') {
            return location.pathname === '/admin' && (!location.search || location.search === '');
        }

        if (!targetQueryString) {
            return location.pathname === targetPath;
        }

        const targetParams = new URLSearchParams(targetQueryString);
        const currentParams = new URLSearchParams(location.search);

        if (targetPath === '/admin/hr') {
            const currentTab = currentParams.get('tab') || 'allocation';
            const targetTab = targetParams.get('tab') || 'allocation';

            if (targetTab === 'attendance' || targetTab === 'payroll') {
                return currentTab === targetTab;
            }

            if (currentTab !== 'allocation') return false;

            const targetSubtab = targetParams.get('subtab');
            const currentSubtab = currentParams.get('subtab') || 'available';

            if (targetSubtab === 'assignments') {
                return currentSubtab === 'assignments';
            }
            return currentSubtab !== 'assignments';
        }

        if (targetPath === '/admin/billing') {
            const currentTab = currentParams.get('tab') || 'deposits';
            const targetTab = targetParams.get('tab') || 'deposits';
            return currentTab === targetTab;
        }

        for (const [key, value] of targetParams.entries()) {
            if (currentParams.get(key) !== value) return false;
        }

        return true;
    };

    const filteredSections = navSections
        .map(section => ({
            ...section,
            items: section.items.filter(item => {
                if (!item.requiredModule) return true;
                return hasAccess(item.requiredModule);
            }),
        }))
        .filter(section => section.items.length > 0);

    const allFilteredItems = filteredSections.flatMap(s => s.items);

    const mobileBottomNavItems = [
        { name: 'Home', href: '/admin', icon: LayoutDashboard, requiredModule: 'dashboard' as AccessModule },
        { name: 'Clients', href: '/admin/clients', icon: Users, requiredModule: 'clients' as AccessModule },
        { name: 'Deployments', href: '/admin/hr?tab=allocation&subtab=assignments', icon: CalendarDays, requiredModule: 'hr' as AccessModule },
        { name: 'Attendance', href: '/admin/hr?tab=attendance', icon: Clock, requiredModule: 'hr' as AccessModule },
        { name: 'Invoices', href: '/admin/billing?tab=monthly', icon: FileText, requiredModule: 'finance' as AccessModule },
    ].filter(item => !item.requiredModule || hasAccess(item.requiredModule));

    // If user is at /admin but doesn't have dashboard access, redirect to first allowed module
    if (location.pathname === '/admin' && !hasAccess('dashboard')) {
        const firstAllowed = allFilteredItems.find(item => item.href !== '/admin');
        if (firstAllowed) {
            return <Navigate to={firstAllowed.href} replace />;
        }
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="h-screen w-full bg-slate-50 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex h-screen shrink-0 select-none">
                {/* Logo */}
                <div className="h-20 flex items-center px-6 border-b border-slate-100 shrink-0">
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
                <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto min-h-0">
                    {filteredSections.map((section, idx) => (
                        <div key={section.title || idx} className="space-y-1">
                            {section.title && (
                                <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    {section.title}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const active = isItemActive(item.href);
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${active
                                                ? 'bg-primary/10 text-primary font-bold shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-slate-400'}`} />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Settings Link for Admins */}
                {user?.role === 'admin' && (
                    <div className="px-4 pb-2 shrink-0">
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
                <div className="p-4 border-t border-slate-100 shrink-0 mt-auto bg-white">
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
            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-20">
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
                                                                            <span className="text-xs text-slate-500 font-mono">{client.phone ? maskPhoneNumber(client.phone, canViewPhoneNumbers) : ''}</span>
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

                                    {/* Mobile Navigation Sections */}
                                    <div className="space-y-4 my-2">
                                        {filteredSections.map((section, idx) => (
                                            <div key={section.title || idx} className="space-y-1">
                                                {section.title && (
                                                    <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                        {section.title}
                                                    </div>
                                                )}
                                                <div className="space-y-0.5">
                                                    {section.items.map((item) => {
                                                        const active = isItemActive(item.href);
                                                        return (
                                                            <Link
                                                                key={item.name}
                                                                to={item.href}
                                                                onClick={() => setIsMobileMenuOpen(false)}
                                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${active
                                                                    ? 'bg-primary/10 text-primary font-bold'
                                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                                    }`}
                                                            >
                                                                <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary' : 'text-slate-400'}`} />
                                                                <span className="truncate">{item.name}</span>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
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
                                                            <span className="font-mono">{client.phone ? maskPhoneNumber(client.phone, canViewPhoneNumbers) : ''}</span>
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
                                                            <span className="font-mono">{worker.phone ? maskPhoneNumber(worker.phone, canViewPhoneNumbers) : ''}</span>
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
                                                    Invoices & Transactions
                                                </div>
                                                {searchResults.invoices.map(invoice => (
                                                    <button
                                                        key={invoice.id}
                                                        onClick={() => {
                                                            setIsSearchOpen(false);
                                                            if (invoice.type === 'payment') {
                                                                navigate(`/admin/billing?tab=history&search=${encodeURIComponent(invoice.searchVal || invoice.title)}`);
                                                            } else {
                                                                navigate('/admin/billing?tab=monthly');
                                                            }
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-semibold text-slate-900 font-mono">{invoice.title || invoice.final_invoice_number}</span>
                                                            {invoice.type === 'payment' && (
                                                                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Ref ID</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span className="text-primary font-medium">{invoice.subtitle || `Client: ${(invoice as any).clients?.client_name || 'Unknown'}`}</span>
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
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setIsDeletionModalOpen(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    pendingDeletionCount > 0
                                        ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200 animate-pulse shadow-xs'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Deletion Requests"
                            >
                                <ShieldAlert className={`w-3.5 h-3.5 ${pendingDeletionCount > 0 ? 'text-amber-700' : 'text-slate-500'}`} />
                                <span className="hidden sm:inline">Delete Requests</span>
                                {pendingDeletionCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-extrabold">
                                        {pendingDeletionCount}
                                    </span>
                                )}
                            </button>
                        )}

                        <div ref={notificationsRef} className="relative">
                            {(() => {
                                const urgentAlertsCount = globalAlerts.filter(a => a.severity === 'error' || a.severity === 'urgent').length;
                                const totalAlertsCount = globalAlerts.length;
                                const displayedAlerts = (notificationFilter === 'urgent'
                                    ? globalAlerts.filter(a => a.severity === 'error' || a.severity === 'urgent')
                                    : [...globalAlerts].sort((a, b) => {
                                        const aUrgent = a.severity === 'error' || a.severity === 'urgent' ? 1 : 0;
                                        const bUrgent = b.severity === 'error' || b.severity === 'urgent' ? 1 : 0;
                                        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
                                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                    })
                                );

                                return (
                                    <>
                                        <button 
                                            onClick={() => setIsGlobalNotificationsOpen(!isGlobalNotificationsOpen)}
                                            className={`relative p-2 transition-colors rounded-full cursor-pointer ${
                                                isGlobalNotificationsOpen
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                            }`}
                                            title={
                                                totalAlertsCount > 0
                                                    ? `${totalAlertsCount} notification${totalAlertsCount > 1 ? 's' : ''}${
                                                          urgentAlertsCount > 0 ? ` (${urgentAlertsCount} urgent)` : ' (All normal review)'
                                                      }`
                                                    : 'Notifications'
                                            }
                                            aria-label="Notifications"
                                        >
                                            <Bell className="w-5 h-5" />
                                            {totalAlertsCount > 0 && (
                                                <span
                                                    className={`absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 flex items-center justify-center rounded-full text-[10px] font-black leading-none border-2 border-white shadow-sm transition-all ${
                                                        urgentAlertsCount > 0
                                                            ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/40'
                                                            : 'bg-amber-500 text-white'
                                                    }`}
                                                >
                                                    {totalAlertsCount > 99 ? '99+' : totalAlertsCount}
                                                </span>
                                            )}
                                        </button>
                                        
                                        {isGlobalNotificationsOpen && (
                                            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                {/* Header */}
                                                <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                                                            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 border border-slate-200 rounded-full shadow-2xs">
                                                                {totalAlertsCount} Total
                                                            </span>
                                                        </div>
                                                        {urgentAlertsCount > 0 ? (
                                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                                {urgentAlertsCount} Urgent
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-slate-400">
                                                                No urgent alerts
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Filter Tabs */}
                                                    {totalAlertsCount > 0 && (
                                                        <div className="flex items-center gap-1.5 pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setNotificationFilter('all')}
                                                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                                                    notificationFilter === 'all'
                                                                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                                                                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                                                }`}
                                                            >
                                                                All ({totalAlertsCount})
                                                            </button>
                                                            {urgentAlertsCount > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setNotificationFilter('urgent')}
                                                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                                                        notificationFilter === 'urgent'
                                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold shadow-2xs'
                                                                            : 'text-rose-600 hover:bg-rose-50/60'
                                                                    }`}
                                                                >
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Urgent ({urgentAlertsCount})
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* List of Alerts */}
                                                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                                                    {displayedAlerts.length === 0 ? (
                                                        <div className="p-8 text-center">
                                                            <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                                                                <Bell className="w-5 h-5" />
                                                            </div>
                                                            <p className="text-sm font-semibold text-slate-700">
                                                                {notificationFilter === 'urgent' ? 'No urgent alerts.' : 'No live alerts right now.'}
                                                            </p>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                {notificationFilter === 'urgent'
                                                                    ? 'All critical issues and urgent leads are cleared!'
                                                                    : 'New leads and attention items will appear here.'}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        displayedAlerts.map((alert) => {
                                                            return (
                                                                <div
                                                                    key={alert.id}
                                                                    className={`group relative w-full text-left p-3.5 hover:bg-slate-50/80 transition-colors flex items-start gap-3 border-l-4 ${
                                                                        alert.severity === 'error'
                                                                            ? 'border-l-rose-600 bg-rose-50/30'
                                                                            : alert.severity === 'urgent'
                                                                            ? 'border-l-amber-500 bg-amber-50/20'
                                                                            : 'border-l-teal-500 bg-white'
                                                                    }`}
                                                                >
                                                                    {/* Icon */}
                                                                    <div
                                                                        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                                            alert.severity === 'error'
                                                                                ? 'bg-rose-100 text-rose-600'
                                                                                : alert.severity === 'urgent'
                                                                                ? 'bg-amber-100 text-amber-700'
                                                                                : 'bg-teal-50 text-teal-700'
                                                                        }`}
                                                                    >
                                                                        {alert.severity === 'error' ? (
                                                                            <AlertCircle className="w-4 h-4" />
                                                                        ) : alert.severity === 'urgent' ? (
                                                                            <AlertTriangle className="w-4 h-4" />
                                                                        ) : (
                                                                            <Bell className="w-4 h-4" />
                                                                        )}
                                                                    </div>

                                                                    {/* Text Info */}
                                                                    <div
                                                                        className="min-w-0 flex-1 cursor-pointer"
                                                                        onClick={() => {
                                                                            handleDismissAlert(alert.id);
                                                                            setIsGlobalNotificationsOpen(false);
                                                                            navigate(alert.route || '/admin/crm');
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            <span
                                                                                className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded shrink-0 ${
                                                                                    alert.severity === 'error'
                                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                                        : alert.severity === 'urgent'
                                                                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                                        : 'bg-slate-100 text-slate-600'
                                                                                }`}
                                                                            >
                                                                                {alert.severity === 'error' ? 'Critical' : alert.severity === 'urgent' ? 'Urgent' : 'Review'}
                                                                            </span>
                                                                            <p className="text-xs font-bold text-slate-900 truncate">
                                                                                {alert.title}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                                                            {alert.body}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                                                            {formatNotificationTime(alert.created_at)}
                                                                        </p>
                                                                    </div>

                                                                    {/* Dismiss button */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDismissAlert(alert.id);
                                                                        }}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-all shrink-0 cursor-pointer"
                                                                        title="Dismiss notification"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Footer */}
                                                {totalAlertsCount > 0 && (
                                                    <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs px-3.5">
                                                        <span className="text-[11px] text-slate-500 font-medium">
                                                            Showing {displayedAlerts.length} of {totalAlertsCount}
                                                        </span>
                                                        <button
                                                            onClick={handleClearAllAlerts}
                                                            className="text-xs font-bold text-primary hover:underline transition-transform cursor-pointer"
                                                        >
                                                            Clear all alerts
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
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
                <div id="admin-main-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-16 lg:pb-8">
                    <Outlet />
                </div>

                {/* Mobile Bottom Navigation */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 pb-safe z-50 h-16 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    {mobileBottomNavItems.map((item) => {
                        const active = isItemActive(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex flex-col items-center justify-center flex-1 h-full py-1 ${active ? 'text-primary' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <div className={`p-1.5 rounded-full mb-0.5 transition-colors ${active ? 'bg-primary/10' : ''}`}>
                                    <item.icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-slate-400'}`} />
                                </div>
                                <span className={`text-[10px] truncate w-full text-center transition-all ${active ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {user?.role === 'admin' && (
                    <AdminDeletionRequestsModal
                        isOpen={isDeletionModalOpen}
                        onClose={() => setIsDeletionModalOpen(false)}
                        onActionCompleted={async () => {
                            const { count } = await supabase
                                .from('deletion_requests')
                                .select('*', { count: 'exact', head: true })
                                .eq('status', 'pending');
                            if (count !== null) setPendingDeletionCount(count);
                        }}
                    />
                )}
            </main>
        </div>
    );
}
