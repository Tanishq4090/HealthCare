import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, AccessModule } from '../contexts/AuthContext';
import { UserCheck, UserPlus, ShieldAlert, Trash2, Edit3, X, Check, Save, Users, Ban, Loader2, Clock, CheckCircle2, Search, Eye, EyeOff, Lock, History, ShieldCheck, Download, Laptop, Smartphone, Tablet, RefreshCw, Filter, ArrowUpRight, FileText, Layers, Globe, Activity, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
    fetchAllDeletionRequests,
    approveDeletionRequest,
    rejectDeletionRequest,
    type DeletionRequest,
    type DeletionRequestStatus
} from '../services/deletionService';
import { fetchAuditLogs, type AuditLogItem, type AuditAction } from '../services/auditService';

const MODULES: { id: AccessModule; label: string; desc: string }[] = [
    { id: 'dashboard', label: 'Operations Dashboard', desc: 'KPI metrics, daily schedules, analytics overview, and attention alerts.' },
    { id: 'crm', label: 'Leads & Inquiries', desc: 'Customer inquiries, AI call recordings, quotations, and conversion pipeline.' },
    { id: 'clients', label: 'Client Master', desc: 'Patient records, active service cycles, multi-select export, and bulk WhatsApp.' },
    { id: 'hr', label: 'Caregivers & Operations', desc: 'Caregiver directory, deployments, live attendance matrix, and caregiver payroll.' },
    { id: 'finance', label: 'Finance & Billing', desc: 'Monthly client invoice generator, security deposits, and collection ledger.' },
];

