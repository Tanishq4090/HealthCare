// Shared worker data - used by both HR and CRM staff picker.
// When real workers are saved to Supabase via HR -> Add Worker,
// both sections fetch live data. This is sanitized demo fallback data.

export const MOCK_WORKERS = [
    {
        id: '1',
        name: 'Demo Care Specialist',
        role: 'Specialist Consultant',
        assigned_client: 'Demo Care Network',
        monthly_daily_rate: 3500,
        short_term_daily_rate: 5000,
        deposit_received: 15000,
        status: 'Active',
        aadhaar_number: '000000000000',
        phone: '+910000000001',
        address: 'Demo Address, India',
        dob: '1985-05-12',
    },
    {
        id: '2',
        name: 'Demo Registered Nurse',
        role: 'Registered Nurse',
        assigned_client: '',
        monthly_daily_rate: 850,
        short_term_daily_rate: 1000,
        deposit_received: 15000,
        status: 'Available',
        aadhaar_number: '000000000000',
        phone: '+910000000002',
        address: 'Demo Address, India',
        dob: '1990-08-22',
    },
    {
        id: '3',
        name: 'Demo Physical Therapist',
        role: 'Physical Therapist',
        assigned_client: '',
        monthly_daily_rate: 1200,
        short_term_daily_rate: 1500,
        deposit_received: 15000,
        status: 'Available',
        aadhaar_number: '000000000000',
        phone: '+910000000003',
        address: 'Demo Address, India',
        dob: '1992-11-05',
    },
];

export const MOCK_PAYROLL = [
    { id: '1', worker: 'Demo Care Specialist', days_worked: 25, client_name: 'Demo Care Network', deposit_received: 15000, daily_rate: 5000, net_balance: 110000, status: 'Pending Verification' },
    { id: '2', worker: 'Demo Registered Nurse', days_worked: 31, client_name: 'Demo Rehab Center', deposit_received: 15000, daily_rate: 850, net_balance: 11350, status: 'Draft' },
];

export const MOCK_ATTENDANCE = [
    {
        id: '1',
        workers: { name: 'Demo Care Specialist', role: 'Specialist Consultant', assigned_client: 'Demo Care Network' },
        check_in_time: new Date(new Date().setHours(new Date().getHours() - 3)).toISOString(),
        check_out_time: null,
        status: 'On Duty',
    },
    {
        id: '2',
        workers: { name: 'Demo Registered Nurse', role: 'Registered Nurse', assigned_client: 'Demo Rehab Center' },
        check_in_time: new Date(new Date().setHours(new Date().getHours() - 8)).toISOString(),
        check_out_time: new Date(new Date().setHours(new Date().getHours() - 0, 30)).toISOString(),
        status: 'Completed',
    },
];
