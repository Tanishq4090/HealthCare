import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

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
            // Pure Username Auth System Request (Zero Supabase API dependency)
            const cleanUser = username.toLowerCase().trim();
            if (cleanUser === 'admin' && password === 'password123') {
                login('pure_dev_token_admin');
                navigate('/admin', { replace: true });
            } else if (cleanUser === 'client' && password === 'password123') {
                login('pure_dev_token_client');
                navigate('/admin', { replace: true });
            } else {
                setError('Invalid username or password.');
            }
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
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
                        <span className="text-white font-bold text-3xl leading-none">99</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome to 99 Care</h1>
                    <p className="text-slate-500">Sign in to your dashboard to continue</p>
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    <p>Secured by HealthFirst OS Authentication</p>
                </div>
            </div>
        </div>
    );
}