export default function AccessControl() {
    const { user, allUsers, refreshUsers, createUser, updateUser, deleteUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Tab state: staff accounts vs deletion requests vs audit log
    const tabParam = searchParams.get('tab');
    const initialTab: 'staff' | 'deletions' | 'audit' =
        tabParam === 'deletions' || tabParam === 'audit' ? tabParam : 'staff';
    const [activeTab, setActiveTab] = useState<'staff' | 'deletions' | 'audit'>(initialTab);

    // Keep activeTab synced with URL query parameter
    useEffect(() => {
        if (tabParam === 'staff' || tabParam === 'deletions' || tabParam === 'audit') {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (tab: 'staff' | 'deletions' | 'audit') => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    // UI States for Staff
    const [isAdding, setIsAdding] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Audit logs states
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
    const [auditUserFilter, setAuditUserFilter] = useState<string>('all');
    const [auditSearch, setAuditSearch] = useState<string>('');
    const [selectedDiffItem, setSelectedDiffItem] = useState<AuditLogItem | null>(null);

    // Deletion requests states
    const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
    const [rejectPromptId, setRejectPromptId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    // Form States
    const [formData, setFormData] = useState<Partial<User>>({
        username: '',
        password: '',
        name: '',
        accesses: []
    });

    useEffect(() => {
        refreshUsers();
    }, [refreshUsers]);

    const displayUsers = useMemo(() => {
        if (allUsers.length > 0) return allUsers;
        return user?.role === 'admin' ? [user] : [];
    }, [allUsers, user]);

    const loadDeletionRequests = useCallback(async () => {
        setIsLoadingRequests(true);
        try {
            const data = await fetchAllDeletionRequests();
            setDeletionRequests(data);
        } catch (err: any) {
            console.error('Failed to load deletion requests:', err);
            toast.error('Failed to load deletion requests.');
        } finally {
            setIsLoadingRequests(false);
        }
    }, []);

    useEffect(() => {
        loadDeletionRequests();
    }, [loadDeletionRequests]);

    const loadAuditLogs = useCallback(async () => {
        setIsLoadingAudit(true);
        try {
            const logs = await fetchAuditLogs({
                action: auditActionFilter,
                userId: auditUserFilter,
                search: auditSearch,
            });
            setAuditLogs(logs);
        } catch (err: any) {
            console.error('Failed to load audit logs:', err);
            toast.error('Failed to load audit trail.');
        } finally {
            setIsLoadingAudit(false);
        }
    }, [auditActionFilter, auditUserFilter, auditSearch]);

    useEffect(() => {
        if (activeTab === 'audit') {
            loadAuditLogs();
        }
    }, [activeTab, loadAuditLogs]);

    const handleExportAuditCsv = () => {
        if (auditLogs.length === 0) {
            toast.error('No audit records to export.');
            return;
        }

        const headers = [
            'Log ID',
            'Timestamp',
            'Action',
            'Staff Name',
            'Staff Role',
            'Target Client / Entity',
            'Description',
            'Device Type',
            'Operating System',
            'Browser',
            'IP Address',
            'Changed Fields',
        ];

        const rows = auditLogs.map(log => {
            const dev = log.device_info || ({} as any);
            const fieldsChanged = log.changes?.fields?.join(', ') || 'N/A';
            return [
                log.id,
                log.created_at,
                log.action,
                `"${(log.user_name || '').replace(/"/g, '""')}"`,
                log.user_role,
                `"${(log.entity_name || '').replace(/"/g, '""')}"`,
                `"${(log.description || '').replace(/"/g, '""')}"`,
                dev.deviceType || 'Desktop',
                dev.os || 'Unknown',
                dev.browser || 'Unknown',
                dev.ip || 'N/A',
                `"${fieldsChanged.replace(/"/g, '""')}"`,
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `99Care_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${auditLogs.length} audit logs to CSV!`);
    };

    const pendingRequestsCount = useMemo(() => {
        return deletionRequests.filter(r => r.status === 'pending').length;
    }, [deletionRequests]);

    const filteredRequests = useMemo(() => {
        return deletionRequests.filter(r => {
            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchesSearch = !searchQuery ||
                r.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.requested_by_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.reason && r.reason.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesStatus && matchesSearch;
        });
    }, [deletionRequests, statusFilter, searchQuery]);

    const handleApproveRequest = async (req: DeletionRequest) => {
        const confirmMsg = req.action_type === 'permanent_delete'
            ? `Permanently delete "${req.entity_name}" (${req.entity_type})? This action CANNOT be undone.`
            : `Approve moving "${req.entity_name}" to trash?`;

        if (!window.confirm(confirmMsg)) return;

        setActionProcessingId(req.id);
        const toastId = toast.loading(`Executing deletion for "${req.entity_name}"...`);
        try {
            await approveDeletionRequest(req, user?.name || user?.username || 'System Admin');
            toast.success(`Request approved and "${req.entity_name}" deleted.`, { id: toastId });
            loadDeletionRequests();
        } catch (err: any) {
            console.error('Failed to approve deletion request:', err);
            toast.error(`Approval failed: ${err.message}`, { id: toastId });
        } finally {
            setActionProcessingId(null);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        setActionProcessingId(requestId);
        try {
            await rejectDeletionRequest(requestId, rejectNote, user?.name || user?.username || 'System Admin');
            toast.success('Deletion request rejected.');
            setRejectPromptId(null);
            setRejectNote('');
            loadDeletionRequests();
        } catch (err: any) {
            console.error('Failed to reject deletion request:', err);
            toast.error(`Rejection failed: ${err.message}`);
        } finally {
            setActionProcessingId(null);
        }
    };

    // Block non-admins preemptively (though ProtectedRoute also handles this)
    if (user?.role !== 'admin') {
        return (
            <div className="p-8 flex items-center justify-center flex-col text-slate-500 h-[70vh]">
                <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Restricted Area</h2>
                <p>Only system administrators can access user management.</p>
            </div>
        );
    }

    const resetForm = () => {
        setFormData({ username: '', password: '', name: '', accesses: [] });
        setIsAdding(false);
        setEditingUserId(null);
    };

    const handleEditClick = (targetUser: User) => {
        setFormData({ ...targetUser });
        setEditingUserId(targetUser.id);
        setIsAdding(false);
    };

    const handleSave = async () => {
        if (!formData.username || !formData.name) return toast.error("Username and name are required.");

        setIsSaving(true);
        try {
            if (isAdding) {
                if (!formData.password) {
                    toast.error("Password is required for new accounts.");
                    return;
                }

                const newUser: User = {
                    id: 'new',
                    username: formData.username.trim().toLowerCase(),
                    password: formData.password,
                    name: formData.name.trim(),
                    role: 'user',
                    accesses: formData.accesses || [],
                    avatar: formData.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                };
                await createUser(newUser);
                toast.success(`${newUser.name} can now sign in to 99Care OS.`);
            } else if (editingUserId) {
                const existingUser = displayUsers.find(u => u.id === editingUserId);
                if (!existingUser) return;

                const updated: User = {
                    ...existingUser,
                    username: formData.username.trim().toLowerCase(),
                    name: formData.name.trim(),
                    accesses: formData.accesses || [],
                    ...(formData.password ? { password: formData.password } : {})
                };

                if (existingUser.name !== formData.name) {
                    updated.avatar = formData.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                }

                await updateUser(updated);
                toast.success(`${updated.name}'s access was updated.`);
            }

            resetForm();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save staff account.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAccess = (moduleId: AccessModule) => {
        setFormData(prev => {
            const accesses = prev.accesses || [];
            if (accesses.includes(moduleId)) {
                return { ...prev, accesses: accesses.filter(id => id !== moduleId) };
            } else {
                return { ...prev, accesses: [...accesses, moduleId] };
            }
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                        <UserCheck className="w-6 h-6 text-primary" />
                        Access & Security Control
                    </h1>
                    <p className="text-slate-500 mt-1">Manage staff accounts, module permissions, and deletion request approvals.</p>
                </div>
                {activeTab === 'staff' && !isAdding && !editingUserId && (
                    <button
                        onClick={() => { resetForm(); setIsAdding(true); }}
                        className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add New User
                    </button>
                )}
            </div>

            {/* Sub-navigation tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 overflow-x-auto">
                <button
                    onClick={() => handleTabChange('staff')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'staff'
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    Staff Accounts
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${activeTab === 'staff' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {displayUsers.length}
                    </span>
                </button>

                <button
                    onClick={() => handleTabChange('deletions')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'deletions'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    Deletion Requests
                    {pendingRequestsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500 text-white animate-pulse">
                            {pendingRequestsCount} Pending
                        </span>
                    )}
                </button>

                <button
                    onClick={() => handleTabChange('audit')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                        activeTab === 'audit'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Data Audit Log
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${activeTab === 'audit' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {auditLogs.length > 0 ? auditLogs.length : 'Live'}
                    </span>
                </button>
            </div>

            {activeTab === 'staff' && (
                <>
            {/* --- FORM REGION --- */}
            {(isAdding || editingUserId) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">
                            {isAdding ? "Create New Staff Account" : "Edit Account: " + formData.name}
                        </h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Smith"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                                <input
                                    type="text"
                                    placeholder="e.g. jsmith"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Password {editingUserId && <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>}
                                </label>
                                <input
                                    type="password"
                                    placeholder={editingUserId ? "••••••••" : "Choose a secure password"}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all max-w-md"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">
                                Module Access Permissions
                            </label>

                            {/* Super Admins don't need module checkboxes, they override it */}
                            {(editingUserId && displayUsers.find(u => u.id === editingUserId)?.role === 'admin') ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">Administrator Override</p>
                                        <p className="text-sm text-emerald-700 mt-0.5">This user is a system administrator and automatically has full access to all modules and full phone visibility.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {MODULES.map(mod => {
                                                const isChecked = formData.accesses?.includes(mod.id);
                                                return (
                                                    <div
                                                        key={mod.id}
                                                        onClick={() => toggleAccess(mod.id)}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${isChecked
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-slate-100 bg-white hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isChecked ? 'bg-primary text-white' : 'bg-slate-100 text-transparent border border-slate-200'
                                                            }`}>
                                                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-bold ${isChecked ? 'text-primary' : 'text-slate-700'}`}>{mod.label}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.desc}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Data Privacy & Phone Masking */}
                                    <div className="pt-2">
                                        <label className="block text-sm font-bold text-slate-900 mb-2 border-b border-slate-100 pb-2">
                                            Data Privacy & Sensitive Fields
                                        </label>
                                        <div
                                            onClick={() => toggleAccess('view_phones')}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                                                formData.accesses?.includes('view_phones')
                                                    ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                                                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                                formData.accesses?.includes('view_phones') ? 'bg-emerald-600 text-white' : 'bg-white text-transparent border border-slate-300'
                                            }`}>
                                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-bold ${formData.accesses?.includes('view_phones') ? 'text-emerald-900' : 'text-slate-700'}`}>
                                                        Reveal Full Phone Numbers
                                                    </span>
                                                    {formData.accesses?.includes('view_phones') ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                                                            <Eye className="w-3 h-3" /> Full Visibility
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md">
                                                            <EyeOff className="w-3 h-3 text-slate-500" /> Masked Default (95370•••75)
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    When enabled, this user can see unmasked 10-digit phone numbers, click to dial, copy numbers, and export contact details. When disabled, client, caregiver, lead, and invoice phone numbers are masked across all pages.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={resetForm} className="px-5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200/50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save Account'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- USER LIST REGION --- */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold font-['Plus_Jakarta_Sans'] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Access Modules & Privacy</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayUsers.map((u) => {
                                const normalMods = (u.accesses || []).filter(m => m !== 'view_phones');
                                const hasPhoneAccess = u.role === 'admin' || (u.accesses || []).includes('view_phones');
                                return (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${u.role === 'admin' ? 'bg-primary' : 'bg-slate-400'}`}>
                                                {u.avatar}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{u.name}</div>
                                                <div className="text-xs text-slate-500">{u.role === 'admin' ? 'Administrator' : 'Standard User'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 bg-slate-50/30">
                                        {u.username}
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.role === 'admin' ? (
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                    * Full System Access
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <Eye className="w-3 h-3 text-emerald-600" /> Full Phone Visibility
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {normalMods.length === 0 && <span className="text-slate-400 italic text-xs">No Module Access</span>}
                                                    {normalMods.map(mod => {
                                                        const dict = MODULES.find(m => m.id === mod);
                                                        return (
                                                            <span key={mod} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                                {dict?.label || mod}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                <div>
                                                    {hasPhoneAccess ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <Eye className="w-3 h-3 text-emerald-600" /> Full Phone Access
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                            <EyeOff className="w-3 h-3 text-slate-400" /> Phone Masked (95370•••75)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEditClick(u)}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>

                                            {u.id !== user?.id && (
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`Are you sure you want to delete ${u.name}?`)) return;
                                                        try {
                                                            await deleteUser(u.id);
                                                            toast.success(`${u.name} was removed from OS access.`);
                                                        } catch (err: any) {
                                                            toast.error(err.message || 'Failed to delete staff account.');
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
            )}

            {/* --- DELETION REQUESTS REGION --- */}
            {activeTab === 'deletions' && (
                <div className="space-y-4">
                    {/* Controls Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                            {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${
                                        statusFilter === st
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {st === 'all' ? `All (${deletionRequests.length})` : st}
                                    {st === 'pending' && pendingRequestsCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                                            {pendingRequestsCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search entity, staff or reason..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                            <button
                                onClick={loadDeletionRequests}
                                disabled={isLoadingRequests}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {isLoadingRequests ? (
                            <div className="p-16 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                <p className="text-sm font-medium">Loading deletion requests...</p>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="p-16 text-center text-slate-400">
                                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                                <h4 className="font-bold text-slate-800 text-base">No Requests Found</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    {statusFilter === 'pending'
                                        ? 'Great! There are no pending deletion requests awaiting admin review.'
                                        : 'No deletion requests match the selected filters.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3.5">Target Record</th>
                                            <th className="px-6 py-3.5">Requested Action</th>
                                            <th className="px-6 py-3.5">Requested By</th>
                                            <th className="px-6 py-3.5">Reason</th>
                                            <th className="px-6 py-3.5">Status</th>
                                            <th className="px-6 py-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRequests.map((req) => {
                                            const isPending = req.status === 'pending';
                                            const isProcessing = actionProcessingId === req.id;
                                            const isRejecting = rejectPromptId === req.id;

                                            return (
                                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{req.entity_name}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                                                                {req.entity_type}
                                                            </span>
                                                            <span className="text-[11px] text-slate-400 font-mono">
                                                                ID: {req.entity_id.slice(0, 8)}...
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                                                                req.action_type === 'permanent_delete'
                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                                            }`}
                                                        >
                                                            {req.action_type === 'permanent_delete' ? 'Permanent Delete' : 'Move to Trash'}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-slate-900 text-xs">{req.requested_by_name}</div>
                                                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(req.created_at).toLocaleDateString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 max-w-xs">
                                                        <p className="text-xs text-slate-700 line-clamp-2">
                                                            {req.reason || <span className="italic text-slate-400">No reason stated</span>}
                                                        </p>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                req.status === 'approved'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : req.status === 'rejected'
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-amber-100 text-amber-800 animate-pulse'
                                                            }`}
                                                        >
                                                            {req.status === 'approved' && <Check className="w-3 h-3" />}
                                                            {req.status === 'rejected' && <Ban className="w-3 h-3" />}
                                                            {req.status.toUpperCase()}
                                                        </span>
                                                        {req.reviewed_by && (
                                                            <div className="text-[10px] text-slate-400 mt-1">
                                                                by {req.reviewed_by}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-right">
                                                        {isPending ? (
                                                            isRejecting ? (
                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        value={rejectNote}
                                                                        onChange={(e) => setRejectNote(e.target.value)}
                                                                        placeholder="Rejection note..."
                                                                        className="px-2 py-1 text-xs border rounded-md w-40"
                                                                    />
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => setRejectPromptId(null)}
                                                                            className="px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 rounded"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRejectRequest(req.id)}
                                                                            disabled={isProcessing}
                                                                            className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded hover:bg-red-700"
                                                                        >
                                                                            Confirm
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => setRejectPromptId(req.id)}
                                                                        disabled={isProcessing}
                                                                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleApproveRequest(req)}
                                                                        disabled={isProcessing}
                                                                        className={`px-3 py-1 text-xs font-bold text-white rounded-lg transition-all shadow-xs flex items-center gap-1 ${
                                                                            req.action_type === 'permanent_delete'
                                                                                ? 'bg-red-600 hover:bg-red-700'
                                                                                : 'bg-emerald-600 hover:bg-emerald-700'
                                                                        }`}
                                                                    >
                                                                        {isProcessing ? (
                                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        )}
                                                                        Approve
                                                                    </button>
                                                                </div>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">Resolved</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- AUDIT LOG REGION --- */}
            {activeTab === 'audit' && (
                <div className="space-y-6">
                    {/* Header Banner & Security Guarantee */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-700/60">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-2">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Client Data Privacy &amp; Compliance Audit
                                </div>
                                <h2 className="text-xl font-bold tracking-tight">System Audit &amp; Device Activity Trail</h2>
                                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                    Immutable real-time audit log tracking every user and device that viewed, modified, or exported client data across 99 Care OS.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleExportAuditCsv}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-xs"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Export Audit CSV
                                </button>
                                <button
                                    onClick={loadAuditLogs}
                                    disabled={isLoadingAudit}
                                    className="p-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                                    title="Refresh logs"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Top Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Events</p>
                                <p className="text-xl font-extrabold text-white mt-0.5">{auditLogs.length}</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Client Views</p>
                                <p className="text-xl font-extrabold text-sky-300 mt-0.5">
                                    {auditLogs.filter(l => l.action === 'VIEW').length}
                                </p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Data Edits</p>
                                <p className="text-xl font-extrabold text-amber-300 mt-0.5">
                                    {auditLogs.filter(l => l.action === 'EDIT').length}
                                </p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Exports / Copies</p>
                                <p className="text-xl font-extrabold text-emerald-300 mt-0.5">
                                    {auditLogs.filter(l => l.action === 'EXPORT').length}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Action Filter */}
                            <select
                                value={auditActionFilter}
                                onChange={(e) => setAuditActionFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="all">All Actions</option>
                                <option value="VIEW">👁️ Views Only</option>
                                <option value="EDIT">✏️ Edits &amp; Modifications</option>
                                <option value="EXPORT">📥 Exports &amp; Bulk Copies</option>
                                <option value="SERVICE_CHANGE">🔄 Service Cycle Changes</option>
                                <option value="DELETE">🗑️ Deletions</option>
                            </select>

                            {/* Staff Member Filter */}
                            <select
                                value={auditUserFilter}
                                onChange={(e) => setAuditUserFilter(e.target.value)}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="all">All Staff Members</option>
                                {displayUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                                ))}
                            </select>
                        </div>

                        {/* Search Bar */}
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={auditSearch}
                                onChange={(e) => setAuditSearch(e.target.value)}
                                placeholder="Search client, user, IP, or OS..."
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Audit Log Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {isLoadingAudit ? (
                            <div className="p-12 text-center text-slate-500">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                                <p className="text-sm font-semibold">Loading audit trail records...</p>
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                                <p className="text-sm font-bold text-slate-700">No audit logs matching filters</p>
                                <p className="text-xs text-slate-500 mt-1">Audit events are logged in real-time when clients are viewed, edited, or exported.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold font-['Plus_Jakarta_Sans'] tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3.5">Timestamp</th>
                                            <th className="px-5 py-3.5">Staff User</th>
                                            <th className="px-5 py-3.5">Action</th>
                                            <th className="px-5 py-3.5">Target Client</th>
                                            <th className="px-5 py-3.5">Device &amp; IP Address</th>
                                            <th className="px-5 py-3.5 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {auditLogs.map((log) => {
                                            const dev = log.device_info || ({} as any);
                                            const isView = log.action === 'VIEW';
                                            const isEdit = log.action === 'EDIT';
                                            const isExport = log.action === 'EXPORT';
                                            const isService = log.action === 'SERVICE_CHANGE';
                                            const isDelete = log.action === 'DELETE';

                                            const DeviceIcon = dev.deviceType === 'Mobile' ? Smartphone : dev.deviceType === 'Tablet' ? Tablet : Laptop;

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                                    {/* Timestamp */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    </td>

                                                    {/* User */}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                                                                log.user_role === 'admin' ? 'bg-primary' : 'bg-slate-500'
                                                            }`}>
                                                                {(log.user_name || 'U').slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-900 truncate">{log.user_name}</p>
                                                                <p className="text-[10px] text-slate-400 capitalize">{log.user_role}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Action Pill */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                                            isView ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                                            isEdit ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                            isExport ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                                            isService ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                                            isDelete ? 'bg-red-50 text-red-700 border border-red-200' :
                                                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {isView && <Eye className="w-3 h-3" />}
                                                            {isEdit && <Edit3 className="w-3 h-3" />}
                                                            {isExport && <Download className="w-3 h-3" />}
                                                            {isService && <RefreshCw className="w-3 h-3" />}
                                                            {isDelete && <Trash2 className="w-3 h-3" />}
                                                            {log.action}
                                                        </span>
                                                    </td>

                                                    {/* Target Client */}
                                                    <td className="px-5 py-3.5 min-w-[160px]">
                                                        <div className="text-xs font-bold text-slate-900 truncate">
                                                            {log.entity_name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 truncate font-mono">
                                                            {log.description}
                                                        </div>
                                                    </td>

                                                    {/* Device & IP Profile */}
                                                    <td className="px-5 py-3.5 min-w-[200px]">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                                                            <DeviceIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                            <span>{dev.os || 'Unknown OS'}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-slate-600">{dev.browser || 'Browser'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                                            {dev.ip && dev.ip !== 'Local / Unknown' && (
                                                                <span className="font-mono bg-slate-100 text-slate-700 px-1 rounded border border-slate-200">
                                                                    IP: {dev.ip}
                                                                </span>
                                                            )}
                                                            {dev.screen && <span>({dev.screen})</span>}
                                                        </div>
                                                    </td>

                                                    {/* Action / Inspect */}
                                                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                        {(log.changes?.fields?.length || log.changes?.export_details || log.changes?.diff) ? (
                                                            <button
                                                                onClick={() => setSelectedDiffItem(log)}
                                                                className="px-2.5 py-1 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary rounded-lg transition-colors inline-flex items-center gap-1"
                                                            >
                                                                <Layers className="w-3 h-3" />
                                                                Inspect Diff
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setSelectedDiffItem(log)}
                                                                className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                                                            >
                                                                <Info className="w-3 h-3" />
                                                                Details
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- DIFF INSPECTION MODAL --- */}
            {selectedDiffItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs" onClick={() => setSelectedDiffItem(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        selectedDiffItem.action === 'VIEW' ? 'bg-sky-100 text-sky-800' :
                                        selectedDiffItem.action === 'EDIT' ? 'bg-amber-100 text-amber-800' :
                                        selectedDiffItem.action === 'EXPORT' ? 'bg-purple-100 text-purple-800' :
                                        'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {selectedDiffItem.action}
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Audit Event: {selectedDiffItem.entity_name}
                                    </h3>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Performed by <span className="font-semibold text-slate-800">{selectedDiffItem.user_name}</span> ({selectedDiffItem.user_role}) on {new Date(selectedDiffItem.created_at).toLocaleString()}
                                </p>
                            </div>
                            <button onClick={() => setSelectedDiffItem(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Device & Hardware Fingerprint */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-slate-500" /> Device &amp; Connection Context
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Device</span>
                                    <span className="font-semibold text-slate-800">{selectedDiffItem.device_info?.deviceType || 'Desktop'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Operating System</span>
                                    <span className="font-semibold text-slate-800">{selectedDiffItem.device_info?.os || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Browser</span>
                                    <span className="font-semibold text-slate-800">{selectedDiffItem.device_info?.browser || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">IP Address</span>
                                    <span className="font-mono font-semibold text-slate-800">{selectedDiffItem.device_info?.ip || 'Unavailable'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Field Changes Table (For Edits) */}
                        {selectedDiffItem.changes?.diff && Object.keys(selectedDiffItem.changes.diff).length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Modified Fields ({Object.keys(selectedDiffItem.changes.diff).length})
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5">Field</th>
                                                <th className="p-2.5">Previous Value (Before)</th>
                                                <th className="p-2.5">New Value (After)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                            {Object.entries(selectedDiffItem.changes.diff).map(([key, delta]: [string, any]) => (
                                                <tr key={key} className="hover:bg-slate-50">
                                                    <td className="p-2.5 font-bold font-sans text-slate-800">{key}</td>
                                                    <td className="p-2.5 text-red-600 bg-red-50/50 break-all">{String(delta.from ?? '—')}</td>
                                                    <td className="p-2.5 text-emerald-700 bg-emerald-50/50 break-all">{String(delta.to ?? '—')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Export Details (For Exports) */}
                        {selectedDiffItem.changes?.export_details && (
                            <div className="bg-purple-50/60 rounded-xl p-3.5 border border-purple-200/80 space-y-2 text-xs">
                                <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Download className="w-3.5 h-3.5" /> Export Specifications
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] text-purple-700/80 block">Export Format</span>
                                        <span className="font-bold text-purple-900 uppercase">{selectedDiffItem.changes.export_details.format}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-purple-700/80 block">Total Records</span>
                                        <span className="font-bold text-purple-900">{selectedDiffItem.changes.export_details.record_count}</span>
                                    </div>
                                </div>
                                {selectedDiffItem.changes.export_details.sample_names && selectedDiffItem.changes.export_details.sample_names.length > 0 && (
                                    <div className="pt-2 border-t border-purple-100">
                                        <span className="text-[10px] text-purple-700/80 block mb-1">Sample Exported Records</span>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedDiffItem.changes.export_details.sample_names.map((name, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded bg-white text-purple-900 border border-purple-200 text-[11px] font-medium">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedDiffItem(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
