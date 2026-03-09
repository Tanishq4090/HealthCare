import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { User, AccessModule } from '../contexts/AuthContext';
import { UserCheck, UserPlus, ShieldAlert, Trash2, Edit3, X, Check, Save } from 'lucide-react';

const MODULES: { id: AccessModule; label: string; desc: string }[] = [
    { id: 'crm', label: 'AI CRM Pipeline', desc: 'Allows access to the lead management Kanban board.' },
    { id: 'clients', label: 'Client Master', desc: 'Allows viewing and managing the Client Master spreadsheet.' },
    { id: 'hr', label: 'AI HR & Workers', desc: 'Grants access to worker management, payroll, and compliance.' },
    { id: 'finance', label: 'Finance & Billing', desc: 'Grants access to invoices and revenue tracking.' },
];

export default function AccessControl() {
    const { user, allUsers, createUser, updateUser, deleteUser } = useAuth();

    // UI States
    const [isAdding, setIsAdding] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Form States
    const [formData, setFormData] = useState<Partial<User>>({
        username: '',
        password: '',
        name: '',
        accesses: []
    });

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

    const handleSave = () => {
        if (!formData.username || !formData.name) return alert("Username and Name are required.");

        if (isAdding) {
            if (!formData.password) return alert("Password is required for new accounts.");

            const newUser: User = {
                id: 'usr_' + Date.now(),
                username: formData.username,
                password: formData.password,
                name: formData.name,
                role: 'user', // Default to standard user, only default admin is 'admin'
                accesses: formData.accesses || [],
                avatar: formData.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
            };
            createUser(newUser);
        } else if (editingUserId) {
            const existingUser = allUsers.find(u => u.id === editingUserId);
            if (!existingUser) return;

            const updated: User = {
                ...existingUser,
                username: formData.username,
                name: formData.name,
                accesses: formData.accesses || [],
                // only update password if they typed a new one, else keep old
                ...(formData.password ? { password: formData.password } : {})
            };

            // Re-calculate avatar if name changed
            if (existingUser.name !== formData.name) {
                updated.avatar = formData.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            }

            updateUser(updated);
        }

        resetForm();
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
                        <UserCheck className="w-6 h-6 text-primary" />
                        Access Control
                    </h1>
                    <p className="text-slate-500 mt-1">Manage staff accounts and their module permissions.</p>
                </div>
                {!isAdding && !editingUserId && (
                    <button
                        onClick={() => { resetForm(); setIsAdding(true); }}
                        className="bg-primary hover:bg-primary/90 text-white font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add New User
                    </button>
                )}
            </div>

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
                            {(editingUserId && allUsers.find(u => u.id === editingUserId)?.role === 'admin') ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">Administrator Override</p>
                                        <p className="text-sm text-emerald-700 mt-0.5">This user is a system administrator and automatically has full access to all modules.</p>
                                    </div>
                                </div>
                            ) : (
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
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={resetForm} className="px-5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200/50 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Save Account
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
                                <th className="px-6 py-4">Access Modules</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${u.role === 'admin' ? 'bg-indigo-500' : 'bg-slate-400'}`}>
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
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                * Full System Access
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {u.accesses.length === 0 && <span className="text-slate-400 italic">No Access</span>}
                                                {u.accesses.map(mod => {
                                                    const dict = MODULES.find(m => m.id === mod);
                                                    return (
                                                        <span key={mod} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                            {dict?.label || mod}
                                                        </span>
                                                    );
                                                })}
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
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to delete ${u.name}?`)) deleteUser(u.id);
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
