export const mockData: Record<string, any[]> = {
  crm_leads: [
    { id: 'lead-1', name: 'Aarav Sharma', phone: '+919876543210', status: 'active', pipeline_stage: 'New Inquiry', service_interest: 'Elder Care 24/7', created_at: new Date(Date.now() - 1000*60*60).toISOString(), urgency: 'high', source: 'AI Phone Call', needs_attention: true },
    { id: 'lead-2', name: 'Priya Patel', phone: '+919876543211', status: 'active', pipeline_stage: 'In Discussion', service_interest: 'Post-Surgery Nursing', created_at: new Date(Date.now() - 1000*60*60*24).toISOString(), urgency: 'medium', source: 'Website Form' },
    { id: 'lead-3', name: 'Vikram Singh', phone: '+919876543212', status: 'active', pipeline_stage: 'Quotation Sent', service_interest: 'Physiotherapy', created_at: new Date(Date.now() - 1000*60*60*48).toISOString(), urgency: 'medium', source: 'WhatsApp' },
    { id: 'lead-4', name: 'Neha Gupta', phone: '+919876543213', status: 'active', pipeline_stage: 'Staff Assigned', service_interest: 'Elder Care 12 Hours', created_at: new Date(Date.now() - 1000*60*60*72).toISOString(), urgency: 'high', source: 'AI Phone Call' },
    { id: 'lead-5', name: 'Rahul Desai', phone: '+919876543214', status: 'active', pipeline_stage: 'Deposit Pending', service_interest: 'Baby Care', created_at: new Date(Date.now() - 1000*60*60*96).toISOString(), urgency: 'low', source: 'Direct Call' }
  ],
  crm_lead_activity: [
    { id: 'act-1', lead_id: 'lead-1', event_type: 'call_received', description: 'AI Agent answered incoming call. Client wants 24/7 elder care.', created_at: new Date(Date.now() - 1000*60*5).toISOString(), metadata: { reason: "Requires immediate care" } },
    { id: 'act-2', lead_id: 'lead-2', event_type: 'form_filled', description: 'Client filled intake form successfully.', created_at: new Date(Date.now() - 1000*60*60*2).toISOString() },
    { id: 'act-3', lead_id: 'lead-3', event_type: 'quote_sent', description: 'Quotation sent for Physiotherapy (₹12,000/month).', created_at: new Date(Date.now() - 1000*60*60*10).toISOString() },
    { id: 'act-4', lead_id: 'lead-4', event_type: 'staff_assigned', description: 'Nurse Meena assigned for Elder Care 12 Hours.', created_at: new Date(Date.now() - 1000*60*60*24).toISOString() },
  ],
  whatsapp_logs: [
    { id: 'wa-1', status: 'delivered', payload: { type: 'intake_form', leadId: 'lead-1', leadName: 'Aarav Sharma' }, created_at: new Date(Date.now() - 1000*60*30).toISOString() },
    { id: 'wa-2', status: 'read', payload: { type: 'quote', leadId: 'lead-3', leadName: 'Vikram Singh' }, created_at: new Date(Date.now() - 1000*60*60*8).toISOString() },
    { id: 'wa-3', status: 'error', error_message: 'Invalid phone number format', payload: { type: 'welcome', phone: '+123' }, created_at: new Date(Date.now() - 1000*60*60*12).toISOString() }
  ],
  employees: [
    { id: 'emp-1', full_name: 'Meena Kumari', role: 'Nurse', phone: '+918888888881', status: 'assigned', job_title: 'Senior RN', rating: 4.8 },
    { id: 'emp-2', full_name: 'Suresh Kumar', role: 'Caregiver', phone: '+918888888882', status: 'Active', job_title: 'Caregiver', rating: 4.5 },
    { id: 'emp-3', full_name: 'Anita Sharma', role: 'Physiotherapist', phone: '+918888888883', status: 'Active', job_title: 'Physio', rating: 4.9 },
    { id: 'emp-4', full_name: 'Ramesh Singh', role: 'Caregiver', phone: '+918888888884', status: 'assigned', job_title: 'Caregiver', rating: 4.2 }
  ],
  clients: [
    { id: 'c-1', client_name: 'Sanjay Gupta', service_type: 'Elder Care', start_date: new Date(Date.now() - 1000*60*60*24*30).toISOString(), status: 'active', phone: '+917777777771' },
    { id: 'c-2', client_name: 'Anjali Verma', service_type: 'Post-Surgery', start_date: new Date(Date.now() - 1000*60*60*24*15).toISOString(), status: 'active', phone: '+917777777772' }
  ],
  worker_assignments: [
    { id: 'wa-1', client_id: 'c-1', assignment_status: 'active', total_bill_amount: 15000, start_date: new Date(Date.now() - 1000*60*60*24*30).toISOString(), clients: { client_name: 'Sanjay Gupta' }, employees: { full_name: 'Suresh Kumar' } },
    { id: 'wa-2', client_id: 'c-2', assignment_status: 'active', total_bill_amount: 22000, start_date: new Date(Date.now() - 1000*60*60*24*15).toISOString(), clients: { client_name: 'Anjali Verma' }, employees: { full_name: 'Meena Kumari' } }
  ],
  payments: [
    { id: 'pay-1', amount: 15000, client_name: 'Sanjay Gupta', payment_date: new Date().toISOString(), payment_type: 'service' },
    { id: 'pay-2', amount: 22000, client_name: 'Anjali Verma', payment_date: new Date().toISOString(), payment_type: 'service' }
  ],
  automation_settings: [
    { id: 'global', pipeline_stages: ['New Inquiry', 'In Discussion', 'Quotation Sent', 'Form Submitted', 'Staff Assigned', 'Deposit Pending', 'Active Service'] }
  ]
};

