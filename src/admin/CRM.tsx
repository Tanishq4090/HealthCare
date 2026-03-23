import { useState, useEffect, useRef } from 'react';
import { Bot, Mail, MessageSquare, Phone, CheckCircle2, FileText, Send, Users, Loader2, Mic, PlayCircle, Plus, PhoneOff, Globe, Edit3, X, MessageCircle, Trash2, ArrowLeft, ArrowRight, Calendar, ClipboardList, ShieldCheck, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import Client from '@vapi-ai/web';
import { MOCK_WORKERS } from '../data/mockWorkers';

const VAPI_PUBLIC_KEY = "3cd76924-ad95-4b41-8018-26d22b309bbf";
const VAPI_ASSISTANT_ID = "2de7804c-6087-43bf-8098-dfc787aa3dee";

export default function CRM() {
    const [activeTab, setActiveTab] = useState<'pipeline' | 'automations' | 'voice' | 'content'>('pipeline');
    const [leads, setLeads] = useState<any[]>([
        { id: '1', name: 'Meet Makwana', email: 'meetmakwana2004@gmail.com', phone: '+91 7575041313', source: 'Web Chat', status: 'AI Handled', pipeline_stage: 'New Inquiry', created_at: new Date().toISOString(), estimated_value_monthly: 5000, service_type: 'baby_care' },
        { id: '2', name: 'John Doe', email: 'john@example.com', phone: '+1234567890', source: 'Email', status: 'System', pipeline_stage: 'Quotation Sent', created_at: new Date(Date.now() - 86400000).toISOString(), estimated_value_monthly: 12000, service_type: 'old_age_care' },
        { id: '3', name: 'Jane Smith', email: 'jane@example.com', phone: '+1987654321', source: 'Contact Form', status: 'Pending', pipeline_stage: 'Form Submitted', created_at: new Date(Date.now() - 172800000).toISOString(), estimated_value_monthly: 8000, service_type: 'nursing_care' },
        { id: '4', name: 'Robert Johnson', email: 'robert@example.com', phone: '+1122334455', source: 'AI Phone Call', status: 'Processed', pipeline_stage: 'Deposit Pending', created_at: new Date(Date.now() - 259200000).toISOString(), estimated_value_monthly: 15000, service_type: 'japa_care' },
        { id: '5', name: 'Emily Davis', email: 'emily@example.com', phone: '+1555666777', source: 'AI Phone Call', status: 'Unprocessed', pipeline_stage: 'Active Client', created_at: new Date(Date.now() - 36400000).toISOString(), estimated_value_monthly: 25000, service_type: 'physiotherapy' }
    ]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingFolio, setIsSendingFolio] = useState(false);
    const [isSimulatingInquiry, setIsSimulatingInquiry] = useState(false);
    const [crmConfig, setCrmConfig] = useState<any>(null);

    const fetchCrmConfig = async () => {
        try {
            // Use pure token from localStorage (no Supabase session required)
            const token = localStorage.getItem('healthfirst_pure_token') || 'pure_dev_token_admin';
            const response = await fetch('/api/crm-config/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setCrmConfig(data);
        } catch (e) {
            console.error("Failed to fetch CRM config", e);
        }
    };

    useEffect(() => {
        fetchCrmConfig();
        fetchLeads();
    }, []);

    // AI Automation State
    const [automationLogs, setAutomationLogs] = useState([
        { id: 1, type: 'greeting', icon: MessageSquare, title: 'Auto-Greeting Sent', desc: 'Sent "Welcome to HealthFirst" SMS to Sarah Jenkins.', time: '10:45 AM', status: 'success' },
        { id: 2, type: 'folio', icon: FileText, title: 'Folio Dispatched', desc: 'Emailed "Enterprise Health Services" PDF to Michael Ross.', time: '09:30 AM', status: 'success' },
        { id: 3, type: 'followup', icon: Send, title: 'Drip Sequence Triggered', desc: 'Added David Chen to "Post-Meeting Follow-up" sequence.', time: 'Yesterday, 4:00 PM', status: 'success' },
    ]);

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetLead, setAgentTargetLead] = useState<any>(null);
    const [agentTargetAction, setAgentTargetAction] = useState<'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing'>('inquiry');

    // Staff Picker State
    const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
    const [staffPickerTargetLead, setStaffPickerTargetLead] = useState<any>(null);
    const [availableWorkers, setAvailableWorkers] = useState<any[]>([]);
    const [selectedWorker, setSelectedWorker] = useState<any>(null);
    const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [templateDraftText, setTemplateDraftText] = useState('');

    // Transcript Modal State
    const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
    const [selectedCall, setSelectedCall] = useState<any>(null);

    const [whatsappTemplates, setWhatsappTemplates] = useState<Record<string, Record<string, string>>>({
        inquiry: {
            Hinglish: "🌟 Welcome to 99 Care! 🌟\n{{name}} sir/ma'am, aapki inquiry mili humein. Hamari team aapke ghar par best healthcare staff provide karne ke liye ready hai!\n\nKoi bhi sawaal ho toh seedha reply karein. Hum aapki service mein!💙✨",
            Hindi: "Namaste {{name}} ji, 99 Care mein aapka swagat hai! Aapki inquiry hamein mili hai. Humari team aapke liye best healthcare solution lekar aayegi. Kripya apni zaroorat batayein.",
            English: "Hi {{name}}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!"
        },
        quotation: {
            Hinglish: "Namaste {{name}} ji! 🙏 Aapke liye humne ek customized quotation taiyar ki hai.\n\n📋 Service details aur pricing is link pe check karein:\nhttps://99care.in/quote/{{link}}\n\nKoi bhi changes chahiye toh batayein — hum adjust kar sakte hain!",
            Hindi: "Namaste {{name}} ji, aapki quotation taiyar hai. Kripya is link par details dekhen:\nhttps://99care.in/quote/{{link}}\n\nKoi prashn ho toh humse sampark karein.",
            English: "Hi {{name}}, your customized quotation from 99 Care is ready! Please review the details here:\nhttps://99care.in/quote/{{link}}\n\nFeel free to reach out if you'd like any adjustments."
        },
        consent: {
            Hinglish: "Hi {{name}} ji! Ek aakhri step baki hai — apna consent form yahan fill karein aur hum service start kar denge! ✅\nhttps://99care.in/consent\n\nSirf 2 minute lagenge!",
            Hindi: "Namaste {{name}} ji, aage badhne ke liye kripya yeh consent form bharein:\nhttps://99care.in/consent",
            English: "Hi {{name}}, just one final step — please complete the consent form below and we'll get your service started:\nhttps://99care.in/consent"
        },
        staff: {
            Hinglish: "Good news {{name}} ji! 🎉 Aapke liye {{workerName}} ({{workerRole}}) ko assign kiya gaya hai!\n\n👤 Unka profile aur joining date confirm karne ke liye yahan dekhen:\nhttps://99care.in/staff/{{link}}\n\nKoi concern ho toh hume batayein!",
            Hindi: "Namaste {{name}} ji, aapke liye {{workerName}} ({{workerRole}}) ko assign kiya gaya hai. Profile dekhne ke liye:\nhttps://99care.in/staff/{{link}}",
            English: "Great news {{name}}! We have assigned {{workerName}} ({{workerRole}}) to you. Please review their profile and confirm the joining date here:\nhttps://99care.in/staff/{{link}}"
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
        const saved = localStorage.getItem('whatsappTemplates');
        if (saved) {
            try {
                setWhatsappTemplates(JSON.parse(saved));
            } catch (e) { }
        }
    }, []);

    const [pipelineStages, setPipelineStages] = useState<string[]>([
        'New Lead', 'New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending', 'Active Client', 'Monthly Billing', 'Closed Won'
    ]);
    const [isAddingStage, setIsAddingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
    const [editingStageName, setEditingStageName] = useState('');

    const [editingLeadValueId, setEditingLeadValueId] = useState<string | null>(null);
    const [editingLeadValueAmount, setEditingLeadValueAmount] = useState<string>('');

    // Predefined stages that cannot be deleted or renamed easily (or you can allow all to be deleted)
    const PROTECTED_STAGES = ['New Lead', 'Closed Won'];


    const [workflows, setWorkflows] = useState({
        greeting: true,
        folio: true,
        quotation: false,
        consent_form: false,
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

    // --- VAPI INTEGRATION ---
    const vapiRef = useRef<any>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'loading' | 'active'>('idle');

    // WhatsApp Messaging Logic
    const sendRequirementsWhatsApp = (lead: any, category: any) => {
        const text = `HealthFirst CRM: Namaste ${lead.name}! Aapne ${category.name} service ke liye enquiry ki hai. Inquiry details fill karne ke liye niche di gayi kripya jankari dein:\n\n${category.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n\nAap message ka reply de sakte hain ya call karein. Dhanyawad! 🙏`;
        const phone = lead.phone?.replace(/\D/g, '') || '917575041313';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
        toast.success(`Questionnaire draft opened for ${lead.name}!`);
    };

    const sendWorkerProfileWhatsApp = (lead: any, worker: any) => {
        const baseUrl = window.location.origin;
        const confirmLink = `${baseUrl}/client/confirm-staff/${worker.id}`;
        const text = `HealthFirst CRM: Namaste ${lead.name}! Humne aapke liye staff allocate kar diya hai.\n\nName: ${worker.name}\nRole: ${worker.role}\nCharge: ₹${worker.monthly_daily_rate}/day\n\nFull profile check karke confirm karein: ${confirmLink}\n\nDhanyawad! ✅`;
        const phone = lead.phone?.replace(/\D/g, '') || '917575041313';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
        toast.success(`Worker profile shared with ${lead.name}!`);
    };

    const saveRequirements = async () => {
        const lead = leads.find(l => l.id === selectedLeadId);
        if (!lead || !selectedLeadId) return;

        try {
            const { error } = await supabase
                .from('crm_leads')
                .update({ 
                    service_type: lead.service_type
                })
                .eq('id', selectedLeadId);

            if (error) throw error;
            toast.success("Client requirements updated successfully!");
            setIsDetailsModalOpen(false);
        } catch (err: any) {
            toast.error("Failed to save to database: " + err.message);
        }
    };

    useEffect(() => {
        // Initialize Vapi object
        vapiRef.current = new Client(VAPI_PUBLIC_KEY);

        vapiRef.current.on('call-start', () => {
            setCallStatus('active');
            console.log('Call started');
        });

        vapiRef.current.on('call-end', () => {
            setCallStatus('idle');
            console.log('Call ended');
            // Optional: immediately refresh call logs to show the new call
            setTimeout(() => fetchVoiceData(), 3000); // 3 sec delay to allow Vapi to process the recording/summary
        });

        vapiRef.current.on('speech-start', () => console.log('Assistant started speaking'));
        vapiRef.current.on('speech-end', () => console.log('Assistant stopped speaking'));
        vapiRef.current.on('error', (e: any) => {
            console.error('Vapi Error', e);
            setCallStatus('idle');
            toast.error('Vapi encountered an error. Please check console.');
        });

        return () => {
            if (vapiRef.current) {
                vapiRef.current.stop();
            }
        };
    }, []);

    const toggleCall = async () => {
        if (callStatus === 'active') {
            vapiRef.current?.stop();
            setCallStatus('idle');
        } else {
            setCallStatus('loading');
            try {
                await vapiRef.current?.start(VAPI_ASSISTANT_ID);
            } catch (err) {
                console.error("Failed to start call", err);
                setCallStatus('idle');
            }
        }
    };

    // --- FETCH REAL VAPI DATA ---
    const fetchVoiceData = async () => {
        setIsLoadingVoice(true);
        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            // 1. Fetch Calls from Vapi Edge Function
            const response = await fetch(`${SUPABASE_URL}/functions/v1/vapi-get-calls`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ assistantId: VAPI_ASSISTANT_ID, limit: 30 })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            const callsData = await response.json();

            // 2. Fetch Leads to cross-reference "Processed" status
            const { data: leadsData } = await supabase
                .from('crm_leads')
                .select('id, name, phone, source');

            const voiceLeads = leadsData?.filter(l => l.source === 'AI Phone Call') || [];

            // 3. Process and format Vapi calls
            let todayCalls = 0;
            let totalDurationToday = 0;
            const todayStr = new Date().toDateString();

            const formattedCalls = (callsData || []).filter((call: any) => call.status === 'ended').map((call: any) => {
                const startedAt = new Date(call.createdAt);
                const isToday = startedAt.toDateString() === todayStr;

                let durationSeconds = 0;
                if (call.endedAt && call.startedAt) {
                    durationSeconds = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000);
                }

                if (isToday) {
                    todayCalls++;
                    totalDurationToday += durationSeconds;
                }

                // Format duration string (e.g. "1m 45s")
                const dMins = Math.floor(durationSeconds / 60);
                const dSecs = durationSeconds % 60;
                const durationStr = dMins > 0 ? `${dMins}m ${dSecs}s` : `${dSecs}s`;

                // Try to extract name/whatsapp from the AI's standard output structure
                // Alternatively, determine if there's a matching lead already created
                let capturedName = null;
                let capturedWhatsapp = null;
                let capturedValue = 5000; // Baseline assumed value

                // Very basic heuristic for demo: if summary mentions a name, or if we find a lead with this phone number
                const matchingLead = voiceLeads.find(l => l.phone && call.customer?.number && l.phone.includes(call.customer.number.replace(/\D/g, '')));
                let callStatus = 'Unprocessed';

                if (matchingLead) {
                    callStatus = 'Processed';
                    capturedName = matchingLead.name;
                } else if (call.summary && call.summary.length > 20) {
                    // Try to guess a name if it's unprocessed but seems to have data
                    const nameMatch = call.summary.match(/name is ([A-Z][a-z]+ [A-Z][a-z]+)/i);
                    if (nameMatch) capturedName = nameMatch[1];
                    else capturedName = "Unknown Caller";
                }

                return {
                    id: call.id,
                    phone: call.customer?.number || "Unknown Number",
                    type: call.type === 'inboundPhoneCall' ? 'Inbound' : 'Outbound',
                    duration: durationStr,
                    time: isToday ? startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : startedAt.toLocaleDateString(),
                    intent: call.analysis?.successEvaluation || "Inquiry",
                    summary: call.summary || "No summary available.",
                    recordingUrl: call.recordingUrl,
                    capturedName,
                    capturedWhatsapp,
                    capturedValue,
                    status: callStatus
                };
            });

            setCalls(formattedCalls);
            setVoiceMetrics({
                totalCallsToday: todayCalls,
                avgDurationSeconds: todayCalls > 0 ? Math.round(totalDurationToday / todayCalls) : 0,
                leadsCaptured: voiceLeads.length
            });

        } catch (error: any) {
            console.error("Failed to fetch voice data:", error);
            toast.error(`Unable to load voice logs: ${error.message}`);
        } finally {
            setIsLoadingVoice(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'voice') {
            fetchVoiceData();
        }
    }, [activeTab]);
    // -------------------------

    const toggleWorkflow = (key: keyof typeof workflows, name: string) => {
        const isTurningOn = !workflows[key];
        setWorkflows(prev => ({ ...prev, [key]: isTurningOn }));

        // Add to log
        const newLog = {
            id: Date.now(),
            type: 'system',
            icon: Bot,
            title: `Workflow ${isTurningOn ? 'Activated' : 'Paused'} `,
            desc: `${name} has been ${isTurningOn ? 'enabled' : 'disabled'} by Admin.`,
            time: 'Just now',
            status: 'success'
        };
        setAutomationLogs(prev => [newLog, ...prev]);
    };

    const handleFolioDispatch = async () => {
        const testEmail = window.prompt("Resend Sandbox limits testing to your verified email. Enter your Resend email to receive the mock Folio:");
        if (!testEmail) return;

        setIsSendingFolio(true);
        try {
            const { error } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: testEmail,
                    subject: 'Your Requested HealthFirst Services Folio',
                    html: `
    < div style = "font-family: sans-serif; max-width: 600px; margin: 0 auto;" >
                            <h2>Hi there! 👋</h2>
                            <p>You recently inquired about our services at HealthFirst. Our AI agent has automatically dispatched our current digital folio for your review.</p>
                            <p><strong>Note:</strong> In a production environment, the actual PDF brochure would be attached to this email.</p>
                            <br/>
                            <p>Let us know if you want to schedule a quick call!</p>
                            <p>- The HealthFirst Team</p>
                        </div >
    `
                },
            });

            if (error) throw error;

            // Log success event
            const newLog = {
                id: Date.now(),
                type: 'folio',
                icon: FileText,
                title: 'Folio Dispatched (Manual Test)',
                desc: `Emailed "Requested Services Folio" to ${testEmail}.`,
                time: 'Just now',
                status: 'success'
            };
            setAutomationLogs(prev => [newLog, ...prev]);

            toast.success(`Success! The automated Folio email was sent to ${testEmail} `);
        } catch (error: any) {
            console.error('Error sending folio:', error);
            toast.error(`Error: ${error.message || 'Failed to send email'}. Ensure you used your verified Resend email!`);
        } finally {
            setIsSendingFolio(false);
        }
    };

    const handleBulkGreeting = async () => {
        if (!workflows.greeting) {
            toast.info("Toggle ON 'Instant Greeting & Triage' first before dispatching.");
            return;
        }

        // Target leads in New Inquiry stage only
        const newInquiryLeads = leads.filter(l => l.pipeline_stage === 'New Inquiry');

        if (newInquiryLeads.length === 0) {
            toast.info("No leads in 'New Inquiry' stage to greet. Move leads into that stage first.");
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

                const message = generateWhatsappDraft(lead.name, 'inquiry', agentDraftLang);

                const response = await fetch(`${SUPABASE_URL}/functions/v1/vapi-whatsapp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'apikey': SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ phone: phoneDigits, message }),
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${response.status}`);
                }

                sentCount++;
                toast.loading(`Sending greetings… ${sentCount}/${newInquiryLeads.length}`, { id: progressId });

                // Move lead to In Discussion after greeting
                await handleMoveLead(lead.id, 'In Discussion');

            } catch (e: any) {
                console.warn(`Failed to greet ${lead.name}:`, e.message);
                failCount++;
            }
        }

        toast.dismiss(progressId);

        const logDesc = `Greeted ${sentCount} lead(s) via WhatsApp and moved them to "In Discussion".${failCount > 0 ? ` ${failCount} failed.` : ''}`;
        setAutomationLogs(prev => [{
            id: Date.now(),
            type: 'greeting',
            icon: MessageSquare,
            title: `Bulk Greeting — ${sentCount}/${newInquiryLeads.length} Sent`,
            desc: logDesc,
            time: 'Just now',
            status: 'success'
        }, ...prev]);

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
            const { data, error } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            setLeads(prev => {
                const mockLeads = prev.filter(l => l.id.length < 10);
                return data ? [...data, ...mockLeads] : mockLeads;
            });
        } catch (err: any) {
            console.error('Error fetching leads:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (leadName: string, action: string, lang: string, worker?: any) => {
        const tpl = whatsappTemplates[action]?.[lang] || '';
        return tpl
            .replace(/\{\{name\}\}/g, leadName)
            .replace(/\{\{link\}\}/g, Math.random().toString(36).substr(2, 6))
            .replace(/\{\{workerName\}\}/g, worker?.name || 'your assigned staff')
            .replace(/\{\{workerRole\}\}/g, worker?.role || 'Healthcare Worker');
    };

    const fetchWorkers = async () => {
        setIsLoadingWorkers(true);
        try {
            // Check both potential column names 'status' or 'availability'
            const { data, error } = await supabase.from('workers').select('*');
            
            if (error) throw error;

            if (data && data.length > 0) {
                // Filter in JS to be safe against schema variations
                const available = data.filter(w => 
                    (w.status && w.status.toLowerCase() === 'available') || 
                    (w.availability && w.availability.toLowerCase() === 'available')
                );
                setAvailableWorkers(available.length > 0 ? available : MOCK_WORKERS.filter(w => w.status === 'Available'));
            } else {
                setAvailableWorkers(MOCK_WORKERS.filter(w => w.status === 'Available'));
            }
        } catch (err) {
            console.warn("Failed to fetch workers from DB, using mock data:", err);
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

    const confirmWorkerSelection = (worker: any) => {
        setSelectedWorker(worker);
        setIsStaffPickerOpen(false);
        // Open WhatsApp agent modal with worker pre-filled
        setAgentTargetLead(staffPickerTargetLead);
        setAgentTargetAction('staff');
        setIsEditingTemplate(false);
        const draft = generateWhatsappDraft(staffPickerTargetLead.name, 'staff', agentDraftLang, worker);
        setAgentDraftText(draft);
        setIsAgentModalOpen(true);
    };

    const openAgentModal = (lead: any, action: 'inquiry' | 'quotation' | 'consent' | 'staff' | 'deposit' | 'billing') => {
        setAgentTargetLead(lead);
        setAgentTargetAction(action);
        setIsEditingTemplate(false);
        const draft = generateWhatsappDraft(lead.name, action, agentDraftLang, selectedWorker);
        setAgentDraftText(draft);
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetLead && !isEditingTemplate) {
            setAgentDraftText(generateWhatsappDraft(agentTargetLead.name, agentTargetAction, agentDraftLang, selectedWorker));
        } else if (isEditingTemplate) {
            setTemplateDraftText(whatsappTemplates[agentTargetAction]?.[agentDraftLang] || '');
        }
    }, [agentDraftLang, agentTargetAction, agentTargetLead, whatsappTemplates, isEditingTemplate, selectedWorker]);

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
        const toastId = toast.loading("Dispatching to WhatsApp via Twilio...");

        try {
            let phoneDigits = '918000044090'; // Default to test number
            if (agentTargetLead) {
                // Prioritize dedicated WhatsApp number if Vapi captured it
                const targetNumber = agentTargetLead.whatsapp_number || agentTargetLead.phone;
                if (targetNumber) {
                    phoneDigits = targetNumber.replace(/\D/g, ''); // Extract only digits
                }
            }

            console.log(`[Dispatch] Sending WhatsApp to: +${phoneDigits}`);

            // Call Edge Function directly using fetch (bypasses SDK key format issues)
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(`${SUPABASE_URL}/functions/v1/vapi-whatsapp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ phone: phoneDigits, message: agentDraftText })
            });

            const resData = await response.json().catch(() => ({ error: response.statusText }));
            console.log('[Dispatch] Function response:', resData);

            if (!response.ok) {
                throw new Error(resData.error || resData.message || `HTTP ${response.status}`);
            }

            // Post-dispatch: move lead if staff action, and update worker assignment
            if (agentTargetLead) {
                // If this was a staff assignment, move lead to Staff Assigned and update worker record
                if (agentTargetAction === 'staff' && selectedWorker) {
                    await handleMoveLead(agentTargetLead.id, 'Staff Assigned');
                    // Update worker's assigned_client in Supabase
                    try {
                        await supabase.from('workers')
                            .update({ assigned_client: agentTargetLead.name, status: 'Active' })
                            .eq('id', selectedWorker.id);
                    } catch (e) {
                        console.warn('Could not update worker in DB (may be mock):', e);
                    }
                    setSelectedWorker(null);
                    toast.success(`${selectedWorker.name} assigned to ${agentTargetLead.name} and moved to Staff Assigned! 🎉`, { id: toastId, duration: 6000 });
                } else {
                    toast.success(`✅ WhatsApp sent to +${phoneDigits}! Check your phone. (SID: ...${resData.sid?.slice(-6) || 'ok'})`, { id: toastId, duration: 6000 });
                }

                const newLog = {
                    id: Date.now(),
                    type: 'system',
                    icon: Bot,
                    title: `WhatsApp Dispatched to ${agentTargetLead.name}`,
                    desc: agentTargetAction === 'staff' && selectedWorker
                        ? `Assigned ${selectedWorker.name} (${selectedWorker.role}) to ${agentTargetLead.name} via WhatsApp.`
                        : `AI Agent dispatched message in ${agentDraftLang} via Twilio to +${phoneDigits}.`,
                    time: 'Just now',
                    status: 'success'
                };
                setAutomationLogs(prev => [newLog, ...prev]);
            }

        } catch (err: any) {
            console.error("WhatsApp dispatch failed", err);
            toast.error(`WhatsApp dispatch failed: ${err.message}`, { id: toastId });
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

    // Fetch leads from Supabase
    useEffect(() => {
        fetchLeads();
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

    const handleAddStage = () => {
        if (newStageName.trim() && !pipelineStages.includes(newStageName.trim())) {
            setPipelineStages([...pipelineStages, newStageName.trim()]);
            setNewStageName('');
            setIsAddingStage(false);
            toast.success(`Pipeline stage "${newStageName.trim()}" added!`);
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
            const newStages = [...pipelineStages];
            newStages.splice(idx, 1);
            setPipelineStages(newStages);
            toast.success(`Stage "${stageToDelete}" deleted successfully.`);
        }
    };

    const handleRenameStage = (oldName: string, idx: number) => {
        if (!editingStageName.trim() || editingStageName.trim() === oldName) {
            setEditingStageIdx(null);
            return;
        }
        if (pipelineStages.includes(editingStageName.trim())) {
            toast.error('A stage with this name already exists.');
            return;
        }

        // Update stage in pipeline list
        const newStages = [...pipelineStages];
        newStages[idx] = editingStageName.trim();
        setPipelineStages(newStages);

        // Update all leads currently in this stage (optimistic)
        setLeads(prev => prev.map(l => l.pipeline_stage === oldName ? { ...l, pipeline_stage: editingStageName.trim() } : l));

        // Note: In a real app, you would also trigger a Supabase bulk update here.
        setEditingStageIdx(null);
        toast.success(`Stage renamed to "${editingStageName.trim()}"`);
    };

    const handleSlideStage = (idx: number, direction: 'left' | 'right') => {
        if ((direction === 'left' && idx === 0) || (direction === 'right' && idx === pipelineStages.length - 1)) return;

        const newStages = [...pipelineStages];
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;

        // Swap
        const temp = newStages[idx];
        newStages[idx] = newStages[targetIdx];
        newStages[targetIdx] = temp;

        setPipelineStages(newStages);
    };

    // Organize leads into pipeline columns
    const columns = pipelineStages.map(stage => ({
        title: stage,
        count: leads.filter(l => l.pipeline_stage === stage).length,
        items: leads.filter(l => l.pipeline_stage === stage).map(l => ({
            id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), valueAmount: l.estimated_value_monthly, value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
        }))
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

    const convertToClient = async (leadId: string, leadName: string) => {
        if (window.confirm(`Are you sure you want to convert ${leadName} to a permanent Client Master entry?`)) {
            // Optimistic behavior: remove from pipeline view for snappiness
            setLeads(prev => prev.filter(l => l.id !== leadId));

            // Add to log
            const newLog = {
                id: Date.now(),
                type: 'system',
                icon: Users,
                title: 'Client Converted',
                desc: `${leadName} was successfully converted to a permanent Client.`,
                time: 'Just now',
                status: 'success'
            };
            setAutomationLogs(prev => [newLog, ...prev]);

            toast.success(`${leadName} has been converted successfully!`);
        }
    };

    const captureCallAsLead = async (callId: number) => {
        const call = calls.find(c => c.id === callId);
        if (!call || !call.capturedName) return;

        try {
            const { error } = await supabase.from('crm_leads').insert([{
                name: call.capturedName,
                phone: call.phone,
                whatsapp_number: call.capturedWhatsapp || null,
                source: 'AI Phone Call',
                status: 'AI Handled',
                pipeline_stage: 'New Inquiry',
                estimated_value_monthly: call.capturedValue || 0,
            }]);

            if (error) throw error;

            // Mark call as processed
            setCalls(prev => prev.map(c => c.id === callId ? { ...c, status: 'Processed' } : c));

            // Refresh list
            fetchLeads();

            toast.success(`Successfully added ${call.capturedName} to the pipeline!`);
        } catch (error: any) {
            console.error("Error creating lead from call:", error);
            toast.error(`Failed to create lead: ${error.message}`);
        }
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
                            <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
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
                    <div className="flex items-center p-1.5 bg-slate-200/50 rounded-2xl shrink-0 border border-slate-200 shadow-inner">
                        <button
                            onClick={() => setActiveTab('pipeline')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'pipeline' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Pipeline
                        </button>
                        <button
                            onClick={() => setActiveTab('automations')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'automations' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            AI Automations
                        </button>
                        <button
                            onClick={() => setActiveTab('voice')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'voice' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Voice AI Calls
                        </button>
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'content' ? 'bg-white text-primary shadow-lg scale-105' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Content & FAQ
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'pipeline' ? (
                <div className="flex flex-col flex-1 h-full min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Live Sync Active
                        </div>
                        <button onClick={handleExportLeadsToCSV} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                            Export Pipeline to CSV
                        </button>
                    </div>
                {/* Kanban Pipeline View */}
                <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="ml-3 text-slate-500 font-medium">Loading live pipeline...</span>
                        </div>
                    ) : (
                        <>
                            {columns.map((col, idx) => (
                                <div key={idx} className="w-[320px] shrink-0 flex flex-col bg-slate-50 rounded-xl border border-slate-200">
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
                                                        disabled={idx === pipelineStages.length - 1}
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
                                            <div key={item.id} onClick={() => { setSelectedLeadId(item.id); setIsIntelligenceModalOpen(true); }} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group relative">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</h4>
                                                    <div onClick={(e) => e.stopPropagation()} className="relative">
                                                        <select
                                                            value={item.pipeline_stage}
                                                            onChange={(e) => handleMoveLead(item.id, e.target.value)}
                                                            className="text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-slate-200 transition-colors uppercase tracking-tight"
                                                        >
                                                            {pipelineStages.map(stage => (
                                                                <option key={stage} value={stage}>{stage}</option>
                                                            ))}
                                                        </select>
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
                                                        <div className="flex-1 flex items-center bg-emerald-50 rounded border border-emerald-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                                                            <span className="text-emerald-700 text-xs font-semibold pl-1.5 pr-0.5">₹</span>
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
                                                                className="w-full bg-transparent text-xs font-semibold text-emerald-700 outline-none py-0.5 leading-none"
                                                                placeholder="Amount"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm cursor-text hover:bg-emerald-100 transition-colors" title="Double click to edit value">
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
                                                            {pipelineStages.map((stage, i) => {
                                                                const currentIdx = pipelineStages.indexOf(item.pipeline_stage);
                                                                const isPast = i <= currentIdx;
                                                                return (
                                                                    <div key={stage} className={`flex-1 transition-all duration-500 ${isPast ? (i === pipelineStages.length - 1 ? 'bg-emerald-400' : 'bg-primary') : 'bg-slate-200'}`}></div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Client Process Flow Actions */}
                                                    <div className="mt-4 flex flex-col gap-2">
                                                        {item.pipeline_stage === 'New Inquiry' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAgentModal(item, 'inquiry'); }}
                                                                className="w-full bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 text-emerald-800 text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 group"
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
                                                                    className="w-full bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 text-emerald-800 text-xs font-bold py-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
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
                                                                    await handleMoveLead(item.id, 'Active Client');
                                                                    toast.success(`${item.name} is now an Active Client! 🎉`);
                                                                }}
                                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
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
                                                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
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
            ) : activeTab === 'voice' ? (
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
                                <span className="text-slate-400">via Vapi</span>
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
                                        Start Web Call (Vapi)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Recent Call Logs</h2>
                                <p className="text-sm text-slate-500 mt-1">Review AI voice interactions and capture leads directly to pipeline.</p>
                            </div>
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
                                                <h3 className="font-bold text-slate-900 text-lg">{call.phone}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${call.type === 'Inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-100 text-purple-700'}`}>
                                                    {call.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                                                <span className="flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> {call.duration}</span>
                                                <span>•</span>
                                                <span className="font-medium">{call.time}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100/80">
                                                {call.recordingUrl ? (
                                                    <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                                                        <PlayCircle className="w-4 h-4" /> Listen
                                                    </a>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-not-allowed">
                                                        <PlayCircle className="w-4 h-4" /> Audio Unavailable
                                                    </span>
                                                )}
                                                <button onClick={() => { setSelectedCall(call); setIsTranscriptModalOpen(true); }} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                                                    <FileText className="w-4 h-4" /> View Transcript
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Bot className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-sm font-semibold text-slate-900">AI Summary & Intent: <span className="font-normal text-slate-600 bg-slate-100 px-2 py-0.5 rounded ml-1">{call.intent}</span></span>
                                                </div>
                                                {call.status === 'Processed' && (
                                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> ADDED TO CRM
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">"{call.summary}"</p>
                                        </div>

                                        {call.status === 'Unprocessed' && call.capturedName && (
                                            <div className="mt-4 flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                                                <div>
                                                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">Lead Data Captured</p>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-sm text-slate-900"><span className="font-semibold">{call.capturedName}</span> • Est. Value: <span className="text-emerald-600 font-medium">₹{call.capturedValue}/mo</span></p>
                                                        {call.capturedWhatsapp && (
                                                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-full">
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
                                        )}
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
                                    <h3 className="text-slate-500 font-medium">Loading real-time voice data from Vapi...</h3>
                                </div>
                            )}
                            {calls.length > 0 && (
                                <div className="text-center pt-2">
                                    <button className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Refresh Calls</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'content' ? (
                /* Content & FAQ View */
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div className="grid lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                        {/* Company Intro Section */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900">Company Introduction</h2>
                                <Globe className="w-5 h-5 text-primary" />
                            </div>
                            <div className="p-5 space-y-6 overflow-y-auto flex-1">
                                {['english', 'hindi', 'gujarati'].map(lang => (
                                    <div key={lang} className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{lang}</label>
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed min-h-[100px]">
                                            {crmConfig?.companyIntro?.[lang] || 'Loading...'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FAQ Section */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900">Frequently Asked Questions</h2>
                                <Bot className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {crmConfig?.faqs?.map((faq: any, idx: number) => (
                                    <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors">
                                        <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">Q</div>
                                            {faq.q}
                                        </h4>
                                        <p className="text-sm text-slate-600 pl-8">{faq.a}</p>
                                    </div>
                                ))}
                                {!crmConfig?.faqs && <p className="text-center text-slate-400 py-10">No FAQs loaded.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
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
                                        onClick={() => toggleWorkflow('greeting', 'Instant Greeting')}
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

                            <div className={`p-4 rounded-lg border transition-colors ${workflows.folio ? 'border-purple-300 bg-purple-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className={`w-5 h-5 ${workflows.folio ? 'text-purple-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.folio ? 'text-purple-700' : 'text-slate-600'}`}>Automated Folio Dispatch</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('folio', 'Automated Folio Dispatch')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.folio ? 'bg-purple-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.folio ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500 mb-3">If a lead asks for services, the AI automatically emails the "2026 Health Services Catalog.pdf".</p>
                                <button
                                    onClick={handleFolioDispatch}
                                    disabled={isSendingFolio || !workflows.folio}
                                    className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                                >
                                    {isSendingFolio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Test Folio Dispatch
                                </button>
                            </div>

                            <div className={`p-4 rounded-lg border transition-colors ${workflows.quotation ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className={`w-5 h-5 ${workflows.quotation ? 'text-amber-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.quotation ? 'text-amber-700' : 'text-slate-600'}`}>Auto-Quotation Generation</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('quotation', 'Auto-Quotation Generation')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.quotation ? 'bg-amber-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.quotation ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">The HR/Admin specifies services; AI automatically drafts and emails a professional quotation to the client.</p>
                            </div>

                            <div className={`p-4 rounded-lg border transition-colors ${workflows.consent_form ? 'border-primary/40 bg-primary/10' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className={`w-5 h-5 ${workflows.consent_form ? 'text-primary' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.consent_form ? 'text-primary' : 'text-slate-600'}`}>Form Link & Receipt Grtg.</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('consent_form', 'Form Link & Receipt Grtg.')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.consent_form ? 'bg-primary' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.consent_form ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">Automatically shares consent links upon quote acceptance, and sends a "Form Submitted" greeting upon receipt.</p>
                            </div>

                            <div className={`p-4 rounded-lg border transition-colors ${workflows.drip ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Send className={`w-5 h-5 ${workflows.drip ? 'text-emerald-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.drip ? 'text-emerald-700' : 'text-slate-600'}`}>No-Response Drip Campaign</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('drip', 'No-Response Drip Campaign')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.drip ? 'bg-emerald-500' : 'bg-slate-200'}`}
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
                            {automationLogs.map((log) => (
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
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Executed</span>
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
                                    {availableWorkers.map(worker => (
                                        <div key={worker.id} className="p-4 border-2 border-slate-200 hover:border-purple-400 rounded-xl transition-all cursor-pointer group hover:shadow-md bg-white">
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                    {worker.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate">{worker.name}</h4>
                                                    <p className="text-xs text-slate-500 truncate">{worker.role}</p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
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
                                                    Assign to {staffPickerTargetLead.name.split(' ')[0]}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const lead = leads.find(l => l.id === staffPickerTargetLead.id);
                                                        if (lead) sendWorkerProfileWhatsApp(lead, worker);
                                                    }}
                                                    className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
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
                        <div className="p-5 border-b border-slate-100 bg-emerald-500/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-emerald-600" />
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
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${agentDraftLang === lang ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                                    >
                                        {isEditingTemplate ? 'Back to Draft View' : '⚙️ Edit Default Template'}
                                    </button>
                                </div>
                                <div className="relative">
                                    <textarea
                                        value={isEditingTemplate ? templateDraftText : agentDraftText}
                                        onChange={(e) => isEditingTemplate ? setTemplateDraftText(e.target.value) : setAgentDraftText(e.target.value)}
                                        className="w-full h-32 px-4 py-3 rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-emerald-50 text-emerald-900 resize-none font-medium leading-relaxed"
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75"></span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse delay-150"></span>
                                    </div>
                                </div>

                                {isEditingTemplate ? (
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-medium">Use <code className="px-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">{"{{name}}"}</code> and <code className="px-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">{"{{link}}"}</code> as dynamic variables.</p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Human conformation ensures quality outbound interactions.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            {isEditingTemplate ? (
                                <button onClick={handleSaveTemplate} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    Save as Default
                                </button>
                            ) : (
                                <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Confirm & Dispatch
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lead Details Modal (Dynamic Questionnaire) */}
            {isDetailsModalOpen && selectedLeadId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <ClipboardList className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Lead Requirements</h2>
                                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                                        CLIENT: {leads.find(l => l.id === selectedLeadId)?.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Service Category Selection */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-primary" /> Service Category
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {crmConfig?.serviceCategories?.map((cat: any) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                const updatedLeads = leads.map(l => 
                                                    l.id === selectedLeadId ? { ...l, service_type: cat.id } : l
                                                );
                                                setLeads(updatedLeads);
                                            }}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                                leads.find(l => l.id === selectedLeadId)?.service_type === cat.id
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                            }`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamic Questions */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-primary" /> Specific Requirements
                                    </label>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                                        {crmConfig?.serviceCategories?.find((c: any) => c.id === leads.find(l => l.id === selectedLeadId)?.service_type)?.name || 'Select Service'}
                                    </span>
                                </div>
                                
                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    {crmConfig?.serviceCategories?.find((cat: any) => cat.id === leads.find(l => l.id === selectedLeadId)?.service_type)?.questions.map((q: string, idx: number) => (
                                        <div key={idx} className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 ml-1">{q}</label>
                                            <input 
                                                type="text"
                                                placeholder="Type response..."
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm bg-white shadow-sm transition-all"
                                            />
                                        </div>
                                    ))}
                                    {!leads.find(l => l.id === selectedLeadId)?.service_type && (
                                        <div className="py-10 text-center space-y-2">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                                                <AlertCircle className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p className="text-sm text-slate-400 font-medium">Please select a service category above to see the requirements list.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* WhatsApp Send Button */}
                            <div className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Send to Client</p>
                                    <p className="text-xs text-emerald-600">Send these requirements via WhatsApp</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const category = crmConfig?.serviceCategories?.find((c: any) => c.id === leads.find(l => l.id === selectedLeadId)?.service_type);
                                        if (category && selectedLeadId) {
                                            const lead = leads.find(l => l.id === selectedLeadId);
                                            if (lead) sendRequirementsWhatsApp(lead, category);
                                        }
                                    }}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                    Send via WhatsApp
                                </button>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsDetailsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                Close
                            </button>
                            <button 
                                onClick={saveRequirements}
                                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save Requirements
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* AI Captured Intelligence Modal (Read-Only Summary) */}
            {isIntelligenceModalOpen && selectedLeadId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center animate-pulse">
                                    <Bot className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">AI Captured Intelligence</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                        Client: {leads.find(l => l.id === selectedLeadId)?.name}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsIntelligenceModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2.5 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-8 overflow-y-auto">
                            {/* AI Summary Card */}
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3">
                                    <ShieldCheck className="w-10 h-10 text-emerald-500/10 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-primary" /> AI Conversation Summary
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                    "The lead was captured via {leads.find(l => l.id === selectedLeadId)?.source}. The AI Agent engaged in a triage conversation, identifying requirements for {leads.find(l => l.id === selectedLeadId)?.service_type?.replace('_', ' ') || 'healthcare'} services. The client indicated urgency and requested a callback regarding pricing."
                                </p>
                            </div>

                            {/* Captured Requirements List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-primary" /> Automated Requirement Capture
                                    </h3>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">LIVE DATA</span>
                                </div>

                                <div className="grid gap-3">
                                    {[
                                        { label: 'Primary Need', value: leads.find(l => l.id === selectedLeadId)?.service_type?.replace('_', ' ').toUpperCase() || 'GENERAL INQUIRY' },
                                        { label: 'Patient Readiness', value: 'IMMEDIATE' },
                                        { label: 'Service Duration', value: '30+ DAYS CONTENT' },
                                        { label: 'Location Context', value: leads.find(l => l.id === selectedLeadId)?.phone?.startsWith('+91') ? 'INDIA (SURAT)' : 'INTERNATIONAL' }
                                    ].map((field, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-primary/20 transition-colors group">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{field.label}</span>
                                            <span className="text-sm font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-lg group-hover:bg-primary/5 group-hover:text-primary transition-colors">{field.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Verification Badge */}
                            <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">Information automatically verified by AI Agent — No manual entry required.</span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                            <button 
                                onClick={() => setIsIntelligenceModalOpen(false)}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                            >
                                Close Intelligence View
                            </button>
                            <button 
                                onClick={() => {
                                    setIsIntelligenceModalOpen(false);
                                    setActiveTab('automations');
                                }}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Bot className="w-4 h-4" /> View Full Chat Logs
                            </button>
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
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Bot className="w-4 h-4" /> AI Summary
                            </h3>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                "{selectedCall.summary || 'Summary unavailable.'}"
                            </p>
                            {selectedCall.intent && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-100 text-xs font-bold text-blue-700 shadow-sm">
                                    Intent: {selectedCall.intent}
                                </div>
                            )}
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
        </div>
    );
}
