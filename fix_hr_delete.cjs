const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                                                        {item.status !== 'Paid' ? (
                                                            <button 
                                                                onClick={async () => {
                                                                    try {
                                                                        const { error } = await supabase
                                                                            .from('payroll')
                                                                            .update({ status: 'Paid', paid_at: new Date().toISOString() })
                                                                            .eq('id', item.id);
                                                                        
                                                                        if (error) throw error;
                                                                        toast.success(\`Salary marked as paid for \${item.worker}\`);
                                                                        fetchData(); // Refresh list
                                                                    } catch (err) {
                                                                        toast.error("Failed to mark salary as paid");
                                                                        // Fallback for demo
                                                                        item.status = 'Paid';
                                                                        toast.success("Demo: Salary marked as paid!");
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
                                                        )}`;

const replacement = `                                                        {item.status !== 'Paid' ? (
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
                                                        <button 
                                                            onClick={async () => {
                                                                if (!confirm('Are you sure you want to delete this payslip?')) return;
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('payroll')
                                                                        .delete()
                                                                        .eq('id', item.id);
                                                                    if (error) throw error;
                                                                    toast.success("Payslip deleted successfully");
                                                                    fetchData();
                                                                } catch (err: any) {
                                                                    toast.error(err.message || "Failed to delete payslip");
                                                                }
                                                            }}
                                                            className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all shadow-sm active:scale-95"
                                                            title="Delete Payslip"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Success");
} else {
    console.log("Not found");
}
