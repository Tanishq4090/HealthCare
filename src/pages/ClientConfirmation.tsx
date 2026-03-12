import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, User, Phone, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientConfirmation() {
    const { id } = useParams<{ id: string }>();
    const [worker, setWorker] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchWorker = async () => {
            try {
                const { data, error } = await supabase
                    .from('workers')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (!data) throw new Error("Worker profile not found.");

                setWorker(data);
                setIsConfirmed(data.status === 'Active');
            } catch (err: any) {
                console.error("Error fetching worker:", err);
                setError(err.message || 'Failed to load staff profile.');
            } finally {
                setLoading(false);
            }
        };

        fetchWorker();
    }, [id]);

    const handleConfirm = async () => {
        if (!worker) return;
        setConfirming(true);

        try {
            const { error } = await supabase
                .from('workers')
                .update({ status: 'Active' })
                .eq('id', worker.id);

            if (error) throw error;

            setIsConfirmed(true);
            setWorker({ ...worker, status: 'Active' });
            toast.success("Staff assignment confirmed successfully!");
        } catch (err: any) {
            console.error("Error confirming worker:", err);
            toast.error("Failed to confirm staff: " + err.message);
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">Loading staff profile...</p>
                </div>
            </div>
        );
    }

    if (error || !worker) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Profile Not Found</h1>
                    <p className="text-slate-600">We couldn't locate this staff member's profile. The link may have expired or is incorrect.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
            <div className="max-w-xl w-full">
                {/* Header branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg shadow-primary/20">
                        <CheckSquare className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Confirm Your Staff Allocation</h1>
                    <p className="text-slate-600 text-lg">Please review the profile of your assigned healthcare professional from 99 Care.</p>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                    {/* Top banner design */}
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                    </div>

                    <div className="px-8 pb-8">
                        {/* Avatar */}
                        <div className="relative -mt-16 flex justify-center mb-6">
                            <div className="w-32 h-32 bg-white rounded-full p-2 shadow-lg relative">
                                <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-slate-50">
                                    <User className="w-12 h-12 text-slate-400" />
                                </div>
                                {isConfirmed && (
                                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-white">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">{worker.name}</h2>
                            <p className="text-primary font-medium text-lg mt-1">{worker.role}</p>
                            <span className="inline-block mt-3 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full border border-blue-100">
                                Assigned to: {worker.assigned_client || 'Your Facility'}
                            </span>
                        </div>

                        {/* Details grid */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Status</p>
                                <p className={`font-medium ${isConfirmed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {isConfirmed ? 'Confirmed & Active' : 'Awaiting Your Approval'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Contact</p>
                                <p className="font-medium text-slate-900 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    {worker.phone || 'Will be shared upon confirmation'}
                                </p>
                            </div>
                        </div>

                        {/* Action Area */}
                        <div className="border-t border-slate-100 pt-8 text-center mt-2">
                            {isConfirmed ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-emerald-800 font-bold text-lg mb-1">Staff Member Confirmed!</h3>
                                    <p className="text-emerald-600 text-sm">Thank you. {worker.name} is now officially assigned and active. They will receive their joining links shortly.</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-slate-500 text-sm mb-4">By clicking confirm, you agree to officially onboard this staff member to your facility or care plan.</p>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={confirming}
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl shadow-primary/20 flex items-center justify-center gap-2 text-lg"
                                    >
                                        {confirming ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                                            </>
                                        ) : (
                                            <>
                                                <CheckSquare className="w-5 h-5" /> Confirm & Accept Staff
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer link */}
                <div className="text-center mt-8">
                    <p className="text-sm text-slate-500">
                        Secure Staff Allocation Platform by <span className="font-semibold text-slate-700">99 Care</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
