import { useState, useEffect, useRef } from 'react';
import { Bot, Mail, MessageSquare, Phone, CheckCircle2, FileText, Send, Users, Loader2, Mic, PlayCircle, Plus, PhoneOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Client from '@vapi-ai/web';

const VAPI_PUBLIC_KEY = "3cd76924-ad95-4b41-8018-26d22b309bbf";
const VAPI_ASSISTANT_ID = "2de7804c-6087-43bf-8098-dfc787aa3dee";

export default function CRM() {
    const [activeTab, setActiveTab] = useState<'pipeline' | 'automations' | 'voice'>('pipeline');
    const [leads, setLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSendingFolio, setIsSendingFolio] = useState(false);
    const [isSimulatingInquiry, setIsSimulatingInquiry] = useState(false);

    // AI Automation State
    const [automationLogs, setAutomationLogs] = useState([
        { id: 1, type: 'greeting', icon: MessageSquare, title: 'Auto-Greeting Sent', desc: 'Sent "Welcome to HealthFirst" SMS to Sarah Jenkins.', time: '10:45 AM', status: 'success' },
        { id: 2, type: 'folio', icon: FileText, title: 'Folio Dispatched', desc: 'Emailed "Enterprise Health Services" PDF to Michael Ross.', time: '09:30 AM', status: 'success' },
        { id: 3, type: 'followup', icon: Send, title: 'Drip Sequence Triggered', desc: 'Added David Chen to "Post-Meeting Follow-up" sequence.', time: 'Yesterday, 4:00 PM', status: 'success' },
    ]);

    const [workflows, setWorkflows] = useState({
        greeting: true,
        folio: true,
        quotation: false,
        consent_form: false,
        drip: false
    });

    // Voice AI Call Logs Data
    const [calls, setCalls] = useState([
        {
            id: 1,
            phone: "+1 (555) 234-5678",
            type: "Inbound",
            duration: "3m 12s",
            time: "10:15 AM",
            intent: "Lead Generation",
            summary: "Caller was inquiring about home healthcare services for their elderly mother. They are looking for a part-time caregiver.",
            capturedName: "Mark Johnson",
            capturedValue: 15000,
            status: "Unprocessed"
        },
        {
            id: 2,
            phone: "+1 (555) 876-5432",
            type: "Inbound",
            duration: "1m 45s",
            time: "09:30 AM",
            intent: "Support",
            summary: "Current client calling to reschedule their appointment for tomorrow. Handled by AI and updated schedule.",
            capturedName: null,
            capturedValue: null,
            status: "Processed"
        },
        {
            id: 3,
            phone: "+1 (555) 112-2334",
            type: "Outbound",
            duration: "4m 5s",
            time: "Yesterday",
            intent: "Follow-up",
            summary: "Follow-up call to an old lead. Lead is interested in discussing options again next week.",
            capturedName: "Emily Davis",
            capturedValue: 25000,
            status: "Unprocessed"
        }
    ]);

    // --- VAPI INTEGRATION ---
    const vapiRef = useRef<any>(null);
    const [callStatus, setCallStatus] = useState<'idle' | 'loading' | 'active'>('idle');

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
            // Optimistic addition to call logs
            setCalls(prev => [{
                id: Date.now(),
                phone: "Browser Call",
                type: "Outbound",
                duration: "Just now",
                time: new Date().toLocaleTimeString(),
                intent: "Lead Gen / Demo",
                summary: "Recent manual browser call triggered via Vapi SDK.",
                capturedName: "Browser Guest",
                capturedValue: 5000,
                status: "Unprocessed"
            }, ...prev]);
        });

        vapiRef.current.on('speech-start', () => console.log('Assistant started speaking'));
        vapiRef.current.on('speech-end', () => console.log('Assistant stopped speaking'));
        vapiRef.current.on('error', (e: any) => {
            console.error('Vapi Error', e);
            setCallStatus('idle');
            alert('Vapi encounterd an error. Please check console.');
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
    // -------------------------

    const toggleWorkflow = (key: keyof typeof workflows, name: string) => {
        const isTurningOn = !workflows[key];
        setWorkflows(prev => ({ ...prev, [key]: isTurningOn }));

        // Add to log
        const newLog = {
            id: Date.now(),
            type: 'system',
            icon: Bot,
            title: `Workflow ${isTurningOn ? 'Activated' : 'Paused'}`,
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
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Hi there! 👋</h2>
                            <p>You recently inquired about our services at HealthFirst. Our AI agent has automatically dispatched our current digital folio for your review.</p>
                            <p><strong>Note:</strong> In a production environment, the actual PDF brochure would be attached to this email.</p>
                            <br/>
                            <p>Let us know if you want to schedule a quick call!</p>
                            <p>- The HealthFirst Team</p>
                        </div>
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

            alert(`Success! The automated Folio email was sent to ${testEmail}`);
        } catch (error: any) {
            console.error('Error sending folio:', error);
            alert(`Error: ${error.message || 'Failed to send email'}. Ensure you used your verified Resend email!`);
        } finally {
            setIsSendingFolio(false);
        }
    };

    const handleBulkGreeting = async () => {
        if (!workflows.greeting) {
            alert("The 'Instant Greeting & Triage' workflow is currently toggled OFF. Please flip the switch to enable it first.");
            return;
        }

        if (leads.length === 0) {
            alert("There are no leads in the pipeline to send greetings to.");
            return;
        }

        const testEmail = window.prompt(`We will simulate sending the Instant Greeting to all ${leads.length} captured leads.\n\nEnter your verified Resend email to receive the mock emails on their behalf:`);
        if (!testEmail) return;

        setIsSimulatingInquiry(true);
        try {
            // Pick the first up to 3 leads to keep it from spamming the inbox too much during a test
            const targetLeads = leads.slice(0, 3);
            const leadNames = targetLeads.map(l => l.name);

            // Send batch greeting
            const { error: emailError } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: testEmail,
                    subject: 'HealthFirst Instant Greeting Batch Sent',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Hello Admin, 👋</h2>
                            <p>This is a simulated batch execution of the <strong>Instant Greeting & Triage</strong> automation.</p>
                            <p>In a live environment, the following tailored welcome emails would have been dispatched directly to the clients' actual email addresses:</p>
                            <ul>
                                ${leadNames.map(name => `<li><strong>To:</strong> ${name} <br/> <strong>Subject:</strong> Welcome to HealthFirst! (Automated Greeting)</li>`).join('')}
                            </ul>
                            <br/>
                            <p><small><em>This is an automated batch summary generated by the HealthFirst CRM.</em></small></p>
                        </div>
                    `
                },
            });

            if (emailError) throw emailError;

            // Log success event
            setAutomationLogs(prev => [{
                id: Date.now(),
                type: 'greeting',
                icon: MessageSquare,
                title: 'Bulk Auto-Greeting Executed',
                desc: `Processed batch of captured leads. Emailed triage greetings for: ${leadNames.join(', ')}.`,
                time: 'Just now',
                status: 'success'
            }, ...prev]);

            alert(`Execution Complete!\nBatch Auto-greeting emails triggered for ${leadNames.length} leads. Summaries sent to ${testEmail}.`);

        } catch (error: any) {
            console.error("Bulk greeting error", error);
            alert(`Bulk greeting failed: ${error.message}`);
        } finally {
            setIsSimulatingInquiry(false);
        }
    };

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('crm_leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error('Error fetching CRM leads:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch leads from Supabase
    useEffect(() => {
        fetchLeads();
    }, []);

    const handleMoveLead = async (leadId: string, newStage: string) => {
        try {
            // Optimistic update for snappier UI
            setLeads(prevLeads => prevLeads.map(lead =>
                lead.id === leadId ? { ...lead, pipeline_stage: newStage } : lead
            ));

            const { error } = await supabase
                .from('crm_leads')
                .update({ pipeline_stage: newStage })
                .eq('id', leadId);

            if (error) throw error;
            // Background refresh to ensure consistency
            fetchLeads();
        } catch (error: any) {
            console.error("Error updating lead stage:", error);
            alert(`Failed to move lead: ${error.message}`);
            // Revert on error
            fetchLeads();
        }
    };

    // Organize leads into pipeline columns
    const columns = [
        {
            title: 'New Leads',
            count: leads.filter(l => l.pipeline_stage === 'New Lead').length,
            items: leads.filter(l => l.pipeline_stage === 'New Lead').map(l => ({
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
            }))
        },
        {
            title: 'In Discussion',
            count: leads.filter(l => l.pipeline_stage === 'In Discussion').length,
            items: leads.filter(l => l.pipeline_stage === 'In Discussion').map(l => ({
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
            }))
        },
        {
            title: 'Quotation Sent',
            count: leads.filter(l => l.pipeline_stage === 'Quotation Sent').length,
            items: leads.filter(l => l.pipeline_stage === 'Quotation Sent').map(l => ({
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
            }))
        },
        {
            title: 'Form Submitted',
            count: leads.filter(l => l.pipeline_stage === 'Form Submitted').length,
            items: leads.filter(l => l.pipeline_stage === 'Form Submitted').map(l => ({
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
            }))
        },
        {
            title: 'Closed Won',
            count: leads.filter(l => l.pipeline_stage === 'Closed Won').length,
            items: leads.filter(l => l.pipeline_stage === 'Closed Won').map(l => ({
                id: l.id, name: l.name, source: l.source, time: new Date(l.created_at).toLocaleDateString(), value: "₹" + l.estimated_value_monthly + "/mo", status: l.status, pipeline_stage: l.pipeline_stage
            }))
        }
    ];

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

            alert(`${leadName} has been converted successfully!`);
        }
    };

    const captureCallAsLead = async (callId: number) => {
        const call = calls.find(c => c.id === callId);
        if (!call || !call.capturedName) return;

        try {
            const { error } = await supabase.from('crm_leads').insert([{
                name: call.capturedName,
                source: 'AI Phone Call',
                status: 'AI Handled',
                pipeline_stage: 'New Lead',
                estimated_value_monthly: call.capturedValue || 0,
            }]);

            if (error) throw error;

            // Mark call as processed
            setCalls(prev => prev.map(c => c.id === callId ? { ...c, status: 'Processed' } : c));

            // Refresh list
            fetchLeads();

            alert(`Successfully added ${call.capturedName} to the pipeline!`);
        } catch (error: any) {
            console.error("Error creating lead from call:", error);
            alert(`Failed to create lead: ${error.message}`);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">AI CRM Center</h1>
                    <p className="text-slate-500 mt-1">Manage leads, pipelines, and AI communication workflows.</p>
                </div>

                {/* Module Tabs */}
                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                    <button
                        onClick={() => setActiveTab('pipeline')}
                        className={`px - 4 py - 2 rounded - md text - sm font - medium transition - colors ${activeTab === 'pipeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Pipeline
                    </button>
                    <button
                        onClick={() => setActiveTab('automations')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'automations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'} `}
                    >
                        AI Automations
                    </button>
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'voice' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'} `}
                    >
                        Voice AI Calls
                    </button>
                </div>
            </div>

            {activeTab === 'pipeline' ? (
                /* Kanban Pipeline View */
                <div className="flex-1 flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="ml-3 text-slate-500 font-medium">Loading live pipeline...</span>
                        </div>
                    ) : (
                        columns.map((col, idx) => (
                            <div key={idx} className="w-[320px] shrink-0 flex flex-col bg-slate-50 rounded-xl border border-slate-200">
                                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-xl">
                                    <h3 className="font-semibold text-slate-900">{col.title}</h3>
                                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
                                        {col.count}
                                    </span>
                                </div>

                                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                                    {col.items.map((item) => (
                                        <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</h4>
                                                <select
                                                    value={item.pipeline_stage}
                                                    onChange={(e) => handleMoveLead(item.id, e.target.value)}
                                                    className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-slate-100 transition-colors"
                                                >
                                                    <option value="New Lead">New Lead</option>
                                                    <option value="In Discussion">In Discussion</option>
                                                    <option value="Quotation Sent">Quotation Sent</option>
                                                    <option value="Form Submitted">Form Submitted</option>
                                                    <option value="Closed Won">Closed Won</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-4 mb-3">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    {item.source === 'Web Chat' && <MessageSquare className="w-3.5 h-3.5" />}
                                                    {item.source === 'Email' && <Mail className="w-3.5 h-3.5" />}
                                                    {item.source === 'Contact Form' && <FileText className="w-3.5 h-3.5" />}
                                                    {item.source === 'Meeting' && <Phone className="w-3.5 h-3.5" />}
                                                    {item.source === 'AI Phone Call' && <Mic className="w-3.5 h-3.5" />}
                                                    {item.source === 'Referral' && <Users className="w-3.5 h-3.5" />}
                                                    {item.source}
                                                </div>
                                                <div className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">
                                                    {item.value}
                                                </div>
                                            </div>

                                            <div className="pt-3 flex flex-col gap-2 border-t border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 cursor-help" title="Current AI Status">
                                                        <Bot className="w-3.5 h-3.5 text-primary" />
                                                        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{item.status}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{item.time}</span>
                                                </div>

                                                {item.pipeline_stage === 'Closed Won' && (
                                                    <button
                                                        onClick={() => convertToClient(item.id, item.name)}
                                                        className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Convert to Server Master
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
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
                            <p className="text-3xl font-bold">48</p>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                                <span className="text-emerald-400 font-medium">+12%</span>
                                <span className="text-slate-400">vs yesterday</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-600">Leads Captured via Voice</h3>
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <p className="text-3xl font-bold text-slate-900">14</p>
                            <div className="flex items-center gap-2 mt-2 text-sm">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 flex-1 mt-1">
                                    <div className="bg-primary h-1.5 rounded-full" style={{ width: '30%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-600">Avg. Call Duration</h3>
                                <Phone className="w-5 h-5 text-purple-500" />
                            </div>
                            <p className="text-3xl font-bold text-slate-900">2m 45s</p>
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
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${call.type === 'Inbound' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-900 text-lg">{call.phone}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${call.type === 'Inbound' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {call.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                                                <span className="flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> {call.duration}</span>
                                                <span>•</span>
                                                <span className="font-medium">{call.time}</span>
                                            </div>
                                            <button className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors">
                                                <PlayCircle className="w-4 h-4" /> Listen to Recording
                                            </button>
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
                                                    <p className="text-sm text-slate-900"><span className="font-semibold">{call.capturedName}</span> • Est. Value: <span className="text-emerald-600 font-medium">₹{call.capturedValue}/mo</span></p>
                                                </div>
                                                <button
                                                    onClick={() => captureCallAsLead(call.id)}
                                                    className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Add to Pipeline
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="text-center pt-2">
                                <button className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Load Older Calls</button>
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

                            <div className={`p-4 rounded-lg border transition-colors ${workflows.consent_form ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className={`w-5 h-5 ${workflows.consent_form ? 'text-blue-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.consent_form ? 'text-blue-700' : 'text-slate-600'}`}>Form Link & Receipt Grtg.</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('consent_form', 'Form Link & Receipt Grtg.')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.consent_form ? 'bg-blue-500' : 'bg-slate-200'}`}
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
        </div>
    );
}
