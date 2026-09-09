import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type AccessModule = 'crm' | 'clients' | 'hr' | 'finance' | 'dashboard';

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
    refreshUsers: () => Promise<void>;
    createUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_USER_KEY = '99care_os_session_user';
const TANISHQ_USERNAME = 'tanishq4090';
const TANISHQ_ACCESS: AccessModule[] = ['hr', 'finance'];

const adminUser: User = {
    id: 'admin',
    username: 'admin',
    name: 'System Admin',
    role: 'admin',
    accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard'],
    avatar: 'SA'
};

// Removal of HARDCODED_USERS as we are moving to database-backed authentication.
const normalizeStaffAccess = (staffUser: User): User => {
    const isTanishqAccount =
        staffUser.username?.toLowerCase() === TANISHQ_USERNAME ||
        staffUser.name?.trim().toLowerCase() === 'tanishq kachiwala';

    if (!isTanishqAccount) return { ...staffUser, password: undefined };

    return {
        ...staffUser,
        password: undefined,
        role: 'user',
        accesses: TANISHQ_ACCESS,
    };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = sessionStorage.getItem(SESSION_USER_KEY);
            return raw ? normalizeStaffAccess(JSON.parse(raw)) : null;
        } catch {
            return null;
        }
    });
    const [allUsers, setAllUsers] = useState<User[]>([]); 
    const [loading, setLoading] = useState(true);

    const refreshUsers = useCallback(async () => {
        try {
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
            try {
                const raw = sessionStorage.getItem(SESSION_USER_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setUser(normalizeStaffAccess(parsed));
                } else {
                    setUser(null);
                }
            } catch {
                sessionStorage.removeItem(SESSION_USER_KEY);
                setUser(null);
            }

            await refreshUsers();
            setLoading(false);
        };
        checkUser();
    }, [refreshUsers]);

    const login = async (role?: string, staffUser?: User) => {
        if (staffUser) {
            const normalized = normalizeStaffAccess(staffUser);
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(normalized));
            setUser(normalized);
            await refreshUsers();
            return;
        }

        if (role === 'admin') {
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(adminUser));
            setUser(adminUser);
            await refreshUsers();
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn('Sign out warning:', err);
        }
        sessionStorage.removeItem(SESSION_USER_KEY);
        setUser(null);
    };

    const hasAccess = (module: AccessModule) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.accesses.includes(module);
    };

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

        if (data?.user) {
            setAllUsers(prev => [adminUser, ...prev.filter(existing => existing.id !== adminUser.id), normalizeStaffAccess(data.user)]);
        }

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

        if (data?.user) {
            setAllUsers(prev => prev.map(existing => existing.id === data.user.id ? normalizeStaffAccess(data.user) : existing));
        }

        if (user?.id === updatedUser.id) {
            const nextUser = normalizeStaffAccess({ ...user, ...(data?.user || updatedUser) });
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser));
            setUser(nextUser);
        }

        await refreshUsers();
    };

    const deleteUser = async (userId: string) => {
        await callStaffAuth({ action: 'delete', id: userId });
        setAllUsers(prev => prev.filter(existing => existing.id !== userId));
        await refreshUsers();
    };

    return (
        <AuthContext.Provider value={{ user, allUsers, loading, login, logout, hasAccess, refreshUsers, createUser, updateUser, deleteUser }}>
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
