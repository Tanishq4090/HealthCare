import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredModule?: AccessModule;
}

export default function ProtectedRoute({ children, requiredModule }: ProtectedRouteProps) {
    const { user, hasAccess, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-gray dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-brand-blue animate-spin" />
                    <p className="text-slate-500 font-medium">Verifying session...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if a specific module is required and if the user has access
    if (requiredModule && !hasAccess(requiredModule)) {
        // Silent Redirect: If they don't have access, just send them back to the main dashboard
        // instead of showing an "Access Denied" error message.
        return <Navigate to="/admin" replace />;
    }

    return <>{children}</>;
}
