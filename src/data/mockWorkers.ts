// Shared worker data — used by both HR and CRM staff picker
// When real workers are saved to Supabase via HR → Add Worker,
// both sections will fetch live data. This is the shared fallback.

export const MOCK_WORKERS = [
    {
        id: '1',
        name: 'Dr. Emily Carter',
        role: 'Specialist Consultant',
        assigned_client: 'Apex Medical Corp',
        monthly_daily_rate: 3500,
        short_term_daily_rate: 5000,
        deposit_received: 15000,
        status: 'Active',
        aadhaar_number: '123456789012',
        phone: '+919876543210',
        address: '123 Health Ave, Mumbai',
        dob: '1985-05-12',
    },
    {
        id: '2',
        name: 'Sarah Jenkins',
        role: 'Registered Nurse',
        assigned_client: '',
        monthly_daily_rate: 850,
        short_term_daily_rate: 1000,
        deposit_received: 15000,
        status: 'Available',
        aadhaar_number: '234567890123',
        phone: '+918765432109',
        address: '45 Care St, Delhi',
        dob: '1990-08-22',
    },
    {
        id: '3',
        name: 'Michael Ross',
        role: 'Physical Therapist',
        assigned_client: '',
        monthly_daily_rate: 1200,
        short_term_daily_rate: 1500,
        deposit_received: 15000,
        status: 'Available',
        aadhaar_number: '345678901234',
        phone: '+917654321098',
        address: '78 Wellness Blvd, Bangalore',
        dob: '1992-11-05',
    },
];

export const MOCK_PAYROLL = [
    { id: '1', worker: 'Dr. Emily Carter', days_worked: 25, client_name: 'Apex Medical Corp', deposit_received: 15000, daily_rate: 5000, net_balance: 110000, status: 'Pending Verification' },
    { id: '2', worker: 'Sarah Jenkins', days_worked: 31, client_name: 'Downtown Physio', deposit_received: 15000, daily_rate: 850, net_balance: 11350, status: 'Draft' },
];

export const MOCK_ATTENDANCE = [
    {
        id: '1',
        workers: { name: 'Dr. Emily Carter', role: 'Specialist Consultant', assigned_client: 'Apex Medical Corp' },
        check_in_time: new Date(new Date().setHours(new Date().getHours() - 3)).toISOString(),
        check_out_time: null,
        status: 'On Duty'
    },
    {
        id: '2',
        workers: { name: 'Sarah Jenkins', role: 'Registered Nurse', assigned_client: 'Downtown Physio' },
        check_in_time: new Date(new Date().setHours(new Date().getHours() - 8)).toISOString(),
        check_out_time: new Date(new Date().setHours(new Date().getHours() - 0, 30)).toISOString(),
        status: 'Completed'
    }
];
