import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

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
    login: (token: string) => void; 
    logout: () => Promise<void>;
    hasAccess: (module: AccessModule) => boolean;
    createUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'healthfirst_pure_token';

const HARDCODED_USERS: Record<string, User> = {
    'pure_dev_token_admin': {
        id: '1',
        username: 'admin',
        name: 'Administrator',
        role: 'admin',
        accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard'],
        avatar: 'A'
    },
    'pure_dev_token_client': {
        id: '2',
        username: 'client',
        name: 'Client',
        role: 'user',
        accesses: ['dashboard', 'crm'],
        avatar: 'C'
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [allUsers] = useState<User[]>([]); 
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (token && HARDCODED_USERS[token]) {
            setUser(HARDCODED_USERS[token]);
        } else {
            setUser(null);
        }
        setLoading(false);
    }, []);

    const login = (token: string) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, token);
        if (HARDCODED_USERS[token]) {
            setUser(HARDCODED_USERS[token]);
        }
    };

    const logout = async () => {
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
