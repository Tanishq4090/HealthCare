const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add workerPhone to manualPayrollData state
const dataStateTarget = `    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        startDate: '',
        endDate: '',
        customDailyRate: null as number | null,
        advanceAmount: 0,
        shiftHoursOverride: 0
    });`;
const dataStateReplacement = `    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        startDate: '',
        endDate: '',
        customDailyRate: null as number | null,
        advanceAmount: 0,
        shiftHoursOverride: 0,
        workerPhone: ''
    });`;
content = content.replace(dataStateTarget, dataStateReplacement);

// 2. Add input to manual payroll modal
const manualInputTarget = `                            {workers.find(w => w.id === manualPayrollData.worker_id)?.preferred_payment_type === 'hourly' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Per Day (Override)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={manualPayrollData.shiftHoursOverride || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, shiftHoursOverride: parseInt(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        placeholder="e.g. 10"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">This overrides the worker's default shift length for this specific payslip.</p>
                                </div>
                            )}`;
const manualInputReplacement = `                            {workers.find(w => w.id === manualPayrollData.worker_id)?.preferred_payment_type === 'hourly' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hours Per Day (Override)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={manualPayrollData.shiftHoursOverride || ''}
                                        onChange={e => setManualPayrollData({...manualPayrollData, shiftHoursOverride: parseInt(e.target.value) || 0})}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                        placeholder="e.g. 10"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">This overrides the worker's default shift length for this specific payslip.</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Worker Phone Number (for WhatsApp)</label>
                                <input
                                    type="text"
                                    value={manualPayrollData.workerPhone || ''}
                                    onChange={e => setManualPayrollData({...manualPayrollData, workerPhone: e.target.value})}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white"
                                    placeholder="Leave empty to use directory number"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Only required if overriding or if missing in directory.</p>
                            </div>`;
content = content.replace(manualInputTarget, manualInputReplacement);

// 3. Save workerPhone when generating manual payslip
const manualGenerateTarget = `            const newPayslip = {
                worker: targetWorker.name,
                client_name: 'Manual Assessment',
                days_worked: days,
                daily_rate: actualDailyRate,
                deposit_received: 0,
                advance_amount: manualPayrollData.advanceAmount || 0,
                net_balance: netPayable,
                status: 'Unpaid',
                period_start: manualPayrollData.startDate,
                period_end: endDateStr,
            };`;
const manualGenerateReplacement = `            const newPayslip = {
                worker: targetWorker.name,
                client_name: 'Manual Assessment',
                days_worked: days,
                daily_rate: actualDailyRate,
                deposit_received: 0,
                advance_amount: manualPayrollData.advanceAmount || 0,
                net_balance: netPayable,
                status: 'Unpaid',
                period_start: manualPayrollData.startDate,
                period_end: endDateStr,
                worker_phone: manualPayrollData.workerPhone || ''
            };`;
content = content.replace(manualGenerateTarget, manualGenerateReplacement);

// 4. Also fetch worker_phone in the dashboard fetch so it is returned from DB
const fetchTarget = `            const { data: dbPayroll, error: dbError } = await supabase
                .from('payroll')
                .select('*')
                .order('created_at', { ascending: false });`;
const fetchReplacement = `            const { data: dbPayroll, error: dbError } = await supabase
                .from('payroll')
                .select('*')
                .order('created_at', { ascending: false });`;
content = content.replace(fetchTarget, fetchReplacement); // Not really changing query since * fetches all columns including worker_phone

