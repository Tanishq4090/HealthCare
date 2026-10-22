import React, { useState, useMemo, useRef } from 'react';
import { X, Send, MessageCircle, Copy, Check, Users, Sparkles, AlertCircle, CheckCircle2, Loader2, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface BulkMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: any[];
}

const PRESET_TEMPLATES = [
    {
        id: 'service_checkin',
        label: '🌟 Service Quality Check-in',
        text: `Namaste {name} ji! 🙏\n\nThis is a friendly check-in from 99 Care regarding your ongoing home care service. We hope our caregiver is assisting your family with the utmost care, warmth, and dedication.\n\nPlease feel free to reply here if there is anything we can improve or if you require any additional support. We are always here for your family!\n\nWarm regards,\n99 Care Team`,
    },
    {
        id: 'billing_reminder',
        label: '💳 Account & Deposit Advisory',
        text: `Namaste {name} ji! 🙏\n\nThis is an update from 99 Care regarding your client account (ID: {clientCode}). If you have any inquiries regarding your billing cycle, security deposit receipt, or caregiver schedule, our support team is at your service.\n\nThank you for trusting 99 Care with your loved ones.`,
    },
    {
        id: 'festive_greetings',
        label: '🎉 Festive & Health Greetings',
        text: `Namaste {name} ji! 🙏\n\nWarmest greetings to you and your loved ones from all of us at 99 Care! Wishing you and your family abundant health, peace, and happiness.\n\nWarm regards,\n99 Care Team`,
    },
    {
        id: 'custom',
        label: '✍️ Custom Message',
        text: `Namaste {name} ji! 🙏\n\n`,
    },
];

