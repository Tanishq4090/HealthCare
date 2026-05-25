// v1.0.1 - Tick Confirmation Update
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Mail, MessageSquare, Phone, CheckCircle2, FileText, Send, Users, Loader2, Mic, Plus, PhoneOff, Globe, Edit3, X, Check, MessageCircle, Trash2, ArrowLeft, ArrowRight, Calendar, AlertCircle, AlertTriangle, Play, Pause, Volume2, ChevronDown, RotateCcw, Clock, TrendingUp, Activity, Star, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useConversation } from '@elevenlabs/react';
import { MOCK_WORKERS } from '../data/mockWorkers';
import { assignWorkerToClient, releaseWorkerByClientId } from '../services/assignmentService';
import { SendQuotationModal } from './components/SendQuotationModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizePhoneDigits, phoneLast10, phonesMatch } from '../utils/phone';
import { buildVoiceCallIntakePrefill, buildLeadIntakePrefill } from '../utils/voiceCallIntake';
import {
    findClientMasterByPhone,
    isLegacyPipelineStage,
    isPipelineVisibleLead,
    NEW_LEAD_PIPELINE_STAGE,
    sanitizePipelineStages,
} from '../utils/crm';

const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || '';


// --- CUSTOM AUDIO PLAYER COMPONENT ---
const VoicePlayer = ({ src }: { src: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setProgress(currentProgress || 0);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const seekTo = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
            audioRef.current.currentTime = seekTo;
            setProgress(parseFloat(e.target.value));
        }
    };

    return (
        <div className="flex items-center gap-3 bg-slate-50/50 border border-slate-200/60 p-2 rounded-xl w-full group transition-all hover:bg-white hover:shadow-sm">
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate} 
                onEnded={handleEnded}
                preload="none"
            />
            <button 
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-all transform active:scale-95 shrink-0"
            >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>
            <div className="flex-1 space-y-1.5 flex flex-col justify-center pr-2">
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress} 
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <span className="flex items-center gap-1"><Volume2 className="w-3 h-3 text-slate-300" /> Audio Track</span>
                    <span className="text-emerald-500">{isPlaying ? 'Playing' : 'Ready'}</span>
                </div>
            </div>
        </div>
    );
};

