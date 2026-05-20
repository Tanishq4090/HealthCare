const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

const resendTarget = `            // Fire off the dispatch email using the Edge Function
            const { error: emailError } = await supabase.functions.invoke('resend-email', {
                body: {
                    to: testEmail,
                    subject: '99Care AI - Daily Fee Invoices & Payslips',
                    html: \`
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #0f172a;">99Care AI Payroll Execution</h2>
                            <p style="color: #475569;">This is an automated message from the 99Care Admin Dashboard.</p>
                            <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0; color: #10b981; font-weight: bold;">Status: Success</p>
                                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">
                                    Processed \${newPayrollEntries.length} worker daily fee calculations.
                                </p>
                            </div>
                            <p style="color: #334155; font-size: 15px;">Please find the attached auto-generated PDF Payslips detailing the Daily Fee calculation algorithms for this cycle.</p>
                        </div>
                    \`,
                    attachments: emailAttachments
                },
            });

            if (emailError) throw emailError;

            toast.success(\`Payroll generated for \${newPayrollEntries.length} workers! Data saved and \${emailAttachments.length} PDFs dispatched.\`, { id: 'payroll-gen' });`;
            
const resendReplacement = `            toast.success(\`Payroll generated for \${newPayrollEntries.length} workers! Data saved.\`, { id: 'payroll-gen' });`;
content = content.replace(resendTarget, resendReplacement);

const waTarget = `                                                                <button 
                                                                    onClick={() => {
                                                                        const txt = encodeURIComponent(\`Hello \${item.worker},\\n\\nYour payslip for \${item.month || item.service_month || 'the recent period'} has been generated.\\n*Net Payable:* Rs. \${amount.toFixed(2)}\\n\\nPlease contact HR for the PDF copy or any discrepancies.\\n\\nRegards,\\n99Care HR\`);
                                                                        const workerRecord = workers.find(w => w.name === item.worker);
                                                                        let phone = '';
                                                                        if (workerRecord && workerRecord.phone) {
                                                                            phone = workerRecord.phone.replace(/\\D/g, '');
                                                                            if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;
                                                                        }
                                                                        window.open(\`https://wa.me/\${phone}?text=\${txt}\`, '_blank');
                                                                    }}
                                                                    className="px-2 py-1 bg-green-50 text-[10px] font-bold text-green-600 hover:bg-green-500 hover:text-white rounded transition-colors flex items-center gap-1"
                                                                >
                                                                    <Send className="w-3 h-3" /> WhatsApp
                                                                </button>`;
const waReplacement = `                                                                <button 
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
content = content.replace(waTarget, waReplacement);

fs.writeFileSync(file, content);
console.log("Success");
