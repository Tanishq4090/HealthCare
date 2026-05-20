const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. State
content = content.replace(
`    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        daysWorked: 0,
        shiftHoursOverride: 0,
        serviceMonth: format(new Date(), 'MMMM yyyy'),
        advanceAmount: 0,
        type: 'payslip' as 'payslip',
        clientNameOverride: '',
        dailyRateOverride: ''
    });`,
`    const [manualPayrollData, setManualPayrollData] = useState({
        worker_id: '',
        startDate: '',
        endDate: '',
        shiftHoursOverride: 0,
        advanceAmount: 0,
        type: 'payslip' as 'payslip',
        clientNameOverride: '',
        dailyRateOverride: ''
    });`
);

// 2. handleManualPayrollGenerate start
content = content.replace(
`    const handleManualPayrollGenerate = async () => {
        if (!manualPayrollData.worker_id || manualPayrollData.daysWorked <= 0) {
            toast.error("Please select a worker and enter valid days worked.");
            return;
        }

        setIsGenerating(true);`,
`    const handleManualPayrollGenerate = async () => {
        const start = manualPayrollData.startDate;
        const end = manualPayrollData.endDate || manualPayrollData.startDate;
        let daysWorked = 0;
        if (start) {
            const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
            daysWorked = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (!manualPayrollData.worker_id || daysWorked <= 0) {
            toast.error("Please select a worker and valid dates.");
            return;
        }
        
        const serviceMonth = start ? format(new Date(start), 'MMMM yyyy') : format(new Date(), 'MMMM yyyy');

        setIsGenerating(true);`
);

// 3. Replace variables in handleManualPayrollGenerate
content = content.replace(/totalCost = manualPayrollData\.daysWorked \* hours \* appliedRate;/g, 'totalCost = daysWorked * hours * appliedRate;');
content = content.replace(/totalCost = manualPayrollData\.daysWorked \* appliedRate; /g, 'totalCost = daysWorked * appliedRate; ');
content = content.replace(/days_worked: manualPayrollData\.daysWorked,/g, 'days_worked: daysWorked,');
content = content.replace(/service_month: manualPayrollData\.serviceMonth,/g, 'service_month: serviceMonth,');
content = content.replace(/Service Period: \$\{manualPayrollData\.serviceMonth\}/g, 'Service Period: ${serviceMonth}');
content = content.replace(/Working Days', \`\$\{manualPayrollData\.daysWorked\} days\`/g, "Working Days', `${daysWorked} days`");
content = content.replace(/_\$\{manualPayrollData\.serviceMonth\.replace/g, '_${serviceMonth.replace');

// 4. Reset state
content = content.replace(
`            setManualPayrollData({ 
                worker_id: '', 
                daysWorked: 0, 
                shiftHoursOverride: 0, 
                serviceMonth: format(new Date(), 'MMMM yyyy'),
                advanceAmount: 0,
                type: 'payslip'
            });`,
`            setManualPayrollData({ 
                worker_id: '', 
                startDate: '',
                endDate: '',
                shiftHoursOverride: 0, 
                advanceAmount: 0,
                type: 'payslip' as 'payslip',
                clientNameOverride: '',
                dailyRateOverride: ''
            });`
);

// 5. Button disable condition
content = content.replace(
`disabled={isGenerating || !manualPayrollData.worker_id || manualPayrollData.daysWorked <= 0}`,
`disabled={isGenerating || !manualPayrollData.worker_id || !manualPayrollData.startDate}`
);

fs.writeFileSync(file, content);
console.log("Done part 1");
