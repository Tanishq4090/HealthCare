import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, User as UserIcon, ShieldCheck, KeyRound, ArrowLeft, RefreshCw, AlertCircle, Clock, Phone, Smartphone, CheckCircle2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import {
    initiateAdminTwoFactor,
    verifyAdminTwoFactor,
    resendAdminTwoFactorCode,
    cancelTwoFactorChallenge,
    getUserPhoneNumbers,
    maskPhoneFor2FA
} from './services/twoFactorService';

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);

    // Step 1: Credentials state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Step 2A: Phone selector state (when admin has multiple registered phone numbers)
    const [pendingPhoneSelect, setPendingPhoneSelect] = useState<{
        user: any;
        availablePhones: string[];
        selectedPhone: string;
        pendingRole?: string;
        pendingStaffUser?: any;
    } | null>(null);

    // Step 2B: 2FA Verification State for Admin accounts
    const [pending2FA, setPending2FA] = useState<{
        challengeId: string;
        targetPhone: string;
        maskedPhone: string;
        availablePhones: string[];
        devCode?: string;
        dispatchedVia?: 'sms' | 'whatsapp' | 'local_secure';
        pendingRole?: string;
        pendingStaffUser?: any;
    } | null>(null);

    const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
    const [resendCooldown, setResendCooldown] = useState(30);
    const [useEmergencyKey, setUseEmergencyKey] = useState(false);
    const [emergencyKeyInput, setEmergencyKeyInput] = useState('');
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const timeoutReason = searchParams.get('reason') === 'timeout';

    // Auto-redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/admin', { replace: true });
        }
    }, [user, navigate]);

    // Resend cooldown timer for 2FA
    useEffect(() => {
        if (!pending2FA || resendCooldown <= 0) return;
        const interval = setInterval(() => {
            setResendCooldown(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [pending2FA, resendCooldown]);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password.');
            return;
        }

        setIsLoading(true);

        try {
            const cleanUser = username.toLowerCase().trim();

            // 1. Built-in super admin account
            if (cleanUser === 'admin' && password === 'password123') {
                // Fetch dynamic admin phone numbers from automation_settings
                let adminPhoneNumbers = ['+919016116564'];
                try {
                    const { data: autoSettings } = await supabase
                        .from('automation_settings')
                        .select('admin_phone_numbers')
                        .eq('id', 'global')
                        .maybeSingle();
                    if (autoSettings?.admin_phone_numbers && Array.isArray(autoSettings.admin_phone_numbers) && autoSettings.admin_phone_numbers.length > 0) {
                        adminPhoneNumbers = autoSettings.admin_phone_numbers;
                    }
                } catch (err) {
                    console.warn('Could not load admin phone settings:', err);
                }

                const adminUserObj: any = {
                    id: 'admin',
                    username: 'admin',
                    name: 'System Admin',
                    role: 'admin',
                    accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard', 'view_phones'],
                    avatar: 'SA',
                    phone_numbers: adminPhoneNumbers,
                    phone: adminPhoneNumbers[0]
                };

                const availablePhones = getUserPhoneNumbers(adminUserObj);

                // If no phone number is set yet, ask for the bypass key directly
                if (availablePhones.length === 0) {
                    const challenge = await initiateAdminTwoFactor(adminUserObj, undefined, true);
                    setPending2FA({
                        challengeId: challenge.challengeId,
                        targetPhone: '',
                        maskedPhone: 'No phone registered',
                        availablePhones: [],
                        devCode: undefined,
                        pendingRole: 'admin',
                        pendingStaffUser: undefined
                    });
                    setUseEmergencyKey(true);
                    setEmergencyKeyInput('');
                    return;
                }

                // If admin has multiple registered phone numbers, let them select destination
                if (availablePhones.length > 1) {
                    setPendingPhoneSelect({
                        user: adminUserObj,
                        availablePhones,
                        selectedPhone: availablePhones[0],
                        pendingRole: 'admin',
                        pendingStaffUser: undefined
                    });
                    return;
                }

                // Single phone number: dispatch 2FA immediately
                const challenge = await initiateAdminTwoFactor(adminUserObj, availablePhones[0]);
                setPending2FA({
                    challengeId: challenge.challengeId,
                    targetPhone: challenge.targetPhone,
                    maskedPhone: challenge.maskedPhone,
                    availablePhones,
                    devCode: challenge.devCode,
                    dispatchedVia: challenge.dispatchedVia,
                    pendingRole: 'admin',
                    pendingStaffUser: undefined
                });
                setResendCooldown(30);
                setUseEmergencyKey(false);
                setOtpCode(['', '', '', '', '', '']);
                return;
            }

            // 2. Database staff authentication via Edge Function
            const { data, error } = await supabase.functions.invoke('staff-auth', {
                body: {
                    action: 'login',
                    username: cleanUser,
                    password
                }
            });

            if (!error && data?.user) {
                // If staff account is an Admin, require 2FA
                if (data.user.role === 'admin') {
                    const availablePhones = getUserPhoneNumbers(data.user);

                    // If no phone number is set yet, ask for the bypass key directly
                    if (availablePhones.length === 0) {
                        const challenge = await initiateAdminTwoFactor(data.user, undefined, true);
                        setPending2FA({
                            challengeId: challenge.challengeId,
                            targetPhone: '',
                            maskedPhone: 'No phone registered',
                            availablePhones: [],
                            devCode: undefined,
                            pendingRole: undefined,
                            pendingStaffUser: data.user
                        });
                        setUseEmergencyKey(true);
                        setEmergencyKeyInput('');
                        return;
                    }

                    // If multiple phone numbers registered, let admin choose destination
                    if (availablePhones.length > 1) {
                        setPendingPhoneSelect({
                            user: data.user,
                            availablePhones,
                            selectedPhone: availablePhones[0],
                            pendingRole: undefined,
                            pendingStaffUser: data.user
                        });
                        return;
                    }

                    // Single phone number: dispatch immediately
                    const challenge = await initiateAdminTwoFactor(data.user, availablePhones[0]);
                    setPending2FA({
                        challengeId: challenge.challengeId,
                        targetPhone: challenge.targetPhone,
                        maskedPhone: challenge.maskedPhone,
                        availablePhones,
                        devCode: challenge.devCode,
                        dispatchedVia: challenge.dispatchedVia,
                        pendingRole: undefined,
                        pendingStaffUser: data.user
                    });
                    setResendCooldown(30);
                    setUseEmergencyKey(false);
                    setOtpCode(['', '', '', '', '', '']);
                    return;
                }

                // Standard non-admin staff log in directly
                await login(undefined, data.user);
                navigate('/admin', { replace: true });
                return;
            }

            setError(data?.error || 'Invalid username or password.');

        } catch (err: any) {
            setError(err.message || 'Authentication failed.');
        } finally {
            setIsLoading(false);
        }
    };

    // User chooses destination phone from multiple registered numbers and triggers OTP
    const handleConfirmPhoneSelect = async () => {
        if (!pendingPhoneSelect) return;
        setIsLoading(true);
        setError('');
        try {
            const challenge = await initiateAdminTwoFactor(pendingPhoneSelect.user, pendingPhoneSelect.selectedPhone);
            setPending2FA({
                challengeId: challenge.challengeId,
                targetPhone: challenge.targetPhone,
                maskedPhone: challenge.maskedPhone,
                availablePhones: pendingPhoneSelect.availablePhones,
                devCode: challenge.devCode,
                dispatchedVia: challenge.dispatchedVia,
                pendingRole: pendingPhoneSelect.pendingRole,
                pendingStaffUser: pendingPhoneSelect.pendingStaffUser
            });
            setPendingPhoneSelect(null);
            setResendCooldown(30);
            setOtpCode(['', '', '', '', '', '']);
        } catch (err: any) {
            setError(err.message || 'Failed to dispatch verification code');
        } finally {
            setIsLoading(false);
        }
    };

    // Switch to another registered number directly from the OTP screen
    const handleSwitchPhone = async (newPhone: string) => {
        if (!pending2FA || isLoading) return;
        setIsLoading(true);
        setError('');
        try {
            const adminUserObj = pending2FA.pendingStaffUser || {
                id: 'admin',
                username: 'admin',
                name: 'System Admin',
                role: 'admin',
                accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard', 'view_phones'],
                avatar: 'SA',
                phone_numbers: pending2FA.availablePhones,
                phone: newPhone
            };
            const res = await resendAdminTwoFactorCode(adminUserObj, newPhone);
            if (res.success) {
                setResendCooldown(30);
                setPending2FA(prev => prev ? {
                    ...prev,
                    targetPhone: newPhone,
                    maskedPhone: res.maskedPhone || prev.maskedPhone,
                    devCode: res.devCode
                } : null);
                setOtpCode(['', '', '', '', '', '']);
            } else {
                setError(res.error || 'Failed to switch verification number');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // OTP Box Navigation
    const handleOtpChange = (index: number, val: string) => {
        const clean = val.replace(/\D/g, '');
        const updated = [...otpCode];

        if (clean.length > 1) {
            // User pasted multi-digit text
            const chars = clean.slice(0, 6).split('');
            for (let i = 0; i < 6; i++) {
                updated[i] = chars[i] || '';
            }
            setOtpCode(updated);
            const nextIdx = Math.min(clean.length, 5);
            otpInputRefs.current[nextIdx]?.focus();
            return;
        }

        updated[index] = clean.slice(-1);
        setOtpCode(updated);

        if (clean && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const updated = ['', '', '', '', '', ''];
        for (let i = 0; i < pasted.length; i++) {
            updated[i] = pasted[i];
        }
        setOtpCode(updated);
        const focusIdx = Math.min(pasted.length, 5);
        otpInputRefs.current[focusIdx]?.focus();
    };

    const handleVerifyTwoFactor = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!pending2FA) return;

        const isBypass = pending2FA.availablePhones.length === 0 || useEmergencyKey;
        const codeToVerify = isBypass ? emergencyKeyInput.trim() : otpCode.join('');
        if (!isBypass && codeToVerify.length < 6) {
            setError('Please enter the complete 6-digit verification code.');
            return;
        }
        if (isBypass && !codeToVerify) {
            setError('Please enter your emergency admin security key.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await verifyAdminTwoFactor(pending2FA.challengeId, codeToVerify);
            if (!result.success) {
                setError(result.error || 'Verification failed.');
                return;
            }

            // 2FA Succeeded: Complete persistent login
            await login(pending2FA.pendingRole, pending2FA.pendingStaffUser);
            navigate('/admin', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Two-factor verification failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!pending2FA || resendCooldown > 0) return;
        setIsLoading(true);
        setError('');
        try {
            const adminUserObj = pending2FA.pendingStaffUser || {
                id: 'admin',
                username: 'admin',
                name: 'System Admin',
                role: 'admin',
                accesses: ['crm', 'clients', 'hr', 'finance', 'dashboard', 'view_phones'],
                avatar: 'SA',
                phone_numbers: pending2FA.availablePhones,
                phone: pending2FA.targetPhone
            };
            const res = await resendAdminTwoFactorCode(adminUserObj, pending2FA.targetPhone);
            if (res.success) {
                setResendCooldown(30);
                if (res.devCode) {
                    setPending2FA(prev => prev ? { ...prev, devCode: res.devCode } : null);
                }
            } else {
                setError(res.error || 'Failed to resend code');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel2FA = () => {
        cancelTwoFactorChallenge();
        setPendingPhoneSelect(null);
        setPending2FA(null);
        setError('');
        setOtpCode(['', '', '', '', '', '']);
        setUseEmergencyKey(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-primary/20">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                * { font-family: 'Plus Jakarta Sans', sans-serif; }
                .login-card { animation: cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }
            `}</style>

            <div className="w-full max-w-sm sm:max-w-md login-card">
                {/* Logo & Header */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-white shadow-xl shadow-slate-200/50 rounded-3xl flex items-center justify-center mx-auto mb-5 p-3 ring-1 ring-slate-100">
                        <img 
                            src="/99care-logo.png"
                            alt="99 Care Logo" 
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-1 tracking-tight">99 Care OS</h1>
                    <p className="text-slate-500 font-medium text-sm">Healthcare Operations & Clinical ERP</p>
                </div>

                {/* Session Timeout Banner if redirected */}
                {timeoutReason && !pending2FA && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800 shadow-xs">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Session Expired</p>
                            <p className="text-xs text-amber-700/90 mt-0.5 leading-relaxed">
                                You were automatically logged out due to 30 minutes of inactivity for patient data protection.
                            </p>
                        </div>
                    </div>
                )}

                {/* Login or 2FA Box */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">

                    {!pendingPhoneSelect && !pending2FA ? (
                        /* STEP 1: Username & Password Form */
                        <form onSubmit={handleInitialSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs sm:text-sm border border-red-100 font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Username</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your OS username"
                                        autoComplete="username"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0f172a] font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your account password"
                                        autoComplete="current-password"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0f172a] font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-3 text-sm"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </form>
                    ) : pendingPhoneSelect ? (
                        /* STEP 2A: Select Phone Destination for 2FA OTP */
                        <div className="space-y-5 animate-in fade-in duration-200">
                            <div className="text-center pb-2">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-1">
                                    Admin 2FA Security
                                </span>
                                <h2 className="text-lg font-extrabold text-slate-900">
                                    Select WhatsApp Destination
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    You have multiple phone numbers registered. Choose which WhatsApp number to receive your 6-digit login verification code.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs border border-red-100 font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                {pendingPhoneSelect.availablePhones.map((phone, idx) => {
                                    const isSelected = pendingPhoneSelect.selectedPhone === phone;
                                    return (
                                        <div
                                            key={phone}
                                            onClick={() => setPendingPhoneSelect(prev => prev ? { ...prev, selectedPhone: phone } : null)}
                                            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                                isSelected
                                                    ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                                                    isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                                                }`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-mono font-bold text-slate-900">
                                                        {maskPhoneFor2FA(phone)}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {idx === 0 ? 'Primary Mobile Device' : `Backup Mobile #${idx + 1}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                <Smartphone className="w-2.5 h-2.5" /> SMS & WhatsApp
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={handleConfirmPhoneSelect}
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    "Send 6-Digit SMS Code"
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleCancel2FA}
                                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Username & Password
                            </button>
                        </div>
                    ) : pending2FA ? (
                        /* STEP 2B: Admin Two-Factor Verification */
                        <form onSubmit={handleVerifyTwoFactor} className="space-y-5 animate-in fade-in duration-200">
                            {pending2FA.availablePhones.length === 0 ? (
                                <div className="text-center pb-2">
                                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-200 shadow-sm">
                                        <KeyRound className="w-6 h-6" />
                                    </div>
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 mb-1 border border-amber-200/80">
                                        Security Setup Required
                                    </span>
                                    <h2 className="text-lg font-extrabold text-slate-900">
                                        Emergency Admin Key Required
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        No 2FA mobile phone number has been configured for this account yet. Please enter your master Emergency Admin Security Key to proceed.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center pb-2">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-200 shadow-sm">
                                        <Smartphone className="w-6 h-6" />
                                    </div>
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 mb-1 border border-indigo-200/80">
                                        Direct Phone SMS 2FA
                                    </span>
                                    <h2 className="text-lg font-extrabold text-slate-900">
                                        SMS Verification Code Sent
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Enter the 6-digit passcode sent directly to your phone's SMS Messages app (<span className="font-mono font-semibold text-slate-700">{pending2FA.maskedPhone}</span>).
                                    </p>
                                </div>
                            )}

                            {/* First-time setup hint when no phone is configured */}
                            {pending2FA.availablePhones.length === 0 && (
                                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-left space-y-1">
                                    <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        WhatsApp 2FA Phone Not Yet Registered
                                    </p>
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        After authenticating with your emergency key, you can register your WhatsApp number(s) in <span className="font-semibold text-amber-950">Settings → Access Control</span>.
                                    </p>
                                </div>
                            )}

                            {/* Dev Testing Helper (shows generated OTP during local testing/demo if phone registered) */}
                            {pending2FA.devCode && (
                                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
                                    <span className="text-[11px] text-blue-700 font-semibold">
                                        Test Passcode: <span className="font-mono font-black text-blue-900 text-sm tracking-widest">{pending2FA.devCode}</span>
                                    </span>
                                </div>
                            )}

                            {/* Multi-phone switcher if user has more than 1 registered number */}
                            {pending2FA.availablePhones && pending2FA.availablePhones.length > 1 && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                            Active Destination: <span className="font-mono font-bold text-slate-900">{pending2FA.maskedPhone}</span>
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200/60">
                                        <span>Send code to another number:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {pending2FA.availablePhones.filter(p => p !== pending2FA.targetPhone).map(altPhone => (
                                                <button
                                                    key={altPhone}
                                                    type="button"
                                                    onClick={() => handleSwitchPhone(altPhone)}
                                                    disabled={isLoading}
                                                    className="text-primary hover:text-primary/80 font-bold underline cursor-pointer disabled:opacity-50"
                                                >
                                                    {maskPhoneFor2FA(altPhone)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs border border-red-100 font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {pending2FA.availablePhones.length === 0 || useEmergencyKey ? (
                                /* Emergency Security Key Input */
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                            Emergency Admin Bypass Key
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal">master key</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={emergencyKeyInput}
                                        onChange={(e) => setEmergencyKeyInput(e.target.value)}
                                        placeholder="Enter master bypass key"
                                        autoFocus
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-[#0f172a] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    />
                                </div>
                            ) : (
                                /* 6-Box OTP Input */
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                                        {otpCode.map((digit, idx) => (
                                            <input
                                                key={idx}
                                                ref={el => { otpInputRefs.current[idx] = el; }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-black font-mono rounded-xl border transition-all focus:outline-none ${
                                                    digit
                                                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20'
                                                        : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-400 text-center pt-1">
                                        Paste or type 6 digits. Expires in 10 minutes.
                                    </p>

                                    {/* Direct Phone SMS / Emergency Key Helper */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-left space-y-1 mt-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                                                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                                                Didn't receive phone SMS?
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setUseEmergencyKey(true)}
                                                className="text-primary hover:text-primary/80 font-bold underline text-[11px]"
                                            >
                                                Use Emergency Key
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-snug">
                                            Carrier SMS delivery takes a few seconds depending on network signal. You can also sign in instantly using your master Emergency Admin Key.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed text-sm ${
                                    pending2FA.availablePhones.length === 0
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                }`}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : pending2FA.availablePhones.length === 0 ? (
                                    "Verify Key & Sign In"
                                ) : (
                                    "Verify & Access Admin OS"
                                )}
                            </button>

                            {/* Resend and Recovery Key options (only shown when account has registered phones) */}
                            {pending2FA.availablePhones.length > 0 && (
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                    <button
                                        type="button"
                                        disabled={resendCooldown > 0 || isLoading}
                                        onClick={handleResendCode}
                                        className="text-slate-500 hover:text-slate-800 disabled:opacity-50 font-medium flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend Code'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setUseEmergencyKey(prev => !prev)}
                                        className="text-slate-500 hover:text-primary font-semibold transition-colors"
                                    >
                                        {useEmergencyKey ? 'Use 6-Digit OTP' : 'Use Emergency Key'}
                                    </button>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleCancel2FA}
                                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Username & Password
                            </button>
                        </form>
                    ) : null}

                </div>

                <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>DPDP Act 2023 & Healthcare Security Enabled</span>
                </div>
            </div>
        </div>
    );
}