// 5. Add generatePayslipBlob function for WhatsApp dispatch
const generateBlobFunctionTarget = `    // Realtime calculations`;
const generateBlobFunctionReplacement = `    const generatePayslipBlob = (item: any) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // Colors
        const primaryColor = [15, 23, 42];
        const secondaryColor = [71, 85, 105];
        const accentColor = [26, 166, 168]; // #1AA6A8

        // Header Section
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Company Info
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("99 CARE", 15, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("104, FORCHUN MALL, GALAXY CIRCAL", 15, 26);
        doc.text("PAL ADAJAN, Surat, GUJARAT, 395007", 15, 31);
        doc.text("Ph: +91 90161 16564 | Email: 99careforyou@gmail.com", 15, 36);

        // Payslip Title
        doc.setFontSize(18);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text("SALARY SLIP", pageWidth - 15, 25, { align: "right" });

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 45, pageWidth - 15, 45);

        // Worker Details Section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Employee Details", 15, 55);

        doc.setFontSize(10);
        const detailsY = 65;
        const lineSpacing = 7;

        // Left Column
        doc.setFont("helvetica", "normal");
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("Employee Name:", 15, detailsY);
        doc.text("Working Month:", 15, detailsY + lineSpacing);
        doc.text("Client Assigned:", 15, detailsY + lineSpacing * 2);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(item.worker, 55, detailsY);
        doc.text(item.month || item.service_month || 'Monthly Period', 55, detailsY + lineSpacing);
        doc.text(item.client_name || 'Various', 55, detailsY + lineSpacing * 2);

        // Right Column
        doc.setFont("helvetica", "normal");
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("Date Generated:", 120, detailsY);
        doc.text("Payslip ID:", 120, detailsY + lineSpacing);
        doc.text("Status:", 120, detailsY + lineSpacing * 2);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(new Date().toLocaleDateString(), 155, detailsY);
        doc.text("PS-" + Math.random().toString(36).substr(2, 6).toUpperCase(), 155, detailsY + lineSpacing);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(item.status, 155, detailsY + lineSpacing * 2);

        // Summary Box
        const summaryY = 100;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, summaryY, pageWidth - 30, 80, 3, 3, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Earnings & Deductions", 25, summaryY + 12);

        const tableY = summaryY + 25;
        doc.setFontSize(10);
        
        // Calculations
        const isMonthlyItem = !!item.month;
        const totalDays = isMonthlyItem ? item.daysInMonth : getDays(item);
        const activeDays = isMonthlyItem ? (totalDays - item.leaves - item.half_days * 0.5) : totalDays;
        
        const baseDailyRate = item.daily_rate;
        const grossEarnings = activeDays * baseDailyRate;
        const advanceDeduction = item.advance_amount || 0;
        const netPayable = grossEarnings - advanceDeduction;

        // Table Content
        doc.setFont("helvetica", "normal");
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        
        doc.text("Description", 25, tableY);
        doc.text("Units", 90, tableY);
        doc.text("Rate", 130, tableY);
        doc.text("Amount", 170, tableY);

        doc.line(20, tableY + 5, pageWidth - 20, tableY + 5);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        
        // Base Pay
        doc.text("Base Pay", 25, tableY + 15);
        doc.setFont("helvetica", "normal");
        doc.text(\`\${activeDays} Days\`, 90, tableY + 15);
        doc.text(\`Rs. \${baseDailyRate.toFixed(2)}\`, 130, tableY + 15);
        doc.text(\`Rs. \${grossEarnings.toFixed(2)}\`, 170, tableY + 15);

        // Deductions
        if (advanceDeduction > 0) {
            doc.text("Advance Deduction", 25, tableY + 25);
            doc.text("-", 90, tableY + 25);
            doc.text("-", 130, tableY + 25);
            doc.setTextColor(220, 38, 38); // Red
            doc.text(\`- Rs. \${advanceDeduction.toFixed(2)}\`, 170, tableY + 25);
        }

        // Net Payable Bar
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(15, summaryY + 80, pageWidth - 30, 20, 'F');
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("NET PAYABLE", 25, summaryY + 93);
        doc.text(\`Rs. \${netPayable.toFixed(2)}\`, pageWidth - 25, summaryY + 93, { align: "right" });

        // Footer Note
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(148, 163, 184);
        doc.text("This is an electronically generated salary slip and does not require a signature.", pageWidth / 2, 280, { align: "center" });

        return doc.output('blob');
    };

    // Realtime calculations`;
content = content.replace(generateBlobFunctionTarget, generateBlobFunctionReplacement);

