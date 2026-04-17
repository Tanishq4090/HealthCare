import { useState, useEffect, useCallback } from 'react';
import { Phone, UserCheck, CheckCircle2, FileText, Upload, Bot, Edit3, X, Globe, Send, Users, Clock, Building, Loader2, RefreshCw, History, Search, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { MOCK_WORKERS, MOCK_PAYROLL } from '../data/mockWorkers';
import { format } from 'date-fns';
import WorkerAllocation from '../components/hr/WorkerAllocation';

export default function HR() {
    const [activeTab, setActiveTab] = useState<'allocation' | 'attendance' | 'payroll'>('allocation');
    const [isGenerating, setIsGenerating] = useState(false);
    const [workers, setWorkers] = useState<any[]>([]);
    const [payrollItems, setPayrollItems] = useState<any[]>([]);
    const [pipelineLeads, setPipelineLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [workerSearch, setWorkerSearch] = useState('');
    const [workerStatusFilter, setWorkerStatusFilter] = useState<string>('All');
    const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);
    const [isDeletingWorker, setIsDeletingWorker] = useState(false);

    const currentMonth = format(new Date(), 'MM');
    const currentYear = format(new Date(), 'yyyy');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
    // Track the original worker data when editing, so we can detect client reassignment
    const [originalWorkerData, setOriginalWorkerData] = useState<any>(null);

    // Live Attendance State
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [inlineMarkingId, setInlineMarkingId] = useState<string | null>(null);

    // Initial data fetch
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        assigned_client: '',
        monthly_daily_rate: '',
        short_term_daily_rate: '',
        deposit_received: '15000',
        status: 'Available',
        phone: '',
        address: '',
        dob: '',
        aadhaar_number: '',
        documents: [] as File[]
    });

    // Payroll Edit Modal State
    const [isEditPayrollModalOpen, setIsEditPayrollModalOpen] = useState(false);
    const [editingPayroll, setEditingPayroll] = useState<any>(null);

    // Invoice Preview State
    const [isInvoicePreviewModalOpen, setIsInvoicePreviewModalOpen] = useState(false);
    const [previewInvoiceItem, setPreviewInvoiceItem] = useState<any>(null);
    const [invoiceExtras, setInvoiceExtras] = useState({ discount: 0, additionalCharge: 0, chargeDesc: 'Extra Services' });

    // Manual Attendance State
    const [isManualAttendanceModalOpen, setIsManualAttendanceModalOpen] = useState(false);
    const [manualAttendanceData, setManualAttendanceData] = useState({
        worker_id: '',
        status: 'On Duty',
        check_in_time: new Date().toISOString().slice(0, 16),
        hours_worked: '8'
    });

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetWorker, setAgentTargetWorker] = useState<any>(null);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');

    // Worker Modal Tabs
    const [modalTab, setModalTab] = useState<'profile' | 'kyc' | 'vault' | 'performance' | 'history'>('profile');

    const handleExportWorkersToCSV = () => {
        if (!workers || workers.length === 0) {
            toast.error("No worker data available to export.");
            return;
        }

        const headers = ["ID", "Name", "Role", "Phone", "Status", "Monthly/Daily Rate", "Assigned Client"];
        const rows = workers.map(w => [
            w.id,
            w.name,
            w.role,
            w.phone || "",
            w.status,
            `₹${w.monthly_daily_rate || 0}`,
            w.assigned_client || "Unassigned"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Workforce_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Workforce Directory exported successfully!");
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch from employees table instead of workers
            const { data: employeeData, error: employeeError } = await supabase.from('employees').select('*');
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*');
            const { data: leadData } = await supabase.from('crm_leads').select('id, name, phone, pipeline_stage').order('created_at', { ascending: false });

            // Fetch Month-to-Date Stats for all employees
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            const { data: monthStats } = await supabase
              .from('attendance')
              .select('worker_id, status, hours_worked')
              .gte('duty_date', startOfMonth.toISOString().split('T')[0]);

            let finalWorkers = [];
                                </div>

                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 sticky bottom-0 z-30">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all">
                                        Discard Changes
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 py-4 px-6 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
                                        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                            <>
                                                <CheckCircle2 className="w-5 h-5" />
                                                {modalMode === 'add' ? 'Confirm Onboarding' : 'Save Portfolio'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div >
                    </div >
                )
            }

            {/* Edit Payroll Modal */}
            {
                isEditPayrollModalOpen && editingPayroll && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-primary" /> Edit Payslip Details
                                </h2>
                                <button onClick={() => setIsEditPayrollModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSavePayroll} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Worker</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingPayroll.worker}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Hours Logged</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.5"
                                            value={editingPayroll.hours_logged}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, hours_logged: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={editingPayroll.total_amount}
                                            onChange={(e) => setEditingPayroll({ ...editingPayroll, total_amount: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setIsEditPayrollModalOpen(false)} className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-2.5 px-4 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* AI WhatsApp Draft Modal */}
            {
                isAgentModalOpen && agentTargetWorker && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                            <div className="p-5 border-b border-slate-100 bg-[#1AA6A8]/10 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#EAFBFB] rounded-full flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-[#1AA6A8]" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                        <p className="text-xs text-slate-500 font-medium tracking-wide">SHARING PROFILE: {agentTargetWorker.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4 flex-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-primary" /> Target Language
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
                                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" /> Edit Generated Draft
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={agentDraftText}
                                            onChange={(e) => setAgentDraftText(e.target.value)}
                                            className="w-full h-32 px-4 py-3 rounded-xl border border-[#1AA6A8]/20 outline-none focus:ring-2 focus:ring-[#1AA6A8] focus:border-transparent text-sm bg-[#E6F7F7] text-[#0E7C7E] resize-none font-medium leading-relaxed"
                                        />
                                        <div className="absolute bottom-3 right-3 flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-75"></span>
                                            <span className="w-2 h-2 rounded-full bg-[#1AA6A8] animate-pulse delay-150"></span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                        Target Client: <strong>{agentTargetWorker.assigned_client}</strong>
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                                <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                    <Send className="w-4 h-4" /> Send on WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Invoice Preview Modal */}
            {isInvoicePreviewModalOpen && previewInvoiceItem && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Invoice Preview: {previewInvoiceItem.client_name || 'Client'}</h2>
                                <p className="text-sm text-slate-500 mt-1">Review and modify invoice details before generating PDF.</p>
                            </div>
                            <button onClick={() => setIsInvoicePreviewModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500 bg-white shadow-sm border border-slate-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                            <div className="bg-white border text-sm border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg">99Care AI</h3>
                                        <p className="text-slate-500">Invoice #INV-{Math.floor(Math.random()*10000)}</p>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="font-bold text-primary text-lg mb-1">Tax Invoice</h3>
                                        <p className="text-slate-500">Bill To: <span className="font-medium text-slate-800">{previewInvoiceItem.client_name}</span></p>
                                    </div>
                                </div>
                                <table className="w-full text-left mb-6">
                                    <thead className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="pb-2 font-semibold">Service</th>
                                            <th className="pb-2 font-semibold text-center">Days</th>
                                            <th className="pb-2 font-semibold text-right">Rate</th>
                                            <th className="pb-2 font-semibold text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-3 font-medium text-slate-900">{previewInvoiceItem.worker}</td>
                                            <td className="py-3 text-center text-slate-600">{previewInvoiceItem.days_worked}</td>
                                            <td className="py-3 text-right text-slate-600">₹{previewInvoiceItem.daily_rate}</td>
                                            <td className="py-3 text-right font-bold text-slate-900">₹{(previewInvoiceItem.days_worked * previewInvoiceItem.daily_rate).toFixed(2)}</td>
                                        </tr>
                                        {Number(invoiceExtras.additionalCharge) > 0 && (
                                            <tr>
                                                <td className="py-3 font-medium text-slate-900">{invoiceExtras.chargeDesc}</td>
                                                <td className="py-3 text-center">-</td>
                                                <td className="py-3 text-right">-</td>
                                                <td className="py-3 text-right font-bold text-slate-900">₹{Number(invoiceExtras.additionalCharge).toFixed(2)}</td>
                                            </tr>
                                        )}
                                        {Number(invoiceExtras.discount) > 0 && (
                                            <tr>
                                                <td className="py-3 font-medium text-[#1AA6A8]">Discount Applied</td>
                                                <td className="py-3 text-center">-</td>
                                                <td className="py-3 text-right">-</td>
                                                <td className="py-3 text-right font-bold text-[#1AA6A8]">- ₹{Number(invoiceExtras.discount).toFixed(2)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-lg">
                                    <span className="font-bold text-slate-600">Final Total Due:</span>
                                    <span className="font-black text-primary tracking-tight">
                                        ₹{((previewInvoiceItem.days_worked * previewInvoiceItem.daily_rate) + Number(invoiceExtras.additionalCharge) - Number(invoiceExtras.discount)).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-slate-700 mb-3 ml-1 text-sm uppercase tracking-wider">Add Custom Line Items</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Additional Charge (₹)</label>
                                    <input type="number" min="0" value={invoiceExtras.additionalCharge || ''} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, additionalCharge: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="e.g. 500" />
                                </div>
                                <div className="space-y-1.5 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Charge Description</label>
                                    <input type="text" value={invoiceExtras.chargeDesc} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, chargeDesc: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="Platform fee, overtimes..." />
                                </div>
                                <div className="space-y-1.5 md:col-span-2 focus-within:relative z-10">
                                    <label className="text-xs font-semibold text-slate-600 ml-1">Discount Amount (₹)</label>
                                    <input type="number" min="0" value={invoiceExtras.discount || ''} onChange={(e) => setInvoiceExtras({ ...invoiceExtras, discount: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-shadow shadow-sm" placeholder="e.g. 1000" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-4 bg-white relative z-20">
                            <button onClick={() => setIsInvoicePreviewModalOpen(false)} className="flex-1 px-6 py-3 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDownloadSingleInvoice} className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                <FileText className="w-5 h-5" />
                                Download Custom PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isManualAttendanceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" /> Mark Manual Attendance
                            </h2>
                            <button onClick={() => setIsManualAttendanceModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleManualAttendanceSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Worker</label>
                                <select
                                    value={manualAttendanceData?.worker_id || ''}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, worker_id: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    required
                                >
                                    <option value="">-- Choose Worker --</option>
                                    {Array.isArray(workers) && workers.filter((w: any) => w && (w.status === 'assigned' || w.status === 'Active')).map((w: any) => (
                                        <option key={w?.id || `fallback-${Math.random()}`} value={w?.id || ''}>
                                            {w?.full_name || w?.name || 'Unknown'} ({w?.assigned_client || 'No Client'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Check-In Time</label>
                                <input
                                    type="datetime-local"
                                    value={manualAttendanceData?.check_in_time || ''}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, check_in_time: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select
                                    value={manualAttendanceData?.status || 'Completed'}
                                    onChange={e => setManualAttendanceData({...manualAttendanceData, status: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                >
                                    <option value="Completed">Completed (Past Shift)</option>
                                    <option value="On Duty">On Duty (Live Check-in)</option>
                                </select>
                            </div>
                            {manualAttendanceData?.status === 'Completed' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Worked</label>
                                    <input
                                        type="number"
                                        value={manualAttendanceData?.hours_worked || ''}
                                        onChange={e => setManualAttendanceData({...manualAttendanceData, hours_worked: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        min="1"
                                        max="24"
                                        required
                                    />
                                </div>
                            )}
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsManualAttendanceModalOpen(false)} className="flex-1 py-2 rounded-lg font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-2 rounded-lg font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
                                    {isSubmitting ? 'Saving...' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
