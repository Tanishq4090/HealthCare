import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type AccessModule = 'crm' | 'clients' | 'hr' | 'finance';

export interface User {
    id: string;
    username: string;
    password?: string; // Stored only for local testing, would be hashed in a real DB
    name: string;
    role: 'admin' | 'user'; // Only used to distinguish the super admin who can manage other users
    accesses: AccessModule[];
    avatar: string;
}

interface AuthContextType {
    user: User | null;
    allUsers: User[];
    login: (user: User) => void;
    logout: () => void;
    hasAccess: (module: AccessModule) => boolean;
    // User Management
    createUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default admin for testing
const DEFAULT_ADMIN: User = {
    id: '1',
    username: 'admin',
    password: 'password123',
    name: 'Jane Doe',
    role: 'admin',
    accesses: ['crm', 'clients', 'hr', 'finance'],
    avatar: 'JD'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    // Initialize all users and current user from local storage
    useEffect(() => {
        // Load All Users DB
        let storedUsers: User[] = [];
        const usersStr = localStorage.getItem('99care_all_users');
        if (usersStr) {
            try {
                storedUsers = JSON.parse(usersStr);
            } catch (e) {
                console.error("Failed to parse stored users", e);
            }
        }

        // Seed with default admin if complete empty
        if (storedUsers.length === 0) {
            storedUsers = [DEFAULT_ADMIN];
            localStorage.setItem('99care_all_users', JSON.stringify(storedUsers));
        }
        setAllUsers(storedUsers);

        // Load Active Session
        const storedUser = localStorage.getItem('99care_active_user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                // Refresh active session from DB to get latest access changes
                const latestData = storedUsers.find(u => u.id === parsedUser.id);
                if (latestData) setUser(latestData);
            } catch (e) {
                console.error("Failed to parse active user", e);
            }
        }
    }, []);

    const login = (newUser: User) => {
        setUser(newUser);
        localStorage.setItem('99care_active_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('99care_active_user');
    };

    const hasAccess = (module: AccessModule) => {
        if (!user) return false;
        if (user.role === 'admin') return true; // Super admins always have access
        return user.accesses.includes(module);
    };

    // --- User Management Methods ---

    const createUser = (newUser: User) => {
        const updatedUsers = [...allUsers, newUser];
        setAllUsers(updatedUsers);
        localStorage.setItem('99care_all_users', JSON.stringify(updatedUsers));
    };

    const updateUser = (updatedUser: User) => {
        const updatedUsers = allUsers.map(u => (u.id === updatedUser.id ? updatedUser : u));
        setAllUsers(updatedUsers);
        localStorage.setItem('99care_all_users', JSON.stringify(updatedUsers));

        // If updating the active user, refresh their session
        if (user && user.id === updatedUser.id) {
            setUser(updatedUser);
            localStorage.setItem('99care_active_user', JSON.stringify(updatedUser));
        }
    };

    const deleteUser = (userId: string) => {
        const updatedUsers = allUsers.filter(u => u.id !== userId);
        setAllUsers(updatedUsers);
        localStorage.setItem('99care_all_users', JSON.stringify(updatedUsers));

        // If deleting self, logout
        if (user && user.id === userId) {
            logout();
        }
    };

    return (
        <AuthContext.Provider value={{ user, allUsers, login, logout, hasAccess, createUser, updateUser, deleteUser }}>
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