// 6. Update WhatsApp dispatch button logic
const waButtonTarget = `                                                                <button 
                                                                    onClick={async () => {
                                                                        const txt = \`Hello \${item.worker},\\n\\nYour payslip for \${item.month || item.service_month || 'the recent period'} has been generated.\\n*Net Payable:* Rs. \${amount.toFixed(2)}\\n\\nPlease contact HR for the PDF copy or any discrepancies.\\n\\nRegards,\\n99Care HR\`;
                                                                        const workerRecord = workers.find(w => w.name === item.worker);
                                                                        let phone = '';
                                                                        if (workerRecord && workerRecord.phone) {
                                                                            phone = workerRecord.phone.replace(/\\D/g, '');
                                                                            if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
                                                                        }
                                                                        if (!phone) {
                                                                            toast.error("No phone number found for this worker.");
                                                                            return;
                                                                        }
                                                                        const toastId = toast.loading("Dispatching WhatsApp message...");
                                                                        try {
                                                                            const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                                                                                body: {
                                                                                    phone: phone,
                                                                                    message: txt
                                                                                }
                                                                            });
                                                                            if (error) throw error;
                                                                            toast.success("WhatsApp message dispatched successfully!", { id: toastId });
                                                                        } catch (err: any) {
                                                                            console.error(err);
                                                                            toast.error(err.message || "Failed to send WhatsApp message", { id: toastId });
                                                                        }
                                                                    }}
                                                                    className="px-2 py-1 bg-green-50 text-[10px] font-bold text-green-600 hover:bg-green-500 hover:text-white rounded transition-colors flex items-center gap-1"
                                                                >
                                                                    <Send className="w-3 h-3" /> WhatsApp
                                                                </button>`;
const waButtonReplacement = `                                                                <button 
                                                                    onClick={async () => {
                                                                        const workerRecord = workers.find(w => w.name === item.worker);
                                                                        let phone = item.worker_phone || '';
                                                                        if (!phone && workerRecord && workerRecord.phone) {
                                                                            phone = workerRecord.phone;
                                                                        }
                                                                        if (phone) {
                                                                            phone = phone.replace(/\\D/g, '');
                                                                            if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
                                                                        }
                                                                        if (!phone) {
                                                                            toast.error("No phone number found for this worker. Please edit the worker profile or specify it in the manual generator.");
                                                                            return;
                                                                        }
                                                                        
                                                                        const toastId = toast.loading("Generating payslip and dispatching...");
                                                                        try {
                                                                            // Generate PDF Blob
                                                                            const pdfBlob = generatePayslipBlob(item);
                                                                            const fileName = \`payslip-\${item.worker.replace(/\\s+/g, '-')}-\${Date.now()}.pdf\`;
                                                                            
                                                                            // Upload to Supabase Storage
                                                                            const { data: uploadData, error: uploadError } = await supabase.storage
                                                                                .from('payslips')
                                                                                .upload(fileName, pdfBlob, {
                                                                                    contentType: 'application/pdf',
                                                                                    upsert: false
                                                                                });
                                                                                
                                                                            if (uploadError) throw uploadError;
                                                                            
                                                                            // Get Public URL
                                                                            const { data: { publicUrl } } = supabase.storage
                                                                                .from('payslips')
                                                                                .getPublicUrl(fileName);
                                                                                
                                                                            // Dispatch via Meta API
                                                                            const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                                                                                body: {
                                                                                    phone: phone,
                                                                                    sendInvoicePdf: true,
                                                                                    invoicePdfUrl: publicUrl,
                                                                                    useTemplate: true,
                                                                                    templateName: 'worker_payslip',
                                                                                    templateParams: [item.worker]
                                                                                }
                                                                            });
                                                                            
                                                                            if (error) throw error;
                                                                            toast.success("Payslip successfully dispatched via WhatsApp!", { id: toastId });
                                                                        } catch (err: any) {
                                                                            console.error(err);
                                                                            toast.error(err.message || "Failed to dispatch payslip", { id: toastId });
                                                                        }
                                                                    }}
                                                                    className="px-2 py-1 bg-green-50 text-[10px] font-bold text-green-600 hover:bg-green-500 hover:text-white rounded transition-colors flex items-center gap-1"
                                                                >
                                                                    <Send className="w-3 h-3" /> WhatsApp
                                                                </button>`;
content = content.replace(waButtonTarget, waButtonReplacement);

fs.writeFileSync(file, content);
console.log("Success");
