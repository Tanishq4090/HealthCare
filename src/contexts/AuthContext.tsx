import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type AccessModule = 'crm' | 'clients' | 'hr' | 'finance' | 'dashboard' | 'view_phones';

export interface User {
    id: string;
    username: string; // Pure username structure (No email requirement)
    password?: string; // Optional, used only in AccessControl UI form
    name: string;
    role: 'admin' | 'user';
    accesses: AccessModule[];
    avatar: string;
}

interface AuthContextType {
    user: User | null;
    allUsers: User[]; 
    loading: boolean;
    login: (role?: string, staffUser?: User) => Promise<void>; 
    logout: () => Promise<void>;
    hasAccess: (module: AccessModule) => boolean;
    canViewPhoneNumbers: boolean;
    refreshUsers: () => Promise<void>;
    createUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = '99care_os_auth_user';
const SESSION_USER_KEY = '99care_os_session_user';
const TANISHQ_USERNAME = 'tanishq4090';
const TANISHQ_ACCESS: AccessModule[] = ['hr', 'finance'];

const adminUser: User = {
    id: 'admin',
    username: 'admin',
    name: 'System Admin',
    role: 'admin',
    accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard', 'view_phones'],
    avatar: 'SA'
};

const normalizeStaffAccess = (staffUser: User): User => {
    const isTanishqAccount =
        staffUser.username?.toLowerCase() === TANISHQ_USERNAME ||
        staffUser.name?.trim().toLowerCase() === 'tanishq kachiwala';

    if (!isTanishqAccount) return { ...staffUser, password: undefined };

    return {
        ...staffUser,
        password: undefined,
        role: 'user',
        accesses: (staffUser.accesses && staffUser.accesses.length > 0) ? staffUser.accesses : TANISHQ_ACCESS,
    };
};

const readPersistedUser = (): User | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(SESSION_USER_KEY);
        if (!raw) return null;
        return normalizeStaffAccess(JSON.parse(raw));
    } catch {
        return null;
    }
};

const savePersistedUser = (user: User) => {
    try {
        const data = JSON.stringify(user);
        localStorage.setItem(AUTH_USER_KEY, data);
        sessionStorage.setItem(SESSION_USER_KEY, data);
    } catch (err) {
        console.warn('Failed to persist user session:', err);
    }
};

const clearPersistedUser = () => {
    try {
        localStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(SESSION_USER_KEY);
    } catch (err) {
        console.warn('Failed to clear persisted user session:', err);
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const initialUser = readPersistedUser();
    const [user, setUser] = useState<User | null>(initialUser);
    const [allUsers, setAllUsers] = useState<User[]>([]); 
    const [loading, setLoading] = useState<boolean>(!initialUser);

    const refreshUsers = useCallback(async () => {
        try {
            // First attempt to query staff_users table directly so custom permissions (e.g. view_phones) are 100% retained
            const { data: dbStaff, error: dbErr } = await supabase
                .from('staff_users')
                .select('id, username, full_name, role, accesses, avatar, created_at')
                .order('created_at', { ascending: true });

            if (!dbErr && dbStaff && dbStaff.length > 0) {
                const mapped: User[] = dbStaff.map(row => ({
                    id: row.id,
                    username: row.username,
                    name: row.full_name,
                    role: row.role as any,
                    accesses: row.accesses || [],
                    avatar: row.avatar || row.username.slice(0, 2).toUpperCase(),
                }));
                setAllUsers([adminUser, ...mapped.filter(u => u.id !== adminUser.id).map(normalizeStaffAccess)]);
                return;
            }

            const { data, error } = await supabase.functions.invoke('staff-auth', {
                body: { action: 'list' }
            });

            if (error) throw error;
            setAllUsers([adminUser, ...((data?.users || []) as User[]).map(normalizeStaffAccess)]);
        } catch (err) {
            console.error('Failed to load OS staff users:', err);
            setAllUsers([adminUser]);
        }
    }, []);

    useEffect(() => {
        const checkUser = async () => {
            const persisted = readPersistedUser();
            if (persisted) {
                setUser(persisted);
            } else {
                setUser(null);
            }
            setLoading(false);
            await refreshUsers();
        };
        checkUser();
    }, [refreshUsers]);

    const login = async (role?: string, staffUser?: User) => {
        if (staffUser) {
            let userToPersist = staffUser;
            try {
                // Ensure real accesses from DB (including view_phones) are loaded
                const { data: dbUser } = await supabase
                    .from('staff_users')
                    .select('accesses')
                    .eq('id', staffUser.id)
                    .maybeSingle();
                if (dbUser?.accesses) {
                    userToPersist = { ...staffUser, accesses: dbUser.accesses };
                }
            } catch (err) {
                console.warn('Could not re-fetch staff accesses:', err);
            }
            const normalized = normalizeStaffAccess(userToPersist);
            savePersistedUser(normalized);
            setUser(normalized);
            setLoading(false);
            await refreshUsers();
            return;
        }

        if (role === 'admin') {
            savePersistedUser(adminUser);
            setUser(adminUser);
            setLoading(false);
            await refreshUsers();
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn('Sign out warning:', err);
        }
        clearPersistedUser();
        setUser(null);
    };

    const hasAccess = (module: AccessModule) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.accesses.includes(module);
    };

    // Administrators and selected staff with 'view_phones' can look at phone numbers
    const canViewPhoneNumbers = Boolean(
        user && (user.role === 'admin' || user.accesses?.includes('view_phones'))
    );

    const callStaffAuth = async (body: Record<string, unknown>) => {
        const { data, error } = await supabase.functions.invoke('staff-auth', { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    };

    const createUser = async (newUser: User) => {
        const data = await callStaffAuth({
            action: 'create',
            username: newUser.username,
            password: newUser.password,
            name: newUser.name,
            accesses: newUser.accesses,
        });

        // Ensure accesses in database has view_phones if specified
        if (data?.user?.id && newUser.accesses) {
            await supabase
                .from('staff_users')
                .update({ accesses: newUser.accesses })
                .eq('id', data.user.id);
        }

        const resolvedUser: User = normalizeStaffAccess({
            ...(data?.user || newUser),
            accesses: newUser.accesses || [],
        });

        setAllUsers(prev => [adminUser, ...prev.filter(existing => existing.id !== adminUser.id), resolvedUser]);
        await refreshUsers();
    };

    const updateUser = async (updatedUser: User) => {
        const data = await callStaffAuth({
            action: 'update',
            id: updatedUser.id,
            username: updatedUser.username,
            password: updatedUser.password,
            name: updatedUser.name,
            accesses: updatedUser.accesses,
        });

        // Ensure accesses in database has view_phones if specified
        if (updatedUser.accesses) {
            await supabase
                .from('staff_users')
                .update({ accesses: updatedUser.accesses })
                .eq('id', updatedUser.id);
        }

        const resolvedUser: User = normalizeStaffAccess({
            ...(data?.user || updatedUser),
            accesses: updatedUser.accesses || [],
        });

        setAllUsers(prev => prev.map(existing => existing.id === resolvedUser.id ? resolvedUser : existing));

        if (user?.id === updatedUser.id) {
            savePersistedUser(resolvedUser);
            setUser(resolvedUser);
        }

        await refreshUsers();
    };

    const deleteUser = async (userId: string) => {
        await callStaffAuth({ action: 'delete', id: userId });
        setAllUsers(prev => prev.filter(existing => existing.id !== userId));
        await refreshUsers();
    };

    return (
        <AuthContext.Provider value={{ user, allUsers, loading, login, logout, hasAccess, canViewPhoneNumbers, refreshUsers, createUser, updateUser, deleteUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
