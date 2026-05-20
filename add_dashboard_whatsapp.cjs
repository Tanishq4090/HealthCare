const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetButtons = `                                                                <button 
                                                                    onClick={() => handleGenerateSinglePayslip(item)} 
                                                                    className="text-[10px] font-bold text-[#1AA6A8] hover:underline flex items-center gap-0.5"
                                                                >
                                                                    <Download className="w-2.5 h-2.5" /> Download
                                                                </button>
                                                            </div>`;

const replacementButtons = `                                                                <button 
                                                                    onClick={() => handleGenerateSinglePayslip(item)} 
                                                                    className="text-[10px] font-bold text-[#1AA6A8] hover:underline flex items-center gap-0.5"
                                                                >
                                                                    <Download className="w-2.5 h-2.5" /> Download
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        const txt = encodeURIComponent(\`Hello \${item.worker},\\n\\nYour payslip for \${item.month || item.service_month || 'the recent period'} has been generated.\\n*Net Payable:* Rs. \${amount.toFixed(2)}\\n\\nPlease contact HR for the PDF copy or any discrepancies.\\n\\nRegards,\\n99Care HR\`);
                                                                        window.open(\`https://wa.me/?text=\${txt}\`, '_blank');
                                                                    }}
                                                                    className="text-[10px] font-bold text-[#25D366] hover:underline flex items-center gap-0.5 ml-1"
                                                                >
                                                                    <Send className="w-2.5 h-2.5" /> WhatsApp
                                                                </button>
                                                            </div>`;

if (content.includes(targetButtons)) {
    content = content.replace(targetButtons, replacementButtons);
} else {
    console.log("Could not find buttons");
}

const targetDashboard = `                        <div className="flex items-center gap-3">
                           <button
                                onClick={() => setIsManualPayrollModalOpen(true)}`;

const dashboardReplacement = `                    <div className="grid grid-cols-3 gap-4 mb-2 mt-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Payables</p>
                                <p className="text-2xl font-black text-slate-900">Rs. {payrollItems.reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#EAFBFB] text-[#1AA6A8] flex items-center justify-center">
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs text-rose-500 font-bold uppercase tracking-wider mb-1">Unpaid Dues</p>
                                <p className="text-2xl font-black text-rose-600">Rs. {payrollItems.filter(i => i.status !== 'Paid').reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-4 shadow-md flex items-center justify-between text-white">
                            <div>
                                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-1">Paid Amount</p>
                                <p className="text-2xl font-black text-white">Rs. {payrollItems.filter(i => i.status === 'Paid').reduce((sum, item) => sum + ((getDays(item) * item.daily_rate) - (item.advance_amount || 0)), 0).toFixed(2)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                        </div>
                    </div>

` + targetDashboard;

if (content.includes(targetDashboard)) {
    content = content.replace(targetDashboard, dashboardReplacement);
} else {
    console.log("Could not find dashboard insertion point");
}

fs.writeFileSync(file, content);
console.log("Success");
