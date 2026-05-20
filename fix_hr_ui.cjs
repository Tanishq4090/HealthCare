const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetContent = `                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Total Days Worked</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={manualPayrollData.daysWorked || ''}
                                    onChange={e => setManualPayrollData({...manualPayrollData, daysWorked: parseFloat(e.target.value) || 0})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    placeholder="e.g. 21.5"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Service Month</label>
                                    <input
                                        type="text"
                                        value={manualPayrollData.serviceMonth}
                                        onChange={e => setManualPayrollData({...manualPayrollData, serviceMonth: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="e.g. April 2026"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Advance Received (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.advanceAmount || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, advanceAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="e.g. 2000"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1 italic">This will be subtracted from worker salary.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Custom Daily Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.dailyRateOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, dailyRateOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={manualPayrollData.clientNameOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, clientNameOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                            </div>`;

const replacement = `                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={manualPayrollData.startDate}
                                        onChange={e => setManualPayrollData({...manualPayrollData, startDate: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">End Date (optional)</label>
                                    <input
                                        type="date"
                                        value={manualPayrollData.endDate}
                                        min={manualPayrollData.startDate}
                                        onChange={e => setManualPayrollData({...manualPayrollData, endDate: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Advance Received (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.advanceAmount || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, advanceAmount: parseFloat(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="e.g. 2000"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1 italic">This will be subtracted.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Custom Daily Rate (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={manualPayrollData.dailyRateOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, dailyRateOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        value={manualPayrollData.clientNameOverride}
                                        onChange={e => setManualPayrollData({...manualPayrollData, clientNameOverride: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white shadow-sm"
                                        placeholder="Optional override"
                                    />
                                </div>
                            </div>`;

if(content.includes(targetContent)) {
    content = content.replace(targetContent, replacement);
    fs.writeFileSync(file, content);
    console.log("Success");
} else {
    console.log("Could not find target content.");
}
