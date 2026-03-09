import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { AccessModule } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredModule?: AccessModule;
}

export default function ProtectedRoute({ children, requiredModule }: ProtectedRouteProps) {
    const { user, hasAccess } = useAuth();
    const location = useLocation();

    if (!user) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience
        // than dropping them off on the home page.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if a specific module is required and if the user has access
    if (requiredModule && !hasAccess(requiredModule)) {
        // User is logged in but doesn't have the required role
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xl shadow-slate-200/50">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-500 mb-6">
                        You do not have the required permissions to view this module.
                        Please contact your administrator if you believe this is an error.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="bg-primary text-white font-medium py-2.5 px-6 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