export const BulkMessageModal: React.FC<BulkMessageModalProps> = ({ isOpen, onClose, clients: initialClients }) => {
    const [recipients, setRecipients] = useState<any[]>(initialClients || []);
    const [messageTemplate, setMessageTemplate] = useState<string>(PRESET_TEMPLATES[0].text);
    const [activeTemplateId, setActiveTemplateId] = useState<string>(PRESET_TEMPLATES[0].id);
    const [showRecipientsList, setShowRecipientsList] = useState(false);
    
    // Dispatch progress state
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; success: number; failed: number }>({
        current: 0,
        total: 0,
        success: 0,
        failed: 0,
    });
    const [dispatchResults, setDispatchResults] = useState<Record<string, { status: 'success' | 'failed' | 'pending'; error?: string }>>({});
    const cancelRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync recipients when modal opens or initialClients change
    React.useEffect(() => {
        if (isOpen) {
            setRecipients(initialClients || []);
            setDispatchResults({});
            cancelRef.current = false;
        }
    }, [isOpen, initialClients]);

    if (!isOpen) return null;

    const validRecipients = recipients.filter(c => c.phone && c.phone.replace(/\D/g, '').length >= 10);
    const missingPhoneCount = recipients.length - validRecipients.length;

    const handleRemoveRecipient = (id: string) => {
        setRecipients(prev => prev.filter(c => c.id !== id));
    };

    const handleInsertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setMessageTemplate(prev => prev + variable);
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const nextVal = currentVal.substring(0, start) + variable + currentVal.substring(end);
        setMessageTemplate(nextVal);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
    };

    const formatMessageForClient = (rawText: string, client: any) => {
        const fullName = (client.name || 'Valued Client').trim();
        const firstName = fullName.split(' ')[0] || fullName;
        const clientCode = client.displayId || 'CL-CLIENT';
        const city = client.city || 'Surat';

        return rawText
            .replace(/{name}/g, firstName)
            .replace(/{fullName}/g, fullName)
            .replace(/{clientCode}/g, clientCode)
            .replace(/{city}/g, city);
    };

    const previewRecipient = validRecipients[0] || recipients[0] || {
        name: 'Rahul Sharma',
        displayId: 'CL-0037',
        city: 'Surat',
        phone: '9876543210'
    };

    const previewMessage = formatMessageForClient(messageTemplate, previewRecipient);

    const cleanPhoneDigits = (rawPhone: string) => {
        let digits = (rawPhone || '').replace(/\D/g, '');
        if (digits.length === 10) digits = `91${digits}`;
        return digits;
    };

    // Automated broadcast dispatch loop via Meta Edge Function
    const handleStartBroadcast = async () => {
        if (validRecipients.length === 0) {
            toast.error('No recipients with valid 10-digit phone numbers found.');
            return;
        }
        if (!messageTemplate.trim()) {
            toast.error('Please enter a message before dispatching.');
            return;
        }

        setIsSending(true);
        cancelRef.current = false;
        const total = validRecipients.length;
        setProgress({ current: 0, total, success: 0, failed: 0 });

        const results: Record<string, { status: 'success' | 'failed' | 'pending'; error?: string }> = {};
        validRecipients.forEach(r => {
            results[r.id] = { status: 'pending' };
        });
        setDispatchResults({ ...results });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < validRecipients.length; i++) {
            if (cancelRef.current) {
                toast.info('Bulk message dispatch cancelled by user.');
                break;
            }

            const client = validRecipients[i];
            const cleanPhone = cleanPhoneDigits(client.phone);
            const personalizedMsg = formatMessageForClient(messageTemplate, client);

            setProgress({
                current: i + 1,
                total,
                success: successCount,
                failed: failCount,
            });

            try {
                const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                    body: {
                        phone: cleanPhone,
                        leadId: client.id,
                        leadFullName: client.name,
                        leadName: (client.name || '').split(' ')[0],
                        useTemplate: false,
                        message: personalizedMsg,
                    }
                });

                if (error || data?.success === false) {
                    failCount++;
                    results[client.id] = {
                        status: 'failed',
                        error: error?.message || data?.error || 'Meta dispatch error',
                    };
                } else {
                    successCount++;
                    results[client.id] = { status: 'success' };
                }
            } catch (err: any) {
                failCount++;
                results[client.id] = { status: 'failed', error: err?.message || 'Network error' };
            }

            setDispatchResults({ ...results });
            setProgress({
                current: i + 1,
                total,
                success: successCount,
                failed: failCount,
            });

            // Polite delay to prevent rate limits
            if (i < validRecipients.length - 1) {
                await new Promise(res => setTimeout(res, 350));
            }
        }

        setIsSending(false);
        if (successCount > 0 && failCount === 0) {
            toast.success(`🎉 All ${successCount} WhatsApp messages dispatched successfully!`);
        } else if (successCount > 0 && failCount > 0) {
            toast.warning(`Dispatched ${successCount} successfully. ${failCount} failed (you can use 1-click WhatsApp fallback below).`);
        } else if (!cancelRef.current) {
            toast.error(`Dispatch failed for ${failCount} recipients. Please check Meta API connection or use WhatsApp fallback.`);
        }
    };

    const handleCopyAllToClipboard = () => {
        if (validRecipients.length === 0) {
            toast.error('No valid recipients to copy.');
            return;
        }

        const compiled = validRecipients.map((c, idx) => {
            const cleanPhone = cleanPhoneDigits(c.phone);
            const msg = formatMessageForClient(messageTemplate, c);
            return `--- [${idx + 1}] ${c.name} (${c.displayId || 'CL-CLIENT'}) | +${cleanPhone} ---\n${msg}\n`;
        }).join('\n');

        navigator.clipboard.writeText(compiled);
        toast.success(`Copied ${validRecipients.length} personalized messages to clipboard!`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 via-white to-sky-50/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0 border border-teal-200/60 shadow-2xs">
                            <MessageCircle className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">Bulk Client Messaging</h2>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                    {recipients.length} Recipient{recipients.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Broadcast personalized WhatsApp messages to selected clients with dynamic tags and live preview.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    
                    {/* Recipients Summary Bar with Toggle Dropdown */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-teal-600" />
                                <span className="text-xs font-bold text-slate-800">
                                    {validRecipients.length} Ready to message
                                </span>
                                {missingPhoneCount > 0 && (
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 text-amber-600" />
                                        {missingPhoneCount} missing phone
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRecipientsList(!showRecipientsList)}
                                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                            >
                                <span>{showRecipientsList ? 'Hide Recipient List' : 'Review Recipient List'}</span>
                                {showRecipientsList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        {/* Collapsible Recipient Chips */}
                        {showRecipientsList && (
                            <div className="mt-3 pt-3 border-t border-slate-200/80 max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                {recipients.map((c) => {
                                    const hasValidPhone = c.phone && c.phone.replace(/\D/g, '').length >= 10;
                                    const res = dispatchResults[c.id];
                                    return (
                                        <div
                                            key={c.id}
                                            className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs border ${
                                                res?.status === 'success'
                                                    ? 'bg-emerald-50/70 border-emerald-200'
                                                    : res?.status === 'failed'
                                                    ? 'bg-red-50/70 border-red-200'
                                                    : 'bg-white border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 shrink-0">
                                                    {c.displayId || 'CL-0001'}
                                                </span>
                                                <span className="font-bold text-slate-800 truncate">{c.name}</span>
                                                <span className="text-slate-400 font-mono text-[11px] shrink-0">
                                                    {c.phone || 'No Phone'}
                                                </span>
                                                {c.city && (
                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide px-1.5 py-0.2 bg-slate-100 rounded shrink-0">
                                                        {c.city}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {res?.status === 'success' && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Sent
                                                    </span>
                                                )}
                                                {res?.status === 'failed' && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-red-600 font-semibold" title={res.error}>
                                                            Failed
                                                        </span>
                                                        {hasValidPhone && (
                                                            <a
                                                                href={`https://wa.me/${cleanPhoneDigits(c.phone)}?text=${encodeURIComponent(formatMessageForClient(messageTemplate, c))}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded inline-flex items-center gap-1"
                                                                title="Open individual WhatsApp chat fallback"
                                                            >
                                                                <ExternalLink className="w-2.5 h-2.5" /> Web Chat
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                                {!isSending && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRecipient(c.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                                                        title="Remove from this broadcast"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Template Pills */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                            Choose Message Template
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {PRESET_TEMPLATES.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveTemplateId(tmpl.id);
                                        setMessageTemplate(tmpl.text);
                                    }}
                                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                                        activeTemplateId === tmpl.id
                                            ? 'border-teal-500 bg-teal-50/50 text-teal-900 ring-2 ring-teal-500/20 font-bold'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {tmpl.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Workspace: Message Editor (Left) & Live Preview Mockup (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* Message Editor */}
                        <div className="lg:col-span-7 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Message Text
                                </label>
                                <div className="text-[11px] text-slate-400">
                                    {messageTemplate.length} characters
                                </div>
                            </div>

                            {/* Dynamic Tag Injectors */}
                            <div className="flex items-center gap-1.5 flex-wrap pb-1">
                                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" /> Insert tags:
                                </span>
                                {[
                                    { label: '{name}', desc: 'First Name' },
                                    { label: '{fullName}', desc: 'Full Name' },
                                    { label: '{clientCode}', desc: 'CL-0037' },
                                    { label: '{city}', desc: 'City' },
                                ].map((t) => (
                                    <button
                                        key={t.label}
                                        type="button"
                                        onClick={() => handleInsertVariable(t.label)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/90 hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                                        title={`Insert ${t.desc} tag at cursor`}
                                    >
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <textarea
                                ref={textareaRef}
                                value={messageTemplate}
                                onChange={(e) => {
                                    setMessageTemplate(e.target.value);
                                    setActiveTemplateId('custom');
                                }}
                                rows={8}
                                placeholder="Type your message here... Use {name}, {fullName}, {clientCode}, {city} for automatic recipient substitution."
                                className="w-full text-xs font-sans p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1AA6A8] focus:border-transparent leading-relaxed text-slate-800"
                            />

                            <p className="text-[11px] text-slate-400">
                                💡 Tip: You can use WhatsApp markdown syntax such as *bold text*, _italics_, or emoji.
                            </p>
                        </div>

                        {/* Live Preview (WhatsApp bubble styling) */}
                        <div className="lg:col-span-5 flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Live Client Preview
                                </label>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    Sample: {previewRecipient.name}
                                </span>
                            </div>

                            <div className="flex-1 bg-[#ECE5DD] p-3.5 rounded-2xl border border-slate-200/80 shadow-inner flex flex-col justify-between min-h-[220px]">
                                {/* Chat Header Simulation */}
                                <div className="bg-[#075E54] text-white p-2 rounded-xl flex items-center gap-2 mb-3 shadow-2xs">
                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
                                        99
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-xs truncate">99 Care Support</div>
                                        <div className="text-[9px] text-teal-200">Official Healthcare Account</div>
                                    </div>
                                </div>

                                {/* Chat Message Bubble */}
                                <div className="flex justify-end mb-auto">
                                    <div className="bg-[#DCF8C6] text-slate-900 rounded-2xl rounded-tr-xs p-3 max-w-[90%] shadow-xs text-xs whitespace-pre-wrap leading-relaxed border border-emerald-200/50">
                                        {previewMessage || <span className="italic text-slate-400">Your message preview will appear here...</span>}
                                        <div className="text-[9px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1 font-mono">
                                            <span>Just now</span>
                                            <span className="text-sky-600 font-bold">✓✓</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[10px] text-center text-slate-500 pt-2 border-t border-slate-300/40 mt-2">
                                    Personalized with {previewRecipient.name} ({previewRecipient.displayId || 'CL-0001'})
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar during Dispatch */}
                    {isSending && (
                        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-2 animate-in fade-in">
                            <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                                    Sending to WhatsApp: {progress.current} of {progress.total}...
                                </span>
                                <span>{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-teal-200/60 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-teal-700">
                                <span>✅ {progress.success} delivered</span>
                                {progress.failed > 0 && <span className="text-red-600 font-bold">⚠️ {progress.failed} failed</span>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2.5">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyAllToClipboard}
                            disabled={isSending || validRecipients.length === 0}
                            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                            title="Copy all personalized messages to clipboard"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy All Messages</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {isSending ? (
                            <button
                                type="button"
                                onClick={() => {
                                    cancelRef.current = true;
                                }}
                                className="px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all cursor-pointer"
                            >
                                Stop Dispatch
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStartBroadcast}
                                    disabled={validRecipients.length === 0 || !messageTemplate.trim()}
                                    className="px-5 py-2 text-xs font-bold text-white bg-[#1AA6A8] hover:bg-[#15898A] rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Send Broadcast ({validRecipients.length})</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkMessageModal;
