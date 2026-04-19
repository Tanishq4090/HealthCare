CREATE TABLE IF NOT EXISTS payroll (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker TEXT NOT NULL,
    client_name TEXT NOT NULL,
    days_worked NUMERIC DEFAULT 0,
    daily_rate NUMERIC DEFAULT 0,
    deposit_received NUMERIC DEFAULT 0,
    net_balance NUMERIC DEFAULT 0,
    status TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow authenticated users full access to payroll"
    ON payroll
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
