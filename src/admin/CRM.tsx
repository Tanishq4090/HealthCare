import { useState, useEffect, useMemo, useRef } from 'react';
import { Bot, Mail, MessageSquare, Phone, CheckCircle2, FileText, Send, Users, Loader2, Mic, Plus, PhoneOff, Globe, Edit3, X, MessageCircle, Trash2, ArrowLeft, ArrowRight, Calendar, AlertCircle, Play, Pause, Volume2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useConversation } from '@elevenlabs/react';
import { MOCK_WORKERS } from '../data/mockWorkers';
import { assignWorkerToClient } from '../services/assignmentService';

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
    const [activeTab, setActiveTab] = useState<'pipeline' | 'clients' | 'automations' | 'voice'>(() => {
        return (localStorage.getItem('crmActiveTab') as any) || 'pipeline';
    });

    useEffect(() => {
        localStorage.setItem('crmActiveTab', activeTab);
    }, [activeTab]);
    const [leads, setLeads] = useState<any[]>([]);

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
                if (data.pipeline_stages) {
                    setPipelineStages(data.pipeline_stages);
                }
                if (data.client_stages) {
                    setClientStages(data.client_stages);
                }
                if (data.whatsapp_templates) {
                    setWhatsappTemplates(data.whatsapp_templates);
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

        return () => {
            clearInterval(interval);
            supabase.removeChannel(callSub);
            supabase.removeChannel(leadsSub);
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
            } else if (payload.templateName === 'greeting_msg') {
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
    const [agentTargetLead, setAgentTargetLead] = useState<any>(null);
    const [agentTargetAction, setAgentTargetAction] = useState<'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing'>('inquiry');
    const [assignmentResult, setAssignmentResult] = useState<any>(null);

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
            Hinglish: "🌟 Welcome to 99 Care! 🌟\n{{name}} sir/ma'am, aapki inquiry mili humein. Hamari team aapke ghar par best healthcare staff provide karne ke liye ready hai!\n\nKoi bhi sawaal ho toh seedha reply karein. Hum aapki service mein!💙✨",
            Hindi: "Namaste {{name}} ji, 99 Care mein aapka swagat hai! Aapki inquiry hamein mili hai. Humari team aapke liye best healthcare solution lekar aayegi. Kripya apni zaroorat batayein.",
            English: "Hi {{name}}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!"
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
        localStorage.setItem('whatsappTemplates', JSON.stringify(whatsappTemplates));
        
        // Safe Cloud Sync
        const syncToCloud = async () => {
            try {
                await supabase.from('automation_settings').upsert({ 
                    id: 'global', 
                    whatsapp_templates: whatsappTemplates 
                }, { onConflict: 'id' });
            } catch (e) { /* Fallback to local only if column doesn't exist */ }
        };
        syncToCloud();
    }, [whatsappTemplates]);

    const PROTECTED_STAGES = ['New Lead', 'Active Client', 'Closed Won', 'Lost'];

    // Initialize pipelineStages from localStorage or defaults
    // Initialize pipelineStages - prioritize clean split defaults
    const [pipelineStages, setPipelineStages] = useState<string[]>(['New Lead', 'New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending']);

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



    const [workflows, setWorkflows] = useState({
        greeting: true,
        drip: false
    });

    // Voice AI State
    const [calls, setCalls] = useState<any[]>([]);
    const [isLoadingVoice, setIsLoadingVoice] = useState(true);
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
                    lead_id: call.lead_id
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
    }, [activeTab]);
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

        // Target leads in New stage only
        const newInquiryLeads = leads.filter(l => l.pipeline_stage === 'New');

        if (newInquiryLeads.length === 0) {
            toast.info("No leads in 'New' stage to greet. There may not be any fresh ungreeted leads right now.");
            return;
        }

        const confirmed = window.confirm(
            `Send WhatsApp greeting to ${newInquiryLeads.length} lead(s) in "New Inquiry"?\n\n` +
            newInquiryLeads.map(l => `• ${l.name}`).join('\n')
        );
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
                        useTemplate: true,
                        templateName: 'greeting_msg',
                        templateParams: [lead.name ? lead.name.split('—')[0].trim() : 'there'],
                    }),
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.details?.message || err.error || err.message || `HTTP ${response.status}`);
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
            const { data: leadsData, error: leadsError } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
            if (leadsError) throw leadsError;

            // Fetch active worker assignments to join the current staff member
            let enrichedLeads = leadsData || [];
            try {
                const { data: assignments } = await supabase
                    .from('worker_assignments')
                    .select('client_id, employee_id')
                    .eq('assignment_status', 'active');
                
                const { data: employees } = await supabase
                    .from('employees')
                    .select('id, full_name, job_title');
                
                if (assignments && employees) {
                    const empMap = new Map(employees.map(e => [e.id, { name: e.full_name, role: e.job_title }]));
                    const assignMap = new Map(assignments.map(a => [a.client_id, empMap.get(a.employee_id)]));
                    
                    enrichedLeads = enrichedLeads.map((lead: any) => ({
                        ...lead,
                        assignedWorker: assignMap.get(lead.id) || null
                    }));
                }
            } catch (e) { console.error('Failed to map assignments', e); }

            setLeads(enrichedLeads);
        } catch (err: any) {
            console.error('Error fetching leads:', err);
        } finally {
            setIsLoading(false);
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
            const { data, error } = await supabase.from('employees').select('*');
            
            if (error) throw error;

            if (data && data.length > 0) {
                // Filter in JS to be safe against schema variations
                const available = data.filter(w => 
                    (w.status && w.status.toLowerCase() === 'available')
                );
                // Map unified fields to legacy UI expectations
                const mapped = available.map(w => ({ ...w, name: w.full_name || w.name, role: w.job_title || w.role }));
                setAvailableWorkers(mapped.length > 0 ? mapped : MOCK_WORKERS.filter(w => w.status === 'Available'));
            } else {
                setAvailableWorkers(MOCK_WORKERS.filter(w => w.status === 'Available'));
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
        setSelectedWorker(worker);
        setIsStaffPickerOpen(false);

        // Show loading state while assignment is created
        const toastId = toast.loading(`Creating assignment for ${worker.name || worker.full_name}...`);

        try {
            // Guard: mock workers have numeric IDs (e.g. '3') — not valid UUIDs
            const isRealWorker = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(worker.id);
            if (!isRealWorker) {
                toast.error(
                    `Cannot assign "${worker.name || worker.full_name}" — this is a demo worker. Please add real workers in the HR module first.`,
                    { id: toastId }
                );
                return;
            }
            // Create the assignment + ID card link FIRST
            const result = await assignWorkerToClient(
                worker.id, 
                staffPickerTargetLead.id,
                undefined,
                0,   // depositPaid (default to 0 via CRM workflow here)
                true // skipWhatsApp — CRM dispatch will handle it
            );

            // Store the result so handleDispatchMessage can use it later
            setAssignmentResult(result);

            // Now open the WhatsApp modal with the REAL shareable URL
            setAgentTargetLead(staffPickerTargetLead);
            setAgentTargetAction('staff');
            setIsEditingTemplate(false);

            // Generate draft with real link injected
            const draft = generateWhatsappDraft(
                staffPickerTargetLead.name, 
                'staff', 
                agentDraftLang, 
                worker,
                result.shareableUrl  // pass the real URL
            );
            setAgentDraftText(draft);
            setIsAgentModalOpen(true);

            toast.success(
                `${worker.name || worker.full_name} assigned! Review the message below.`, 
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

    const openAgentModal = (lead: any, action: 'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing') => {
        setAgentTargetLead(lead);
        setAgentTargetAction(action);
        setIsEditingTemplate(false);
        if (action === 'quotation') {
            setQuotationVars({ v1: '', v2: '', v3: '', v4: '' });
        }
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

    const handleSaveTemplate = () => {
        const updated = {
            ...whatsappTemplates,
            [agentTargetAction]: {
                ...whatsappTemplates[agentTargetAction],
                [agentDraftLang]: templateDraftText
            }
        };
        setWhatsappTemplates(updated);
        localStorage.setItem('whatsappTemplates', JSON.stringify(updated));

        setIsEditingTemplate(false);
        toast.success("Default template saved successfully!");
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
            
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    phone: phoneDigits,
                    message: agentDraftText,
                    leadId: agentTargetLead?.id,
                    useTemplate: agentTargetAction === 'inquiry' || agentTargetAction === 'quotation' || agentTargetAction === 'consent',
                    templateName: agentTargetAction === 'inquiry' ? 'greeting_msg' 
                                  : (agentTargetAction === 'quotation' ? 'quotation_v2' 
                                  : (agentTargetAction === 'consent' ? 'consent_form' : undefined)),
                    templateParams: agentTargetAction === 'quotation' 
                                    ? [quotationVars.v1, quotationVars.v2, quotationVars.v3, quotationVars.v4] 
                                    : (agentTargetAction === 'inquiry' || agentTargetAction === 'consent' ? [(agentTargetLead?.name || 'there')] : undefined),
                })
            });

            const textRes = await response.text().catch(() => '');
            let resData: any = {};
            try { resData = textRes ? JSON.parse(textRes) : {}; } catch(e) {}
            
            if (!response.ok) {
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
                // If it was quotations -> move to Quotation Sent
                else if (agentTargetAction === 'quotation') {
                    await handleMoveLead(agentTargetLead.id, 'Quotation Sent');
                    toast.success(`Quotation sent! Moved ${agentTargetLead.name} to Quotation Sent.`, { id: toastId, duration: 4000 });
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
                // If Consent Form -> move to Form Submitted (or keep in Quotation Sent but user asked for automation)
                else if (agentTargetAction === 'consent') {
                    await handleMoveLead(agentTargetLead.id, 'Form Submitted');
                    toast.success(`Consent Form link dispatched! Moved ${agentTargetLead.name} to Form Submitted.`, { id: toastId, duration: 4000 });
                }
                // If Deposit Invoice -> move to Deposit Pending
                else if (agentTargetAction === 'deposit') {
                    await handleMoveLead(agentTargetLead.id, 'Deposit Pending');
                    toast.success(`Deposit Invoice dispatched! Moved ${agentTargetLead.name} to Deposit Pending.`, { id: toastId, duration: 4000 });
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
                    const newLead = payload.new;
                    setLeads(prev => prev.map(lead => lead.id === newLead.id ? { ...lead, ...newLead } : lead));
                    
                    // Trigger a toast notification if the AI moved the lead
                    const oldLead = payload.old;
                    if (oldLead && newLead.pipeline_stage !== oldLead.pipeline_stage) {
                        toast.success(`🤖 AI Agent moved ${newLead.name} to "${newLead.pipeline_stage}"!`);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'crm_leads' },
                (payload) => {
                    setLeads(prev => [payload.new, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const handleMoveLead = async (id: string, newStage: string) => {
        // Move instantly on frontend for immediate feedback
        setLeads(prev => prev.map(lead => lead.id === id ? { ...lead, pipeline_stage: newStage } : lead));
        toast.info(`Lead moved to ${newStage}`);

        // If this is a hardcoded mock lead (ID length < 10), there's no need to update Supabase
        if (id.length < 10) return;

        try {
            const { error } = await supabase
                .from('crm_leads')
                .update({ pipeline_stage: newStage })
                .eq('id', id);

            if (error) throw error;
            // Background refresh to ensure consistency
            fetchLeads();
        } catch (error: any) {
            console.error("Error updating lead stage:", error);
            toast.error(`Failed to move lead: ${error.message}`);
            // Revert on error
            fetchLeads();
        }
    };

    const handleDeleteLead = async (leadId: string, leadName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${leadName}"? This action cannot be undone.`)) return;

        // Remove from UI immediately
        setLeads(prev => prev.filter(l => l.id !== leadId));
        toast.success(`Lead "${leadName}" deleted.`);

        // If mock lead (short ID), skip Supabase
        if (leadId.length < 10) return;

        try {
            // Unassign workers automatically
            await supabase.from('workers')
                .update({ assigned_client: null, status: 'Available' })
                .eq('assigned_client', leadName);

            const { error } = await supabase
                .from('crm_leads')
                .delete()
                .eq('id', leadId);

            if (error) {
                throw new Error(error.message || "Delete blocked");
            }
        } catch (err: any) {
            console.error('Failed to delete lead:', err);
            toast.error(`Database blocked deletion. Restoring UI...`);
            fetchLeads(); // Re-fetch to restore
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
            return {
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), valueAmount: l.estimated_value_monthly, value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage, phone: l.phone, whatsapp_number: l.whatsapp_number, priority: l.priority || 'medium',
                isDuplicate: p && p.length === 10 ? phoneCounts[p] > 1 : false
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

    const handleUpdateLeadDetails = async (leadId: string) => {
        const newName = editingLeadName.trim();
        const newPhone = editingLeadPhone.trim();

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
        // Optimistic
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, priority: newPriority } : l));
        if (leadId.length >= 10) {
            try {
                const { error } = await supabase.from('crm_leads').update({ priority: newPriority }).eq('id', leadId);
                if (error) throw error;
                toast.success('Priority updated');
            } catch (err: any) {
                console.error("Error updating priority", err);
                toast.error("Failed to update priority");
                fetchLeads(); // revert
            }
        }
    };

    const convertToClient = async (leadId: string, leadName: string) => {
        if (window.confirm(`Are you sure you want to convert ${leadName} to a permanent Client Master entry?`)) {
            // Optimistic behavior: remove from pipeline view for snappiness
            setLeads(prev => prev.filter(l => l.id !== leadId));

            // Add to log
            fetchDeliveryLogs();

            toast.success(`${leadName} has been converted successfully!`);
        }
    };

    const captureCallAsLead = async (callId: string | number) => {
        const call = calls.find(c => c.id === callId);
        if (!call) return;

        try {
            // Determine initial pipeline stage based on greeting success
            let initialStage = 'In Discussion';
            const phoneToCheck = call.capturedWhatsapp || call.phone;
            
            if (phoneToCheck && phoneToCheck !== 'Unknown Number') {
                const last10 = phoneToCheck.replace(/\D/g, '').slice(-10);
                const { data: greetingSent } = await supabase
                    .from('whatsapp_messages')
                    .select('id')
                    .ilike('phone', `%${last10}%`)
                    .ilike('content', '%[Automated Greeting]%')
                    .maybeSingle();
                
                if (greetingSent) {
                    initialStage = 'In Discussion';
                }
            }

            const { data: newLead, error } = await supabase.from('crm_leads').insert([{
                name: call.capturedName || 'Voice Lead',
                phone: (!call.phone || call.phone === 'Unknown Number') ? null : call.phone,
                whatsapp_number: (!call.capturedWhatsapp || call.capturedWhatsapp === 'Unknown Number') ? null : call.capturedWhatsapp,
                source: 'AI Phone Call',
                status: 'AI Handled',
                pipeline_stage: initialStage,
                estimated_value_monthly: call.capturedValue || 0,
            }]).select('id').single();

            if (error) throw error;

            // Mark this conversation_id as processed in call_transcripts
            // so the Edge Function's new conversation_id-based check picks it up
            if (newLead?.id && call.id) {
                await supabase.from('call_transcripts').upsert({
                    conversation_id: String(call.id),
                    lead_id: newLead.id,
                    phone_number: call.phone === 'Unknown Number' ? null : call.phone,
                    called_at: new Date().toISOString(),
                }, { onConflict: 'conversation_id' });
            }

            // Optimistically mark the call as processed in the UI
            setCalls(prev => prev.map(c => c.id === callId ? { ...c, status: 'Processed' } : c));
            fetchLeads();

            toast.success(`Successfully added ${call.capturedName || 'Lead'} to the pipeline!`);
        } catch (error: any) {
            console.error("Error creating lead from call:", error);
            toast.error(`Failed to create lead: ${error.message}`);
        }
    };

    const handleAddManualLead = async () => {
        try {
            const { error } = await supabase.from('crm_leads').insert([{
                name: 'New Lead',
                phone: '',
                whatsapp_number: '',
                source: 'Manual Add',
                status: 'New',
                pipeline_stage: pipelineStages[0] || 'New Lead',
                estimated_value_monthly: 0,
            }]);
            
            if (error) throw error;
            toast.success("Manual Lead created! Double-click to edit name/number.");
            fetchLeads();
        } catch (err: any) {
            toast.error("Failed to add lead: " + err.message);
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
                            <button onClick={handleAddManualLead} className="px-3 sm:px-4 py-2 bg-[#E6F7F7] text-[#1AA6A8] border border-[#1AA6A8]/20 text-xs sm:text-sm font-bold rounded-lg hover:bg-[#EAFBFB] transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm">
                                <Plus className="w-4 h-4" /> Add Lead
                            </button>
                            <button onClick={handleExportLeadsToCSV} className="px-3 sm:px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs sm:text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm hidden sm:flex">
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
                        {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="ml-3 text-slate-500 font-medium">Loading live pipeline...</span>
                        </div>
                    ) : (
                        <>
                            {columns.map((col, idx) => (
                                <div key={idx} className="w-[280px] sm:w-[320px] shrink-0 flex flex-col bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="p-4 border-b border-slate-200 bg-white rounded-t-xl relative group/header">
                                        {/* Stage Header w/ Edit toggle */}
                                        <div className="flex items-center justify-between">
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
                                                    className="font-semibold text-slate-900 cursor-text hover:text-primary transition-colors truncate pr-2 w-[180px]"
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

                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                                                    {col.count}
                                                </span>

                                                {/* Header Dropdown Menu (Hover based) */}
                                                <div className="absolute right-2 top-3 opacity-0 group-hover/header:opacity-100 transition-opacity bg-white shadow-sm border border-slate-200 rounded-md flex overflow-hidden">
                                                    <button
                                                        disabled={idx === 0}
                                                        onClick={() => handleSlideStage(idx, 'left')}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors border-r border-slate-100" title="Slide Left"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        disabled={idx === activeStages.length - 1}
                                                        onClick={() => handleSlideStage(idx, 'right')}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-colors border-r border-slate-100" title="Slide Right"
                                                    >
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>

                                                    {!PROTECTED_STAGES.includes(col.title) && (
                                                        <button
                                                            onClick={() => handleDeleteStage(col.title, idx)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete Stage"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 flex-1 overflow-y-auto space-y-3">
                                        {col.items.map((item) => (
                                            <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-default group relative">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div
                                                        className="flex flex-col flex-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onDoubleClick={() => {
                                                            setEditingLeadDetailsId(item.id);
                                                            setEditingLeadName(item.name);
                                                            setEditingLeadPhone(item.phone || item.whatsapp_number || '');
                                                        }}
                                                    >
                                                        {editingLeadDetailsId === item.id ? (
                                                            <div className="space-y-1 pr-2">
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    value={editingLeadName}
                                                                    onChange={e => setEditingLeadName(e.target.value)}
                                                                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
                                                                    placeholder="Lead Name"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editingLeadPhone}
                                                                    onChange={e => setEditingLeadPhone(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleUpdateLeadDetails(item.id);
                                                                    }}
                                                                    onBlur={() => handleUpdateLeadDetails(item.id)}
                                                                    className="w-full text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary"
                                                                    placeholder="Phone Number"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex justify-between items-start">
                                                                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors flex-1" title="Double click to edit">{item.name}</h4>
                                                                    <select 
                                                                        value={item.priority || 'medium'} 
                                                                        onChange={(e) => handleUpdatePriority(item.id, e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="bg-transparent border-none text-base cursor-pointer focus:outline-none appearance-none ml-1 p-0 leading-none hover:scale-110 transition-transform shrink-0 outline-none"
                                                                        title="Lead Priority"
                                                                    >
                                                                        <option value="hot">🔥</option>
                                                                        <option value="medium">☀️</option>
                                                                        <option value="cold">❄️</option>
                                                                    </select>
                                                                </div>
                                                                
                                                                {(item.whatsapp_number || item.phone) ? (
                                                                    <div className="flex items-center gap-2 mt-0.5" title="Contact Number (Double click to edit)">
                                                                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                                            <Phone className="w-3 h-3 text-slate-400" />
                                                                            {formatPhoneNumber(item.whatsapp_number || item.phone)}
                                                                        </div>

                                                                        {(() => {
                                                                            const log = deliveryLogs.find(l => l.payload?.lead_id === item.id);
                                                                            if (!log) return null;
                                                                            const isFailed = ['failed', 'undelivered'].includes(log.status);
                                                                            const isDelivered = ['delivered', 'read'].includes(log.status);
                                                                            return (
                                                                                <div className="flex items-center">
                                                                                    {isFailed ? (
                                                                                        <div className="group/err relative cursor-help" title={`WhatsApp Failed: ${log.error_message || 'Twilio Error'}`}>
                                                                                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                                                        </div>
                                                                                    ) : isDelivered ? (
                                                                                        <span title="WhatsApp Delivered">
                                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1AA6A8]" />
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span title={log.status}>
                                                                                            <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-[11px] font-medium text-slate-400 italic" title="No contact info (Double click to add)">
                                                                        <Phone className="w-3 h-3 text-slate-300" />
                                                                        Add phone...
                                                                    </div>
                                                                )}

                                                                {item.isDuplicate && (
                                                                    <div className="mt-2 text-[10px] font-semibold text-red-700 bg-red-50 p-1.5 rounded border border-red-200 flex items-start gap-1">
                                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                                        <span>Duplicate! 2+ leads share this number. Please delete one to avoid AI issues.</span>
                                                                    </div>
                                                                )}

                                                                {/* Assigned Worker Badge OR Warning */}
                                                                {(() => {
                                                                    const typedItem = item as any;
                                                                    const hasAssignedWorker = !!typedItem.assignedWorker;
                                                                    
                                                                    // Check if it's equal to or past 'Staff Assigned' (or in client stages)
                                                                    const targetIndex = pipelineStages.findIndex(s => s.toLowerCase().includes('staff assigned'));
                                                                    const activeIndex = pipelineStages.indexOf(typedItem.pipeline_stage);
                                                                    const isClientStage = clientStages.includes(typedItem.pipeline_stage);
                                                                    
                                                                    const isPastInitial = isClientStage || 
                                                                        (targetIndex !== -1 && activeIndex >= targetIndex) || 
                                                                        (targetIndex === -1 && activeIndex >= 5);
                                                                    
                                                                    if (hasAssignedWorker) {
                                                                        return (
                                                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 w-fit line-clamp-1">
                                                                                <Users className="w-3 h-3 shrink-0" />
                                                                                <span className="truncate">👤 {typedItem.assignedWorker.name} ({typedItem.assignedWorker.role || 'Staff'})</span>
                                                                            </div>
                                                                        );
                                                                    } else if (isPastInitial) {
                                                                        return (
                                                                            <div className="mt-1.5 flex items-start gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                                                                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                                                                <span className="leading-tight">Warning: Needs Staff Assignment. Send Deposit link & Assign Staff via DB immediately.</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
                                                        <select
                                                            value={item.pipeline_stage}
                                                            onChange={(e) => handleMoveLead(item.id, e.target.value)}
                                                            className="text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-slate-200 transition-colors uppercase tracking-tight"
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
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteLead(item.id, item.name); }}
                                                            className="absolute top-2 right-2 p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 bg-white/90 backdrop-blur"
                                                            title="Delete Lead"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 mb-3" onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingLeadValueId(item.id);
                                                    setEditingLeadValueAmount(item.valueAmount.toString());
                                                }}>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                        {item.source === 'Web Chat' && <MessageSquare className="w-3.5 h-3.5" />}
                                                        {item.source === 'Email' && <Mail className="w-3.5 h-3.5" />}
                                                        {item.source === 'Contact Form' && <FileText className="w-3.5 h-3.5" />}
                                                        {item.source === 'Appointment Form' && <Calendar className="w-3.5 h-3.5" />}
                                                        {item.source === 'Meeting' && <Phone className="w-3.5 h-3.5" />}
                                                        {item.source === 'AI Phone Call' && <Mic className="w-3.5 h-3.5" />}
                                                        {item.source === 'Referral' && <Users className="w-3.5 h-3.5" />}
                                                        {!['Web Chat', 'Email', 'Contact Form', 'Appointment Form', 'Meeting', 'AI Phone Call', 'Referral'].includes(item.source) && <span className="w-3.5 h-3.5" />}
                                                        {item.source}
                                                    </div>

                                                    {editingLeadValueId === item.id ? (
                                                        <div className="flex-1 flex items-center bg-[#E6F7F7] rounded border border-[#1AA6A8]/20 overflow-hidden" onClick={e => e.stopPropagation()}>
                                                            <span className="text-[#1AA6A8] text-xs font-semibold pl-1.5 pr-0.5">₹</span>
                                                            <input
                                                                type="text"
                                                                value={editingLeadValueAmount}
                                                                onChange={e => setEditingLeadValueAmount(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleUpdateLeadValue(item.id);
                                                                    if (e.key === 'Escape') setEditingLeadValueId(null);
                                                                }}
                                                                onBlur={() => handleUpdateLeadValue(item.id)}
                                                                autoFocus
                                                                className="w-full bg-transparent text-xs font-semibold text-[#1AA6A8] outline-none py-0.5 leading-none"
                                                                placeholder="Amount"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-medium text-[#1AA6A8] bg-[#E6F7F7] px-2 py-0.5 rounded-sm cursor-text hover:bg-[#EAFBFB] transition-colors" title="Double click to edit value">
                                                            {item.value}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-3 flex flex-col gap-2 border-t border-slate-100">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 cursor-help" title="Current AI Status">
                                                            <Bot className="w-3.5 h-3.5 text-primary" />
                                                            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{item.status}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400">{item.time}</span>
                                                    </div>

                                                    {/* Futuristic Progress Tracker */}
                                                    <div className="mt-3 relative pt-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Process Flow</span>
                                                        </div>
                                                        <div className="flex gap-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            {[...pipelineStages, ...clientStages].map((stage, i) => {
                                                                const allStages = [...pipelineStages, ...clientStages];
                                                                const currentIdx = allStages.indexOf(item.pipeline_stage);
                                                                const isPast = i <= currentIdx;
                                                                return (
                                                                    <div key={stage} className={`flex-1 transition-all duration-500 ${isPast ? (i === allStages.length - 1 ? 'bg-emerald-400' : 'bg-primary') : 'bg-slate-200'}`} title={stage}></div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Client Process Flow Actions */}
                                                    <div className="mt-4 flex flex-col gap-2">
                                                        {/* AI Chat Viewer Button (General Action) */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); fetchWhatsappChat(item); }}
                                                            className="w-full bg-slate-50 hover:bg-[#E6F7F7] border border-slate-200 hover:border-[#1AA6A8]/20 text-slate-700 hover:text-[#1AA6A8] text-xs font-bold py-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                        >
                                                            <MessageCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                            View AI Chat History
                                                        </button>

                                                        {item.pipeline_stage === 'New Inquiry' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'inquiry'); }}
                                                                className="w-full bg-[#E6F7F7] hover:bg-[#1AA6A8] hover:text-white border border-[#1AA6A8]/20 text-[#0E7C7E] text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                            >
                                                                <Bot className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                                Send Greeting Message
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'In Discussion' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'quotation'); }}
                                                                className="w-full bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-100 text-amber-800 text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                            >
                                                                <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                                Send Quotation
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'Quotation Sent' && (
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'consent'); }}
                                                                    className="w-full bg-primary/10 hover:bg-primary hover:text-primary-foreground border border-primary/15 text-primary text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                                    Send Consent Form Link
                                                                </button>
                                                                <button
                                                                    onClick={async (e) => { 
                                                                        e.stopPropagation(); 
                                                                        await handleMoveLead(item.id, 'Form Submitted');
                                                                        toast.success("Consent marked as Agreed! Lead moved to Form Submitted.");
                                                                    }}
                                                                    className="w-full bg-[#E6F7F7] hover:bg-[#1AA6A8] hover:text-white border border-[#1AA6A8]/20 text-[#0E7C7E] text-xs font-bold py-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                                >
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Mark Consent Agreed
                                                                </button>
                                                            </div>
                                                        )}

                                                        {item.pipeline_stage === 'Form Submitted' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openStaffPicker(item); }}
                                                                className="w-full bg-purple-50 hover:bg-purple-500 hover:text-white border border-purple-100 text-purple-800 text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                            >
                                                                <Users className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                                Assign Staff Member
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'Staff Assigned' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'deposit'); }}
                                                                className="w-full bg-orange-50 hover:bg-orange-500 hover:text-white border border-orange-100 text-orange-800 text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                            >
                                                                <FileText className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                                Send Deposit Invoice
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'Deposit Pending' && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const toastId = toast.loading("Confirming deposit and notifying client...");
                                                                    
                                                                    try {
                                                                        const firstName = item.name.split(' ')[0] || 'there';
                                                                        const message = `Great news ${firstName}! 🙏 We have received your deposit amount. You are officially an active client of 99 Care now! Our team will coordinate the start date with you shortly. We're honored to serve you! ✨`;
                                                                        
                                                                        const phoneDigits = (item.whatsapp_number || item.phone || '').replace(/\D/g, '');
                                                                        const finalPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
                                                                        
                                                                        // 1. Send automated confirmation FIRST
                                                                        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-whatsapp-outbound`, {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Content-Type': 'application/json',
                                                                                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                                                                                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                                                                            },
                                                                            body: JSON.stringify({
                                                                                phone: finalPhone,
                                                                                message: message, // fallback for local UI logging if needed
                                                                                leadId: item.id,
                                                                                useTemplate: true,
                                                                                templateName: 'deposit_invoice_alert',
                                                                                templateParams: [firstName]
                                                                            })
                                                                        });

                                                                        if (!response.ok) {
                                                                            console.warn("Automated message status:", response.status);
                                                                        }

                                                                        // 2. Move lead AFTER successful (or attempted) dispatch
                                                                        await handleMoveLead(item.id, 'Active Client');
                                                                        toast.success(`${item.name} is now an Active Client! Message sent. 🎉`, { id: toastId });
                                                                    } catch (err) {
                                                                        console.error("Failed to send automated deposit confirmation:", err);
                                                                        // Still move the lead even if WhatsApp fails
                                                                        await handleMoveLead(item.id, 'Active Client');
                                                                        toast.error("Deposit confirmed, but could not send WhatsApp notification.", { id: toastId });
                                                                    }
                                                                }}
                                                                className="w-full bg-[#1AA6A8] hover:bg-[#1AA6A8] text-white text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                Confirm Deposit Received
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'Active Client' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'billing'); }}
                                                                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
                                                            >
                                                                <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                                Send Monthly Bill
                                                            </button>
                                                        )}

                                                        {item.pipeline_stage === 'Monthly Billing' && (
                                                            <button
                                                                onClick={() => {
                                                                    convertToClient(item.id, item.name);
                                                                    toast.success(`${item.name} migrated to Client Master.`);
                                                                }}
                                                                className="w-full bg-gradient-to-r from-[#1AA6A8] to-[#0E7C7E] hover:from-[#1AA6A8] hover:to-[#0E7C7E] text-white text-xs font-bold py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                                                            >
                                                                <Users className="w-3.5 h-3.5" />
                                                                Convert to Client Master
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
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
                                                <div className="flex items-center gap-3 mt-3">
                                                    <button onClick={() => { setSelectedCall(call); setIsTranscriptModalOpen(true); }} className="text-sm font-bold text-[#1AA6A8] hover:text-[#0E7C7E] flex items-center gap-1.5 transition-colors bg-[#E6F7F7] px-4 py-1.5 rounded-lg border border-[#1AA6A8]/20 shadow-sm w-full justify-center">
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
                                            <div className="mt-4 flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                                                <div>
                                                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Lead Data Captured</p>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-sm text-slate-900"><span className="font-semibold">{call.capturedName}</span> • Est. Value: <span className="text-[#1AA6A8] font-medium">₹{call.capturedValue}/mo</span></p>
                                                        {call.capturedWhatsapp && (
                                                            <span className="flex items-center gap-1 text-xs font-medium text-[#1AA6A8] bg-[#EAFBFB]/50 px-2 py-0.5 rounded-full">
                                                                <MessageCircle className="w-3 h-3" /> WhatsApp: {call.capturedWhatsapp}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => captureCallAsLead(call.id)}
                                                    className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm shrink-0"
                                                >
                                                    <Plus className="w-4 h-4" /> Add to Pipeline
                                                </button>
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
            {activeTab === 'automations' && (
                /* AI Automations View */
                <div className="flex-1 grid lg:grid-cols-2 gap-6 pb-4">
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

            {/* AI WhatsApp Draft Modal */}
            {isAgentModalOpen && agentTargetLead && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
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
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-primary" /> Target Language Model
                                </label>
                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    {['English', 'Hindi', 'Hinglish'].map(lang => (
                                        <button
                                            key={lang}
                                            onClick={() => setAgentDraftLang(lang as any)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${agentDraftLang === lang ? 'bg-white text-[#1AA6A8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" /> {isEditingTemplate ? 'Edit Default Template' : 'Review Editable Draft'}
                                    </label>
                                    <button
                                        onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                                        className="text-xs font-semibold text-[#1AA6A8] hover:text-[#1AA6A8] transition-colors"
                                    >
                                        {isEditingTemplate ? 'Back to Draft View' : '⚙️ Edit Default Template'}
                                    </button>
                                </div>
                                <div className="relative">
                                    {agentTargetAction === 'quotation' && !isEditingTemplate ? (
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
                                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Complete Month</label>
                                                    <input type="text" value={quotationVars.v3} onChange={e => setQuotationVars({...quotationVars, v3: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. ₹ 45,000" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Incomplete Month</label>
                                                <input type="text" value={quotationVars.v4} onChange={e => setQuotationVars({...quotationVars, v4: e.target.value})} className="w-full text-sm font-medium border border-slate-200 bg-slate-50 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1AA6A8]" placeholder="e.g. ₹ 1,500/day" />
                                            </div>
                                        </div>
                                    ) : (
                                        <textarea
                                            value={isEditingTemplate ? templateDraftText : agentDraftText}
                                            onChange={(e) => isEditingTemplate ? setTemplateDraftText(e.target.value) : setAgentDraftText(e.target.value)}
                                            className="w-full h-32 px-4 py-3 rounded-xl border border-[#1AA6A8]/20 outline-none focus:ring-2 focus:ring-[#1AA6A8] focus:border-transparent text-sm bg-[#E6F7F7] text-[#0E7C7E] resize-none font-medium leading-relaxed mb-6"
                                        />
                                    )}
                                    
                                    {(!isEditingTemplate && agentTargetAction !== 'quotation') && (
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
                                                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
        </div>
    );
}