export default function CRM() {
    const [activeTab, setActiveTab] = useState<'pipeline' | 'clients' | 'automations' | 'voice' | 'trash'>(() => {
        return (localStorage.getItem('crmActiveTab') as any) || 'pipeline';
    });

    useEffect(() => {
        localStorage.setItem('crmActiveTab', activeTab);
    }, [activeTab]);
    const [leads, setLeads] = useState<any[]>([]);
    const [trashedLeads, setTrashedLeads] = useState<any[]>([]);
    const [isLoadingTrash, setIsLoadingTrash] = useState(false);
    // Delete choice modal state
    const [deleteChoiceModal, setDeleteChoiceModal] = useState<{ id: string; name: string } | null>(null);
    // Reviews state
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    // Returning client modal state
    const [returningClientModal, setReturningClientModal] = useState<{ phone: string; name: string; existingClient: any; pendingLeadData: any } | null>(null);

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    const [isSimulatingInquiry, setIsSimulatingInquiry] = useState(false);

    const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);

    const fetchDeliveryLogs = async () => {
        try {
            const { data } = await supabase
                .from('whatsapp_logs')
                .select('id, status, error_message, payload, created_at')
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setDeliveryLogs(data);
        } catch (err) { }
    };


    useEffect(() => {
        const fetchAutomationSettings = async () => {
            const { data, error } = await supabase
                .from('automation_settings')
                .select('*')
                .eq('id', 'global')
                .maybeSingle();
            
            console.log("[fetchAutomationSettings] data:", data, "error:", error);
            if (data && !error) {
                setWorkflows({
                    greeting: data.greeting_enabled,
                    drip: data.drip_enabled
                });
                
                // Cloud Sync: If database has columns for stages/templates, use them
                if (data.client_stages) {
                    setClientStages(data.client_stages);
                }
                if (data.pipeline_stages) {
                    // Defensively strip out any client stages that may have leaked in
                    const knownClientStages = new Set(data.client_stages ?? ['Active Client', 'Monthly Billing', 'Closed Won']);
                    const cleanPipeline = sanitizePipelineStages(
                        data.pipeline_stages.filter((s: string) => !knownClientStages.has(s))
                    );
                    setPipelineStages(cleanPipeline);
                }
                if (data.whatsapp_templates) {
                    let updatedTemplates = { ...data.whatsapp_templates };
                    let needsMigration = false;
                    
                    // Check if 'inquiry' template is still using old hardcoded text
                    const oldEnglish = "Hi {{name}}, welcome to 99 Care! We've received your inquiry.";
                    if (updatedTemplates.inquiry?.English?.includes(oldEnglish)) {
                        updatedTemplates.inquiry = {
                            Hinglish: "Hi {{name}}! 🌟 99 Care me aapka swagat hai. Kripya niche diye gaye button par click karke apni zaroorat batayein taaki hum aapke liye best staff find kar sakein.",
                            Hindi: "Namaste {{name}} ji, 99 Care mein aapka swagat hai! Kripya niche diye gaye button par click karein aur apni requirements form me bharein.",
                            English: "Hi {{name}}, welcome to 99 Care! Please tap the button below to fill out our intake form so we can understand your requirements and assign the best healthcare staff for you."
                        };
                        needsMigration = true;
                    }
                    
                    setWhatsappTemplates(updatedTemplates);
                    
                    if (needsMigration) {
                        supabase.from('automation_settings').update({ whatsapp_templates: updatedTemplates }).eq('id', 'global').then(() => console.log("Migrated WhatsApp templates to cloud."));
                    }
                }
            } else if (!data && !error) {
                console.log("[fetchAutomationSettings] row missing, initializing...");
                await supabase.from('automation_settings').upsert({ id: 'global', greeting_enabled: true, drip_enabled: false }, { onConflict: 'id' });
            }
            setIsSettingsLoaded(true);
        };

        fetchLeads();
        fetchDeliveryLogs();
        fetchAutomationSettings();

        const interval = setInterval(() => {
            fetchLeads();
            fetchDeliveryLogs();
            fetchVoiceData?.();
        }, 1000 * 30); // 30s auto-refresh
        
        // --- REALTIME SUBSCRIPTIONS ---
        const callSub = supabase.channel('realtime_calls_v2')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_transcripts' }, (payload) => {
                const call = payload.new;
                toast.success(`Voice Call Ended: ${call.phone_number}`);
                fetchVoiceData?.();
            })
            .subscribe();

        const leadsSub = supabase.channel('realtime_leads_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => {
                fetchLeads();
            })
            .subscribe();

        const activitySub = supabase.channel('realtime_activity_v2')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_lead_activity' }, (payload) => {
                const activity = payload.new;
                if (activity.event_type === 'form_filled') {
                    toast.success(`📋 New Intake Form: ${activity.metadata?.service || 'Unknown Service'}`, { duration: 6000 });
                    
                    // Trigger browser notification if supported and granted
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("New Intake Form Filled", {
                            body: activity.description || 'A lead just submitted their requirements.',
                            icon: '/favicon.ico'
                        });
                    }
                }
            })
            .subscribe();

        // Request browser notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        return () => {
            clearInterval(interval);
            supabase.removeChannel(callSub);
            supabase.removeChannel(leadsSub);
            supabase.removeChannel(activitySub);
        };
    }, []);

    // AI Automation State (Real-time from whatsapp_logs)
    const automationLogs = useMemo(() => {
        return deliveryLogs.map((log: any) => {
            const payload = log.payload || {};
            const createdDate = new Date(log.created_at);
            const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = createdDate.toLocaleDateString();
            const now = new Date();
            const isToday = createdDate.toDateString() === now.toDateString();
            const displayTime = isToday ? timeStr : `${dateStr}, ${timeStr}`;

            let title = 'Action Executed';
            let desc = 'AI performed an automated action.';
            let icon = Bot;

            if (payload.pipelineStageUpdate) {
                title = 'Stage Advanced';
                desc = `Moved lead to "${payload.pipelineStageUpdate}".`;
                icon = CheckCircle2;
            } else if (payload.templateName === 'post_call_intake') {
                title = 'Auto-Greeting Sent';
                desc = `Sent welcome menu to customer at ${payload.original_recipient}.`;
                icon = MessageSquare;
            } else if (payload.templateName?.startsWith('drip')) {
                title = 'Drip Sequence Triggered';
                desc = `Sent follow-up step ${payload.templateName.split('_')[2]} to ${payload.original_recipient}.`;
                icon = Send;
            } else if (payload.templateName) {
                title = 'Template Dispatched';
                desc = `Sent ${payload.templateName} to ${payload.original_recipient}.`;
                icon = FileText;
            } else if (payload.message || payload.type === 'ai_response') {
                title = 'AI Response Sent';
                desc = payload.message 
                    ? `Replied: "${payload.message.substring(0, 40)}${payload.message.length > 40 ? '...' : ''}"`
                    : 'Sent automated response to customer.';
                icon = MessageCircle;
            } else if (payload.type === 'incoming_message') {
                title = 'Message Received';
                desc = payload.raw_text 
                    ? `From customer: "${payload.raw_text.substring(0, 40)}${payload.raw_text.length > 40 ? '...' : ''}"`
                    : 'New incoming message detected.';
                icon = MessageSquare;
            }

            return {
                id: log.id,
                type: payload.templateName || 'custom',
                icon,
                title,
                desc,
                time: displayTime,
                status: log.status === 'error' ? 'error' : 'success'
            };
        });
    }, [deliveryLogs]);

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
    const [quotationTargetLead, setQuotationTargetLead] = useState<any>(null);
    const [agentTargetLead, setAgentTargetLead] = useState<any>(null);
    const [agentTargetAction, setAgentTargetAction] = useState<'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing' | 'custom'>('inquiry');
    // Per-call greeting dispatch status (keyed by call.id)
    const [callGreetingStatus, setCallGreetingStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
    const processingCalls = useRef<Set<string>>(new Set());
    const [assignmentResult, setAssignmentResult] = useState<any>(null);

    // Add Lead Modal State
    const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
    const [addLeadName, setAddLeadName] = useState('');
    const [addLeadPhone, setAddLeadPhone] = useState('');
    const [addLeadDuplicateWarning, setAddLeadDuplicateWarning] = useState<any>(null);
    const [addLeadCheckingDuplicate, setAddLeadCheckingDuplicate] = useState(false);

    // Client Invoice Generator State (CRM Pipeline)
    const [isClientInvoiceOpen, setIsClientInvoiceOpen] = useState(false);
    const [clientInvoiceLead, setClientInvoiceLead] = useState<any>(null);
    const [ciDays, setCiDays] = useState<number>(1);
    const [ciRate, setCiRate] = useState<number>(0);
    const [ciDeposit, setCiDeposit] = useState<number>(0);
    const [ciStartDate, setCiStartDate] = useState('');
    const [ciEndDate, setCiEndDate] = useState('');
    const [ciAttendanceVerified, setCiAttendanceVerified] = useState(true);
    const [ciLeadId, setCiLeadId] = useState('');
    const [addLeadConfirmDuplicate, setAddLeadConfirmDuplicate] = useState(false);

    // Staff Picker State
    const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
    const [staffPickerTargetLead, setStaffPickerTargetLead] = useState<any>(null);
    const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);
    const [allWorkers, setAllWorkers] = useState<any[]>([]); // All employees for Kanban badge
    const [selectedWorker, setSelectedWorker] = useState<any>(null);
    const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('English');
    const [agentDraftText, setAgentDraftText] = useState('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [templateDraftText, setTemplateDraftText] = useState('');
    const [quotationVars, setQuotationVars] = useState({ v1: '', v2: '', v3: '', v4: '' });
    const [invoiceDepositAmount, setInvoiceDepositAmount] = useState('');
    const [invoiceStartDate, setInvoiceStartDate] = useState('');
    const [invoiceEndDate, setInvoiceEndDate] = useState('');
    const [invoiceDueDate, setInvoiceDueDate] = useState('');
    
    // Service Period Modal State
    const [isServicePeriodOpen, setIsServicePeriodOpen] = useState(false);
    const [serviceType, setServiceType] = useState<'one_day' | 'date_range'>('one_day');
    const [serviceStartDate, setServiceStartDate] = useState('');
    const [serviceEndDate, setServiceEndDate] = useState('');
    const [serviceHours, setServiceHours] = useState(1);
    const [calculatedBill, setCalculatedBill] = useState(0);

    // Transcript Modal State
    const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
    const [selectedCall, setSelectedCall] = useState<any>(null);

    // WhatsApp Chat Modal State
    const [isWhatsappChatOpen, setIsWhatsappChatOpen] = useState(false);
    const [selectedWhatsappLead, setSelectedWhatsappLead] = useState<any>(null);
    const [whatsappChat, setWhatsappChat] = useState<any[]>([]);
    const [isFetchingChat, setIsFetchingChat] = useState(false);

    const fetchWhatsappChat = async (lead: any) => {
        setSelectedWhatsappLead(lead);
        setIsWhatsappChatOpen(true);
        setIsFetchingChat(true);
        setWhatsappChat([]);
        try {
            let phoneDigits = 'Unknown';
            const targetNumber = lead.whatsapp_number || lead.phone;
            if (targetNumber && targetNumber !== 'Unknown Number' && targetNumber !== 'Unknown') {
                phoneDigits = targetNumber.replace(/\D/g, ''); 
                if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
            }

            const { data, error } = await supabase
                .from("whatsapp_messages")
                .select("role, content, created_at")
                .ilike("phone", `%${phoneDigits.slice(-10)}%`)
                .order("created_at", { ascending: true }); // chronological

            if (error) throw error;
            setWhatsappChat(data || []);
        } catch (err: any) {
            console.error('Failed to fetch chat logs:', err);
            toast.error(`Unable to load chat: ${err.message}`);
        } finally {
            setIsFetchingChat(false);
        }
    };

    const [whatsappTemplates, setWhatsappTemplates] = useState<Record<string, Record<string, string>>>({
        inquiry: {
            Hinglish: "Hi {{name}}! 🌟 99 Care me aapka swagat hai. Kripya niche diye gaye button par click karke apni zaroorat batayein taaki hum aapke liye best staff find kar sakein.",
            Hindi: "Namaste {{name}} ji, 99 Care mein aapka swagat hai! Kripya niche diye gaye button par click karein aur apni requirements form me bharein.",
            English: "Hi {{name}}, welcome to 99 Care! Please tap the button below to fill out our intake form so we can understand your requirements and assign the best healthcare staff for you."
        },
        quotation: {
            Hinglish: "Namaste {{name}} ji! 🙏 Aapke liye humne ek customized quotation taiyar ki hai.\n\n📋 Service: {{v1}}\n⏰ Hours: {{v2}}\n💰 Full Month: {{v3}}\n💵 Half Month: {{v4}}\n\nKoi bhi changes chahiye toh batayein — hum adjust kar sakte hain!",
            Hindi: "Namaste {{name}} ji, aapki quotation taiyar hai.\n\n📋 सेवा: {{v1}}\n⏰ घंटे: {{v2}}\n💰 पूरा महीना: {{v3}}\n💵 आधा महीना: {{v4}}\n\nकोई प्रश्न हो तो हमसे संपर्क करें।",
            English: "Hi {{name}}, your customized quotation from 99 Care is ready!\n\n📋 Service: {{v1}}\n⏰ Hours: {{v2}}\n💰 Full Month: {{v3}}\n💵 Half Month: {{v4}}\n\nFeel free to reach out if you'd like any adjustments."
        },
        consent: {
            Hinglish: "Hi {{name}} ji! Ek aakhri step baki hai — apna consent form yahan fill karein aur hum service start kar denge! ✅\nhttps://docs.google.com/forms/d/e/1FAIpQLScENgj7ltdWY9O3leGhXVl1U4wExTX1zlHItApNhRkqui3dIg/viewform",
            Hindi: "Namaste {{name}} ji, aage badhne ke liye kripya yeh consent form bharein:\nhttps://docs.google.com/forms/d/e/1FAIpQLScENgj7ltdWY9O3leGhXVl1U4wExTX1zlHItApNhRkqui3dIg/viewform",
            English: "Hi {{name}}, just one final step — please complete the consent form below and we'll get your service started:\nhttps://docs.google.com/forms/d/e/1FAIpQLScENgj7ltdWY9O3leGhXVl1U4wExTX1zlHItApNhRkqui3dIg/viewform"
        },
        staff: {
            Hinglish: "Good news {{name}} ji! 🎉 Aapke liye {{workerName}} ({{workerRole}}) ko assign kiya gaya hai!\n\n👤 Unki ID Card aur profile verify karne ke liye yahan dekhen:\n{{link}}\n\nYe link 30 din tak valid hai. Koi concern ho toh hume batayein!",
            Hindi: "Namaste {{name}} ji, aapke liye {{workerName}} ({{workerRole}}) ko assign kiya gaya hai.\n\nID Card dekhne ke liye:\n{{link}}\n\nYe link 30 din tak valid hai.",
            English: "Great news {{name}}! We have assigned {{workerName}} ({{workerRole}}) to you.\n\n🔗 View their verified ID Card: {{link}}\n\nPlease verify their identity upon arrival. This link is valid for 30 days."
        },
        deposit: {
            Hinglish: "Namaste {{name}} ji! 🙏 Aapka deposit invoice ready hai.\n\n💰 Amount aur payment details yahan dekhein:\nhttps://99care.in/invoice/{{link}}\n\nPayment complete karne ke baad service start ho jayegi!",
            Hindi: "Namaste {{name}} ji, aapka deposit invoice taiyar hai. Kripya yahan dekhen:\nhttps://99care.in/invoice/{{link}}",
            English: "Hi {{name}}, your deposit invoice is ready. Please review and complete the payment here:\nhttps://99care.in/invoice/{{link}}\n\nService will begin once payment is confirmed!"
        },
        billing: {
            Hinglish: "Namaste {{name}} ji! 📄 Is mahine ka bill taiyar ho gaya hai.\n\nBill amount aur details yahan dekhein:\nhttps://99care.in/bill/{{link}}\n\nPayment complete karne par confirmation milegi. Shukriya! 🙏",
            Hindi: "Namaste {{name}} ji, is mahine ka bill taiyar hai. Kripya yahan dekhen:\nhttps://99care.in/bill/{{link}}",
            English: "Hi {{name}}, your monthly bill for this period is ready. Please review and pay here:\nhttps://99care.in/bill/{{link}}\n\nThank you for choosing 99 Care!"
        }
    });

    useEffect(() => {
        // Sync templates to DB only — do not write to localStorage
        // localStorage is vulnerable to browser extensions and XSS
        const syncToCloud = async () => {
            try {
                await supabase.from('automation_settings').upsert({ 
                    id: 'global', 
                    whatsapp_templates: whatsappTemplates 
                }, { onConflict: 'id' });
            } catch (e) { console.warn('Template cloud sync failed:', e); }
        };
        syncToCloud();
    }, [whatsappTemplates]);

    const PROTECTED_STAGES = ['New Inquiry', 'Active Client', 'Closed Won', 'Lost'];

    // Initialize pipelineStages from localStorage or defaults
    // Initialize pipelineStages - prioritize clean split defaults
    const [pipelineStages, setPipelineStages] = useState<string[]>(['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending']);

    const [clientStages, setClientStages] = useState<string[]>(['Active Client', 'Monthly Billing', 'Closed Won']);

    // Helper to sync to cloud only when manually changed
    const syncStagesToCloud = async (pStages: string[], cStages: string[]) => {
        if (!isSettingsLoaded) {
            console.log("[syncStagesToCloud] blocked: settings not yet loaded from cloud.");
            return;
        }
        try {
            await supabase.from('automation_settings').upsert({ 
                id: 'global', 
                pipeline_stages: pStages,
                client_stages: cStages
            }, { onConflict: 'id' });
        } catch (e) { }
    };

    // Sync pipelineStages to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('crmPipelineStages', JSON.stringify(pipelineStages));
    }, [pipelineStages]);

    useEffect(() => {
        localStorage.setItem('crmClientStages', JSON.stringify(clientStages));
    }, [clientStages]);

    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
    const [editingStageName, setEditingStageName] = useState('');

    const [editingLeadValueId, setEditingLeadValueId] = useState<string | null>(null);
    const [editingLeadValueAmount, setEditingLeadValueAmount] = useState<string>('');

    const [editingLeadDetailsId, setEditingLeadDetailsId] = useState<string | null>(null);
    const [editingLeadName, setEditingLeadName] = useState<string>('');
    const [editingLeadPhone, setEditingLeadPhone] = useState<string>('');
    const [selectedInspectorLead, setSelectedInspectorLead] = useState<any | null>(null);

    // Inspector editing state for new fields
    const [inspectorActivity, setInspectorActivity] = useState<any[]>([]);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [editingInspectorEmail, setEditingInspectorEmail] = useState(false);
    const [inspectorEmailDraft, setInspectorEmailDraft] = useState('');
    const [editingInspectorService, setEditingInspectorService] = useState(false);
        const [inspectorServiceDraft, setInspectorServiceDraft] = useState('');
    const [inspectorNameDraft, setInspectorNameDraft] = useState('');
    const [inspectorPhoneDraft, setInspectorPhoneDraft] = useState('');
    const [editingInspectorName, setEditingInspectorName] = useState(false);
    const [editingInspectorPhone, setEditingInspectorPhone] = useState(false);
    const [inspectorNoteDraft, setInspectorNoteDraft] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Kanban Accordion State
    const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
    const [stageLimits, setStageLimits] = useState<Record<string, number>>({});

    // Initialize first 3 stages as open by default
    useEffect(() => {
        if (pipelineStages.length > 0 && Object.keys(expandedStages).length === 0) {
            const initialExpanded: Record<string, boolean> = {};
            pipelineStages.slice(0, 3).forEach(stage => {
                initialExpanded[stage] = true;
            });
            setExpandedStages(initialExpanded);
        }
    }, [pipelineStages]);

    const toggleStage = (stageName: string) => {
        setExpandedStages(prev => ({ ...prev, [stageName]: !prev[stageName] }));
    };

    const loadMoreInStage = (stageName: string) => {
        setStageLimits(prev => ({ ...prev, [stageName]: (prev[stageName] || 4) + 4 }));
    };    const [workflows, setWorkflows] = useState({
        greeting: true,
        drip: false
    });

    // Voice AI State
    const [calls, setCalls] = useState<any[]>([]);
    const [isLoadingVoice, setIsLoadingVoice] = useState(true);
    const [capturingCallId, setCapturingCallId] = useState<string | number | null>(null);
    const [voiceMetrics, setVoiceMetrics] = useState({
        totalCallsToday: 0,
        avgDurationSeconds: 0,
        leadsCaptured: 0
    });

    // --- ELEVENLABS INTEGRATION ---
    const conversation = useConversation({
        onConnect: () => {
            setCallStatus('active');
            console.log('ElevenLabs: connected');
        },
        onDisconnect: () => {
            setCallStatus('idle');
            console.log('ElevenLabs: disconnected');
            setTimeout(() => fetchVoiceData(), 3000);
        },
        onError: (error: any) => {
            console.error('ElevenLabs Error', error);
            setCallStatus('idle');
            toast.error('ElevenLabs encountered an error. Please check console.');
        },
    });
    const [callStatus, setCallStatus] = useState<'idle' | 'loading' | 'active'>('idle');

    const sendWorkerProfileWhatsApp = async (lead: any, worker: any) => {
        try {
            // Guard: mock workers have numeric IDs — skip DB and open WhatsApp directly
            const isRealWorker = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worker.id);
            if (!isRealWorker) {
                const text = `99Care: Namaste ${lead.name}! Aapke liye ${worker.name || worker.full_name} (${worker.role || worker.job_title}) ko assign kiya gaya hai. Dhanyawad! ✅`;
                let phone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '') || '917575041313';
                if (phone.length === 10) phone = `91${phone}`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                toast.success(`Message opened for ${lead.name}! (Demo worker — no ID card link)`);
                return;
            }
            // Create assignment + ID card link
            const result = await assignWorkerToClient(worker.id, lead.id, undefined, 0, true);
            const text = `99Care: Namaste ${lead.name}! Aapke liye ${worker.name || worker.full_name} (${worker.role || worker.job_title}) ko assign kiya gaya hai.\n\n🔗 Unki verified ID Card dekhein: ${result.shareableUrl}\n\nYe link 30 din tak valid hai. Dhanyawad! ✅`;
            let phone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '') || '917575041313';
            if (phone.length === 10) phone = `91${phone}`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
            toast.success(`ID card link shared with ${lead.name}!`);
        } catch (err: any) {
            toast.error(`Failed to create assignment: ${err.message}`);
        }
    };



    const toggleCall = async () => {
        if (callStatus === 'active') {
            await conversation.endSession();
            setCallStatus('idle');
        } else {
            setCallStatus('loading');
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                await conversation.startSession({ agentId: String(ELEVENLABS_AGENT_ID), connectionType: 'webrtc' });
            } catch (err) {
                console.error('Failed to start ElevenLabs call', err);
                setCallStatus('idle');
                toast.error('Failed to start call. Please allow microphone access.');
            }
        }
    };

    // ── Helper: Relative time (e.g. "2h ago") ──────────────────────────────
    const getRelativeTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    // ── Helper: Initials from name ─────────────────────────────────────────
    const getInitials = (name: string) => {
        const parts = (name || '').trim().split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return (parts[0]?.[0] || '?').toUpperCase();
    };

    // ── Helper: Consistent avatar color from name ──────────────────────────
    const AVATAR_COLORS = [
        'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500',
        'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-pink-500'
    ];
    const getAvatarColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    };

    // ── Helper: Format activity timestamp ─────────────────────────────────
    const formatActivityTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${timeStr}`;
    };

    // ── Activity: Fetch from DB ────────────────────────────────────────────
    const fetchLeadActivity = async (leadId: string) => {
        setIsLoadingActivity(true);
        try {
            const { data, error } = await supabase
                .from('crm_lead_activity')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setInspectorActivity(data || []);
        } catch (e: any) {
            console.error('Failed to load lead activity:', e.message);
            setInspectorActivity([]);
        } finally {
            setIsLoadingActivity(false);
        }
    };

    const navigate = useNavigate();
    const location = useLocation();

    // Auto-open lead if passed via navigation state (e.g. from Global Search)
    useEffect(() => {
        if (location.state?.openLeadId && leads.length > 0) {
            const lead = leads.find(l => l.id === location.state.openLeadId);
            if (lead && (!selectedInspectorLead || selectedInspectorLead.id !== lead.id)) {
                setSelectedInspectorLead(lead);
                fetchLeadActivity(lead.id);
            }
        }
    }, [location.state?.openLeadId, leads]);

    // ── Activity: Log a new event ──────────────────────────────────────────
    const logActivity = async (leadId: string, eventType: string, description: string, metadata: any = {}) => {
        if (!leadId || leadId.length < 10) return; // Skip mock leads
        try {
            const { error } = await supabase.from('crm_lead_activity').insert([{ 
                lead_id: leadId, 
                event_type: eventType, 
                description, 
                metadata 
            }]);
            if (error) console.warn("Activity logging skipped:", error.message);
        } catch (e) {
            console.error("Activity log error:", e);
        }
    };

    // ── Inspector: Save a field (email or service_interest) ───────────────
    const saveInspectorField = async (leadId: string, field: string, value: string) => {
        // Optimistic update
        setSelectedInspectorLead((prev: any) => prev ? { ...prev, [field]: value } : null);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
        if (leadId.length >= 10) {
            const { error } = await supabase.from('crm_leads').update({ [field]: value }).eq('id', leadId);
            if (error) {
                console.error('saveInspectorField failed:', error.message);
                toast.error('Failed to save field. Please try again.');
                // Revert optimistic update
                fetchLeads();
            }
        }
    };

    const handleAddNote = async (leadId: string, noteText: string) => {
        if (!noteText.trim()) return;
        setIsSavingNote(true);
        try {
            // Fetch current notes so we can append
            const { data: current } = await supabase.from('crm_leads').select('notes').eq('id', leadId).single();
            const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            const newEntry = `[${timestamp}] ${noteText.trim()}`;
            const updatedNotes = current?.notes ? `${current.notes}\n\n${newEntry}` : newEntry;
            await supabase.from('crm_leads').update({ notes: updatedNotes }).eq('id', leadId);
            setSelectedInspectorLead((prev: any) => prev ? { ...prev, notes: updatedNotes } : null);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: updatedNotes } : l));
            // Log as activity
            await supabase.from('crm_lead_activity').insert([{
                lead_id: leadId,
                event_type: 'note_added',
                description: `Note: ${noteText.trim().substring(0, 80)}${noteText.length > 80 ? '...' : ''}`,
                metadata: { note: noteText.trim() }
            }]);
            // Refresh activity feed
            fetchLeadActivity(leadId);
            setInspectorNoteDraft('');
            toast.success('Note saved!');
        } catch (err) {
            toast.error('Failed to save note.');
        } finally {
            setIsSavingNote(false);
        }
    };

    const upsertCallTranscriptStatus = async (
        call: any,
        phoneDigits: string,
        automationError: string
    ) => {
        const { error } = await supabase.from('call_transcripts').upsert(
            {
                conversation_id: String(call.id),
                phone_number: phoneDigits,
                called_at: call.created_at || new Date().toISOString(),
                lead_id: call.lead_id || null,
                automation_error: automationError,
            },
            { onConflict: 'conversation_id' }
        );
        if (error) {
            console.warn('[Greeting] call_transcripts upsert failed:', error.message);
        }
    };

    const handleResendCallGreeting = (call: any) => {
        processingCalls.current.delete(String(call.id));
        void handleSendCallGreeting(call, true);
    };

    // Send WhatsApp post_call_intake template manually from call log card
    const handleSendCallGreeting = async (call: any, isManual = false) => {
        const callKey = String(call.id);
        if (processingCalls.current.has(callKey)) {
            if (!isManual) return;
            processingCalls.current.delete(callKey);
        }
        processingCalls.current.add(callKey);

        const rawPhone = call.capturedWhatsapp || call.phone;
        if (!rawPhone) {
            processingCalls.current.delete(callKey);
            toast.error('No WhatsApp number found for this call.');
            return;
        }

        let digits = rawPhone.replace(/\D/g, '');
        if (digits.length === 10) digits = `91${digits}`;
        if (digits.length < 11) {
            processingCalls.current.delete(callKey);
            toast.error(`Invalid phone number: ${rawPhone}`);
            return;
        }
        const last10 = digits.slice(-10);

        setCallGreetingStatus(prev => ({ ...prev, [callKey]: 'sending' }));

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const firstName = (call.capturedName || 'there').split(' ')[0];
        const manualToastId = isManual
            ? toast.loading(`Resending greeting to ${firstName}…`)
            : undefined;

        try {
            if (!isManual) {
                const { data: transcriptRow } = await supabase
                    .from('call_transcripts')
                    .select('automation_error')
                    .eq('conversation_id', callKey)
                    .maybeSingle();

                if (
                    transcriptRow?.automation_error === 'GREETING_SENT' ||
                    transcriptRow?.automation_error === 'GREETING_PROCESSING'
                ) {
                    console.log(`[Auto-Greet] DB lock found (${transcriptRow.automation_error}) for ${callKey} — skipping.`);
                    setCallGreetingStatus(prev => ({ ...prev, [callKey]: 'sent' }));
                    return;
                }
            }

            await upsertCallTranscriptStatus(
                call,
                digits,
                isManual ? 'GREETING_RESENDING' : 'GREETING_PROCESSING'
            );

            // Step 1: Check if we already sent a greeting to this number recently (last 24h)
            // This is a real-time DB check — not just local state — to prevent duplicates on refresh
            const { data: existingGreeting } = await supabase
                .from('whatsapp_logs')
                .select('id, created_at, status')
                .or(`payload->>'original_recipient'.ilike.%${last10}%`)
                .eq('status', 'success')
                .filter('payload->>templateName', 'eq', 'post_call_intake')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1)
                .maybeSingle();

            if (existingGreeting && !isManual) {
                console.log(`[Auto-Greet] Already found a greeting log for ${last10} — marking sent without re-sending.`);
                await upsertCallTranscriptStatus(call, digits, 'GREETING_SENT');
                setCallGreetingStatus(prev => ({ ...prev, [callKey]: 'sent' }));
                toast.success(`✅ Greeting already sent to ${firstName}! Marked as done.`);
                return;
            }

            await upsertCallTranscriptStatus(call, digits, 'GREETING_PROCESSING');

            // Step 2: Send post_call_intake — template body + Flow prefill from Voice AI summary
            const intakePrefill = buildVoiceCallIntakePrefill(call);
            const requestBody = {
                phone: digits,
                useTemplate: true,
                templateName: 'post_call_intake',
                leadName: intakePrefill.flowData.name || firstName,
                templateParams: intakePrefill.templateParams,
                flowData: intakePrefill.flowData,
            };

            const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(requestBody),
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(`Edge Function error: HTTP ${res.status}`);
            }
            if (data.success === false || data.error) {
                throw new Error(data.error || 'WhatsApp delivery failed — template may be paused or rejected by Meta.');
            }

            // Step 3: Verify delivery by checking whatsapp_logs was written
            await new Promise(r => setTimeout(r, 1500)); // give DB a moment to write
            const { data: verifyLog } = await supabase
                .from('whatsapp_logs')
                .select('id, status')
                .or(`payload->>'original_recipient'.ilike.%${last10}%`)
                .filter('payload->>templateName', 'eq', 'post_call_intake')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const deliveryConfirmed =
                verifyLog?.status === 'success' || verifyLog?.status === 'accepted_by_meta';

            await upsertCallTranscriptStatus(call, digits, 'GREETING_SENT');
            setCalls((prev) =>
                prev.map((c) =>
                    String(c.id) === callKey ? { ...c, automation_error: 'GREETING_SENT' } : c
                )
            );

            // Sync parsed call details onto matching CRM lead (if any)
            const { data: linkedLeads } = await supabase
                .from('crm_leads')
                .select('id, notes, service_interest, phone, whatsapp_number')
                .is('deleted_at', null)
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .limit(3);
            const linkedLead = (linkedLeads || []).find(
                (l) => phonesMatch(l.phone, rawPhone) || phonesMatch(l.whatsapp_number, rawPhone)
            );
            if (linkedLead?.id) {
                const noteLines = [
                    `Service: ${intakePrefill.service}`,
                    `Shift: ${intakePrefill.shiftType}`,
                    intakePrefill.startDateDisplay ? `Start date: ${intakePrefill.startDateDisplay}` : null,
                    'Source: AI Phone Call (WhatsApp greeting)',
                ].filter(Boolean);
                const priorNotes = linkedLead.notes?.trim() || '';
                const mergedNotes = priorNotes
                    ? `${priorNotes}\n${noteLines.join('\n')}`
                    : noteLines.join('\n');
                await supabase
                    .from('crm_leads')
                    .update({
                        service_interest: intakePrefill.service,
                        notes: mergedNotes,
                    })
                    .eq('id', linkedLead.id);
            }

            setCallGreetingStatus(prev => ({ ...prev, [callKey]: 'sent' }));
            const prefillHint = `${intakePrefill.flowData.service || intakePrefill.service} · ${intakePrefill.shiftLabel}`;
            const resendNote = isManual ? ' (resent)' : '';
            if (manualToastId) toast.dismiss(manualToastId);
            if (deliveryConfirmed) {
                toast.success(`✅ Greeting sent to ${firstName}${resendNote}! Prefill: ${prefillHint}`);
            } else {
                toast.success(`✅ Greeting dispatched to ${firstName}${resendNote}. Prefill: ${prefillHint}`);
            }
        } catch (err: any) {
            console.error('[Greeting Error]', err.message);

            const errCode = `GREETING_ERROR: ${err.message?.slice(0, 200)}`;
            await upsertCallTranscriptStatus(call, digits, errCode);
            setCalls((prev) =>
                prev.map((c) => (String(c.id) === callKey ? { ...c, automation_error: errCode } : c))
            );

            setCallGreetingStatus(prev => ({ ...prev, [callKey]: 'error' }));
            if (manualToastId) toast.dismiss(manualToastId);
            toast.error(`❌ Greeting failed: ${err.message}`, { duration: 8000 });
        } finally {
            processingCalls.current.delete(callKey);
        }
    };

    // --- FETCH VOICE DATA (From ElevenLabs webhook via crm_call_logs) ---
    const fetchVoiceData = async () => {
        setIsLoadingVoice(true);
        try {
            // Fetch calls natively from Edge Function to bypass SDK wrapper issues
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(`${SUPABASE_URL}/functions/v1/get-elevenlabs-calls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ limit: 30 })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Edge Function responded with HTTP ${res.status}: ${errText}`);
            }

            const edgeResponse = await res.json();
            const callsData = edgeResponse?.data || [];

            // Process and format calls
            let todayCalls = 0;
            let totalDurationToday = 0;
            const todayStr = new Date().toDateString();

            const formattedCalls = (callsData || []).map((call: any) => {
                const startedAt = new Date(call.created_at);
                const isToday = startedAt.toDateString() === todayStr;

                const durationSeconds = call.duration_seconds || 0;

                if (isToday) {
                    todayCalls++;
                    totalDurationToday += durationSeconds;
                }

                // Format duration string (e.g. "1m 45s")
                const dMins = Math.floor(durationSeconds / 60);
                const dSecs = durationSeconds % 60;
                const durationStr = dMins > 0 ? `${dMins}m ${dSecs}s` : `${dSecs}s`;

                // If lead_id exists, it means the webhook successfully associated this call with a lead
                const callStatus = call.lead_id ? 'Processed' : 'Unprocessed';

                return {
                    id: call.id,
                    phone: call.phone_number || "Unknown Number",
                    type: 'Inbound',
                    duration: durationStr,
                    time: isToday ? startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : startedAt.toLocaleDateString(),
                    intent: call.intent || "Inquiry",
                    summary: call.summary || "No summary available.",
                    recordingUrl: call.recording_url,
                    capturedName: call.lead_id ? (call.capturedName || "Known Lead") : call.capturedName,
                    capturedWhatsapp: call.capturedWhatsapp || call.phone_number || null,
                    status: callStatus,
                    transcript: call.transcript,
                    lead_id: call.lead_id,
                    automation_error: call.automation_error,
                    created_at: call.created_at // Preserve raw timestamp for auto-trigger logic
                };
            });

            // Filter calls that successfully captured a lead (lead_id is not null) or phone matches existing lead
            const actualVoiceLeadsCaptured = formattedCalls.filter((c: any) => {
                const isAlreadyInPipeline = leads.some(l => {
                    if (c.lead_id && l.id === c.lead_id) return true;
                    return false;
                });
                return isAlreadyInPipeline;
            }).length;

            setCalls(formattedCalls);
            setVoiceMetrics({
                totalCallsToday: todayCalls,
                avgDurationSeconds: todayCalls > 0 ? Math.round(totalDurationToday / todayCalls) : 0,
                leadsCaptured: actualVoiceLeadsCaptured
            });

        } catch (error: any) {
            console.error('CRITICAL: Voice logs fetch failed:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                stack: error.stack
            });
            toast.error(`Unable to load voice logs: ${error.message}. Check console for network details.`);
        } finally {
            setIsLoadingVoice(false);
        }
    };

    const handleRetryVoice = () => {
        fetchVoiceData();
    };

    useEffect(() => {
        if (activeTab === 'voice') {
            fetchVoiceData();
        }
        if (activeTab === 'trash') {
            fetchTrashedLeads();
        }
        if (activeTab === 'automations') {
            fetchReviews();
        }
    }, [activeTab]);

    const fetchReviews = async () => {
        setIsLoadingReviews(true);
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            setReviews(data || []);
        } catch (err: any) {
            console.warn('Reviews table not available:', err.message);
            setReviews([]);
        } finally {
            setIsLoadingReviews(false);
        }
    };
    // -------------------------

    const toggleWorkflow = async (key: keyof typeof workflows) => {
        const isTurningOn = !workflows[key];
        
        // Update local state immediately for responsiveness
        setWorkflows(prev => ({ ...prev, [key]: isTurningOn }));

        const updatePayload = {
            id: 'global',
            greeting_enabled: key === 'greeting' ? isTurningOn : workflows.greeting,
            drip_enabled: key === 'drip' ? isTurningOn : workflows.drip
        };

        const { error } = await supabase
            .from('automation_settings')
            .upsert(updatePayload, { onConflict: 'id' });

        if (error) {
            console.error("[Settings Update Error]:", error);
            toast.error(`Failed to update ${key} setting.`);
            // Rollback
            setWorkflows(prev => ({ ...prev, [key]: !isTurningOn }));
        } else {
            toast.success(`${key === 'greeting' ? 'Instant Greeting' : 'Drip Campaign'} ${isTurningOn ? 'Enabled' : 'Disabled'}`);
            fetchDeliveryLogs();
        }
    };




    const handleBulkGreeting = async () => {
        if (!workflows.greeting) {
            toast.info("Toggle ON 'Instant Greeting & Triage' first before dispatching.");
            return;
        }

        const newInquiryLeads = leads.filter((l) => l.pipeline_stage === NEW_LEAD_PIPELINE_STAGE);

        if (newInquiryLeads.length === 0) {
            toast.info(`No leads in '${NEW_LEAD_PIPELINE_STAGE}' to greet. There may not be any fresh ungreeted leads right now.`);
            return;
        }

        const confirmed = await new Promise<boolean>(resolve => {
            toast(`Send WhatsApp greeting to ${newInquiryLeads.length} lead(s)?\n${newInquiryLeads.map(l => `• ${l.name}`).join(', ')}`, {
                action: { label: 'Send', onClick: () => resolve(true) },
                cancel: { label: 'Cancel', onClick: () => resolve(false) },
                duration: 10000,
            });
        });
        if (!confirmed) return;

        setIsSimulatingInquiry(true);
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

        let sentCount = 0;
        let failCount = 0;
        const progressId = `bulk-greeting-${Date.now()}`;
        toast.loading(`Sending greetings… 0/${newInquiryLeads.length}`, { id: progressId });

        for (const lead of newInquiryLeads) {
            try {
                // Prioritize dedicated WhatsApp number if Vapi captured it, otherwise use regular phone
                let targetNumber = lead.whatsapp_number || lead.phone || '918000044090';
                const phoneDigits = targetNumber.replace(/\D/g, '');
                const bulkPrefill = buildLeadIntakePrefill(lead);

                const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        phone: phoneDigits,
                        leadId: lead.id,
                        leadName: bulkPrefill.flowData.name || lead.name?.split(/\s+/)[0] || 'there',
                        useTemplate: true,
                        templateName: 'post_call_intake',
                        templateParams: bulkPrefill.templateParams,
                        flowData: bulkPrefill.flowData,
                    }),
                });

                const bulkRes = await response.json().catch(() => ({}));
                if (!response.ok || bulkRes.success === false) {
                    throw new Error(bulkRes.error || bulkRes.message || `HTTP ${response.status}`);
                }

                sentCount++;
                toast.loading(`Sending greetings… ${sentCount}/${newInquiryLeads.length}`, { id: progressId });

                // Determine target stage (usually the one after 'New Lead')
                const targetStage = pipelineStages[1] || 'In Discussion';

                // Move lead to target stage after greeting and record timestamp
                await supabase
                    .from('crm_leads')
                    .update({ 
                        pipeline_stage: targetStage,
                        last_greeted_at: new Date().toISOString(),
                        drip_step: 0
                    })
                    .eq('id', lead.id);

            } catch (e: any) {
                console.warn(`Failed to greet ${lead.name}:`, e.message);
                failCount++;
            }
        }

        toast.dismiss(progressId);

        fetchDeliveryLogs();

        if (sentCount > 0) {
            toast.success(`✅ Greeted ${sentCount} lead(s)! They've been moved to "In Discussion".`);
        }
        if (failCount > 0) {
            toast.error(`${failCount} greeting(s) failed — check console.`);
        }

        setIsSimulatingInquiry(false);
    };

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('crm_leads')
                .select('*, crm_quotations(start_date, duration, created_at)')
                .is('deleted_at', null)
                .not('pipeline_stage', 'eq', 'Archived')
                .order('created_at', { ascending: false });

            if (error) {
                // If deleted_at column doesn't exist yet, fall back to fetching all leads
                if (error.message?.includes('deleted_at') || error.code === '42703') {
                    const { data: fallback, error: fallbackError } = await supabase
                        .from('crm_leads')
                        .select('*, crm_quotations(start_date, duration, created_at)')
                        .not('pipeline_stage', 'eq', 'Archived')
                        .order('created_at', { ascending: false });
                    if (fallbackError) throw fallbackError;
                    const fallbackRows = fallback || [];
                    const firstStage = NEW_LEAD_PIPELINE_STAGE;
                    const legacyIds = fallbackRows
                        .filter((l) => isLegacyPipelineStage(l.pipeline_stage))
                        .map((l) => l.id);
                    if (legacyIds.length > 0) {
                        supabase
                            .from('crm_leads')
                            .update({ pipeline_stage: firstStage })
                            .in('id', legacyIds);
                    }
                    setLeads(
                        fallbackRows.map((l) =>
                            isLegacyPipelineStage(l.pipeline_stage)
                                ? { ...l, pipeline_stage: firstStage }
                                : l
                        )
                    );
                    return;
                }
                throw error;
            }
            const rows = data || [];
            const firstStage = NEW_LEAD_PIPELINE_STAGE;
            const legacyIds = rows
                .filter((l) => isLegacyPipelineStage(l.pipeline_stage))
                .map((l) => l.id);
            if (legacyIds.length > 0) {
                supabase
                    .from('crm_leads')
                    .update({ pipeline_stage: firstStage })
                    .in('id', legacyIds)
                    .then(({ error }) => {
                        if (error) console.warn('Legacy stage migration failed:', error.message);
                    });
            }
            setLeads(
                rows.map((l) =>
                    isLegacyPipelineStage(l.pipeline_stage)
                        ? { ...l, pipeline_stage: firstStage }
                        : l
                )
            );
        } catch (err: any) {
            console.error('Error fetching leads:', err);
            toast.error('Failed to load CRM leads. Please refresh the page.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTrashedLeads = async () => {
        setIsLoadingTrash(true);
        try {
            const { data, error } = await supabase
                .from('crm_leads')
                .select('*')
                .not('deleted_at', 'is', null)
                .order('deleted_at', { ascending: false });
            if (error) throw error;
            // Auto-clear leads trashed more than 30 days ago
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const expired = (data || []).filter((l: any) => l.deleted_at < thirtyDaysAgo);
            if (expired.length > 0) {
                await Promise.all(expired.map((l: any) =>
                    supabase.rpc('delete_crm_lead_robust', { target_lead_id: l.id })
                ));
            }
            setTrashedLeads((data || []).filter((l: any) => l.deleted_at >= thirtyDaysAgo));
        } catch (err: any) {
            console.error('Error fetching trash:', err);
        } finally {
            setIsLoadingTrash(false);
        }
    };

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (
        leadName: string, 
        action: string, 
        lang: string, 
        worker?: any,
        shareableUrl?: string
    ) => {
        let tpl = whatsappTemplates[action]?.[lang] || '';
        const link = shareableUrl || `${window.location.origin}/id-card/${Math.random().toString(36).substr(2, 6)}`;
        
        // Strip out hardcoded legacy domain prefixes if they exist in the template
        // e.g. "https://99care.in/staff/{{link}}" -> "{{link}}"
        if (tpl.includes('https://99care.in/staff/')) {
            tpl = tpl.replace(/https:\/\/99care\.in\/staff\//g, '');
        }

        return tpl
            .replace(/\{\{name\}\}/g, leadName)
            .replace(/\{\{link\}\}/g, link)
            .replace(/\{\{workerName\}\}/g, worker?.name || worker?.full_name || 'your assigned staff')
            .replace(/\{\{workerRole\}\}/g, worker?.role || worker?.job_title || 'Healthcare Worker')
            .replace(/\{\{v1\}\}/g, quotationVars.v1 || '[Service]')
            .replace(/\{\{v2\}\}/g, quotationVars.v2 || '[Hours]')
            .replace(/\{\{v3\}\}/g, quotationVars.v3 || '[Price]')
            .replace(/\{\{v4\}\}/g, quotationVars.v4 || '[Price]');
    };

    const fetchWorkers = async () => {
        setIsLoadingWorkers(true);
        try {
            const { data, error } = await supabase.from('employees').select('*').is('deleted_at', null);
            
            if (error) throw error;

            if (data && data.length > 0) {
                // Filter in JS to be safe against schema variations
                const available = data.filter(w => 
                    (w.status && w.status.toLowerCase() === 'available') && !w.deleted_at
                );
                // Map unified fields to legacy UI expectations
                const mapped = available.map(w => ({ ...w, name: w.full_name || w.name, role: w.job_title || w.role }));
                setAvailableWorkers(mapped);
            } else {
                setAvailableWorkers([]);
            }
        } catch (err) {
            console.warn("Failed to fetch employees from DB, using mock data:", err);
            setAvailableWorkers(MOCK_WORKERS.filter(w => w.status === 'Available'));
        } finally {
            setIsLoadingWorkers(false);
        }
    };

    const openStaffPicker = (lead: any) => {
        setStaffPickerTargetLead(lead);
        setSelectedWorker(null);
        fetchWorkers();
        setIsStaffPickerOpen(true);
    };

    const confirmWorkerSelection = async (worker: any) => {
        // Guard: mock workers have numeric IDs (e.g. '3') — not valid UUIDs
        const isRealWorker = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worker.id);
        if (!isRealWorker) {
            toast.error(
                `Cannot assign "${worker.name || worker.full_name}" — this is a demo worker. Please add real workers in the HR module first.`
            );
            return;
        }

        setSelectedWorker(worker);
        setIsStaffPickerOpen(false);
        setIsServicePeriodOpen(true);
        
        // Fetch quotation and consent to auto-fill dates
        let autoStartDate = new Date().toISOString().split('T')[0];
        let autoEndDate = '';
        let autoHours = 12;
        let autoType: 'one_day' | 'date_range' = 'date_range';
        let autoBill = 0;

        if (staffPickerTargetLead?.id) {
            const { data: quote } = await supabase
                .from('crm_quotations')
                .select('*')
                .eq('lead_id', staffPickerTargetLead.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const { data: consent } = await supabase
                .from('client_consents')
                .select('*')
                .eq('lead_id', staffPickerTargetLead.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (quote?.start_date) {
                autoStartDate = quote.start_date.split('T')[0];
            } else if (consent?.service_start_date) {
                autoStartDate = consent.service_start_date.split('T')[0];
            }

            if (quote?.hours_per_day) {
                autoHours = quote.hours_per_day;
            } else if (consent?.offered_time) {
                const hourMatch = consent.offered_time.match(/(\d+)/);
                if (hourMatch) autoHours = parseInt(hourMatch[1]);
            }

            if (quote?.duration) {
                const start = new Date(autoStartDate);
                if (!isNaN(start.getTime())) {
                    const dur = quote.duration.toLowerCase().trim();
                    if (dur.includes('open') || dur.includes('ongoing') || dur.includes('indefinite')) {
                        autoEndDate = '';
                    } else {
                    const match = dur.match(/^(\d+)\s*(day|month|year)s?$/);
                    if (match) {
                        const amount = parseInt(match[1]);
                        const unit = match[2];
                        if (unit === 'day') {
                            start.setDate(start.getDate() + amount);
                        } else if (unit === 'month') {
                            start.setMonth(start.getMonth() + amount);
                        } else if (unit === 'year') {
                            start.setFullYear(start.getFullYear() + amount);
                        }
                        autoEndDate = start.toISOString().split('T')[0];
                    } else if (dur.includes('month')) {
                        const amountMatch = dur.match(/(\d+)/);
                        const amount = amountMatch ? parseInt(amountMatch[1]) : 1;
                        start.setMonth(start.getMonth() + amount);
                        autoEndDate = start.toISOString().split('T')[0];
                    } else if (dur.includes('day')) {
                        const amountMatch = dur.match(/(\d+)/);
                        const amount = amountMatch ? parseInt(amountMatch[1]) : 15;
                        start.setDate(start.getDate() + amount);
                        autoEndDate = start.toISOString().split('T')[0];
                    }
                    }
                }
            } else {
                // If there's no duration specified but it is date_range, default end date to start date + 1 month
                const start = new Date(autoStartDate);
                if (!isNaN(start.getTime())) {
                    start.setMonth(start.getMonth() + 1);
                    autoEndDate = start.toISOString().split('T')[0];
                }
            }

            // Determine if single day or date range
            if (quote?.service_category === 'one_day' || quote?.service_name === 'one_day') {
                autoType = 'one_day';
            } else {
                autoType = 'date_range';
            }

            // Monthly total bill estimation
            autoBill = quote?.estimated_monthly_total || quote?.complete_month_rate || 0;
            if (!autoBill) {
                const dailyRate = staffPickerTargetLead?.quoted_daily_rate || 0;
                if (autoType === 'date_range' && autoEndDate) {
                    const days = Math.max(1, Math.ceil((new Date(autoEndDate).getTime() - new Date(autoStartDate).getTime()) / (1000 * 3600 * 24)) + 1);
                    autoBill = Math.round(days * dailyRate);
                } else {
                    autoBill = Math.round(dailyRate);
                }
            }
        }

        // Reset service form with auto-filled data
        setServiceType(autoType);
        setServiceStartDate(autoStartDate);
        setServiceEndDate(autoEndDate);
        setServiceHours(autoHours);
        setCalculatedBill(autoBill);
    };

    const handleConfirmServicePeriod = async () => {
        if (!selectedWorker || !staffPickerTargetLead) return;

        setIsServicePeriodOpen(false);
        const toastId = toast.loading(`Creating assignment for ${selectedWorker.name || selectedWorker.full_name}...`);

        try {
            // Create the assignment + ID card link FIRST
            const result = await assignWorkerToClient(
                selectedWorker.id, 
                staffPickerTargetLead.id,
                undefined,
                0,   // depositPaid
                true, // skipWhatsApp
                {
                    startDate: serviceStartDate,
                    endDate: serviceType === 'date_range' ? serviceEndDate : undefined,
                    serviceType,
                    hoursPerDay: serviceHours,
                    totalBillAmount: calculatedBill
                }
            );

            // Store the result
            setAssignmentResult(result);
            
            // Open the WhatsApp modal with ID card link
            setAgentTargetLead(staffPickerTargetLead);
            setAgentTargetAction('staff');
            setIsEditingTemplate(false);

            const draft = generateWhatsappDraft(
                staffPickerTargetLead.name, 
                'staff', 
                agentDraftLang, 
                selectedWorker,
                result.shareableUrl
            );
            setAgentDraftText(draft);
            setIsAgentModalOpen(true);

            toast.success(
                `${selectedWorker.name || selectedWorker.full_name} assigned! Review the message below.`, 
                { id: toastId, duration: 3000 }
            );
        } catch (err: any) {
            console.error('Assignment creation failed:', err);
            toast.error(
                `Failed to create assignment: ${err.message}`, 
                { id: toastId }
            );
        }
    };

    const openClientInvoiceGenerator = async (lead: any) => {
        setClientInvoiceLead(lead);
        setCiLeadId(lead.id || '');
        const { data: asgn } = await supabase
            .from('worker_assignments')
            .select('*')
            .eq('client_id', lead.id)
            .eq('assignment_status', 'active')
            .maybeSingle();

        setCiRate(asgn?.client_billing_rate || parseInt(lead.quoted_monthly_rate?.replace(/[^0-9]/g, '') || '0') || 0);
        setCiDeposit(asgn?.deposit_amount || 0);
        const defaultStart = asgn?.start_date || '';
        setCiStartDate(defaultStart ? defaultStart.split('T')[0] : '');
        setCiEndDate(asgn?.end_date ? asgn.end_date.split('T')[0] : '');
        setCiDays(1);
        setCiAttendanceVerified(true);
        setIsClientInvoiceOpen(true);

        if (asgn?.employee_id && defaultStart) {
            supabase.from('attendance')
                .select('status, is_half_day')
                .eq('worker_id', asgn.employee_id)
                .gte('duty_date', defaultStart.split('T')[0])
                .then(({ data, error }) => {
                    if (error) console.error("Error fetching attendance:", error);
                    if (data && data.length > 0) {
                        const p = data.filter((a: any) => a.status === 'Present' || a.status === 'present').length;
                        const h = data.filter((a: any) => a.is_half_day).length;
                        setCiDays(p + h * 0.5 || 1);
                        setCiAttendanceVerified(true);
                    } else {
                        setCiDays(0);
                        setCiAttendanceVerified(false);
                    }
                });
        }
    };

    const openAgentModal = (lead: any, action: 'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing' | 'custom') => {
        if (action === 'quotation') {
            setQuotationTargetLead(lead);
            setIsQuotationModalOpen(true);
            return;
        }
        setAgentTargetLead(lead);
        setAgentTargetAction(action);
        setIsEditingTemplate(false);
        const draft = generateWhatsappDraft(lead.name, action, agentDraftLang, selectedWorker);
        setAgentDraftText(draft);
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetLead && !isEditingTemplate) {
            setAgentDraftText(generateWhatsappDraft(
                agentTargetLead.name, 
                agentTargetAction, 
                agentDraftLang, 
                selectedWorker,
                assignmentResult?.shareableUrl // pass real URL if available
            ));
        } else if (isEditingTemplate) {
            setTemplateDraftText(whatsappTemplates[agentTargetAction]?.[agentDraftLang] || '');
        }
    }, [agentDraftLang, agentTargetAction, agentTargetLead, whatsappTemplates, isEditingTemplate, selectedWorker, assignmentResult]);

    // Initialize per-call greeting status from DB and auto-trigger for the latest new call
    useEffect(() => {
        if (calls.length > 0) {
            const initialStatus: Record<string, 'sending' | 'sent' | 'error'> = {};
            
            calls.forEach((call: any) => {
                if (call.automation_error === 'GREETING_SENT') {
                    initialStatus[call.id] = 'sent';
                } else if (call.automation_error?.startsWith('GREETING_ERROR')) {
                    initialStatus[call.id] = 'error';
                }
            });

            // Update UI state with DB data
            setCallGreetingStatus(prev => ({ ...initialStatus, ...prev }));

            // Step 2: AUTO-TRIGGER — only for the SINGLE most recent ungreeted call.
            const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
            
            const targetCall = calls.find((call: any) => {
                const phone = (call.capturedWhatsapp || call.phone || '').toString();
                const digits = phone.replace(/\D/g, '');
                const isToday = new Date(call.created_at).toDateString() === new Date().toDateString();
                const callTime = new Date(call.created_at).getTime();
                const isRecent = callTime > fiveMinsAgo;
                
                // CRITICAL: Check local UI state + the mutex ref to avoid double-firing
                const alreadyHandled = !!callGreetingStatus[call.id] || processingCalls.current.has(call.id);
                const dbAlreadyLogged = !!call.automation_error;
                const lead = leads.find(l => l.id === call.lead_id);
                const isNewLead = !lead || ['New', 'New Lead', 'New Inquiry'].includes(lead.pipeline_stage);

                return digits.length >= 10 && isRecent && isToday && !dbAlreadyLogged && !alreadyHandled && isNewLead;
            });

            if (targetCall) {
                console.log(`[Auto-Greet] Triggering for: ${targetCall.id}`);
                handleSendCallGreeting(targetCall);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calls]);

    const handleSaveTemplate = () => {
        const updated = {
            ...whatsappTemplates,
            [agentTargetAction]: {
                ...whatsappTemplates[agentTargetAction],
                [agentDraftLang]: templateDraftText
            }
        };
        setWhatsappTemplates(updated);

        setIsEditingTemplate(false);
        toast.success("Default template saved successfully!");
    };

    // Helper to extract numeric values from strings like "₹45,000" or "1500/day"
    const parsePrice = (str: string) => {
        if (!str) return 0;
        const matched = str.replace(/[^\d]/g, '');
        return parseFloat(matched) || 0;
    };

    // Helper to dispatch WhatsApp templates programmatically
    const dispatchWhatsAppTemplate = async (lead: any, action: string, params?: string[], flowData?: any) => {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        let phoneDigits = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '');
        if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
        if (!phoneDigits) throw new Error("No phone number found.");
        
        const templateMap: Record<string, string> = {
            inquiry: 'post_call_intake',
            quotation: 'quote_client',
            consent: 'consent_form',
            deposit: 'deposit_request',
            staff: 'staff_assignment'
        };

        const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
                phone: phoneDigits,
                leadId: lead.id,
                leadName: lead.name?.split(/\s+/)[0] || 'there',
                useTemplate: true,
                templateName: templateMap[action],
                templateParams: params || (action === 'inquiry' ? buildLeadIntakePrefill(lead).templateParams : [lead.name.split(' ')[0] || 'there']),
                flowData: flowData || (action === 'inquiry' ? buildLeadIntakePrefill(lead).flowData : undefined),
            })
        });

        const resData = await response.json().catch(() => ({}));
        if (!response.ok || resData.success === false) {
            throw new Error(resData.error || `Dispatch failed: HTTP ${response.status}`);
        }
        return resData;
    };

    const handleDispatchQuotation = async (quotationData: any) => {
        setIsQuotationModalOpen(false);
        const toastId = toast.loading(`Sending quotation to ${quotationTargetLead.name}...`);
        
        try {
            // 1. Save to DB
            const { error: dbError } = await supabase.from('crm_quotations').insert({
                lead_id: quotationTargetLead.id,
                service_name: quotationData.serviceName,
                service_category: quotationData.serviceCategory,
                recipient_age_condition: quotationData.recipientCondition,
                hours_per_day: quotationData.hoursPerDay,
                days_per_week: quotationData.daysPerWeek,
                shift_type: quotationData.shiftType,
                start_date: quotationData.startDate || null,
                duration: quotationData.duration,
                complete_month_rate: quotationData.completeMonthRate,
                incomplete_month_rate: quotationData.incompleteMonthRate,
                setup_fee: quotationData.setupFee,
                deposit: quotationData.deposit,
                estimated_monthly_total: quotationData.estimatedTotal,
                inclusions: quotationData.inclusions,
                message_template: quotationData.messageTemplate,
                language: quotationData.language,
                custom_message: quotationData.customMessage,
                valid_until: quotationData.validUntil || null
            });

            if (dbError) throw dbError;

            // 2. Format Whatsapp message payload (Structured text)
            let msgText = `*SERVICE QUOTATION*\n`;
            msgText += `*${quotationData.serviceName}*\n`;
            if (quotationData.serviceCategory) msgText += `${quotationData.serviceCategory}\n\n`;
            
            if (quotationData.hoursPerDay) msgText += `Hours per day: ${quotationData.hoursPerDay} hrs - ${quotationData.shiftType}\n`;
            if (quotationData.daysPerWeek) msgText += `Days per week: ${quotationData.daysPerWeek} days\n`;
            if (quotationData.startDate) msgText += `Proposed start: ${new Date(quotationData.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}\n`;
            if (quotationData.duration) msgText += `Duration: ${quotationData.duration}\n`;
            
            msgText += `Rate (full month): ₹${quotationData.completeMonthRate} / day\n`;
            msgText += `Rate (partial month): ₹${quotationData.incompleteMonthRate} / day\n`;
            if (quotationData.deposit) msgText += `Deposit: ₹${quotationData.deposit}\n`;
            
            msgText += `\n*Estimated monthly total: ₹${quotationData.estimatedTotal} / mo*\n\n`;
            
            if (quotationData.inclusions && quotationData.inclusions.length > 0) {
                msgText += `*What is included*\n${quotationData.inclusions.join(', ')}\n\n`;
            }
            
            if (quotationData.customMessage) {
                msgText += `${quotationData.customMessage}\n`;
            }

            if (quotationData.validUntil) {
                msgText += `_This quote is valid until ${new Date(quotationData.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}_`;
            }

            // Meta template params cannot contain newlines or multiple spaces.
            // So we send the full formatted message as a standard text first,
            // then send the template with a summarized param to show the buttons.
            
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            // 1. Send full quotation as standard text (preserves newlines & formatting)
            await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    phone: quotationTargetLead.whatsapp_number || quotationTargetLead.phone,
                    message: msgText,
                    useTemplate: false,
                    leadId: quotationTargetLead.id
                })
            });

            // 2. Send the template with buttons using a newline-free summary
            const summaryParam = `Total Estimate: ₹${quotationData.estimatedTotal}/mo`;
            const templateLogText = `Hello, please find the quotation details for your care request below:\n${summaryParam}\nPlease use the buttons below to respond or schedule a follow-up. We look forward to assisting your family.`;

            const payload = {
                phone: quotationTargetLead.whatsapp_number || quotationTargetLead.phone,
                leadName: quotationTargetLead.name,
                message: templateLogText, // passed for logging so it looks accurate in CRM
                useTemplate: true,
                templateName: 'quote_client_v2',
                templateParams: [summaryParam],
                leadId: quotationTargetLead.id
            };

            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to send WhatsApp message');
            
            const data = await response.json();
            if (data.success === false) {
                throw new Error(data.error || 'Meta API rejected the message.');
            }

            // 3. Log Activity (stage is NOT changed here — it stays 'In Discussion'
            //    until the lead accepts the quote via WhatsApp or admin clicks 'Quotation Approved')
            await logActivity(
                quotationTargetLead.id,
                'quotation_sent',
                `Quotation dispatched via WhatsApp: ₹${quotationData.estimatedTotal}/mo for ${quotationData.serviceName}`
            );

            // 5. Update Lead Value in DB
            const { error: updateError } = await supabase
                .from('crm_leads')
                .update({ 
                    estimated_value_monthly: quotationData.estimatedTotal
                })
                .eq('id', quotationTargetLead.id);
                
            if (updateError) {
                console.error('Failed to update lead value:', updateError);
            }

            // 6. Auto-populate Service + Shift into notes so bubbles show on card
            const { data: existingLead } = await supabase.from('crm_leads').select('notes').eq('id', quotationTargetLead.id).single();
            const serviceEntry = `Service: ${quotationData.serviceName}${quotationData.shiftType ? `\nShift: ${quotationData.shiftType}` : ''}`;
            let updatedNotes = serviceEntry;
            if (existingLead?.notes) {
                // Replace old Service/Shift lines if present, otherwise prepend
                const hasServiceLine = /^Service:/m.test(existingLead.notes);
                if (!hasServiceLine) {
                    updatedNotes = `${serviceEntry}\n\n${existingLead.notes}`;
                } else {
                    // Leave existing notes untouched (already has service info)
                    updatedNotes = existingLead.notes;
                }
            }
            await supabase.from('crm_leads').update({ notes: updatedNotes }).eq('id', quotationTargetLead.id);

            // Sync UI: Update Lead Value, Notes and Activity Timeline
            if (selectedInspectorLead && selectedInspectorLead.id === quotationTargetLead.id) {
                setSelectedInspectorLead((prev: any) => ({ 
                    ...prev, 
                    estimated_value_monthly: quotationData.estimatedTotal,
                    valueAmount: quotationData.estimatedTotal,
                    value: '₹' + quotationData.estimatedTotal + '/mo',
                    notes: updatedNotes
                }));
                fetchLeadActivity(quotationTargetLead.id);
            }

            // Also update the main leads list
            setLeads(prev => prev.map(l => l.id === quotationTargetLead.id ? { 
                ...l, 
                estimated_value_monthly: quotationData.estimatedTotal,
                valueAmount: quotationData.estimatedTotal,
                value: '₹' + quotationData.estimatedTotal + '/mo',
                notes: updatedNotes 
            } : l));

            toast.success(`Quotation successfully sent!`, { id: toastId });
        } catch (error: any) {
            console.error('Quotation dispatch error:', error);
            toast.error(`Error: ${error.message}`, { id: toastId });
        }
    };

    const handleDispatchMessage = async () => {
        setIsAgentModalOpen(false);
        const toastId = toast.loading(`Dispatching AI Message to ${agentTargetLead?.name || 'Lead'}...`);

        try {
            let phoneDigits = '918000044090'; // Default to test number
            if (agentTargetLead) {
                const targetNumber = agentTargetLead.whatsapp_number || agentTargetLead.phone;
                console.log(`[Debug] Lead: ${agentTargetLead.name}, Raw Phone: ${agentTargetLead.phone}, Raw WhatsApp: ${agentTargetLead.whatsapp_number}`);
                
                if (targetNumber && targetNumber !== 'Unknown Number' && targetNumber !== 'Unknown') {
                    phoneDigits = targetNumber.replace(/\D/g, ''); 
                    if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
                } else {
                    toast.error(`⚠️ No valid number for ${agentTargetLead.name}. Falling back to test number.`, { id: toastId });
                }
            } else {
                toast.error("⚠️ No target lead selected!", { id: toastId });
            }

            console.log(`[Dispatch] Sending WhatsApp via Twilio API to ${agentTargetLead?.name}: +${phoneDigits}`);
            
            let finalLogMessage = agentDraftText;
            if (agentTargetAction === 'quotation') {
                finalLogMessage = `Quotation\n\nService Details for: ${quotationVars.v1}\n\nAs per your request, here are the details of the service:\n\n💰 Pricing Information\n${quotationVars.v2} Service\nFull Month: ₹${quotationVars.v3} per day\nFlexible Days: ₹${quotationVars.v4} per day\n\n🕒 Service Policy\n• 1 day leave: No replacement provided\n• More than 1 day leave: Replacement available (subject to availability)\n\n⚠️ Trial Policy\nIf the service is discontinued after a 2-day trial, charges will be same as Flexible Days rate.\n\nThis information is shared based on your inquiry. Please let us know if you need any further details.`;
            }

            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            let invoicePdfUrl = null;

            if (agentTargetAction === 'deposit' || agentTargetAction === 'billing') {
                toast.loading("Generating PDF Invoice...", { id: toastId });
                
                const formatDateStr = (dateStr: string) => {
                    if (!dateStr) return '';
                    const [y, m, d] = dateStr.split('-');
                    return `${d}/${m}/${y}`;
                };

                const formattedPeriod = (invoiceStartDate && invoiceEndDate)
                    ? `${formatDateStr(invoiceStartDate)} To ${formatDateStr(invoiceEndDate)}`
                    : 'As agreed';

                const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        lead_id: agentTargetLead?.id,
                        deposit_amount: invoiceDepositAmount || agentTargetLead?.quoted_monthly_rate || 15000,
                        service_period: formattedPeriod,
                        due_date: invoiceDueDate,
                        is_deposit: agentTargetAction === 'deposit'
                    })
                });

                if (!invResp.ok) {
                    const err = await invResp.text();
                    throw new Error(`Failed to generate invoice: ${err}`);
                }

                const invData = await invResp.json();
                invoicePdfUrl = invData.public_url;
                toast.loading("Sending via WhatsApp...", { id: toastId });
            }

            const inquiryPrefill = agentTargetAction === 'inquiry' && agentTargetLead
                ? buildLeadIntakePrefill(agentTargetLead)
                : null;

            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    phone: phoneDigits,
                    leadName: inquiryPrefill?.flowData?.name || agentTargetLead?.name?.split(/\s+/)[0] || 'there',
                    message: finalLogMessage,
                    leadId: agentTargetLead?.id,
                    sendInvoicePdf: agentTargetAction === 'deposit' || agentTargetAction === 'billing',
                    invoicePdfUrl: invoicePdfUrl,
                    useTemplate: agentTargetAction !== 'custom' && (agentTargetAction === 'inquiry' || agentTargetAction === 'quotation' || agentTargetAction === 'consent' || agentTargetAction === 'deposit' || agentTargetAction === 'staff'),
                    templateName: agentTargetAction === 'inquiry' ? 'post_call_intake' 
                                  : (agentTargetAction === 'quotation' ? 'quote_client_v2' 
                                  : (agentTargetAction === 'consent' ? 'consent_form' 
                                  : (agentTargetAction === 'deposit' ? 'deposit_request' 
                                  : (agentTargetAction === 'staff' ? 'staff_assignment' : undefined)))),
                    templateParams: agentTargetAction === 'quotation' 
                                    ? [finalLogMessage.replace(/\n+/g, ' | ')] 
                                    : agentTargetAction === 'staff'
                                    ? [
                                        selectedWorker?.full_name || selectedWorker?.name || 'Your Care Professional',
                                        selectedWorker?.job_title || 'Care Staff',
                                        assignmentResult?.shareableUrl || ''
                                      ]
                                    : agentTargetAction === 'inquiry' && inquiryPrefill
                                    ? inquiryPrefill.templateParams
                                    : (agentTargetAction === 'consent' ? [(agentTargetLead?.name || 'there')] : agentTargetAction === 'deposit' || agentTargetAction === 'billing' ? [(agentTargetLead?.name || 'there'), String(invoiceDepositAmount || '')] : undefined),
                    flowData: inquiryPrefill?.flowData,
                })
            });

            const textRes = await response.text().catch(() => '');
            let resData: any = {};
            try { resData = textRes ? JSON.parse(textRes) : {}; } catch(e) {}
            
            if (!response.ok || resData.success === false) {
                let errMsg = response.statusText;
                
                if (resData.error && typeof resData.error === 'object') {
                    errMsg = resData.error.message || resData.error.error_user_title || "Unknown API Error";
                } else if (typeof resData.error === 'string') {
                    errMsg = resData.error;
                } else if (resData.message) {
                    errMsg = resData.message;
                } else if (resData.details?.message) {
                    errMsg = resData.details.message;
                }

                throw new Error(errMsg.trim());
            }

            // Post-dispatch pipeline advancement
            if (agentTargetLead) {
                // If Inquiry -> move to In Discussion
                if (agentTargetAction === 'inquiry') {
                    await handleMoveLead(agentTargetLead.id, 'In Discussion');
                    toast.success(`Greeting dispatched! Moved ${agentTargetLead.name} to In Discussion.`, { id: toastId, duration: 4000 });
                }
                // If it was quotations -> move to Quotation Sent and SAVE the rates for auto-estimation later
                else if (agentTargetAction === 'quotation') {
                    const monthlyRate = parsePrice(quotationVars.v3);
                    const dailyRate = parsePrice(quotationVars.v4);

                    await supabase.from('crm_leads').update({
                        pipeline_stage: 'Quotation Sent',
                        estimated_value_monthly: monthlyRate // Primary lead value
                    }).eq('id', agentTargetLead.id);

                    await logActivity(agentTargetLead.id, 'quotation_sent', `Quotation sent: ₹${monthlyRate}/mo`);
                    toast.success(`Quotation sent! Moved ${agentTargetLead.name} to Quotation Sent and saved pricing for auto-estimation.`, { id: toastId, duration: 4000 });
                }
                else if (agentTargetAction === 'consent') {
                    await logActivity(agentTargetLead.id, 'consent_sent', 'Consent form link sent');
                    toast.success(`Consent Form dispatched to ${agentTargetLead.name}!`, { id: toastId, duration: 4000 });
                }
                // If staff assignment -> move to Staff Assigned
                else if (agentTargetAction === 'staff' && (selectedWorker || agentTargetLead.assigned_staff)) {
                    await handleMoveLead(agentTargetLead.id, 'Staff Assigned');
                    
                    if (selectedWorker && assignmentResult) {
                        // Assignment was already created in confirmWorkerSelection
                        // The WhatsApp message (with real ID card link) was just dispatched above
                        toast.success(
                            `✅ ${selectedWorker.name || selectedWorker.full_name} assigned to ${agentTargetLead.name}! ID card link sent via WhatsApp.`, 
                            { id: toastId, duration: 6000 }
                        );
                        // Clean up
                        setAssignmentResult(null);
                    } else {
                        toast.success(`Staff assignment updated locally!`, { id: toastId, duration: 4000 });
                    }
                    setSelectedWorker(null);
                }
                // If Deposit Invoice -> move to Deposit Pending
                else if (agentTargetAction === 'deposit') {
                    if (invoicePdfUrl) {
                        await supabase
                            .from('worker_assignments')
                            .update({
                                deposit_invoice_sent: true,
                                invoice_pdf_url: invoicePdfUrl
                            })
                            .eq('client_id', agentTargetLead.id)
                            .eq('assignment_status', 'active');
                    }
                    await handleMoveLead(agentTargetLead.id, 'Deposit Pending');
                    toast.success(`Deposit Invoice dispatched! Moved ${agentTargetLead.name} to Deposit Pending.`, { id: toastId, duration: 4000 });
                }
                else if (agentTargetAction === 'billing') {
                    if (invoicePdfUrl) {
                        await supabase
                            .from('worker_assignments')
                            .update({
                                invoice_pdf_url: invoicePdfUrl
                            })
                            .eq('client_id', agentTargetLead.id)
                            .eq('assignment_status', 'active');
                    }
                    await handleMoveLead(agentTargetLead.id, 'Monthly Billing');
                    toast.success(`Billing Invoice dispatched! Moved ${agentTargetLead.name} to Monthly Billing.`, { id: toastId, duration: 4000 });
                }
                // Default acknowledgment
                else {
                    toast.success(`WhatsApp message delivered to +${phoneDigits}!`, { id: toastId, duration: 4000 });
                }
                
                fetchDeliveryLogs();
            }

        } catch (error: any) {
            console.error('Dispatch error:', error);
            toast.error(error.message || 'Error pushing to WhatsApp Cloud API', { id: toastId });
        }
    };

    const handleExportLeadsToCSV = () => {
        if (!leads || leads.length === 0) {
            toast.error("No leads available to export.");
            return;
        }

        const headers = ["ID", "Name", "Phone", "Email", "Source", "Status", "Pipeline Stage", "Est. Monthly Value"];
        const rows = leads.map(l => [
            l.id,
            l.name,
            l.phone || "",
            l.email || "",
            l.source || "",
            l.status || "",
            l.pipeline_stage || "",
            `INR ${l.estimated_value_monthly || 0}`
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `CRM_Leads_Pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Leads pipeline exported successfully!");
    };

    // Fetch leads from Supabase and Subscribe to Realtime Updates
    useEffect(() => {
        fetchLeads();
        // Also load all workers for Staff Picker Modal
        supabase.from('employees').select('id, full_name, job_title').then(({ data }) => {
            if (data && data.length > 0) setAllWorkers(data.map(w => ({ ...w, name: w.full_name || '', role: w.job_title || '' })));
        });

        // Enable real-time magic for AI Pipeline Automation
        const subscription = supabase
            .channel('crm_leads_ai_updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'crm_leads' },
                (payload) => {
                    const newLead = payload.new as any;
                    // Merge the updated lead directly — preserves assigned_worker_name from DB
                    setLeads(prev => prev.map(lead => lead.id === newLead.id ? { ...lead, ...newLead } : lead));
                    
                    // Trigger a toast notification if the AI moved the lead
                    const oldLead = payload.old as any;
                    if (oldLead && newLead.pipeline_stage !== oldLead.pipeline_stage) {
                        toast.success(`🤖 AI Agent moved ${newLead.name} to "${newLead.pipeline_stage}"!`);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'crm_leads' },
                (payload) => {
                    setLeads(prev => [payload.new as any, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const handleMoveLead = async (id: string, newStage: string) => {
        // If this is a hardcoded mock lead (ID length < 10), move and return
        if (id.length < 10) {
            setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, pipeline_stage: newStage } : lead));
            toast.info(`Mock lead moved to ${newStage}`);
            return;
        }

        const toastId = toast.loading(`Moving lead to "${newStage}"...`);

        try {
            // ── Guard: Require staff assignment before advancing to staff stages ──────
            const staffRequiredStages = ['Staff Assigned', 'Deposit Pending', 'Active Client'];
            if (staffRequiredStages.includes(newStage)) {
                const { data: activeAssignment } = await supabase
                    .from('worker_assignments')
                    .select('id')
                    .eq('client_id', id)
                    .eq('assignment_status', 'active')
                    .maybeSingle();

                if (!activeAssignment) {
                    toast.error(
                        `Cannot move to "${newStage}" — please assign a staff member first using the "Assign Staff Member" button.`,
                        { id: toastId, duration: 5000 }
                    );
                    return;
                }
            }

            // Rule: Automatic staff release if moved to pre-assignment stages
            const preAssignmentStages = ['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted'];
            if (preAssignmentStages.includes(newStage)) {
                try {
                    await releaseWorkerByClientId(id);
                } catch (err) {
                    console.error("Auto-release worker failed:", err);
                }
            }


            const { error } = await supabase
                .from('crm_leads')
                .update({ pipeline_stage: newStage })
                .eq('id', id);

            if (error) throw error;
            
            // Sync UI only after database confirms
            setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, pipeline_stage: newStage } : lead));
            if (selectedInspectorLead && selectedInspectorLead.id === id) {
                const oldStage = selectedInspectorLead.pipeline_stage;
                setSelectedInspectorLead((prev: any) => ({ ...prev, pipeline_stage: newStage }));
                
                // Log the movement activity
                await logActivity(id, 'stage_changed', `Pipeline moved: ${oldStage} → ${newStage}`, { from: oldStage, to: newStage });
                fetchLeadActivity(id);
            } else {
                // Still log even if not selected in inspector
                await logActivity(id, 'stage_changed', `Pipeline moved to ${newStage}`, { to: newStage });
            }

            toast.success(`Pipeline state updated successfully!`, { id: toastId });
            
            // Background refresh to ensure full consistency (assigned worker names, etc)
            fetchLeads();
        } catch (error: any) {
            console.error("Error updating lead stage:", error);
            toast.error(`Persistence Error: ${error.message}. Change reverted.`, { id: toastId });
            fetchLeads(); // Force re-fetch to restore correct state
        }
    };

    const handleDeleteLead = async (leadId: string, leadName: string) => {
        // Show choice modal instead of window.confirm
        setDeleteChoiceModal({ id: leadId, name: leadName });
        setSelectedInspectorLead(null);
    };

    const handleMoveToTrash = async (leadId: string, leadName: string) => {
        setDeleteChoiceModal(null);
        if (leadId.length < 10) {
            setLeads(prev => prev.filter(l => l.id !== leadId));
            toast.success(`Lead "${leadName}" removed.`);
            return;
        }
        const toastId = toast.loading(`Moving "${leadName}" to Trash...`);
        try {
            const { error } = await supabase
                .from('crm_leads')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', leadId);
            if (error) throw error;
            setLeads(prev => prev.filter(l => l.id !== leadId));
            toast.success(`"${leadName}" moved to Trash. Recoverable for 30 days.`, { id: toastId });
        } catch (err: any) {
            toast.error(`Failed to trash lead: ${err.message}`, { id: toastId });
        }
    };

    const handleDeletePermanently = async (leadId: string, leadName: string) => {
        setDeleteChoiceModal(null);
        if (leadId.length < 10) {
            setLeads(prev => prev.filter(l => l.id !== leadId));
            setTrashedLeads(prev => prev.filter(l => l.id !== leadId));
            toast.success(`Lead "${leadName}" deleted permanently.`);
            return;
        }
        const toastId = toast.loading(`Permanently deleting "${leadName}"...`);
        try {
            const { data, error: rpcError } = await supabase.rpc('delete_crm_lead_robust', { target_lead_id: leadId });
            if (rpcError) throw new Error(rpcError.message);
            if (data && data.success === false) throw new Error(data.error || 'Deletion blocked by database.');
            setLeads(prev => prev.filter(l => l.id !== leadId));
            setTrashedLeads(prev => prev.filter(l => l.id !== leadId));
            toast.success(`"${leadName}" deleted permanently.`, { id: toastId });
        } catch (err: any) {
            toast.error(`Deletion Failed: ${err.message}`, { id: toastId, duration: 6000 });
        }
    };

    const handleRestoreLead = async (lead: any) => {
        const toastId = toast.loading(`Restoring "${lead.name}"...`);
        try {
            const { error } = await supabase
                .from('crm_leads')
                .update({ deleted_at: null })
                .eq('id', lead.id);
            if (error) throw error;
            setTrashedLeads(prev => prev.filter(l => l.id !== lead.id));
            setLeads(prev => [{ ...lead, deleted_at: null }, ...prev]);
            toast.success(`"${lead.name}" restored to ${lead.pipeline_stage}.`, { id: toastId });
        } catch (err: any) {
            toast.error(`Restore failed: ${err.message}`, { id: toastId });
        }
    };

    const sendReviewRequest = async (lead: any) => {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const toastId = toast.loading(`Sending review request to ${lead.name}...`);
        try {
            let phoneDigits = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '');
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
            if (!phoneDigits) throw new Error('No phone number on file for this client.');

            const resp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({
                    phone: phoneDigits,
                    leadId: lead.id,
                    useTemplate: true,
                    templateName: 'client_review_request',
                    templateParams: [lead.name?.split(' ')[0] || 'there'],
                })
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.error || 'WhatsApp dispatch failed');
            await logActivity(lead.id, 'review_requested', `Review request sent to ${lead.name}`);
            toast.success(`Review request sent to ${lead.name}! ✅`, { id: toastId, duration: 4000 });
        } catch (err: any) {
            toast.error(err.message || 'Failed to send review request', { id: toastId });
        }
    };

    const handleEmptyTrash = async () => {
        if (trashedLeads.length === 0) return;
        const toastId = toast.loading(`Permanently deleting ${trashedLeads.length} lead(s)...`);
        try {
            await Promise.all(trashedLeads.map(l =>
                supabase.rpc('delete_crm_lead_robust', { target_lead_id: l.id })
            ));
            setTrashedLeads([]);
            toast.success('Trash emptied. All leads permanently deleted.', { id: toastId });
        } catch (err: any) {
            toast.error(`Failed to empty trash: ${err.message}`, { id: toastId });
        }
    };

    const activeStages = activeTab === 'clients' ? clientStages : pipelineStages;
    const setActiveStages = activeTab === 'clients' ? setClientStages : setPipelineStages;

    const handleAddStage = () => {
        if (newStageName.trim() && !activeStages.includes(newStageName.trim())) {
            const nextStages = [...activeStages, newStageName.trim()];
            setActiveStages(nextStages);
            
            // Sync to cloud
            const p = activeTab === 'clients' ? pipelineStages : nextStages;
            const c = activeTab === 'clients' ? nextStages : clientStages;
            syncStagesToCloud(p, c);

            setNewStageName('');
            setIsAddingStage(false);
            toast.success(`Stage "${newStageName.trim()}" added!`);
        }
    };

    const handleDeleteStage = (stageToDelete: string, idx: number) => {
        if (PROTECTED_STAGES.includes(stageToDelete)) {
            toast.error(`Cannot delete protected stage: ${stageToDelete}`);
            return;
        }

        // Ensure no leads are in this stage before deleting
        const leadsInStage = leads.filter(l => l.pipeline_stage === stageToDelete).length;
        if (leadsInStage > 0) {
            toast.error(`Cannot delete stage. Please move ${leadsInStage} leads to another stage first.`);
            return;
        }

        if (window.confirm(`Are you sure you want to delete the "${stageToDelete}" stage?`)) {
            const newStages = [...activeStages];
            newStages.splice(idx, 1);
            setActiveStages(newStages);

            // Sync to cloud
            const p = activeTab === 'clients' ? pipelineStages : newStages;
            const c = activeTab === 'clients' ? newStages : clientStages;
            syncStagesToCloud(p, c);

            toast.success(`Stage "${stageToDelete}" deleted successfully.`);
        }
    };

    const handleRenameStage = (oldName: string, idx: number) => {
        if (!editingStageName.trim() || editingStageName.trim() === oldName) {
            setEditingStageIdx(null);
            return;
        }
        if (activeStages.includes(editingStageName.trim())) {
            toast.error('A stage with this name already exists.');
            return;
        }

        // Update stage in list
        const newStages = [...activeStages];
        newStages[idx] = editingStageName.trim();
        setActiveStages(newStages);

        // Sync to cloud
        const p = activeTab === 'clients' ? pipelineStages : newStages;
        const c = activeTab === 'clients' ? newStages : clientStages;
        syncStagesToCloud(p, c);

        // Update all leads currently in this stage (optimistic)
        setLeads(prev => prev.map(l => l.pipeline_stage === oldName ? { ...l, pipeline_stage: editingStageName.trim() } : l));

        // Note: Update all leads in DB to match the new stage naming
        const syncLeadsInDB = async () => {
            try {
                const { error } = await supabase
                    .from('crm_leads')
                    .update({ pipeline_stage: editingStageName.trim() })
                    .eq('pipeline_stage', oldName);
                if (error) throw error;
                toast.success(`Updated leads in database to match "${editingStageName.trim()}"`);
            } catch (err) {
                console.error("Failed to sync leads to renamed stage:", err);
            }
        };
        syncLeadsInDB();

        setEditingStageIdx(null);
        toast.success(`Stage renamed to "${editingStageName.trim()}"`);
    };

    const handleSlideStage = (idx: number, direction: 'left' | 'right') => {
        if ((direction === 'left' && idx === 0) || (direction === 'right' && idx === activeStages.length - 1)) return;

        const newStages = [...activeStages];
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;

        // Swap
        const temp = newStages[idx];
        newStages[idx] = newStages[targetIdx];
        newStages[targetIdx] = temp;

        setActiveStages(newStages);

        // Sync to cloud
        const p = activeTab === 'clients' ? pipelineStages : newStages;
        const c = activeTab === 'clients' ? newStages : clientStages;
        syncStagesToCloud(p, c);
    };

    // Compute duplicate phone numbers so we can warn the user
    const phoneCounts = leads.reduce((acc, l) => {
        const p = (l.whatsapp_number || l.phone || '').replace(/\D/g, '').slice(-10);
        if (p && p.length === 10) {
            acc[p] = (acc[p] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // Organize leads into columns based on active tab
    const columns = activeStages.map(stage => ({
        title: stage,
        count: leads.filter(l => l.pipeline_stage === stage).length,
        items: leads.filter(l => l.pipeline_stage === stage).map(l => {
            const p = (l.whatsapp_number || l.phone || '').replace(/\D/g, '').slice(-10);
            
            // Extract latest quote dates
            let plannedStart = null;
            let plannedDuration = null;
            if (l.crm_quotations && l.crm_quotations.length > 0) {
                const latestQuote = [...l.crm_quotations].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                plannedStart = latestQuote.start_date;
                plannedDuration = latestQuote.duration;
            }

            return {
                ...l,
                time: new Date(l.created_at).toLocaleDateString(),
                valueAmount: l.estimated_value_monthly,
                value: l.estimated_value_monthly ? "₹" + l.estimated_value_monthly + "/mo" : "₹0/mo",
                priority: l.priority || 'medium',
                isDuplicate: p && p.length === 10 ? phoneCounts[p] > 1 : false,
                plannedStart,
                plannedDuration
            };
        })
    }));

    const handleUpdateLeadValue = async (leadId: string) => {
        const newValue = parseInt(editingLeadValueAmount.replace(/\D/g, ''), 10);

        if (isNaN(newValue)) {
            setEditingLeadValueId(null);
            return;
        }

        // Optimistic update
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, estimated_value_monthly: newValue } : l));
        setEditingLeadValueId(null);

        // Supabase update if not mock lead
        if (leadId.length >= 10) {
            try {
                const { error } = await supabase
                    .from('crm_leads')
                    .update({ estimated_value_monthly: newValue })
                    .eq('id', leadId);

                if (error) throw error;
                toast.success('Lead value updated');
            } catch (err: any) {
                console.error("Error updating lead value", err);
                toast.error("Failed to update lead value");
                fetchLeads(); // revert
            }
        } else {
            toast.success('Lead value updated (Mock lead)');
        }
    };

    const handleUpdateLeadDetails = async (leadId: string, customName?: string, customPhone?: string) => {
        const newName = (customName !== undefined ? customName : editingLeadName).trim();
        const newPhone = (customPhone !== undefined ? customPhone : editingLeadPhone).trim();

        if (!newName) {
            setEditingLeadDetailsId(null);
            return;
        }

        // Optimistic update
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, name: newName, phone: newPhone || null, whatsapp_number: newPhone || null } : l));
        setEditingLeadDetailsId(null);

        if (leadId.length >= 10) {
            try {
                const { error } = await supabase
                    .from('crm_leads')
                    .update({ name: newName, phone: newPhone || null, whatsapp_number: newPhone || null })
                    .eq('id', leadId);

                if (error) throw error;
                toast.success('Lead details updated');
            } catch (err: any) {
                console.error("Error updating lead details", err);
                toast.error("Failed to update details");
                fetchLeads(); // revert
            }
        }
    };

    const handleUpdatePriority = async (leadId: string, newPriority: string) => {
        // If mock lead, handle locally and return
        if (leadId.length < 10) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, priority: newPriority } : l));
            toast.success('Mock priority updated');
            return;
        }

        const toastId = toast.loading('Updating priority...');
        try {
            const { error } = await supabase.from('crm_leads').update({ priority: newPriority }).eq('id', leadId);
            if (error) throw error;
            
            // Sync UI only after database confirms
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, priority: newPriority } : l));
            toast.success('Priority updated permanently', { id: toastId });
        } catch (err: any) {
            console.error("Persistence error (priority):", err);
            toast.error(`Fail to persist priority: ${err.message}`, { id: toastId });
            fetchLeads(); // revert
        }
    };

    const convertToClient = async (leadId: string, leadName: string) => {
        if (!window.confirm(`Convert "${leadName}" to a Client Master entry?\n\nThis will:\n• Create a permanent client record\n• Move the lead to Closed Won\n• Keep the full history`)) return;

        const toastId = toast.loading(`Converting ${leadName} to Client Master...`);
        try {
            const lead = leads.find(l => l.id === leadId);

            // 1. Create entry in clients table (used by Billing, HR assignments)
            const { error: clientError } = await supabase.from('clients').insert([{
                id: leadId, // Use same UUID so worker_assignments can link by client_id
                client_name: leadName,
                phone_number: lead?.phone || lead?.whatsapp_number || null,
                email: lead?.email || null,
            }]);

            // Ignore duplicate key error — client may already exist
            if (clientError && !clientError.message.includes('duplicate') && !clientError.message.includes('unique')) {
                throw new Error(clientError.message);
            }

            // 2. Move lead to Closed Won
            const { error: stageError } = await supabase
                .from('crm_leads')
                .update({ pipeline_stage: 'Closed Won' })
                .eq('id', leadId);
            if (stageError) throw new Error(stageError.message);

            // 3. Log the conversion
            await logActivity(leadId, 'converted_to_client', `${leadName} converted to Client Master`, { lead_id: leadId });

            // 4. Update local state
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: 'Closed Won' } : l));

            toast.success(`${leadName} is now a Client Master! ✅`, { id: toastId, duration: 4000 });
        } catch (err: any) {
            console.error('Conversion failed:', err);
            toast.error(`Conversion failed: ${err.message}`, { id: toastId });
        }
    };

    type VoiceCallSnapshot = {
        id: string | number;
        phone?: string;
        capturedName?: string;
        capturedWhatsapp?: string;
        capturedValue?: number;
    };

    const resolveVoiceCallPhone = (call: VoiceCallSnapshot) => {
        const leadPhone = !call.phone || call.phone === 'Unknown Number' ? '' : call.phone;
        const leadWhatsapp =
            !call.capturedWhatsapp || call.capturedWhatsapp === 'Unknown Number' ? '' : call.capturedWhatsapp;
        return { leadPhone, leadWhatsapp, phoneForLookup: leadPhone || leadWhatsapp };
    };

    const createLeadFromVoiceCall = async (
        call: VoiceCallSnapshot,
        opts?: { duplicateOfId?: string; skipReturningCheck?: boolean }
    ) => {
        const { leadPhone, leadWhatsapp, phoneForLookup } = resolveVoiceCallPhone(call);

        if (!opts?.skipReturningCheck && phoneLast10(phoneForLookup).length >= 8) {
            try {
                const existingClient = await findClientMasterByPhone(supabase, phoneForLookup);
                if (existingClient) {
                    setReturningClientModal({
                        phone: phoneForLookup,
                        name: call.capturedName || 'Voice Lead',
                        existingClient,
                        pendingLeadData: {
                            kind: 'voice',
                            callSnapshot: {
                                id: call.id,
                                phone: call.phone,
                                capturedName: call.capturedName,
                                capturedWhatsapp: call.capturedWhatsapp,
                                capturedValue: call.capturedValue,
                            },
                        },
                    });
                    return;
                }
            } catch (lookupErr: any) {
                console.warn('Client master lookup failed:', lookupErr?.message || lookupErr);
            }
        }

        const toastId = toast.loading('Adding lead to pipeline…');
        try {
            const standardized = normalizePhoneDigits(leadWhatsapp || leadPhone);
            const { data: newLead, error } = await supabase
                .from('crm_leads')
                .insert([
                    {
                        name: call.capturedName || 'Voice Lead',
                        phone: leadPhone || null,
                        whatsapp_number: standardized || leadWhatsapp || null,
                        source: opts?.duplicateOfId ? 'AI Phone Call (Returning)' : 'AI Phone Call',
                        status: 'AI Handled',
                        pipeline_stage: NEW_LEAD_PIPELINE_STAGE,
                        estimated_value_monthly: Number(call.capturedValue) || 0,
                        ...(opts?.duplicateOfId ? { duplicate_of_lead_id: opts.duplicateOfId } : {}),
                    },
                ])
                .select('*')
                .single();

            if (error) throw error;

            if (newLead?.id && call.id) {
                const { error: transcriptErr } = await supabase.from('call_transcripts').upsert(
                    {
                        conversation_id: String(call.id),
                        lead_id: newLead.id,
                        phone_number: leadPhone || standardized || null,
                        called_at: new Date().toISOString(),
                    },
                    { onConflict: 'conversation_id' }
                );
                if (transcriptErr) console.warn('call_transcripts upsert:', transcriptErr.message);

                const activityMsg = opts?.duplicateOfId
                    ? 'Returning client — voice lead linked to existing client record'
                    : 'Lead created from AI phone call';
                await logActivity(newLead.id, 'lead_created', activityMsg, {
                    source: 'AI Phone Call',
                    call_id: String(call.id),
                    ...(opts?.duplicateOfId ? { client_id: opts.duplicateOfId } : {}),
                });
            }

            setCalls((prev) =>
                prev.map((c) =>
                    String(c.id) === String(call.id)
                        ? { ...c, status: 'Processed', lead_id: newLead?.id ?? c.lead_id }
                        : c
                )
            );
            setLeads((prev) => [newLead, ...prev.filter((l) => l.id !== newLead.id)]);
            fetchLeads();
            setActiveTab('pipeline');
            setSelectedInspectorLead(newLead);
            toast.success(`Added ${call.capturedName || 'Lead'} to ${NEW_LEAD_PIPELINE_STAGE}!`, { id: toastId });
        } catch (error: any) {
            console.error('Error creating lead from call:', error);
            toast.error(`Failed to create lead: ${error.message}`, { id: toastId });
            throw error;
        }
    };

    const captureCallAsLead = async (callId: string | number) => {
        const call = calls.find((c) => String(c.id) === String(callId));
        if (!call) {
            toast.error('Call not found. Refresh Voice AI and try again.');
            return;
        }
        setCapturingCallId(callId);
        try {
            await createLeadFromVoiceCall(call);
        } catch {
            /* toast shown in createLeadFromVoiceCall */
        } finally {
            setCapturingCallId(null);
        }
    };

    const checkAddLeadDuplicate = async (phone: string) => {
        if (!phone || phone.replace(/\D/g, '').length < 8) {
            setAddLeadDuplicateWarning(null);
            return;
        }
        setAddLeadCheckingDuplicate(true);
        const last10 = phoneLast10(phone);
        const { data } = await supabase
            .from('crm_leads')
            .select('id, name, pipeline_stage, whatsapp_number, phone, deleted_at')
            .is('deleted_at', null)
            .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);
        setAddLeadCheckingDuplicate(false);

        const matches = (data || []).filter(
            (l) => phonesMatch(l.phone, phone) || phonesMatch(l.whatsapp_number, phone)
        );

        // Stale ghost in legacy "New Lead" stage (hidden from pipeline after permanent delete)
        const legacyOnly = matches.filter((l) => isLegacyPipelineStage(l.pipeline_stage));
        if (legacyOnly.length > 0 && legacyOnly.length === matches.length) {
            for (const ghost of legacyOnly) {
                await supabase.rpc('delete_crm_lead_robust', { target_lead_id: ghost.id });
            }
            setAddLeadDuplicateWarning(null);
            toast.success(
                legacyOnly.length === 1
                    ? `Removed hidden stale record (${legacyOnly[0].name}). You can add this lead now.`
                    : `Removed ${legacyOnly.length} hidden stale records. You can add this lead now.`
            );
            fetchLeads();
            return;
        }

        const match = matches.find((l) => isPipelineVisibleLead(l, pipelineStages, clientStages));
        if (match) {
            setAddLeadDuplicateWarning(match);
            setAddLeadConfirmDuplicate(false);
        } else {
            setAddLeadDuplicateWarning(null);
        }
    };

    const handleAddManualLead = async (opts?: { name: string; phone: string; isDuplicate?: boolean; duplicateOfId?: string; skipReturningCheck?: boolean }) => {
        const leadName = opts?.name?.trim() || 'New Lead';
        const leadPhone = opts?.phone?.trim() || '';
        const standardized = normalizePhoneDigits(leadPhone);

        // Check if this phone belongs to an existing client (returning client detection)
        if (!opts?.skipReturningCheck && phoneLast10(leadPhone).length >= 8) {
            const existingClient = await findClientMasterByPhone(supabase, leadPhone);

            if (existingClient) {
                setReturningClientModal({
                    phone: leadPhone,
                    name: leadName,
                    existingClient,
                    pendingLeadData: {
                        name: leadName,
                        phone: leadPhone,
                        isDuplicate: opts?.isDuplicate,
                        duplicateOfId: opts?.duplicateOfId,
                    },
                });
                setIsAddLeadModalOpen(false);
                return; // Wait for user choice on returning-client modal
            }
        }

        try {
            const { data: newLead, error } = await supabase.from('crm_leads').insert([{
                name: leadName,
                phone: leadPhone || null,
                whatsapp_number: standardized || null,
                source: 'Manual Add',
                status: 'New',
                pipeline_stage: NEW_LEAD_PIPELINE_STAGE,
                estimated_value_monthly: 0,
                is_duplicate: opts?.isDuplicate || false,
                duplicate_of_lead_id: opts?.duplicateOfId || null,
            }]).select('*').single();
            
            if (error) throw error;
            if (newLead?.id) {
                await logActivity(newLead.id, 'lead_created', opts?.isDuplicate ? 'Lead created manually (duplicate confirmed by staff)' : 'Lead created manually', { source: 'Manual Add' });
            }
            toast.success(`Lead "${leadName}" created!`);
            setIsAddLeadModalOpen(false);
            setReturningClientModal(null);
            setAddLeadName('');
            setAddLeadPhone('');
            setAddLeadDuplicateWarning(null);
            setAddLeadConfirmDuplicate(false);
            if (newLead) setSelectedInspectorLead(newLead);
            fetchLeads();
        } catch (err: any) {
            toast.error("Failed to add lead: " + err.message);
            setAddLeadName(leadName);
            setAddLeadPhone(leadPhone);
            setIsAddLeadModalOpen(true);
        }
    };

    const handleReturningClientNewLead = async () => {
        if (!returningClientModal) return;
        const { pendingLeadData } = returningClientModal;
        setReturningClientModal(null);
        if (pendingLeadData?.kind === 'voice' && pendingLeadData.callSnapshot) {
            await createLeadFromVoiceCall(pendingLeadData.callSnapshot, { skipReturningCheck: true });
            return;
        }
        await handleAddManualLead({
            name: pendingLeadData?.name || returningClientModal.name,
            phone: pendingLeadData?.phone || returningClientModal.phone,
            isDuplicate: pendingLeadData?.isDuplicate,
            duplicateOfId: pendingLeadData?.duplicateOfId,
            skipReturningCheck: true,
        });
    };

    const handleReturningClientLink = async () => {
        if (!returningClientModal) return;
        const { phone, name, existingClient, pendingLeadData } = returningClientModal;
        setReturningClientModal(null);
        if (pendingLeadData?.kind === 'voice' && pendingLeadData.callSnapshot) {
            await createLeadFromVoiceCall(pendingLeadData.callSnapshot, {
                skipReturningCheck: true,
                duplicateOfId: existingClient.id,
            });
            return;
        }
        const standardized = normalizePhoneDigits(phone);
        try {
            const { data: newLead, error } = await supabase.from('crm_leads').insert([{
                name: name || existingClient.client_name,
                phone: phone || null,
                whatsapp_number: standardized || null,
                source: 'Manual Add (Returning)',
                status: 'New',
                pipeline_stage: NEW_LEAD_PIPELINE_STAGE,
                estimated_value_monthly: 0,
                duplicate_of_lead_id: existingClient.id,
            }]).select('*').single();
            if (error) throw error;
            if (newLead?.id) {
                await logActivity(newLead.id, 'lead_created', `Returning client — linked to existing client record: ${existingClient.client_name}`, { source: 'Returning Client', client_id: existingClient.id });
            }
            toast.success(`New lead created and linked to ${existingClient.client_name}'s client record! ✅`);
            setIsAddLeadModalOpen(false);
            setAddLeadName('');
            setAddLeadPhone('');
            setAddLeadDuplicateWarning(null);
            setAddLeadConfirmDuplicate(false);
            if (newLead) setSelectedInspectorLead(newLead);
            fetchLeads();
        } catch (err: any) {
            toast.error("Failed: " + err.message);
            setIsAddLeadModalOpen(true);
        }
    };

    // Helper to standardize phone number display
    const formatPhoneNumber = (num: string) => {
        if (!num) return '';
        const digits = num.replace(/\D/g, '');
        if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
        if (digits.startsWith('91') && digits.length === 12) {
            return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
        }
        return `+${digits}`; // Fallback for other countries or malformed numbers
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans'] tracking-tight">AI CRM Center</h1>
                        <p className="text-sm text-slate-500 font-medium font-bold">AI-Powered Management</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Notification Bell */}
                    <div className="relative z-50">
                        <button 
                            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                            className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all relative group shadow-sm"
                        >
                            <Bot className="w-6 h-6 group-hover:scale-110 transition-transform text-primary" />
                            <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
                        </button>
                        
                        {isNotificationsOpen && (
                            <div className="absolute right-0 sm:right-0 -right-4 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="font-bold text-slate-900 text-sm">AI Agent Activity</h3>
                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">LIVE</span>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {automationLogs.map(log => (
                                        <div key={log.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors border border-slate-200">
                                                    <log.icon className="w-5 h-5 text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 leading-tight">{log.title}</p>
                                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{log.desc}</p>
                                                    <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold tracking-tighter flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#1AA6A8] shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                                                        {log.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 text-center bg-slate-50/30 border-t border-slate-50">
                                    <button onClick={() => { setActiveTab('automations'); setIsNotificationsOpen(false); }} className="text-xs font-bold text-primary hover:underline transition-transform inline-block">View Full Intelligence Logs</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Module Tabs */}
                    <div className="flex items-center p-1 sm:p-1.5 bg-slate-200/50 rounded-xl sm:rounded-2xl shrink-0 border border-slate-200 shadow-inner overflow-x-auto hide-scrollbar">
                        <button
                            onClick={() => setActiveTab('pipeline')}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'pipeline' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Pipeline
                        </button>
                        <button
                            onClick={() => setActiveTab('clients')}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'clients' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Clients
                        </button>
                        <button
                            onClick={() => setActiveTab('automations')}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'automations' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            AI Auto
                        </button>
                        <button
                            onClick={() => setActiveTab('voice')}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'voice' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Voice AI
                        </button>
                        <button
                            onClick={() => setActiveTab('trash')}
                            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'trash' ? 'bg-white text-red-500 shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Trash
                            {trashedLeads.length > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{trashedLeads.length}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {(activeTab === 'pipeline' || activeTab === 'clients') && (
                <div className="flex flex-col flex-1 h-full min-h-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8]"></span>
                            Live Sync Active
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={() => { setIsAddLeadModalOpen(true); setAddLeadName(''); setAddLeadPhone(''); setAddLeadDuplicateWarning(null); setAddLeadConfirmDuplicate(false); }} className="px-3 sm:px-4 py-2 bg-[#E6F7F7] text-[#1AA6A8] border border-[#1AA6A8]/20 text-xs sm:text-sm font-bold rounded-lg hover:bg-[#EAFBFB] transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm">
                                <Plus className="w-4 h-4" /> Add Lead
                            </button>
                            <button onClick={handleExportLeadsToCSV} className="px-3 sm:px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs sm:text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm hidden sm:flex">
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4 pr-2 custom-scrollbar">
                        {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="ml-3 text-slate-500 font-medium">Loading live pipeline...</span>
                        </div>
                    ) : (
                        <>
                            {columns.map((col, idx) => {
                                const isExpanded = expandedStages[col.title] || false;
                                const limit = stageLimits[col.title] || 4;
                                const displayedItems = col.items.slice(0, limit);
                                const hasMore = col.items.length > limit;

                                return (
                                <div key={idx} className={`flex bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 ${isExpanded ? 'flex-row items-stretch' : 'flex-col'}`}>
                                    <div 
                                        className={`p-4 bg-white relative group/header cursor-pointer select-none transition-colors hover:bg-slate-50 flex-shrink-0 flex flex-col ${isExpanded ? 'w-[280px] sm:w-[320px] rounded-l-xl border-r border-slate-200' : 'rounded-xl'}`}
                                        onClick={() => toggleStage(col.title)}
                                    >
                                        {/* Stage Header w/ Edit toggle */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`transition-transform duration-200 ${isExpanded ? '-rotate-90' : 'rotate-0'}`}>
                                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                                </div>
                                            {editingStageIdx === idx ? (
                                                <input
                                                    type="text"
                                                    value={editingStageName}
                                                    onChange={(e) => setEditingStageName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameStage(col.title, idx);
                                                        if (e.key === 'Escape') setEditingStageIdx(null);
                                                    }}
                                                    onBlur={() => handleRenameStage(col.title, idx)}
                                                    autoFocus
                                                    className="font-semibold text-slate-900 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded outline-none ring-2 ring-primary/20 w-[180px] text-sm"
                                                />
                                            ) : (
                                                <h3
                                                    className="font-semibold text-slate-900 cursor-text hover:text-primary transition-colors truncate pr-2 w-[150px]"
                                                    onDoubleClick={() => {
                                                        if (!PROTECTED_STAGES.includes(col.title)) {
                                                            setEditingStageIdx(idx);
                                                            setEditingStageName(col.title);
                                                        } else {
                                                            toast.info("Protected stages cannot be renamed.");
                                                        }
                                                    }}
                                                    title={PROTECTED_STAGES.includes(col.title) ? "Protected Stage" : "Double-click to rename"}
                                                >
                                                    {col.title}
                                                </h3>
                                            )}
                                                <span className={`min-w-[2rem] h-8 px-2 rounded-full flex items-center justify-center text-sm font-extrabold transition-all shadow-sm ${col.count > 0 ? 'bg-gradient-to-br from-[#1AA6A8] to-[#0E7C7E] text-white ring-2 ring-[#1AA6A8]/30 scale-105' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                    {col.count}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Header Dropdown Menu (Hover based) */}
                                                <div className={`absolute opacity-0 group-hover/header:opacity-100 transition-opacity bg-white shadow-sm border border-slate-200 rounded-md flex overflow-hidden ${isExpanded ? 'bottom-4 left-4' : 'right-4 top-1/2 -translate-y-1/2'}`} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        disabled={idx === 0}
                                                        onClick={(e) => { e.stopPropagation(); handleSlideStage(idx, 'left'); }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors border-r border-slate-100" title="Slide Left"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        disabled={idx === activeStages.length - 1}
                                                        onClick={(e) => { e.stopPropagation(); handleSlideStage(idx, 'right'); }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors border-r border-slate-100" title="Slide Right"
                                                    >
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>

                                                    {!PROTECTED_STAGES.includes(col.title) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteStage(col.title, idx); }}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Stage"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-5 flex-1 overflow-x-auto min-w-0 custom-scrollbar bg-slate-50/50">
                                            {col.items.length === 0 ? (
                                                <div className="text-center text-slate-400 text-sm py-8 h-full flex flex-col justify-center">No leads in this stage</div>
                                            ) : (
                                                <div className="flex flex-wrap gap-4 min-w-min">
                                                    {displayedItems.map((item) => {
                                                        const priorityMeta = item.priority === 'hot'
                                                            ? { label: 'Hot', cls: 'bg-red-100 text-red-700 border-red-200' }
                                                            : item.priority === 'cold'
                                                            ? { label: 'Low', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
                                                            : { label: 'Medium', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
                                                        // Extract service name: prefer service_interest column, then parse from notes
                                                        let serviceName: string | null = item.service_interest || null;
                                                        let shiftBubble: string | null = null;
                                                        let serviceLocation: string | null = null;

                                                        if (item.notes) {
                                                            // Parse structured notes: "Service: X\nShift: Y\nLocation: Z"
                                                            const serviceMatch = item.notes.match(/^Service:\s*(.+)$/im);
                                                            const shiftMatch   = item.notes.match(/^Shift:\s*(.+)$/im);
                                                            const locMatch     = item.notes.match(/^Location:\s*(.+)$/im);
                                                            if (!serviceName && serviceMatch) {
                                                                serviceName = serviceMatch[1].trim();
                                                            }
                                                            if (shiftMatch) {
                                                                shiftBubble = shiftMatch[1].trim();
                                                            }
                                                            if (locMatch) {
                                                                serviceLocation = locMatch[1].replace(/^,\s*|,\s*$/g, '').trim();
                                                            }
                                                        }

                                                        // Fallback: use intent if still nothing
                                                        if (!serviceName) serviceName = item.intent || null;

                                                        // Sanitize: drop placeholder / empty values
                                                        if (serviceName === 'Unknown' || serviceName === '') serviceName = null;
                                                        if (shiftBubble === '' || shiftBubble === 'Unknown') shiftBubble = null;
                                                        if (serviceLocation === ', , , ' || serviceLocation === '') serviceLocation = null;
                                                        const deliveryLog = deliveryLogs
                                                            .filter((l) => l.payload?.lead_id === item.id)
                                                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                                                        return (
                                                        <div key={item.id} className="relative w-[280px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-default flex flex-col">
                                                            {item.needs_attention && (
                                                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm z-10 animate-pulse"></div>
                                                            )}
                                                            <div className="p-4 flex flex-col gap-3 flex-1">
                                                                {/* Row 1: Avatar + Name + Priority */}
                                                                <div className="flex items-start gap-3">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${getAvatarColor(item.name)}`}>
                                                                        {getInitials(item.name)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-bold text-slate-900 truncate leading-tight">
                                                                            {item.name}
                                                                        </p>
                                                                         <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                             <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${priorityMeta.cls}`}>
                                                                                 {priorityMeta.label}
                                                                             </span>
                                                                             {serviceName && (
                                                                                 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                                                                     {serviceName}
                                                                                 </span>
                                                                             )}
                                                                             {item.assigned_worker_name && (
                                                                                 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                                                                                     <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                     </svg>
                                                                                     {item.assigned_worker_name}
                                                                                 </span>
                                                                             )}
                                                                         </div>
                                                                    </div>
                                                                </div>
                                                                 {/* Service Details Breakdown */}
                                                                 <div className="flex flex-col gap-1.5">
                                                                     {shiftBubble && (
                                                                         <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                                             <Clock className="w-3 h-3 text-primary shrink-0" />
                                                                             <span className="text-[10px] font-medium text-slate-600 truncate">
                                                                                 {shiftBubble}
                                                                             </span>
                                                                         </div>
                                                                     )}
                                                                     {serviceLocation && (
                                                                         <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                                             <Globe className="w-3 h-3 text-primary shrink-0" />
                                                                             <span className="text-[10px] font-medium text-slate-600 truncate">
                                                                                 {serviceLocation}
                                                                             </span>
                                                                         </div>
                                                                     )}
                                                                     {(item.plannedStart || item.plannedDuration) && (
                                                                         <div className="flex items-center gap-2 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 mt-0.5">
                                                                             <svg className="w-3 h-3 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                             </svg>
                                                                             <span className="text-[10px] font-bold text-indigo-700 truncate tracking-wide">
                                                                                 {item.plannedStart ? new Date(item.plannedStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'TBD'} 
                                                                                 {item.plannedDuration ? ` • ${item.plannedDuration}` : ''}
                                                                             </span>
                                                                         </div>
                                                                     )}
                                                                 </div>
                                                                {/* Phone row */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-slate-600 truncate flex items-center gap-1">
                                                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                                        {formatPhoneNumber(item.whatsapp_number || item.phone) || 'No phone'}
                                                                    </span>
                                                                    {deliveryLog && (
                                                                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                                            deliveryLog.status === 'failed' || deliveryLog.status === 'error'
                                                                                ? 'bg-red-100 text-red-700'
                                                                                : deliveryLog.status === 'delivered'
                                                                                ? 'bg-green-100 text-green-700'
                                                                                : deliveryLog.status === 'read'
                                                                                ? 'bg-blue-100 text-blue-700'
                                                                                : 'bg-slate-100 text-slate-500'
                                                                        }`} title={deliveryLog.error_message || undefined}>
                                                                            {deliveryLog.status === 'accepted_by_meta' ? 'sent' : deliveryLog.status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {/* Time */}
                                                                <p className="text-[11px] text-slate-400">{getRelativeTime(item.created_at)}</p>
                                                                <div className="flex-1"></div>
                                                            </div>
                                                            {/* View Details */}
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedInspectorLead(item);
                                                                    fetchLeadActivity(item.id);
                                                                    if (item.needs_attention) {
                                                                        setLeads(prev => prev.map(l => l.id === item.id ? { ...l, needs_attention: false } : l));
                                                                        await supabase.from('crm_leads').update({ needs_attention: false }).eq('id', item.id);
                                                                    }
                                                                }}
                                                                className="w-full py-2 border-t border-slate-100 text-slate-500 hover:text-primary hover:bg-slate-50 text-[12px] font-semibold rounded-b-2xl transition-all flex items-center justify-center gap-1.5 group"
                                                            >
                                                                View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                            </button>
                                                        </div>
                                                        );
                                                    })}
                                                    {hasMore && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); loadMoreInStage(col.title); }}
                                                            className="w-[300px] shrink-0 flex flex-col items-center justify-center gap-3 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-primary hover:border-primary/50 transition-colors hover:bg-primary/5 min-h-[150px]"
                                                        >
                                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                                <Plus className="w-5 h-5 text-primary" />
                                                            </div>
                                                            <span className="font-semibold text-sm">Load More ({col.items.length - limit} left)</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            {/* Add Column Button */}
                            <div className="w-[320px] shrink-0 flex flex-col bg-transparent rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
                                {isAddingStage ? (
                                    <div className="p-4 flex flex-col gap-3">
                                        <input
                                            type="text"
                                            value={newStageName}
                                            onChange={(e) => setNewStageName(e.target.value)}
                                            placeholder="Enter column name..."
                                            className="w-full text-sm py-2 px-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddStage();
                                                if (e.key === 'Escape') { setIsAddingStage(false); setNewStageName(''); }
                                            }}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setIsAddingStage(false); setNewStageName(''); }} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md">Cancel</button>
                                            <button onClick={handleAddStage} className="px-3 py-1.5 text-xs bg-primary text-white hover:bg-primary/90 rounded-md" disabled={!newStageName.trim()}>Add</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsAddingStage(true)} className="flex items-center justify-center p-4 text-slate-500 hover:text-slate-800 transition-colors group flex-1">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                                            </div>
                                            <span className="font-medium">+ Create a new one</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            )}
            {activeTab === 'voice' && (
                /* Voice AI Dashboard View */
                <div className="flex-1 flex flex-col gap-6">
                    <div className="grid lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-300">Total AI Calls Today</h3>
                                <Mic className="w-5 h-5 text-emerald-400" />
                            </div>
                            <p className="text-3xl font-bold">{isLoadingVoice ? '-' : voiceMetrics.totalCallsToday}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                                <span className="text-emerald-400 font-medium">Auto-tracked</span>
                                <span className="text-slate-400">via ElevenLabs</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-600">Leads Captured via Voice</h3>
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <p className="text-3xl font-bold text-slate-900">{isLoadingVoice ? '-' : voiceMetrics.leadsCaptured}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 flex-1 mt-1">
                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: voiceMetrics.totalCallsToday > 0 ? `${Math.min(100, (voiceMetrics.leadsCaptured / voiceMetrics.totalCallsToday) * 100)}%` : '0%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-600">Avg. Call Duration</h3>
                                <Phone className="w-5 h-5 text-purple-500" />
                            </div>
                            <p className="text-3xl font-bold text-slate-900">{isLoadingVoice ? '-' : `${Math.floor(voiceMetrics.avgDurationSeconds / 60)}m ${voiceMetrics.avgDurationSeconds % 60}s`}</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-center">
                            <button
                                onClick={toggleCall}
                                disabled={callStatus === 'loading'}
                                className={`w-full h-full min-h-[100px] border-2 border-dashed rounded-xl font-medium transition-colors flex flex-col items-center justify-center gap-2 ${callStatus === 'active'
                                    ? 'border-red-200 hover:border-red-300 text-red-500 bg-red-50/50'
                                    : callStatus === 'loading'
                                        ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'border-slate-200 hover:border-primary/50 text-slate-500 hover:text-primary'
                                    }`}
                            >
                                {callStatus === 'loading' ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Connecting...
                                    </>
                                ) : callStatus === 'active' ? (
                                    <>
                                        <span className="relative flex h-6 w-6">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 items-center justify-center text-white">
                                                <PhoneOff className="w-3.5 h-3.5" />
                                            </span>
                                        </span>
                                        End Test Call
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-6 h-6" />
                                        Start Web Call (ElevenLabs)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="mb-6">
                                <h2 className="text-lg font-bold text-slate-900">Call Logs & Audio recordings</h2>
                                <p className="text-sm text-slate-500">Listen to AI voice interactions and review transcripts instantly.</p>
                            </div>
                            <button 
                                onClick={handleRetryVoice}
                                disabled={isLoadingVoice}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                            >
                                Refresh Logs
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-5 space-y-4">
                            {calls.map((call) => (
                                <div key={call.id} className="p-5 rounded-xl border border-slate-200 flex flex-col xl:flex-row gap-6 hover:shadow-sm transition-shadow">
                                    <div className="flex items-start gap-4 xl:w-1/3 shrink-0 border-b xl:border-b-0 xl:border-r border-slate-100 pb-4 xl:pb-0 xl:pr-6">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${call.type === 'Inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-50 text-purple-600'}`}>
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-900 text-lg">{call.capturedName || call.phone}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${call.type === 'Inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-100 text-purple-700'}`}>
                                                    {call.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                                                <span className="flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> {call.duration}</span>
                                                <span>•</span>
                                                <span className="font-medium">{call.time}</span>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-slate-100/80">
                                                <VoicePlayer src={`https://sgyladamwnanudnropwl.supabase.co/functions/v1/get-call-audio?conversation_id=${call.id}`} />
                                                <div className="flex items-center gap-2 mt-3">
                                                    <button onClick={() => { setSelectedCall(call); setIsTranscriptModalOpen(true); }} className="text-sm font-bold text-[#1AA6A8] hover:text-[#0E7C7E] flex items-center gap-1.5 transition-colors bg-[#E6F7F7] px-4 py-1.5 rounded-lg border border-[#1AA6A8]/20 shadow-sm flex-1 justify-center">
                                                        <FileText className="w-4 h-4" /> View Full Transcript
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Bot className="w-4 h-4 text-[#1AA6A8]" />
                                                    <span className="text-sm font-semibold text-slate-900">AI Summary & Intent: <span className="font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded ml-1">{call.intent}</span></span>
                                                </div>
                                                {(() => {
                                                    const isAlreadyInPipeline = leads.some(l => {
                                                        if (call.lead_id && l.id === call.lead_id) return true;
                                                        return false;
                                                    });
                                                    const isProcessed = call.status === 'Processed' || isAlreadyInPipeline;

                                                    if (call.automation_error && call.automation_error !== 'GREETING_SENT') {
                                                        return (
                                                            <span className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 border border-rose-100 text-rose-600 rounded text-[10px] font-bold" title={call.automation_error}>
                                                                <AlertTriangle className="w-3 h-3" /> AUTOMATION FAILED
                                                            </span>
                                                        );
                                                    }

                                                    return isProcessed ? (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-[#1AA6A8] bg-[#E6F7F7] px-2 py-1 rounded" title={isAlreadyInPipeline ? "Found existing Lead with this phone number." : ""}>
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> ADDED TO CRM
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">"{call.summary}"</p>
                                        </div>

                                        {(() => {
                                            const isAlreadyInPipeline = leads.some(l => {
                                                if (call.lead_id && l.id === call.lead_id) return true;
                                                return false;
                                            });
                                            const isProcessed = isAlreadyInPipeline;

                                            return (!isProcessed && (call.capturedName || (call.summary && call.summary !== 'No summary available.' && call.summary !== 'Call completed.'))) ? (
                                                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 opacity-70">Lead Data Captured</p>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                            <p className="text-sm text-slate-900 font-semibold truncate max-w-[200px]">{call.capturedName}</p>
                                                            <span className="text-sm text-[#1AA6A8] font-medium whitespace-nowrap">Est. ₹{call.capturedValue}/mo</span>
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                                <Phone className="w-3.5 h-3.5" /> {call.phone}
                                                            </span>
                                                            {call.capturedWhatsapp && (
                                                                <span className="flex items-center gap-1.5 text-xs font-bold text-[#1AA6A8] bg-[#EAFBFB] px-2.5 py-1 rounded-lg border border-[#1AA6A8]/10">
                                                                    <MessageCircle className="w-3.5 h-3.5" /> {call.capturedWhatsapp}
                                                                </span>
                                                            )}

                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                        {(() => {
                                                            const greetStatus = callGreetingStatus[call.id];
                                                            const dbSent = call.automation_error === 'GREETING_SENT';
                                                            const phone = call.capturedWhatsapp || call.phone;
                                                            if (!phone) return null;
                                                            if (greetStatus === 'sending') return (
                                                                <button disabled className="px-3 py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 cursor-not-allowed">
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                                                                </button>
                                                            );
                                                            if (greetStatus === 'sent' || dbSent) return (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleResendCallGreeting(call);
                                                                    }}
                                                                    disabled={greetStatus === 'sending'}
                                                                    className="px-3 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-100 flex items-center gap-1.5 shrink-0 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5" /> Sent (Resend?)
                                                                </button>
                                                            );
                                                            if (greetStatus === 'error') {
                                                                const errorDetail = call.automation_error?.replace('GREETING_ERROR: ', '') || 'Unknown error';
                                                                return (
                                                                    <button 
                                                                        onClick={() => handleSendCallGreeting(call, true)} 
                                                                        className="px-3 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-1.5 shrink-0 hover:bg-red-100 transition-colors"
                                                                        title={`Error: ${errorDetail}`}
                                                                    >
                                                                        <AlertTriangle className="w-3.5 h-3.5" /> Retry Greeting
                                                                    </button>
                                                                );
                                                            }
                                                            return (
                                                                <button onClick={() => handleSendCallGreeting(call, true)} className="px-3 py-2 bg-[#E6F7F7] text-[#0E7C7E] text-xs font-bold rounded-lg border border-[#1AA6A8]/20 flex items-center gap-1.5 shrink-0 hover:bg-[#1AA6A8] hover:text-white transition-colors">
                                                                    <MessageCircle className="w-3.5 h-3.5" /> Send Greeting
                                                                </button>
                                                            );
                                                        })()}
                                                        {call.lead_id || call.status === 'Processed' ? (
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100 shrink-0">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> Added to CRM
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={capturingCallId != null && String(capturingCallId) === String(call.id)}
                                                                onClick={() => captureCallAsLead(call.id)}
                                                                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm shrink-0 whitespace-nowrap"
                                                            >
                                                                {capturingCallId != null && String(capturingCallId) === String(call.id) ? (
                                                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                                                                ) : (
                                                                    <><Plus className="w-3.5 h-3.5" /> Add to Pipeline</>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            ))}
                            {calls.length === 0 && !isLoadingVoice && (
                                <div className="text-center py-10">
                                    <Mic className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                    <h3 className="text-slate-500 font-medium">No calls found for today.</h3>
                                </div>
                            )}
                            {isLoadingVoice && (
                                <div className="text-center py-10">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                                    <h3 className="text-slate-500 font-medium">Loading voice data...</h3>
                                </div>
                            )}
                            {calls.length > 0 && (
                                <div className="text-center pt-2">
                                    <button onClick={handleRetryVoice} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Refresh Calls</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'trash' && (
                /* Trash Can View */
                <div className="flex-1 flex flex-col gap-4">
                    {/* Header */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Trash2 className="w-5 h-5 text-red-400" />
                                <h2 className="text-lg font-bold text-slate-900">Trash</h2>
                                {trashedLeads.length > 0 && (
                                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{trashedLeads.length}</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500">Leads are automatically deleted after 30 days. Restore to recover all data.</p>
                        </div>
                        {trashedLeads.length > 0 && (
                            <button
                                onClick={() => {
                                    toast(`Permanently delete all ${trashedLeads.length} lead(s) in trash?`, {
                                        action: { label: 'Empty Trash', onClick: handleEmptyTrash },
                                        cancel: { label: 'Cancel', onClick: () => {} },
                                        duration: 8000,
                                    });
                                }}
                                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 shrink-0"
                            >
                                <Trash2 className="w-4 h-4" /> Empty Trash
                            </button>
                        )}
                    </div>

                    {/* Trash list */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                        {isLoadingTrash ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-4" />
                                <span className="text-slate-500 font-medium">Loading trash...</span>
                            </div>
                        ) : trashedLeads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Trash2 className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Trash is Empty</h3>
                                <p className="text-slate-500 text-sm max-w-xs">Deleted leads will appear here for 30 days before being permanently removed.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {trashedLeads.map(lead => {
                                    const deletedAt = new Date(lead.deleted_at);
                                    const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                                    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <div key={lead.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-50 text-red-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {(lead.name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{lead.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="text-xs text-slate-500">{lead.phone || lead.whatsapp_number || 'No phone'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
                                                        <span className="text-xs font-medium text-slate-600">{lead.pipeline_stage}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
                                                        <span className={`text-xs font-semibold ${daysLeft <= 3 ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {daysLeft <= 0 ? 'Expires today' : `${daysLeft}d left`}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Deleted {deletedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleRestoreLead(lead)}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePermanently(lead.id, lead.name)}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'automations' && (
                /* AI Automations View */
                <div className="flex-1 flex flex-col gap-6 pb-4 overflow-y-auto">
                    <div className="grid lg:grid-cols-2 gap-6">
                    {/* Active Workflows */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">Active AI Workflows</h2>
                            <p className="text-sm text-slate-500 mt-1">Configure how the AI responds to new leads.</p>
                        </div>
                        <div className="p-5 flex-1 space-y-4">
                            <div className={`p-4 rounded-lg border transition-colors ${workflows.greeting ? 'border-primary/30 bg-primary/5' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className={`w-5 h-5 ${workflows.greeting ? 'text-primary' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.greeting ? 'text-primary' : 'text-slate-600'}`}>Instant Greeting & Triage</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('greeting')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.greeting ? 'bg-primary' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.greeting ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500 mb-3">Automatically replies to inbound web chats and SMS. Classifies intent (Booking vs. Inquiry).</p>
                                <button
                                    onClick={handleBulkGreeting}
                                    disabled={isSimulatingInquiry}
                                    className="text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-sm mt-3"
                                >
                                    {isSimulatingInquiry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                                    Send Greetings to Captured Leads
                                </button>
                            </div>


                            <div className={`p-4 rounded-lg border transition-colors ${workflows.drip ? 'border-emerald-300 bg-[#E6F7F7]' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Send className={`w-5 h-5 ${workflows.drip ? 'text-[#1AA6A8]' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.drip ? 'text-[#1AA6A8]' : 'text-slate-600'}`}>No-Response Drip Campaign</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('drip')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.drip ? 'bg-[#1AA6A8]' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.drip ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">Sends 3 automated follow-ups if lead ghosts after 48 hours. {!workflows.drip && <span className="text-amber-500 font-medium">(Currently Paused)</span>}</p>
                            </div>
                        </div>
                    </div>

                    {/* Execution Log */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-200 bg-white">
                            <h2 className="text-lg font-bold text-slate-900">Recent Workflow Executions</h2>
                            <p className="text-sm text-slate-500 mt-1">Live log of actions taken by the AI agent.</p>
                        </div>
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            {automationLogs.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Bot className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium">No recent activity logged.</p>
                                </div>
                            ) : automationLogs.map((log) => (
                                <div key={log.id} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 z-10">
                                            <log.icon className="w-4 h-4 text-slate-600" />
                                        </div>
                                        {log.id !== automationLogs.length && <div className="w-px h-full bg-slate-200 my-1"></div>}
                                    </div>
                                    <div className="pb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-bold text-slate-900">{log.title}</h4>
                                            <span className="text-xs text-slate-400">{log.time}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-2">{log.desc}</p>
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1AA6A8]" />
                                            <span className="text-xs font-medium text-[#1AA6A8] uppercase tracking-wide">Executed</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="text-center pt-4">
                                <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View All Logs</button>
                            </div>
                        </div>
                    </div>
                </div>

                    {/* Recent Reviews Panel */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                    Recent Reviews
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Client feedback collected via WhatsApp.</p>
                            </div>
                            <button onClick={fetchReviews} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Refresh</button>
                        </div>
                        <div className="p-5 flex-1 overflow-y-auto">
                            {isLoadingReviews ? (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Star className="w-6 h-6 text-amber-300" />
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium">No reviews yet.</p>
                                    <p className="text-xs text-slate-400 mt-1">Send a review request from a client's inspector panel.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map(review => (
                                        <div key={review.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">{review.client_name}</p>
                                                    <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                </div>
                                                {review.rating && (
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {review.review_text && (
                                                <p className="text-sm text-slate-600 leading-relaxed">"{review.review_text}"</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Staff Picker Modal */}
            {isStaffPickerOpen && staffPickerTargetLead && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-slate-100 bg-purple-500/10 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Assign Staff Member</h2>
                                    <p className="text-xs text-slate-500 font-medium">FOR: {staffPickerTargetLead.name} — select an available worker below</p>
                                </div>
                            </div>
                            <button onClick={() => setIsStaffPickerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto">
                            {isLoadingWorkers ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
                                    <p className="text-slate-500 font-medium">Loading available staff...</p>
                                </div>
                            ) : availableWorkers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Users className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 mb-2">No Available Staff</h3>
                                    <p className="text-sm text-slate-500">All workers are currently assigned. Add more staff from the HR page.</p>
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {availableWorkers.map((worker, index) => (
                                        <div key={worker.id || index} className="p-4 border-2 border-slate-200 hover:border-purple-400 rounded-xl transition-all cursor-pointer group hover:shadow-md bg-white">
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                    {(worker.name || 'W').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate">{worker.name || 'Unknown Member'}</h4>
                                                    <p className="text-xs text-slate-500 truncate">{worker.role || 'Worker'}</p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1AA6A8] bg-[#E6F7F7] px-2 py-0.5 rounded-full shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#1AA6A8] animate-pulse"></span>
                                                    Available
                                                </span>
                                            </div>
                                            {worker.phone && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                                                    <Phone className="w-3 h-3" /> {worker.phone}
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => confirmWorkerSelection(worker)}
                                                    className="flex-1 py-2 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 text-xs font-bold rounded-lg border border-purple-200 transition-all group-hover:border-purple-400 flex items-center justify-center gap-1.5"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Assign to {(staffPickerTargetLead?.name || 'Lead').split(' ')[0]}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const lead = leads.find(l => l.id === staffPickerTargetLead?.id);
                                                        if (lead) sendWorkerProfileWhatsApp(lead, worker);
                                                    }}
                                                    className="p-2 bg-[#E6F7F7] text-[#1AA6A8] border border-[#1AA6A8]/20 rounded-lg hover:bg-[#1AA6A8] hover:text-white transition-all"
                                                    title="Share Profile via WhatsApp"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

                        {/* Send Quotation Modal */}
            <SendQuotationModal 
                isOpen={isQuotationModalOpen} 
                onClose={() => setIsQuotationModalOpen(false)} 
                lead={quotationTargetLead} 
                onDispatch={handleDispatchQuotation} 
            />

            {/* AI WhatsApp Draft Modal */}
            {isAgentModalOpen && agentTargetLead && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-[100] transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-[#1AA6A8]/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#EAFBFB] rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-[#1AA6A8]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                                        {agentTargetAction === 'staff' && selectedWorker
                                            ? `ASSIGNING: ${selectedWorker.name} → ${agentTargetLead.name}`
                                            : `DRAFTING TO: ${agentTargetLead.name}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 flex-1">
                            {/* Simplified Message Type Selector */}
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-primary" /> Message Type
                                </label>
                                <select 
                                    value={agentTargetAction === 'custom' ? 'custom' : 'stage'}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setAgentTargetAction('custom');
                                        } else {
                                            // Derive the correct template action based on the lead's current stage
                                            const stage = agentTargetLead?.pipeline_stage;
                                            let restoreAction: any = 'inquiry';
                                            if (stage === 'In Discussion') restoreAction = 'quotation';
                                            else if (stage === 'Quotation Sent') restoreAction = 'consent';
                                            else if (stage === 'Form Submitted') restoreAction = 'staff';
                                            else if (stage === 'Staff Assigned') restoreAction = 'deposit';
                                            else if (stage === 'Monthly Billing') restoreAction = 'billing';
                                            
                                            // Handle special case for staff sharing which might not be stage-based
                                            if (selectedWorker) restoreAction = 'staff';

                                            setAgentTargetAction(restoreAction);
                                        }
                                    }}
                                    className="text-xs font-semibold text-slate-700 bg-slate-100 border-none rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="stage">
                                        {(() => {
                                            // Determine what the "Automated" label should be even if current action is 'custom'
                                            const stage = agentTargetLead?.pipeline_stage;
                                            let action = agentTargetAction;
                                            if (action === 'custom') {
                                                if (stage === 'In Discussion') action = 'quotation';
                                                else if (stage === 'Quotation Sent') action = 'consent';
                                                else if (stage === 'Form Submitted') action = 'staff';
                                                else if (stage === 'Staff Assigned') action = 'deposit';
                                                else if (stage === 'Monthly Billing') action = 'billing';
                                                else action = 'inquiry';
                                                
                                                if (selectedWorker) action = 'staff';
                                            }

                                            return action === 'inquiry' ? 'Greeting Message' :
                                                   action === 'quotation' ? 'Quotation Template' :
                                                   action === 'consent' ? 'Consent Form' :
                                                   action === 'staff' ? 'Profile Sharing' :
                                                   action === 'deposit' ? 'Deposit Invoice' :
                                                   action === 'billing' ? 'Monthly Bill' : 
                                                   'Automated Template';
                                        })()}
                                    </option>
                                    <option value="custom">Manual Message</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" /> {isEditingTemplate ? 'Edit Default Template' : 'Review Editable Draft'}
                                    </label>
                                    {agentTargetAction !== 'deposit' && agentTargetAction !== 'consent' && agentTargetAction !== 'billing' && (
                                        <button
                                            onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                                            className="text-xs font-semibold text-[#1AA6A8] hover:text-[#1AA6A8] transition-colors"
                                        >
                                            {isEditingTemplate ? 'Back to Draft View' : '⚙️ Edit Default Template'}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    {agentTargetAction === 'consent' && !isEditingTemplate ? (
                                        <div className="w-full h-48 bg-[#EAFBFB] border border-[#1AA6A8]/20 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-inner">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-[#1AA6A8]">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <h3 className="font-bold text-slate-800 mb-2">WhatsApp Consent Flow</h3>
                                            <p className="text-sm text-slate-600 leading-relaxed mx-auto max-w-xs">
                                                This will dispatch the interactive WhatsApp Flow template. {agentTargetLead?.name?.split(' ')[0] || 'They'} will receive a button to open and submit the consent form natively inside WhatsApp.
                                            </p>
                                        </div>
                                    ) : agentTargetAction === 'quotation' && !isEditingTemplate ? (
                                        <div className="space-y-3 bg-white p-4 rounded-xl border border-[#1AA6A8]/20 shadow-sm relative z-10 w-full mb-6">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Service Name</label>
                                                <input type="text" value={quotationVars.v1} onChange={e => setQuotationVars({...quotationVars, v1: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. Registered Nurse" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Hours of Service</label>
                                                    <input type="text" value={quotationVars.v2} onChange={e => setQuotationVars({...quotationVars, v2: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. 12 Hours" />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Complete Month (Per Day Rate)</label>
                                                    <input type="text" value={quotationVars.v3} onChange={e => setQuotationVars({...quotationVars, v3: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. ₹ 800/day" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Incomplete Month (Per Day Rate)</label>
                                                <input type="text" value={quotationVars.v4} onChange={e => setQuotationVars({...quotationVars, v4: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. ₹ 1,500/day" />
                                            </div>
                                        </div>
                                    ) : (agentTargetAction === 'deposit' || agentTargetAction === 'billing') && !isEditingTemplate ? (
                                        <div className="space-y-3 bg-white p-4 rounded-xl border border-[#1AA6A8]/20 shadow-sm relative z-10 w-full mb-6">
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                                <FileText className="w-4 h-4 text-[#1AA6A8]" />
                                                <span className="text-xs font-bold text-slate-700">Invoice Details (Auto-generated PDF)</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                                                        {agentTargetAction === 'billing' ? 'Billing Amount (₹)' : 'Deposit Amount (₹)'}
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        value={invoiceDepositAmount} 
                                                        onChange={e => setInvoiceDepositAmount(e.target.value)} 
                                                        className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" 
                                                        placeholder={agentTargetLead?.quoted_monthly_rate || '15000'} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Due Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={invoiceDueDate} 
                                                        onChange={e => setInvoiceDueDate(e.target.value)} 
                                                        className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Start Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={invoiceStartDate} 
                                                        onChange={e => setInvoiceStartDate(e.target.value)} 
                                                        className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">End Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={invoiceEndDate} 
                                                        onChange={e => setInvoiceEndDate(e.target.value)} 
                                                        className="w-full text-xs font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" 
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3">
                                                <div className="p-2 bg-white rounded shadow-sm border border-slate-200 shrink-0">
                                                    <QrCode className="w-6 h-6 text-slate-700" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-900 mb-0.5">Dynamic QR Code Attached</p>
                                                    <p className="text-xs text-slate-500">
                                                        The client can scan the QR code to securely pay ₹{invoiceDepositAmount || agentTargetLead?.quoted_monthly_rate || '15000'} via their preferred UPI app.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <textarea
                                            value={isEditingTemplate ? templateDraftText : agentDraftText}
                                            onChange={(e) => isEditingTemplate ? setTemplateDraftText(e.target.value) : setAgentDraftText(e.target.value)}
                                            readOnly={!isEditingTemplate && agentTargetAction === 'inquiry'}
                                            className={`w-full h-32 px-4 py-3 rounded-xl border border-[#1AA6A8]/20 outline-none focus:ring-2 focus:ring-[#1AA6A8] focus:border-transparent text-sm resize-none font-medium leading-relaxed mb-6 ${(!isEditingTemplate && agentTargetAction === 'inquiry') ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-[#E6F7F7] text-[#0E7C7E]'}`}
                                        />
                                    )}
                                    
                                    {(!isEditingTemplate && agentTargetAction !== 'quotation' && agentTargetAction !== 'deposit') && (
                                        <div className="absolute bottom-3 right-3 flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-75"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-150"></span>
                                        </div>
                                    )}
                                </div>

                                {isEditingTemplate ? (
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-medium">Use <code className="px-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">{"{{name}}"}</code> and <code className="px-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">{"{{link}}"}</code> as dynamic variables.</p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#1AA6A8]" /> Human conformation ensures quality outbound interactions.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            {isEditingTemplate ? (
                                <button onClick={handleSaveTemplate} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-[#1AA6A8] hover:bg-[#1AA6A8] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    Save as Default
                                </button>
                            ) : (
                                <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#1AA6A8] to-[#0E7C7E] hover:from-[#1AA6A8] hover:to-[#0E7C7E] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Confirm & Dispatch
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}



        {/* Transcript Modal */}
        {isTranscriptModalOpen && selectedCall && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedCall.type === 'Inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-100 text-purple-600'}`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Call Transcript</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Contact: {selectedCall.phone} • {selectedCall.duration}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsTranscriptModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 bg-white border border-slate-200 shadow-sm">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-slate-50/30">
                        {/* Call Summary Block */}
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Bot className="w-4 h-4" /> AI Summary
                            </h3>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                "{selectedCall.summary || 'Summary unavailable.'}"
                            </p>
                            {selectedCall.intent && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-primary/10 text-xs font-bold text-primary shadow-sm">
                                    Intent: {selectedCall.intent}
                                </div>
                            )}
                            
                            {/* Modal Audio Player */}
                            <div className="mt-4 pt-4 border-t border-primary/10">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">Call Recording</p>
                                <VoicePlayer src={`https://sgyladamwnanudnropwl.supabase.co/functions/v1/get-call-audio?conversation_id=${selectedCall.id}`} />
                            </div>
                        </div>

                        {/* Transcript Dialogue */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Full Dialogue</h3>
                            {selectedCall.transcript ? (
                                <div className="space-y-4">
                                    {selectedCall.transcript.split('\n').filter((l: string) => l.trim()).map((line: string, idx: number) => {
                                        const isAI = line.toLowerCase().startsWith('ai:') || line.toLowerCase().startsWith('assistant:');
                                        const isUser = line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('lead:');
                                        
                                        if (!isAI && !isUser) {
                                            return <p key={idx} className="text-xs text-slate-400 text-center py-2">{line}</p>;
                                        }

                                        return (
                                            <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isAI ? 'bg-white border border-slate-200 shadow-sm rounded-tl-none' : 'bg-primary text-white rounded-tr-none shadow-md'}`}>
                                                    <span className={`block text-[10px] uppercase font-bold mb-1 tracking-wider ${isAI ? 'text-primary' : 'text-emerald-100'}`}>
                                                        {isAI ? 'AI Agent' : 'Contact'}
                                                    </span>
                                                    <p className={`text-sm ${isAI ? 'text-slate-800' : 'text-emerald-50'}`}>{line.replace(/^(AI|Assistant|User|Lead):\s*/i, '')}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                                        <FileText className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">No detailed transcript available for this call.</p>
                                    <p className="text-xs text-slate-400 mt-1">This could be due to a short drop-off or tracking limitations.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* WhatsApp Chat Modal */}
        {isWhatsappChatOpen && selectedWhatsappLead && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#EAFBFB] text-[#1AA6A8]">
                                <MessageCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">WhatsApp Chat History</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Contact: {selectedWhatsappLead.name}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsWhatsappChatOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 bg-white border border-slate-200 shadow-sm">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-y-auto space-y-4 bg-[#efeae2]">
                        {isFetchingChat ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <Loader2 className="w-8 h-8 text-[#1AA6A8] animate-spin mb-3" />
                                <p className="text-slate-600 font-medium">Loading chat history...</p>
                            </div>
                        ) : whatsappChat.length > 0 ? (
                            <div className="space-y-3">
                                {whatsappChat.map((msg, idx) => {
                                    const isAI = msg.role === 'assistant';
                                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const date = new Date(msg.created_at).toLocaleDateString();
                                    
                                    // simple date separator
                                    const showDate = idx === 0 || new Date(whatsappChat[idx-1].created_at).toLocaleDateString() !== date;

                                    return (
                                        <div key={idx}>
                                            {showDate && (
                                                <div className="flex justify-center my-4">
                                                    <span className="bg-white/80 rounded-md px-3 py-1 text-[11px] font-bold text-slate-500 shadow-sm">{date}</span>
                                                </div>
                                            )}
                                            <div className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm flex flex-col relative ${isAI ? 'bg-white rounded-tl-none' : 'bg-[#d9fdd3] rounded-tr-none'}`}>
                                                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-all">{msg.content}</p>
                                                    <span className="text-[10px] text-slate-500 text-right mt-1 ml-4 block">{time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center bg-white/50 rounded-xl border border-dashed border-slate-300">
                                <MessageCircle className="w-10 h-10 text-slate-300 mb-3" />
                                <h3 className="font-semibold text-slate-700">No Chat History</h3>
                                <p className="text-sm text-slate-500">The AI hasn't conversed with this lead yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}


        {/* Right Sidebar Inspector (Non-blocking) */}
        {selectedInspectorLead && (
            <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 z-[90] flex flex-col animate-in slide-in-from-right duration-300">

                {/* ── Inspector Header ─────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${getAvatarColor(selectedInspectorLead.name)}`}>
                            {getInitials(selectedInspectorLead.name)}
                        </div>
                        <div className="min-w-0">
                            {editingInspectorName ? (
                                <div className="flex items-center gap-1.5 w-full">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={inspectorNameDraft}
                                        onChange={e => setInspectorNameDraft(e.target.value)}
                                        onKeyDown={e => { 
                                            if (e.key === 'Enter') { handleUpdateLeadDetails(selectedInspectorLead.id, inspectorNameDraft, inspectorPhoneDraft); setEditingInspectorName(false); setSelectedInspectorLead((prev: any) => prev ? {...prev, name: inspectorNameDraft} : null); } 
                                            if (e.key === 'Escape') setEditingInspectorName(false); 
                                        }}
                                        className="text-base font-bold text-slate-900 bg-white border-b border-primary/50 outline-none flex-1 min-w-0"
                                    />
                                    <button 
                                        onClick={() => { handleUpdateLeadDetails(selectedInspectorLead.id, inspectorNameDraft, inspectorPhoneDraft); setEditingInspectorName(false); setSelectedInspectorLead((prev: any) => prev ? {...prev, name: inspectorNameDraft} : null); }}
                                        className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="group/inspname flex items-center gap-2">
                                    <h2 
                                        className="text-base font-bold text-slate-900 truncate cursor-pointer hover:text-primary transition-colors"
                                        onDoubleClick={() => { setInspectorNameDraft(selectedInspectorLead.name); setInspectorPhoneDraft(selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone || ''); setEditingInspectorName(true); }}
                                    >
                                        {selectedInspectorLead.name}
                                    </h2>
                                    <button 
                                        onClick={() => { setInspectorNameDraft(selectedInspectorLead.name); setInspectorPhoneDraft(selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone || ''); setEditingInspectorName(true); }}
                                        className="opacity-0 group-hover/inspname:opacity-100 p-1 text-slate-400 hover:text-primary transition-all"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            {(selectedInspectorLead.service_interest || selectedInspectorLead.notes) && (
                                <p className="text-xs text-slate-500 truncate">
                                    {selectedInspectorLead.service_interest
                                        || (selectedInspectorLead.notes ? selectedInspectorLead.notes.split('|')[0].replace('Service:', '').trim() : '')}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedInspectorLead(null)}
                        className="p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-500 bg-white border border-slate-200 shadow-sm shrink-0 ml-2"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 custom-scrollbar">

                    {/* Assigned Staff Info */}
                    {selectedInspectorLead.assigned_worker_name && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Staff</p>
                                <p className="text-sm font-bold text-slate-900">{selectedInspectorLead.assigned_worker_name}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Pipeline Stage ─────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pipeline Stage</p>
                        <select
                            value={selectedInspectorLead.pipeline_stage}
                            onChange={async (e) => {
                                const newStage = e.target.value;
                                
                                // Warning if manually bypassing Quotation stage
                                if (newStage === 'Quotation Sent' && selectedInspectorLead.pipeline_stage === 'In Discussion') {
                                    const confirmed = window.confirm("⚠️ Warning: You are manually moving this lead to Quotation Sent without sending a quotation via WhatsApp.\n\nAre you sure you want to bypass the automated quotation sending process?");
                                    if (!confirmed) return;
                                }

                                await handleMoveLead(selectedInspectorLead.id, newStage);
                                await logActivity(selectedInspectorLead.id, 'stage_changed', `Moved to "${newStage}"`, { from: selectedInspectorLead.pipeline_stage, to: newStage });
                                setSelectedInspectorLead((prev: any) => prev ? {...prev, pipeline_stage: newStage} : null);
                                setInspectorActivity(prev => [...prev, { id: Date.now().toString(), event_type: 'stage_changed', description: `Moved to "${newStage}"`, created_at: new Date().toISOString() }]);
                            }}
                            className="w-full text-sm font-bold bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-shadow shadow-sm"
                        >
                            <option disabled className="text-slate-400 font-bold bg-slate-50">-- Pipeline --</option>
                            {pipelineStages.map(stage => (
                                <option key={stage} value={stage}>{stage}</option>
                            ))}
                            <option disabled className="text-slate-400 font-bold bg-slate-50">-- Clients --</option>
                            {clientStages.map(stage => (
                                <option key={stage} value={stage}>{stage}</option>
                            ))}
                        </select>
                    </div>

                    {/* ── Service Timeline ────────────────────────────── */}
                    {(selectedInspectorLead.plannedStart || selectedInspectorLead.plannedDuration) && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Service Timeline</p>
                            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-slate-900">
                                            {selectedInspectorLead.plannedStart ? new Date(selectedInspectorLead.plannedStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                                        </p>
                                        <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                                            {selectedInspectorLead.plannedDuration ? `Duration: ${selectedInspectorLead.plannedDuration}` : 'Ongoing'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Contact Details ────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contact Details</p>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {/* Phone */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><Phone className="w-3.5 h-3.5 text-slate-400" /> Phone</span>
{editingInspectorPhone ? (
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={inspectorPhoneDraft}
                                            onChange={e => setInspectorPhoneDraft(e.target.value)}
                                            onKeyDown={e => { 
                                                if (e.key === 'Enter') { handleUpdateLeadDetails(selectedInspectorLead.id, inspectorNameDraft, inspectorPhoneDraft); setEditingInspectorPhone(false); setSelectedInspectorLead((prev: any) => prev ? {...prev, whatsapp_number: inspectorPhoneDraft, phone: inspectorPhoneDraft} : null); } 
                                                if (e.key === 'Escape') setEditingInspectorPhone(false); 
                                            }}
                                            className="text-sm text-right bg-white border border-primary/30 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary w-40"
                                            placeholder="Phone number"
                                        />
                                        <button 
                                            onClick={() => { handleUpdateLeadDetails(selectedInspectorLead.id, inspectorNameDraft, inspectorPhoneDraft); setEditingInspectorPhone(false); setSelectedInspectorLead((prev: any) => prev ? {...prev, whatsapp_number: inspectorPhoneDraft, phone: inspectorPhoneDraft} : null); }}
                                            className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 shadow-sm"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="group/inspphone flex items-center gap-2">
                                        <span 
                                            className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-primary transition-colors"
                                            onDoubleClick={() => { setInspectorNameDraft(selectedInspectorLead.name); setInspectorPhoneDraft(selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone || ''); setEditingInspectorPhone(true); }}
                                        >
                                            {formatPhoneNumber(selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone) || 'No phone'}
                                        </span>
                                        <button 
                                            onClick={() => { setInspectorNameDraft(selectedInspectorLead.name); setInspectorPhoneDraft(selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone || ''); setEditingInspectorPhone(true); }}
                                            className="opacity-0 group-hover/inspphone:opacity-100 p-1 text-slate-400 hover:text-primary transition-all"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Email */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><Mail className="w-3.5 h-3.5 text-slate-400" /> Email</span>
                                {editingInspectorEmail ? (
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            autoFocus
                                            type="email"
                                            value={inspectorEmailDraft}
                                            onChange={e => setInspectorEmailDraft(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { saveInspectorField(selectedInspectorLead.id, 'email', inspectorEmailDraft); setEditingInspectorEmail(false); } if (e.key === 'Escape') setEditingInspectorEmail(false); }}
                                            className="text-sm text-right bg-white border border-primary/30 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary w-40"
                                            placeholder="email@example.com"
                                        />
                                        <button 
                                            onClick={() => { saveInspectorField(selectedInspectorLead.id, 'email', inspectorEmailDraft); setEditingInspectorEmail(false); }}
                                            className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 shadow-sm"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <span
                                        className={`text-sm font-semibold cursor-pointer hover:text-primary transition-colors ${selectedInspectorLead.email ? 'text-primary' : 'text-slate-400 italic'}`}
                                        onDoubleClick={() => { setInspectorEmailDraft(selectedInspectorLead.email || ''); setEditingInspectorEmail(true); }}
                                        title="Double-tap to edit"
                                    >
                                        {selectedInspectorLead.email || 'Add email'}
                                    </span>
                                )}
                            </div>
                            {/* Source */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><Globe className="w-3.5 h-3.5 text-slate-400" /> Source</span>
                                <span className="text-sm font-semibold text-slate-800">{selectedInspectorLead.source || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Lead Value ─────────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lead Value</p>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {/* Monthly value */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Monthly value</span>
                                {editingLeadValueId === selectedInspectorLead.id ? (
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center bg-white rounded border border-primary/30 overflow-hidden">
                                            <span className="text-primary text-sm font-semibold pl-2">₹</span>
                                            <input
                                                type="text"
                                                value={editingLeadValueAmount}
                                                onChange={e => setEditingLeadValueAmount(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleUpdateLeadValue(selectedInspectorLead.id);
                                                        setSelectedInspectorLead((prev: any) => prev ? {...prev, valueAmount: parseFloat(editingLeadValueAmount), value: '₹'+editingLeadValueAmount+'/mo'} : null);
                                                    }
                                                    if (e.key === 'Escape') setEditingLeadValueId(null);
                                                }}
                                                autoFocus
                                                className="w-20 bg-transparent text-sm font-semibold text-primary outline-none py-1 px-1"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => {
                                                handleUpdateLeadValue(selectedInspectorLead.id);
                                                setSelectedInspectorLead((prev: any) => prev ? {...prev, valueAmount: parseFloat(editingLeadValueAmount), value: '₹'+editingLeadValueAmount+'/mo'} : null);
                                            }}
                                            className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 shadow-sm"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <span
                                        className="text-sm font-bold text-primary cursor-pointer hover:scale-105 transition-transform inline-block"
                                        title="Double-tap to edit"
                                        onDoubleClick={() => { setEditingLeadValueId(selectedInspectorLead.id); setEditingLeadValueAmount(selectedInspectorLead.valueAmount?.toString() || '0'); }}
                                    >
                                        {selectedInspectorLead.value || '₹0/mo'}
                                    </span>
                                )}
                            </div>
                            {/* Est. Annual */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Est. annual</span>
                                <span className="text-sm font-bold text-slate-800">₹{((selectedInspectorLead.valueAmount || selectedInspectorLead.estimated_value_monthly || 0) * 12).toLocaleString('en-IN')}</span>
                            </div>
                            {/* Priority */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="flex items-center gap-2 text-sm text-slate-500"><Star className="w-3.5 h-3.5 text-slate-400" /> Priority</span>
                                <select
                                    value={selectedInspectorLead.priority || 'medium'}
                                    onChange={async (e) => {
                                        await handleUpdatePriority(selectedInspectorLead.id, e.target.value);
                                        setSelectedInspectorLead((prev: any) => prev ? {...prev, priority: e.target.value} : null);
                                    }}
                                    className={`text-sm font-bold bg-transparent border-0 outline-none cursor-pointer ${selectedInspectorLead.priority === 'hot' ? 'text-red-600' : selectedInspectorLead.priority === 'cold' ? 'text-blue-600' : 'text-amber-600'}`}
                                >
                                    <option value="hot">Hot</option>
                                    <option value="medium">Medium</option>
                                    <option value="cold">Low</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── Activity Timeline ──────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Timeline</p>
                        <div className="flex flex-col gap-0">
                            {isLoadingActivity ? (
                                <div className="flex items-center gap-2 py-4 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                            ) : inspectorActivity.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-2">No activity yet.</p>
                            ) : (
                                inspectorActivity.map((evt, i) => {
                                    const isLast = i === inspectorActivity.length - 1;
                                    const dotColor = evt.event_type === 'lead_created' ? 'bg-teal-500'
                                        : evt.event_type === 'greeting_sent' ? 'bg-blue-500'
                                        : evt.event_type === 'form_filled' ? 'bg-purple-500'
                                        : evt.event_type === 'stage_changed' ? 'bg-amber-500'
                                        : evt.event_type === 'quotation_sent' ? 'bg-orange-500'
                                        : evt.event_type === 'call_received' ? 'bg-emerald-500'
                                        : evt.event_type === 'note_added' ? 'bg-indigo-500'
                                        : 'bg-slate-400';
                                    return (
                                        <div key={evt.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                                                {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                                            </div>
                                            <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
                                                <p className="text-sm font-semibold text-slate-800 leading-tight">{evt.description}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{formatActivityTime(evt.created_at)}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Add Note ──────────────────────────────────────── */}
                    <div className="border-t border-slate-100 pt-5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Add Note</p>
                        <div className="flex flex-col gap-2">
                            <textarea
                                rows={3}
                                value={inspectorNoteDraft}
                                onChange={e => setInspectorNoteDraft(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        handleAddNote(selectedInspectorLead.id, inspectorNoteDraft);
                                    }
                                }}
                                placeholder="Write a note… (Ctrl+Enter to save)"
                                className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder-slate-400 transition-all"
                            />
                            <button
                                onClick={() => handleAddNote(selectedInspectorLead.id, inspectorNoteDraft)}
                                disabled={isSavingNote || !inspectorNoteDraft.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2 rounded-lg transition-all shadow-sm"
                            >
                                {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                {isSavingNote ? 'Saving…' : 'Save Note'}
                            </button>
                        </div>
                    </div>


                    <div className="border-t border-slate-100 pt-5 mt-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Actions & Processing</h3>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { fetchWhatsappChat(selectedInspectorLead); setSelectedInspectorLead(null); }}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                            >
                                <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform text-primary" />
                                View AI Chat History
                            </button>
                            
                            {selectedInspectorLead.pipeline_stage === 'New Inquiry' && (
                                <button
                                    onClick={async () => {
                                        openAgentModal(selectedInspectorLead, 'inquiry');
                                    }}
                                    className="w-full bg-[#E6F7F7] hover:bg-primary hover:text-white border border-[#1AA6A8]/20 text-[#0E7C7E] font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Send Greeting Message
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'In Discussion' && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={async () => {
                                            openAgentModal(selectedInspectorLead, 'quotation');
                                        }}
                                        className="w-full bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-100 text-amber-800 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                    >
                                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        Send Quotation
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const hasQuotationValue = selectedInspectorLead.quoted_monthly_rate > 0 || selectedInspectorLead.estimated_value_monthly > 0 || selectedInspectorLead.valueAmount > 0;
                                            const hasQuotationLog = inspectorActivity.some((evt: any) => evt.event_type === 'quotation_sent');
                                            
                                            if (!hasQuotationValue && !hasQuotationLog) {
                                                const confirmed = window.confirm("⚠️ Warning: You haven't sent a quotation to this lead on WhatsApp yet.\n\nAre you sure you want to bypass the quotation and send the consent form directly?");
                                                if (!confirmed) return;
                                            }

                                            const toastId = toast.loading("Approving quotation and sending consent form...");
                                            try {
                                                // 1. Move lead to Quotation Sent
                                                await handleMoveLead(selectedInspectorLead.id, 'Quotation Sent');
                                                
                                                // Fetch latest quotation for autofill
                                                const { data: latestQuote } = await supabase
                                                    .from('crm_quotations')
                                                    .select('*')
                                                    .eq('lead_id', selectedInspectorLead.id)
                                                    .order('created_at', { ascending: false })
                                                    .limit(1)
                                                    .maybeSingle();

                                                let flowData: any = {
                                                    relative_name: selectedInspectorLead.name || '',
                                                    patient_name: '',
                                                    contact_number: (selectedInspectorLead.whatsapp_number || selectedInspectorLead.phone || '').replace(/\D/g, '')
                                                };
                                                if (latestQuote) {
                                                    flowData = {
                                                        ...flowData,
                                                        service_category: latestQuote.service_category || latestQuote.service_name || '',
                                                        offered_time: latestQuote.shift_type || '',
                                                        service_start_date: latestQuote.start_date ? latestQuote.start_date.split('T')[0] : ''
                                                    };
                                                }
                                                
                                                // 2. Dispatch Consent Form automatically with autofill data
                                                await dispatchWhatsAppTemplate(selectedInspectorLead, 'consent', undefined, flowData);
                                                
                                                toast.success("✅ Quotation Approved! Consent form sent to client.", { id: toastId });
                                                setSelectedInspectorLead(null);
                                            } catch (err: any) {
                                                console.error("[Approve Error]", err);
                                                toast.error(`Failed to complete automation: ${err.message}`, { id: toastId });
                                            }
                                        }}
                                        className="w-full bg-[#E6F7F7] hover:bg-primary hover:text-white border border-[#1AA6A8]/20 text-[#0E7C7E] font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                    >
                                        <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        Quotation Approved
                                    </button>
                                </div>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Quotation Sent' && (
                                <button
                                    onClick={() => { openAgentModal(selectedInspectorLead, 'consent'); }}
                                    className="w-full bg-primary/10 hover:bg-primary hover:text-white border border-primary/15 text-primary font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <FileText className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    Send Consent Form Link
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Form Submitted' && (
                                <button
                                    onClick={() => { openStaffPicker(selectedInspectorLead); setSelectedInspectorLead(null); }}
                                    className="w-full bg-purple-50 hover:bg-purple-500 hover:text-white border border-purple-100 text-purple-800 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Assign Staff Member
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Staff Assigned' && (
                                <button
                                    onClick={() => { openAgentModal(selectedInspectorLead, 'deposit'); }}
                                    className="w-full bg-orange-50 hover:bg-orange-500 hover:text-white border border-orange-100 text-orange-800 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <FileText className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    Send Deposit Invoice
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Deposit Pending' && (
                                <button
                                    onClick={async () => {
                                        const toastId = toast.loading('Confirming deposit and activating client...');
                                        try {
                                            await handleMoveLead(selectedInspectorLead.id, 'Active Client');
                                            await logActivity(selectedInspectorLead.id, 'stage_changed', 'Deposit received — moved to Active Client');
                                            toast.success('✅ Deposit confirmed! Lead moved to Active Client.', { id: toastId });
                                            setSelectedInspectorLead(null);
                                        } catch (err: any) {
                                            toast.error(`Failed: ${err.message}`, { id: toastId });
                                        }
                                    }}
                                    className="w-full bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-200 text-emerald-800 font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Deposit Received → Activate Client
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Active Client' && (
                                <button
                                    onClick={() => {
                                        openClientInvoiceGenerator(selectedInspectorLead);
                                    }}
                                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 group"
                                >
                                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    Send Monthly Bill
                                </button>
                            )}

                            {selectedInspectorLead.pipeline_stage === 'Monthly Billing' && (
                                <button
                                    onClick={() => {
                                        convertToClient(selectedInspectorLead.id, selectedInspectorLead.name);
                                        setSelectedInspectorLead(null);
                                    }}
                                    className="w-full bg-gradient-to-r from-primary to-[#0E7C7E] text-white font-bold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Users className="w-4 h-4" />
                                    Convert to Client Master
                                </button>
                            )}
                        </div>
                    </div>

                </div>
                
                {/* Inspector Footer Actions */}
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 mt-auto space-y-2">
                    {/* Review request — only for active/billing clients */}
                    {['Active Client', 'Monthly Billing', 'Closed Won'].includes(selectedInspectorLead.pipeline_stage) && (
                        <button
                            onClick={() => sendReviewRequest(selectedInspectorLead)}
                            className="w-full bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200 text-amber-700 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Star className="w-4 h-4" />
                            Send Review Request
                        </button>
                    )}
                    <button
                        onClick={() => handleDeleteLead(selectedInspectorLead.id, selectedInspectorLead.name)}
                        className="w-full bg-red-50 hover:bg-red-500 hover:text-white border border-red-100 text-red-600 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Lead
                    </button>
                </div>
            </div>
        )}

            {/* Returning Client Modal — portal so Voice AI tab overflow cannot hide it */}
            {returningClientModal &&
                createPortal(
                    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-amber-50 flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                    <Users className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Returning Client Detected</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">This phone matches Client Master</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                                    <p className="font-bold text-slate-900">{returningClientModal.existingClient.client_name}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{returningClientModal.existingClient.phone_number}</p>
                                </div>
                                <p className="text-sm text-slate-600">How would you like to handle this enquiry?</p>
                                <button
                                    type="button"
                                    onClick={handleReturningClientNewLead}
                                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                                >
                                    <Plus className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-blue-800 text-sm">New Independent Lead</p>
                                        <p className="text-xs text-blue-600 mt-0.5">Fresh enquiry, no connection to old record.</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReturningClientLink}
                                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
                                >
                                    <Users className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-emerald-800 text-sm">Link to Existing Client</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">New lead linked to {returningClientModal.existingClient.client_name}'s history.</p>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const fromVoice = returningClientModal.pendingLeadData?.kind === 'voice';
                                        setReturningClientModal(null);
                                        if (!fromVoice) setIsAddLeadModalOpen(true);
                                    }}
                                    className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Delete Choice Modal */}
            {deleteChoiceModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Delete "{deleteChoiceModal.name}"?</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Choose how to delete this lead</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <button
                                onClick={() => handleMoveToTrash(deleteChoiceModal.id, deleteChoiceModal.name)}
                                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                            >
                                <Trash2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-800 text-sm">Move to Trash</p>
                                    <p className="text-xs text-amber-600 mt-0.5">Recoverable for 30 days. All data preserved.</p>
                                </div>
                            </button>
                            <button
                                onClick={() => handleDeletePermanently(deleteChoiceModal.id, deleteChoiceModal.name)}
                                className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
                            >
                                <Trash2 className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-red-700 text-sm">Delete Permanently</p>
                                    <p className="text-xs text-red-500 mt-0.5">Cannot be undone. All data will be lost.</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setDeleteChoiceModal(null)}
                                className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Service Period Modal */}
            {isServicePeriodOpen && selectedWorker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Assign Service Period
                            </h3>
                            <button onClick={() => setIsServicePeriodOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Service Type</label>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                                    <button 
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${serviceType === 'one_day' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => {
                                            setServiceType('one_day');
                                            const dailyRate = staffPickerTargetLead?.quoted_daily_rate || 0;
                                            setCalculatedBill(Math.round(dailyRate));
                                        }}
                                    >One Day</button>
                                    <button 
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${serviceType === 'date_range' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => {
                                            setServiceType('date_range');
                                            // Start with monthly rate as default for range
                                            setCalculatedBill(staffPickerTargetLead?.quoted_monthly_rate || 0);
                                        }}
                                    >Date Range</button>
                                </div>
                            </div>
                            
                            {serviceType === 'one_day' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                                        <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={serviceStartDate} onChange={e => setServiceStartDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Hours</label>
                                        <input type="number" min="1" max="24" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={serviceHours} onChange={e => {
                                            const h = parseInt(e.target.value) || 1;
                                            setServiceHours(h);
                                            // Pro-rate the daily rate based on 12h standard
                                            const dailyRate = staffPickerTargetLead?.quoted_daily_rate || 0;
                                            const hourlyRate = dailyRate / 12;
                                            setCalculatedBill(Math.round(h * hourlyRate));
                                        }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                                            <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={serviceStartDate} onChange={e => {
                                                setServiceStartDate(e.target.value);
                                                if (serviceEndDate) {
                                                    const days = Math.max(1, Math.ceil((new Date(serviceEndDate).getTime() - new Date(e.target.value).getTime()) / (1000 * 3600 * 24)) + 1);
                                                    setCalculatedBill(days * (selectedWorker.monthly_daily_rate || 0));
                                                }
                                            }} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">End Date <span className="font-normal text-slate-400">(optional — leave blank for open-ended)</span></label>
                                            <input type="date" min={serviceStartDate} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={serviceEndDate} onChange={e => {
                                                setServiceEndDate(e.target.value);
                                                if (serviceStartDate) {
                                                    const days = Math.max(1, Math.ceil((new Date(e.target.value).getTime() - new Date(serviceStartDate).getTime()) / (1000 * 3600 * 24)) + 1);
                                                    
                                                    // Intelligent estimation:
                                                    // Both rates are now per-day rates.
                                                    // If days >= 30, use the monthly-commitment per-day rate.
                                                    // Otherwise, use the standard short-term per-day rate.
                                                    const monthlyDayRate = staffPickerTargetLead?.quoted_monthly_rate || 0;
                                                    const dailyRate = staffPickerTargetLead?.quoted_daily_rate || 0;
                                                    
                                                    if (days >= 30) {
                                                        setCalculatedBill(Math.round(days * monthlyDayRate));
                                                    } else {
                                                        setCalculatedBill(Math.round(days * dailyRate));
                                                    }
                                                }
                                            }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Shift Hours</label>
                                        <input type="number" min="1" max="24" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={serviceHours} onChange={e => setServiceHours(parseInt(e.target.value) || 12)} />
                                    </div>
                                </>
                            )}
                            
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex justify-between items-center mt-2">
                                <span className="font-bold text-primary">Estimated Total Bill</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xl font-extrabold text-primary">₹</span>
                                    <input 
                                        type="number" 
                                        className="w-24 bg-transparent text-xl font-extrabold text-primary border-b border-primary/30 outline-none text-right focus:border-primary transition-colors"
                                        value={calculatedBill}
                                        onChange={e => setCalculatedBill(parseInt(e.target.value) || 0)}
                                        title="Click to override quoted amount"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button onClick={() => setIsServicePeriodOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleConfirmServicePeriod} className="flex-1 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">Confirm Assignment</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ADD LEAD MODAL ─── */}
            {isAddLeadModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsAddLeadModalOpen(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Add New Lead</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Fill in the lead's details to add them to the pipeline.</p>
                                </div>
                                <button onClick={() => setIsAddLeadModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="px-6 py-5 flex flex-col gap-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={addLeadName}
                                    onChange={e => setAddLeadName(e.target.value)}
                                    placeholder="e.g. Maulik Kariya"
                                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8] transition-all"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">WhatsApp / Phone Number</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={addLeadPhone}
                                        onChange={e => {
                                            setAddLeadPhone(e.target.value);
                                            checkAddLeadDuplicate(e.target.value);
                                        }}
                                        placeholder="e.g. 9974093920"
                                        className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                                            addLeadDuplicateWarning
                                                ? 'border-amber-400 focus:ring-amber-300/30 focus:border-amber-400'
                                                : 'border-slate-200 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8]'
                                        }`}
                                    />
                                    {addLeadCheckingDuplicate && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1AA6A8] rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Duplicate Warning Banner */}
                                {addLeadDuplicateWarning && (
                                    <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-start gap-2.5">
                                            <div className="text-amber-500 mt-0.5">⚠️</div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-amber-800">Duplicate phone number detected!</p>
                                                <p className="text-xs text-amber-700 mt-0.5">
                                                    An existing lead <strong>{addLeadDuplicateWarning.name}</strong> already uses this number
                                                    (Stage: <strong>{addLeadDuplicateWarning.pipeline_stage}</strong>).
                                                </p>
                                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={addLeadConfirmDuplicate}
                                                        onChange={e => setAddLeadConfirmDuplicate(e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded accent-amber-500"
                                                    />
                                                    <span className="text-xs text-amber-700 font-medium">I understand — this is a different person using the same number</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setIsAddLeadModalOpen(false)}
                                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!addLeadName.trim()) { toast.error('Please enter a name.'); return; }
                                    if (addLeadDuplicateWarning && !addLeadConfirmDuplicate) { toast.error('Please confirm the duplicate warning to proceed.'); return; }
                                    handleAddManualLead({
                                        name: addLeadName,
                                        phone: addLeadPhone,
                                        isDuplicate: !!addLeadDuplicateWarning && addLeadConfirmDuplicate,
                                        duplicateOfId: addLeadDuplicateWarning?.id,
                                    });
                                }}
                                disabled={!addLeadName.trim() || (!!addLeadDuplicateWarning && !addLeadConfirmDuplicate)}
                                className="flex-1 py-2.5 text-sm font-bold text-white bg-[#1AA6A8] rounded-xl hover:bg-[#1AA6A8]/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Add Lead
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Invoice Generator Modal */}
            {isClientInvoiceOpen && clientInvoiceLead && (() => {
                const total = ciDays * ciRate;
                const net = Math.max(0, total - ciDeposit);
                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-slate-900 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white">Client Invoice Generator</h2>
                                        <p className="text-xs text-slate-400">{clientInvoiceLead.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsClientInvoiceOpen(false)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                {!ciAttendanceVerified && (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2.5 rounded-lg text-xs font-medium flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                                        <p>Attendance is not yet marked or verified by HR for this period. Days of service may be inaccurate.</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Start Date</label>
                                        <input type="date" value={ciStartDate} onChange={e => setCiStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1AA6A8]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">End Date</label>
                                        <input type="date" value={ciEndDate} onChange={e => setCiEndDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1AA6A8]" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Days of Service</label>
                                        <input type="number" min="0" step="0.5" value={ciDays} onChange={e => setCiDays(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1AA6A8]" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Client Rate / Day (₹)</label>
                                        <input type="number" min="0" value={ciRate} onChange={e => setCiRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1AA6A8]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Deposit Already Collected (₹)</label>
                                    <input type="number" min="0" value={ciDeposit} onChange={e => setCiDeposit(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1AA6A8]" />
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">{ciDays} day{ciDays !== 1 ? 's' : ''} × ₹{ciRate.toLocaleString('en-IN')}/day</span>
                                        <span className="font-semibold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                                    </div>
                                    {ciDeposit > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Deposit Collected</span>
                                            <span className="font-semibold text-emerald-600">− ₹{ciDeposit.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-1">
                                        <span className="text-slate-800">Net Payable</span>
                                        <span className="text-[#1AA6A8]">₹{net.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-2xl">
                                <button onClick={() => setIsClientInvoiceOpen(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors w-full sm:w-auto text-center">Cancel</button>
                                <div className="flex gap-3 flex-1 sm:flex-none w-full sm:w-auto">
                                    <button
                                        onClick={async () => {
                                            const total = ciDays * ciRate;
                                            const net = Math.max(0, total - ciDeposit);
                                            const lead = clientInvoiceLead;
                                            setIsClientInvoiceOpen(false);
                                            const toastId = toast.loading(`Generating invoice for ${lead.name}...`);
                                            try {
                                                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                                                const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
                                                const formatDateStr = (ds: string) => {
                                                    if (!ds) return '';
                                                    const [y, m, d] = ds.split('-');
                                                    return `${d}/${m}/${y}`;
                                                };
                                                const formattedPeriod = (ciStartDate && ciEndDate)
                                                    ? `${formatDateStr(ciStartDate)} To ${formatDateStr(ciEndDate)}`
                                                    : 'As agreed';
                                                // 1. Generate PDF
                                                const invResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                                                    body: JSON.stringify({ lead_id: ciLeadId || lead.id, deposit_amount: net, service_period: formattedPeriod, is_deposit: false })
                                                });
                                                if (!invResp.ok) throw new Error(await invResp.text());
                                                const invData = await invResp.json();
                                                if (invData.error) throw new Error(invData.error);
                                                const invoicePdfUrl = invData.public_url;
                                                toast.loading('Sending invoice via WhatsApp...', { id: toastId });
                                                // 2. Send template message with QR header + PDF follow-up
                                                let phoneDigits = lead.whatsapp_number || lead.phone || '';
                                                phoneDigits = phoneDigits.replace(/\D/g, '');
                                                if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;
                                                const waResp = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
                                                    body: JSON.stringify({
                                                        phone: phoneDigits,
                                                        leadId: lead.id,
                                                        useTemplate: true,
                                                        templateName: 'client_monthly_invoice',
                                                        templateParams: [lead.name || 'there', String(net)],
                                                        sendInvoicePdf: true,
                                                        invoicePdfUrl: invoicePdfUrl,
                                                    })
                                                });
                                                const waData = await waResp.json();
                                                if (!waData.success) throw new Error(waData.error || 'WhatsApp dispatch failed');
                                                // Move lead to Monthly Billing stage
                                                await supabase
                                                    .from('crm_leads')
                                                    .update({ pipeline_stage: 'Monthly Billing' })
                                                    .eq('id', ciLeadId || lead.id);
                                                toast.success(`Invoice sent to ${lead.name} on WhatsApp! ✅ Moved to Monthly Billing.`, { id: toastId, duration: 4000 });
                                            } catch (err: any) {
                                                toast.error(err.message || 'Failed to send invoice', { id: toastId });
                                            }
                                        }}
                                        className="flex-[1.5] sm:flex-none px-5 py-2.5 rounded-xl font-bold text-white bg-[#25D366] hover:bg-[#1ebd5a] transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        <Send className="w-4 h-4" /> Send Invoice on WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
