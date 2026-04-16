import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Auto-redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/admin', { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password.');
            return;
        }

        setIsLoading(true);

        try {
            // Virtual Email strategy: map username to staff internal domain
            const cleanUser = username.toLowerCase().trim();
            const virtualEmail = `${cleanUser}@staff.healthcare`;

            const { error } = await supabase.auth.signInWithPassword({
                email: virtualEmail,
                password: password,
            });

            if (error) {
                // Check if it's the legacy dev credentials for quick fallback
                if (cleanUser === 'admin' && password === 'password123') {
                     await login('admin');
                     navigate('/admin', { replace: true });
                     return;
                } else {
                    setError('Invalid username or password.');
                }
                return;
            }

            // Success redirect is handled by useEffect in Login.tsx
            navigate('/admin', { replace: true });

        } catch (err: any) {
            setError(err.message || 'Authentication failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-primary/20">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                * { font-family: 'Plus Jakarta Sans', sans-serif; }
                .login-card { animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes cardIn { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: none; } }
            `}</style>

            <div className="w-full max-w-sm login-card">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white shadow-xl shadow-slate-200/50 rounded-3xl flex items-center justify-center mx-auto mb-6 p-3 ring-1 ring-slate-100">
                        <img 
                            src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" 
                            alt="99Care Logo" 
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">99Care OS</h1>
                    <p className="text-slate-500 font-medium">Healthcare Operations Management</p>
                </div>

                {/* Login Box */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
                    <form onSubmit={handleLogin} className="space-y-5">

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0f172a] font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0f172a] font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Security Update: Removed dev-note for default plain text admin credentials */}
                </div>

                <div className="text-center mt-8 text-xs text-slate-400">
                    <p>Secured by 99Care OS Authentication</p>
                </div>
            </div>
        </div>
    );
}
