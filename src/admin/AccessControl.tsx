import { useState } from 'react';
import { Check, Edit3, Save, ShieldAlert, ShieldCheck, Trash2, UserCheck, UserPlus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule, User } from '../contexts/AuthContext';
import { AdminPage, IconFrame, SectionHeader, StatusBadge, Surface } from './AdminPrimitives';
import { cn } from '../lib/utils';

const MODULES: { id: AccessModule; label: string; desc: string }[] = [
    { id: 'dashboard', label: 'Main Dashboard', desc: 'Access to high-level analytics and business overview.' },
    { id: 'crm', label: 'AI CRM Pipeline', desc: 'Allows access to the lead management Kanban board.' },
    { id: 'clients', label: 'Client Master', desc: 'Allows viewing and managing the Client Master spreadsheet.' },
    { id: 'hr', label: 'AI HR & Workers', desc: 'Grants access to worker management, payroll, and compliance.' },
    { id: 'finance', label: 'Finance & Billing', desc: 'Grants access to invoices and revenue tracking.' },
];

export default function AccessControl() {
    const { user, allUsers, createUser, updateUser, deleteUser } = useAuth();
    const [isAdding, setIsAdding] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<User>>({
        username: '',
        password: '',
        name: '',
        accesses: [],
    });

    if (user?.role !== 'admin') {
        return (
            <AdminPage>
                <Surface className="mx-auto max-w-xl text-center">
                    <IconFrame icon={ShieldAlert} tone="rose" className="mx-auto mb-4 h-12 w-12" />
                    <h2 className="text-xl font-bold text-slate-800">Restricted Area</h2>
                    <p className="mt-1 text-sm text-slate-500">Only system administrators can access user management.</p>
                </Surface>
            </AdminPage>
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

    const handleSave = () => {
        if (!formData.username || !formData.name) return alert('Username and Name are required.');

        if (isAdding) {
            if (!formData.password) return alert('Password is required for new accounts.');

            const newUser: User = {
                id: `usr_${Date.now()}`,
                username: formData.username,
                password: formData.password,
                name: formData.name,
                role: 'user',
                accesses: formData.accesses || [],
                avatar: formData.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
            };
            createUser(newUser);
        } else if (editingUserId) {
            const existingUser = allUsers.find((candidate) => candidate.id === editingUserId);
            if (!existingUser) return;

            const updated: User = {
                ...existingUser,
                username: formData.username,
                name: formData.name,
                accesses: formData.accesses || [],
                ...(formData.password ? { password: formData.password } : {}),
            };

            if (existingUser.name !== formData.name) {
                updated.avatar = formData.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
            }

            updateUser(updated);
        }

        resetForm();
    };

    const toggleAccess = (moduleId: AccessModule) => {
        setFormData((prev) => {
            const accesses = prev.accesses || [];
            if (accesses.includes(moduleId)) {
                return { ...prev, accesses: accesses.filter((id) => id !== moduleId) };
            }
            return { ...prev, accesses: [...accesses, moduleId] };
        });
    };

    return (
        <AdminPage>
            <Surface className="bg-gradient-to-br from-white via-cyan-50/40 to-emerald-50/60">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-4">
                        <IconFrame icon={ShieldCheck} tone="cyan" className="h-12 w-12" />
                        <div>
                            <p className="text-xs font-bold uppercase text-cyan-700">Security workspace</p>
                            <h2 className="text-2xl font-extrabold text-slate-950">Access Control</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                                Review team access, role status, and permission coverage across care operations modules.
                            </p>
                        </div>
                    </div>
                    {!isAdding && !editingUserId && (
                        <button type="button" onClick={() => { resetForm(); setIsAdding(true); }} className="btn-primary">
                            <UserPlus className="h-4 w-4" />
                            Add New User
                        </button>
                    )}
                </div>
            </Surface>

            {(isAdding || editingUserId) && (
                <Surface>
                    <SectionHeader
                        title={isAdding ? 'Create New Staff Account' : `Edit Account: ${formData.name}`}
                        description="Set account details and module access."
                        action={
                            <button type="button" onClick={resetForm} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        }
                    />

                    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Demo User"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="field-control w-full px-4"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Username</label>
                            <input
                                type="text"
                                placeholder="e.g. demo.user"
                                value={formData.username || ''}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="field-control w-full px-4"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                Password {editingUserId && <span className="font-normal text-slate-400">(Leave blank to keep current)</span>}
                            </label>
                            <input
                                type="password"
                                placeholder={editingUserId ? 'Keep current password' : 'Choose a secure password'}
                                value={formData.password || ''}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="field-control w-full max-w-md px-4"
                            />
                        </div>
                    </div>

                    <div className="mt-8">
                        <label className="mb-3 block border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
                            Module Access Permissions
                        </label>

                        {editingUserId && allUsers.find((candidate) => candidate.id === editingUserId)?.role === 'admin' ? (
                            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Administrator Override</p>
                                    <p className="mt-0.5 text-sm text-emerald-700">This user is a system administrator and automatically has full access to all modules.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {MODULES.map((module) => {
                                    const isChecked = formData.accesses?.includes(module.id);
                                    return (
                                        <button
                                            key={module.id}
                                            type="button"
                                            onClick={() => toggleAccess(module.id)}
                                            className={cn(
                                                'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
                                                isChecked ? 'border-cyan-200 bg-cyan-50/70' : 'border-slate-100 bg-white hover:border-slate-200'
                                            )}
                                        >
                                            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors', isChecked ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-slate-200 bg-slate-100 text-transparent')}>
                                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                            </span>
                                            <span>
                                                <span className={cn('block text-sm font-bold', isChecked ? 'text-cyan-800' : 'text-slate-700')}>{module.label}</span>
                                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{module.desc}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <button type="button" onClick={resetForm} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="button" onClick={handleSave} className="btn-primary">
                            <Save className="h-4 w-4" />
                            Save Account
                        </button>
                    </div>
                </Surface>
            )}

            <div className="table-shell">
                <div className="clinical-content overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="table-heading px-6 py-4">User</th>
                                <th className="table-heading px-6 py-4">Username</th>
                                <th className="table-heading px-6 py-4">Access Modules</th>
                                <th className="table-heading px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.map((account) => (
                                <tr key={account.id} className="border-b border-slate-100/80 transition-colors hover:bg-cyan-50/40">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${account.role === 'admin' ? 'bg-gradient-to-br from-cyan-600 to-emerald-500' : 'bg-slate-400'}`}>
                                                {account.avatar}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-950">{account.name}</div>
                                                <div className="text-xs text-slate-500">{account.role === 'admin' ? 'Administrator' : 'Standard User'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="bg-slate-50/30 px-6 py-4 font-mono text-slate-600">{account.username}</td>
                                    <td className="px-6 py-4">
                                        {account.role === 'admin' ? (
                                            <StatusBadge className="border-cyan-100 bg-cyan-50 text-cyan-700">
                                                <UserCheck className="h-3.5 w-3.5" />
                                                Full System Access
                                            </StatusBadge>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {account.accesses.length === 0 && <span className="text-slate-400 italic">No Access</span>}
                                                {account.accesses.map((moduleId) => {
                                                    const dict = MODULES.find((module) => module.id === moduleId);
                                                    return (
                                                        <StatusBadge key={moduleId} className="border-slate-200 bg-slate-50 text-slate-600">
                                                            {dict?.label || moduleId}
                                                        </StatusBadge>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => handleEditClick(account)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-700" title="Edit User">
                                                <Edit3 className="h-4 w-4" />
                                            </button>

                                            {account.id !== user?.id && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to delete ${account.name}?`)) deleteUser(account.id);
                                                    }}
                                                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminPage>
    );
}
