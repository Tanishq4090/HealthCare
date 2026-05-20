const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add PayslipGenerator import after AssignmentAttendancePanel import
content = content.replace(
  `import AssignmentAttendancePanel from '../components/hr/AssignmentAttendancePanel';`,
  `import AssignmentAttendancePanel from '../components/hr/AssignmentAttendancePanel';\nimport PayslipGenerator from '../components/hr/PayslipGenerator';`
);

// 2. Add billingAssignment state after previewPayslip state
content = content.replace(
  `    const [previewPayslip, setPreviewPayslip] = useState<any>(null);`,
  `    const [previewPayslip, setPreviewPayslip] = useState<any>(null);\n    const [billingAssignment, setBillingAssignment] = useState<any>(null);`
);

// 3. Add assignments fetch in fetchData (after payrollData fetch)
content = content.replace(
  `            const { data: employeeData, error: employeeError } = await supabase.from('employees').select('*');
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*');`,
  `            const { data: employeeData, error: employeeError } = await supabase.from('employees').select('*');
            const { data: payrollData, error: payrollError } = await supabase.from('payroll').select('*');
            const { data: assignmentsData } = await supabase.from('worker_assignments').select('*, employees(*), clients(*)').eq('status', 'active');
            if (assignmentsData) setActiveAssignments(assignmentsData);`
);

// 4. Add Billing button and remove mark-as-paid buttons in the payslip card
const oldActionButtons = `                                                        {item.status !== 'Paid' ? (
                                                            <button 
                                                                onClick={async () => {
                                                                    try {
                                                                        const { error } = await supabase
                                                                            .from('payroll')
                                                                            .update({ status: 'Paid' })
                                                                            .eq('id', item.id);
                                                                        
                                                                        if (error) throw error;
                                                                        toast.success(\`Salary marked as paid for \${item.worker}\`);
                                                                        fetchData(); // Refresh list
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || "Failed to mark salary as paid");
                                                                    }
                                                                }}
                                                                className="p-2 rounded-lg bg-[#1AA6A8] text-white hover:bg-[#1AA6A8] transition-all shadow-sm active:scale-95"
                                                                title="Mark as Paid"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <div className="p-2 rounded-lg bg-slate-100 text-slate-400">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                        <button `;
const newActionButtons = `                                                        <button
                                                                onClick={async () => {
                                                                    // Find the assignment for this worker
                                                                    const assignment = activeAssignments.find(
                                                                        a => a.employee_id === item.worker_id || 
                                                                             (a.employees && a.employees.full_name === item.worker)
                                                                    );
                                                                    if (assignment) {
                                                                        setBillingAssignment(assignment);
                                                                    } else {
                                                                        // Fetch on demand if not in state
                                                                        const { data } = await supabase
                                                                            .from('worker_assignments')
                                                                            .select('*, employees(*), clients(*)')
                                                                            .or(\`employee_id.eq.\${item.worker_id || '00000000-0000-0000-0000-000000000000'}\`)
                                                                            .maybeSingle();
                                                                        if (data) setBillingAssignment(data);
                                                                        else toast.error('No active assignment found for this worker.');
                                                                    }
                                                                }}
                                                                className="px-2 py-1 bg-slate-800 text-[10px] font-bold text-white hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                                                                title="Open Payslip Generator"
                                                            >
                                                                <FileText className="w-3 h-3" /> Billing
                                                            </button>
                                                        <button `;
content = content.replace(oldActionButtons, newActionButtons);

// 5. Add PayslipGenerator modal just before the closing of the payroll section (find a good anchor)
const payslipGeneratorModal = `
            {/* Worker Payslip Generator Modal (Billing) */}
            {billingAssignment && (
                <PayslipGenerator
                    assignment={billingAssignment}
                    onClose={() => setBillingAssignment(null)}
                    onGenerated={() => { setBillingAssignment(null); fetchData(); }}
                />
            )}
`;

// Add it just before the last closing tag of the payroll tab section
const targetAnchor = `            {/* Preview Payslip Modal */}`;
content = content.replace(targetAnchor, payslipGeneratorModal + `            {/* Preview Payslip Modal */}`);

fs.writeFileSync(file, content);
console.log('Done');
