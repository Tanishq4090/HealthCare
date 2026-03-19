import { useState, useEffect } from 'react';
import { DollarSign, FileText, CheckCircle2, AlertCircle, Building, Send, Edit3, X, Bot, Globe, QrCode } from 'lucide-react';
import { toast } from 'sonner';

export default function Billing() {
    const [activeTab, setActiveTab] = useState<'deposits' | 'monthly'>('deposits');

    const [deposits, setDeposits] = useState([
        { id: 1, client: 'Apex Medical Corp', amount: '₹15,000', status: 'Pending Invoice', date: 'Oct 24, 2026', invoice_no: null },
        { id: 2, client: 'Wellness Clinic Inc', amount: '₹5,000', status: 'Invoice Sent', date: 'Oct 23, 2026', invoice_no: 'INV-D502' },
        { id: 3, client: 'Downtown Physio', amount: '₹12,500', status: 'Paid', date: 'Oct 20, 2026', invoice_no: 'INV-D499' }
    ]);

    // Dummy Data for Monthly Bills
    const [monthlyBills, setMonthlyBills] = useState([
        { id: 1, client: 'Apex Medical Corp', amount: '₹45,000', attendanceVerified: true, status: 'Draft', month: 'October', invoice_no: null },
        { id: 2, client: 'Downtown Physio', amount: '₹28,500', attendanceVerified: false, status: 'Pending Verification', month: 'October', invoice_no: null },
        { id: 3, client: 'CareFirst Hospital', amount: '₹62,000', attendanceVerified: true, status: 'Sent', month: 'October', invoice_no: 'INV-M103' },
    ]);

    // Deposit Collect Modal State
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [activeDepositId, setActiveDepositId] = useState<number | null>(null);
    const [depositMethod, setDepositMethod] = useState('Online');

    // Edit Monthly Bill Modal State
    const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false);
    const [editingBill, setEditingBill] = useState<any>(null);

    // AI WhatsApp Agent State
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [agentTargetBill, setAgentTargetBill] = useState<any>(null);
    const [agentDraftLang, setAgentDraftLang] = useState<'English' | 'Hindi' | 'Hinglish'>('Hinglish');
    const [agentDraftText, setAgentDraftText] = useState('');

    const handleGenerateDepositInvoice = (id: number, clientName: string) => {
        const fakeInvoiceNo = `INV-D${Math.floor(Math.random() * 1000) + 500}`;
        setDeposits(prev => prev.map(d => d.id === id ? { ...d, status: 'Invoice Sent', invoice_no: fakeInvoiceNo } : d));
        toast.success(`System auto-generated Deposit Invoice ${fakeInvoiceNo}. PDF emailed automatically to ${clientName}!`);
    };

    const handleCollectDeposit = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeDepositId) {
            setDeposits(prev => prev.map(d => d.id === activeDepositId ? { ...d, status: 'Paid' } : d));
            toast.success(`Deposit marked as paid via ${depositMethod}. Automated "Payment Confirmation & Thank You" greeting has been dispatched to the client.`);
        }
        setIsDepositModalOpen(false);
    };

    const handleAction = (action: string, clientName: string, id: number) => {
        if (action === 'Record Monthly Payment') {
            const txnId = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            setMonthlyBills(prev => prev.map(b => b.id === id ? { ...b, status: 'Paid' } : b));
            toast.success(`Payment received for ${clientName}. Transaction ID: ${txnId} logged. Auto-greeting sent.`);
        }
    };

    const handleSaveBill = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingBill) {
            setMonthlyBills(prev => prev.map(b => b.id === editingBill.id ? editingBill : b));
            toast.success(`Bill for ${editingBill.client} updated successfully.`);
            setIsEditBillModalOpen(false);
        }
    };

    // AI WhatsApp Agent Logic
    const generateWhatsappDraft = (bill: any, lang: string) => {
        if (!bill) return '';
        const link = `https://healthfirst.ai/pay/${bill.invoice_no || Math.floor(Math.random() * 1000) + 100}`;
        if (lang === 'Hinglish') return `Hello ${bill.client} team, aapka ${bill.month} mahine ka bill generate ho gaya hai. Total amount: ${bill.amount}. Is link par click karke QR code scan karein aur payment complete karein. 📄✅👇\n${link}`;
        if (lang === 'Hindi') return `Namaste ${bill.client}, aapka ${bill.month} mahine ka bil jama karne ke liye taiyar hai. Kul rashi: ${bill.amount}. Kripya is link dwara QR code scan karein aur bhugtan karein:\n${link}`;
        return `Hi ${bill.client}, your monthly invoice for ${bill.month} has been auto-generated. Total amount due: ${bill.amount}. Please click the link below to view the bill and scan the QR code to process your payment:\n${link}`;
    };

    const openAgentModal = (bill: any) => {
        const billToProcess = { ...bill, invoice_no: bill.invoice_no || `INV-M${Math.floor(Math.random() * 1000) + 100}` };
        setAgentTargetBill(billToProcess);
        setAgentDraftText(generateWhatsappDraft(billToProcess, agentDraftLang));
        setIsAgentModalOpen(true);
    };

    useEffect(() => {
        if (agentTargetBill) {
            setAgentDraftText(generateWhatsappDraft(agentTargetBill, agentDraftLang));
        }
    }, [agentDraftLang, agentTargetBill]);

    const handleDispatchMessage = () => {
        // Launch real WhatsApp Web intent with drafted text
        let phoneDigits = '917575041313'; // Default to test number
        if (agentTargetBill?.client_phone) {
            phoneDigits = agentTargetBill.client_phone.replace(/\D/g, ''); // Extract only digits
        }
        const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(agentDraftText)}`;
        window.open(waUrl, '_blank');

        setMonthlyBills(prev => prev.map(b => b.id === agentTargetBill.id ? { ...b, status: 'Sent', invoice_no: agentTargetBill.invoice_no } : b));
        setIsAgentModalOpen(false);
        toast.success(`WhatsApp Invoice intent opened for ${agentTargetBill.client}! 📱✅`);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Finance & Billing</h1>
                    <p className="text-slate-500 mt-1">Manage deposits, monthly billing cycles, and payment collections.</p>
                </div>

                <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
                    <button
                        onClick={() => setActiveTab('deposits')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'deposits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Deposit Entries
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        Monthly Billing
                    </button>
                </div>
            </div>

            {activeTab === 'deposits' ? (
                /* Deposit Entry View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-semibold text-slate-900">Security Deposit Management</h2>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-semibold px-2">Auto-Receipt Logs Active</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {deposits.map(dep => (
                            <div key={dep.id} className="p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                                        <DollarSign className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            {dep.client}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                            <span className="font-semibold text-slate-700">{dep.amount}</span>
                                            <span>•</span>
                                            <span>{dep.date}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${dep.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                                        dep.status === 'Invoice Sent' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                        {dep.status}
                                    </span>

                                    {dep.status === 'Pending Invoice' && (
                                        <button onClick={() => handleGenerateDepositInvoice(dep.id, dep.client)} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Prepare Invoice
                                        </button>
                                    )}
                                    {dep.status === 'Invoice Sent' && (
                                        <button onClick={() => { setActiveDepositId(dep.id); setIsDepositModalOpen(true); }} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Record Collection
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* Monthly Billing View */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="p-5 border-b border-slate-200 bg-slate-50">
                        <h2 className="font-semibold text-slate-900">Monthly Billing Dashboard (October 2026)</h2>
                        <p className="text-sm text-slate-500 mt-1">Invoices require explicit HR Attendance Verification before dispatch.</p>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {monthlyBills.map(bill => (
                            <div key={bill.id} className="p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:border-primary/20 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0">
                                        <Building className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{bill.client}</h3>
                                        <p className="text-sm font-semibold text-slate-600 mt-1">Total: {bill.amount}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    {/* Verification Status */}
                                    <div className="flex items-center gap-2 text-sm">
                                        {bill.attendanceVerified ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="font-medium">Attendance Verified</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                <AlertCircle className="w-4 h-4" />
                                                <span className="font-medium">Pending Verification</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                                        <button onClick={() => { setEditingBill({ ...bill }); setIsEditBillModalOpen(true); }} className="px-3 py-2 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors" title="Edit Bill">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        {bill.status === 'Pending Verification' ? (
                                            <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Locked
                                            </button>
                                        ) : bill.status === 'Draft' ? (
                                            <button onClick={() => openAgentModal(bill)} className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-lg hover:bg-emerald-100 hover:text-emerald-800 transition-colors flex items-center gap-2 shadow-sm group border border-emerald-100">
                                                <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" /> AI WhatsApp Bill
                                            </button>
                                        ) : (
                                            <button onClick={() => handleAction('Record Monthly Payment', bill.client, bill.id)} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-emerald-500" /> Record Payment
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Deposit Collection Modal */}
            {isDepositModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-500" /> Record Deposit
                            </h2>
                        </div>
                        <form onSubmit={handleCollectDeposit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
                                <select
                                    value={depositMethod}
                                    onChange={(e) => setDepositMethod(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                >
                                    <option value="Online Transfer">Online Transfer (NEFT/RTGS)</option>
                                    <option value="UPI">UPI Setup</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Cash">Cash</option>
                                </select>
                            </div>
                            <p className="text-xs text-slate-500">Upon recording this payment, a formal receipt and dynamic thank-you greeting will be automatically sent to the client via Email/SMS.</p>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsDepositModalOpen(false)} className="flex-1 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2 rounded-lg font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-sm">
                                    Confirm Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Monthly Bill Modal */}
            {isEditBillModalOpen && editingBill && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-primary" /> Edit Monthly Bill
                            </h2>
                            <button onClick={() => setIsEditBillModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBill} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Client Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingBill.client}
                                    onChange={(e) => setEditingBill({ ...editingBill, client: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Total Amount</label>
                                <input
                                    type="text"
                                    required
                                    value={editingBill.amount}
                                    onChange={(e) => setEditingBill({ ...editingBill, amount: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                                <span className="text-sm font-semibold text-slate-700">Attendance Verified</span>
                                <button
                                    type="button"
                                    onClick={() => setEditingBill({ ...editingBill, attendanceVerified: !editingBill.attendanceVerified, status: !editingBill.attendanceVerified ? 'Draft' : 'Pending Verification' })}
                                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${editingBill.attendanceVerified ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${editingBill.attendanceVerified ? 'right-0.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsEditBillModalOpen(false)} className="flex-1 py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 py-2 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm">
                                    Save Bill
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* AI WhatsApp Draft Modal */}
            {isAgentModalOpen && agentTargetBill && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all">
                    <div className="bg-white/95 backdrop-blur-xl border border-white/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-emerald-500/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">AI WhatsApp Agent</h2>
                                    <p className="text-xs text-slate-500 font-medium tracking-wide">BILLING: {agentTargetBill.client}</p>
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
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${agentDraftLang === lang ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                                        className="w-full h-32 px-4 py-3 rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-emerald-50 text-emerald-900 resize-none font-medium leading-relaxed"
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75"></span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse delay-150"></span>
                                    </div>
                                </div>
                                <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3">
                                    <div className="p-2 bg-white rounded shadow-sm border border-slate-200 shrink-0">
                                        <QrCode className="w-6 h-6 text-slate-700" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-900 mb-0.5">Dynamic QR Code Attached</p>
                                        <p className="text-xs text-slate-500">The client can scan the QR code to securely pay {agentTargetBill.amount} via their preferred UPI app.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setIsAgentModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDispatchMessage} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                <Send className="w-4 h-4" /> Send Bill on WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
