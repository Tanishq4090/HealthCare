// Shared worker data — used by both HR and CRM staff picker
// When real workers are saved to Supabase via HR → Add Worker,
// both sections will fetch live data. This is the shared fallback.

export const MOCK_WORKERS = [
    {
        id: '1',
        name: 'Dr. Emily Carter',
        role: 'Specialist Consultant',
        assigned_client: 'Apex Medical Corp',
        hourly_rate: 120,
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
        hourly_rate: 45,
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
        hourly_rate: 85,
        status: 'Available',
        aadhaar_number: '345678901234',
        phone: '+917654321098',
        address: '78 Wellness Blvd, Bangalore',
        dob: '1992-11-05',
    },
];

export const MOCK_PAYROLL = [
    { id: '1', worker: 'Dr. Emily Carter', hours_logged: 105, client_name: 'Apex Medical Corp', total_amount: 12600, status: 'Pending Verification' },
    { id: '2', worker: 'Sarah Jenkins', hours_logged: 140, client_name: 'Downtown Physio', total_amount: 6300, status: 'Draft' },
];
