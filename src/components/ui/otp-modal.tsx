import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OtpModalProps {
    isOpen: boolean;
    onClose: () => void;
    phoneNumber: string;
    onVerified: () => void;
}

export function OtpModal({ isOpen, onClose, phoneNumber, onVerified }: OtpModalProps) {
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

    // Simulate sending an OTP when the modal opens
    useEffect(() => {
        if (isOpen && phoneNumber) {
            // Generate a mock 4-digit OTP
            const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
            setGeneratedOtp(mockOtp);
            setOtp(''); // Reset input

            console.log(`[WhatsApp API Simulation] Sending OTP ${mockOtp} to ${phoneNumber}`);

            // Simulate network delay for sending message
            setTimeout(() => {
                toast.success(`Mock WhatsApp Message Sent!`, {
                    description: `(SIMULATION) We would send an OTP to ${phoneNumber} here. Please use the code: ${mockOtp}`,
                    icon: <MessageSquare className="w-5 h-5 text-emerald-500" />,
                    duration: 8000,
                });
            }, 1000);
        }
    }, [isOpen, phoneNumber]);

    const handleVerify = () => {
        if (otp.length !== 4) {
            toast.error('Please enter a valid 4-digit OTP.');
            return;
        }

        setIsVerifying(true);

        // Simulate verification delay
        setTimeout(() => {
            setIsVerifying(false);
            if (otp === generatedOtp) {
                toast.success('WhatsApp Number Verified!', {
                    icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />
                });
                onVerified();
                onClose();
            } else {
                toast.error('Invalid OTP. Please try again.');
                setOtp('');
            }
        }, 1200);
    };

    const handleResend = () => {
        const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(mockOtp);
        toast.success(`New Mock WhatsApp OTP Sent!`, {
            description: `(SIMULATION) Please use the code: ${mockOtp}`,
            icon: <MessageSquare className="w-5 h-5 text-emerald-500" />,
            duration: 8000,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
                <DialogHeader className="text-center sm:text-center">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <MessageSquare className="w-8 h-8 text-emerald-600" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-[#002a5c]">
                        Verify WhatsApp
                    </DialogTitle>
                    <DialogDescription className="text-[#002a5c]/70 mt-2">
                        We've sent a 4-digit secure code to your WhatsApp number:<br />
                        <strong className="text-[#285fe2]">{phoneNumber}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    <div className="flex justify-center">
                        <Input
                            type="text"
                            maxLength={4}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            className="text-center text-3xl tracking-[1em] font-bold h-16 w-48 border-2 border-[#285fe2]/20 focus:border-[#285fe2] focus:ring-[#285fe2] rounded-xl bg-slate-50"
                            autoFocus
                        />
                    </div>

                    <Button
                        onClick={handleVerify}
                        disabled={otp.length !== 4 || isVerifying}
                        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] hover:opacity-90 disabled:opacity-50 transition-all rounded-xl shadow-lg hover:shadow-xl"
                    >
                        {isVerifying ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Verifying...
                            </span>
                        ) : (
                            'Verify & Continue'
                        )}
                    </Button>

                    <p className="text-center text-sm text-[#002a5c]/60">
                        Didn't receive the code?{' '}
                        <button
                            onClick={handleResend}
                            className="text-[#285fe2] font-semibold hover:underline"
                        >
                            Resend WhatsApp OTP
                        </button>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