class MockQuery {
  table: string;
  resultData: any[] | null = null;
  isSingle = false;

  constructor(table: string) {
    this.table = table;
    this.resultData = mockData[table] || [];
  }
  
  select(...args: any[]) { return this; }
  order(...args: any[]) { return this; }
  limit(num: number) { 
    if (this.resultData) this.resultData = this.resultData.slice(0, num);
    return this; 
  }
  in(col: string, vals: any[]) { 
    if (this.resultData) this.resultData = this.resultData.filter(item => vals.includes(item[col]));
    return this; 
  }
  eq(col: string, val: any) { 
    if (this.resultData) this.resultData = this.resultData.filter(item => item[col] === val);
    return this; 
  }
  neq(...args: any[]) { return this; }
  gt(...args: any[]) { return this; }
  gte(...args: any[]) { return this; }
  lt(...args: any[]) { return this; }
  lte(...args: any[]) { return this; }
  is(...args: any[]) { return this; }
  not(...args: any[]) { return this; }
  ilike(...args: any[]) { return this; }
  or(...args: any[]) { return this; }
  
  insert(data: any) { 
    this.resultData = Array.isArray(data) ? data : [data];
    return this; 
  }
  
  update(data: any) { 
    this.resultData = [data];
    return this; 
  }
  
  delete() { return this; }
  
  single() { 
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }
  
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    const result = this.isSingle 
      ? { data: (this.resultData && this.resultData.length > 0) ? this.resultData[0] : null, error: null }
      : { data: this.resultData || [], error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<any | TResult> {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<any> {
    return this.then().finally(onfinally);
  }
}

export const supabase = {
  from: (table: string) => new MockQuery(table),
  rpc: (...args: any[]) => Promise.resolve({ data: null, error: null }),
  functions: {
    invoke: (...args: any[]) => Promise.resolve({ data: null, error: null })
  },
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'mock', email: 'admin@healthcareos.com', role: 'admin' } } }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { user: { id: 'mock' }, session: {} }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  channel: (...args: any[]) => {
    const mockChannel = {
      on: (...args: any[]) => mockChannel,
      subscribe: (...args: any[]) => mockChannel,
      unsubscribe: (...args: any[]) => Promise.resolve()
    };
    return mockChannel;
  },
  removeChannel: (...args: any[]) => Promise.resolve({ error: null }),
  storage: {
    from: (bucket: string) => ({
      upload: (...args: any[]) => Promise.resolve({ data: { path: 'mock/path' }, error: null }),
      getPublicUrl: (...args: any[]) => ({ data: { publicUrl: 'https://mock.url/image.jpg' } }),
      remove: (...args: any[]) => Promise.resolve({ data: null, error: null }),
      download: (...args: any[]) => Promise.resolve({ data: new Blob(), error: null })
    })
  }
};
