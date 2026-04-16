import React, { createContext, useContext, useState, useEffect } from 'react';
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
    login: (role?: string) => void; 
    logout: () => Promise<void>;
    hasAccess: (module: AccessModule) => boolean;
    createUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'healthfirst_pure_token';

// Removal of HARDCODED_USERS as we are moving to database-backed authentication.

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [allUsers] = useState<User[]>([]); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user: supabaseUser } } = await supabase.auth.getUser();
            if (supabaseUser) {
                // Fetch additional employee data from public.employees
                const { data: profile } = await supabase
                    .from('employees')
                    .select('id, username, full_name, role, accesses, photo_url')
                    .eq('username', supabaseUser.email?.split('@')[0])
                    .single();

                if (profile) {
                    setUser({
                        id: profile.id,
                        username: profile.username,
                        name: profile.full_name,
                        role: profile.role,
                        accesses: profile.accesses || [],
                        avatar: profile.photo_url || profile.full_name[0]
                    });
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    const login = async (role?: string) => {
        if (role === 'admin') {
            localStorage.setItem(LOCAL_STORAGE_KEY, 'admin-token');
            setUser({
                id: 'admin',
                username: 'admin',
                name: 'System Admin',
                role: 'admin',
                accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard'],
                avatar: ''
            });
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setUser(null);
    };

    const hasAccess = (module: AccessModule) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.accesses.includes(module);
    };

    const createUser = () => {};
    const updateUser = () => {};
    const deleteUser = () => {};

    return (
        <AuthContext.Provider value={{ user, allUsers, loading, login, logout, hasAccess, createUser, updateUser, deleteUser }}>
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
