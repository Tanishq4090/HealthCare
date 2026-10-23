import React from 'react';
import { AlertTriangle, Clock, LogOut, CheckCircle } from 'lucide-react';

interface SessionTimeoutModalProps {
    isOpen: boolean;
    secondsLeft: number;
    onStayLoggedIn: () => void;
    onLogoutNow: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
    isOpen,
    secondsLeft,
    onStayLoggedIn,
    onLogoutNow,
}) => {
    if (!isOpen) return null;

    // Progress percentage based on 60 seconds
    const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 60) * 100));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center relative overflow-hidden">
                {/* Top subtle emergency banner */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

                {/* Animated Warning Icon */}
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto mb-4 text-amber-600 shadow-sm">
                    <AlertTriangle className="w-8 h-8 animate-pulse text-amber-500" />
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
                    Session Inactivity Warning
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                    Under India's DPDP Act 2023 & healthcare security policy, inactive admin sessions are automatically locked to safeguard patient and clinical records.
                </p>

                {/* Countdown display */}
                <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        Automatic Logout In
                    </div>
                    <div className="text-4xl font-black text-rose-600 font-mono tracking-tight">
                        {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                        <div
                            className="bg-rose-500 h-full transition-all duration-1000 ease-linear rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onStayLoggedIn}
                        className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Stay Signed In
                    </button>
                    <button
                        type="button"
                        onClick={onLogoutNow}
                        className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                        <LogOut className="w-4 h-4" />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
};
