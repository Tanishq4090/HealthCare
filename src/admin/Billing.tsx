import { useState } from 'react';
import { DollarSign, FileText, CheckCircle2, AlertCircle, Building, Send } from 'lucide-react';

export default function Billing() {
    const [activeTab, setActiveTab] = useState<'deposits' | 'monthly'>('deposits');

    // Dummy Data for Deposits
    const [deposits] = useState([
        { id: 1, client: 'Apex Medical Corp', amount: '₹15,000', status: 'Pending Invoice', date: 'Oct 24, 2026' },
        { id: 2, client: 'Wellness Clinic Inc', amount: '₹5,000', status: 'Invoice Sent', date: 'Oct 23, 2026' },
        { id: 3, client: 'Downtown Physio', amount: '₹12,500', status: 'Paid', date: 'Oct 20, 2026' }
    ]);

    // Dummy Data for Monthly Bills
    const [monthlyBills] = useState([
        { id: 1, client: 'Apex Medical Corp', amount: '₹45,000', attendanceVerified: true, status: 'Draft', month: 'October' },
        { id: 2, client: 'Downtown Physio', amount: '₹28,500', attendanceVerified: false, status: 'Pending Verification', month: 'October' },
        { id: 3, client: 'CareFirst Hospital', amount: '₹62,000', attendanceVerified: true, status: 'Sent', month: 'October' },
    ]);

    const handleAction = (action: string, clientName: string) => {
        alert(`${action} triggered for ${clientName}`);
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
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
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
                                        <button onClick={() => handleAction('Auto-Generate Deposit Invoice', dep.client)} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Prepare Invoice
                                        </button>
                                    )}
                                    {dep.status === 'Invoice Sent' && (
                                        <button onClick={() => handleAction('Manual Payment Recorded', dep.client)} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
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
                                        {bill.status === 'Pending Verification' ? (
                                            <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Locked
                                            </button>
                                        ) : bill.status === 'Draft' ? (
                                            <button onClick={() => handleAction('Dispatch Monthly Bill', bill.client)} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
                                                <Send className="w-4 h-4" /> Send Bill
                                            </button>
                                        ) : (
                                            <button onClick={() => handleAction('Record Monthly Payment', bill.client)} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
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
        </div>
    );
}
