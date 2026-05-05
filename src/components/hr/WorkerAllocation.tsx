import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Users, UserPlus, Briefcase, Copy, Check, ExternalLink,
  ChevronDown, Building2, Shield, Trash2, RotateCcw,
  Calendar, FileText, Phone, MapPin, Search, X, Upload, Loader2, RefreshCw, Link2, MessageCircle, Edit2, AlertTriangle,
} from 'lucide-react';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Services & types
import { services as allAvailableServices } from '@/data/services';
import {
  createEmployee,
  getAvailableEmployees,
  updateEmployeeStatus,
  deleteEmployee,
  getDeletedEmployees,
  restoreEmployee,
  permanentlyDeleteEmployee,
  permanentlyDeleteAllDeletedEmployees,
  getEmployeeDocuments,
} from '../../services/employeeService';
import {
  assignWorkerToClient,
  deactivateIDCardLink,
  sendIDCardLinkToClient,
} from '../../services/assignmentService';
import { supabase } from '../../lib/supabase';
import { EmployeeIDCard } from '../hr/EmployeeIDCard';
import type { Employee, EmployeeStatus, CreateEmployeeInput } from '../../types/hr';

// ── Types ─────────────────────────────────────────────────

interface ActiveAssignment {
  id: string;
  employee_id: string;
  client_id: string;
  assigned_at: string;
  assignment_status: string;
  notes: string | null;
  employee: Employee;
  client: { id: string; client_name: string; phone_number: string | null };
  shareableUrl: string | null;
  token: string | null;
}

interface Client {
  id: string;
  client_name: string;
  company_name: string | null;
  phone_number: string | null;
}

// ── Helpers ───────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function statusBadge(status: EmployeeStatus) {
  const map: Record<EmployeeStatus, { label: string; className: string }> = {
    available: { label: 'Available', className: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-500/5' },
    assigned:  { label: 'Assigned',  className: 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm shadow-blue-500/5' },
    inactive:  { label: 'Inactive',  className: 'bg-slate-50 text-slate-500 border-slate-200 shadow-sm shadow-slate-500/5' },
  };
  const { label, className } = map[status] ?? map.inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'available' ? 'bg-emerald-400' : status === 'assigned' ? 'bg-blue-400' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
      title="Copy link"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Loading Skeletons ─────────────────────────────────────

function WorkerCardSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

// ── Add Employee Dialog ───────────────────────────────────

interface AddEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (emp: Employee, autoPreview?: boolean) => void;
}

function AddEmployeeDialog({ open, onClose, onCreated }: AddEmployeeDialogProps) {
  const [form, setForm] = useState<CreateEmployeeInput>({ 
    full_name: '', job_title: '', 
    preferred_payment_type: 'monthly', services: [],
    phone: '', aadhaar_number: '', address: '', dob: '',
    hourly_rate: 0, monthly_daily_rate: 0, short_term_daily_rate: 0,
    username: '', password: '', documents: []
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB.'); return; }
    setForm(f => ({ ...f, photo: file }));
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setForm(f => ({ ...f, documents: [...(f.documents || []), ...files] }));
  };

  const removeDocument = (index: number) => {
    setForm(f => {
      const newDocs = [...(f.documents || [])];
      newDocs.splice(index, 1);
      return { ...f, documents: newDocs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Full name is required.'); return; }
    if (!form.job_title.trim()) { toast.error('Job title is required.'); return; }
    setIsSubmitting(true);
    try {
      const emp = await createEmployee(form);
      toast.success(`Employee created! ID: ${emp.employee_id} ✅`);
      onCreated(emp, true); // Added flag to trigger auto-preview
      onClose();
      // Reset form but keep the newly created emp for preview
      setForm({ 
        full_name: '', job_title: '',
        preferred_payment_type: 'monthly', services: [],
        phone: '', aadhaar_number: '', address: '', dob: '',
        hourly_rate: 0, monthly_daily_rate: 0, short_term_daily_rate: 0,
        username: '', password: '', documents: []
      });
      setPhotoPreview(null);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add New Employee
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Photo upload */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors
              ${isDragging ? 'border-primary/40 bg-primary/5' : 'border-slate-200 hover:border-primary/30 hover:bg-slate-50'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover ring-4 ring-primary/10" />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPhotoPreview(null); setForm(f => ({ ...f, photo: undefined })); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300" />
                <p className="text-sm text-slate-500">Drag & drop or <span className="text-primary font-medium">click to upload</span></p>
                <p className="text-xs text-slate-400">JPEG, PNG, WebP · max 5 MB</p>
              </>
            )}
            <input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-400">*</span></label>
              <Input className="mt-1" placeholder="e.g. Anita Sharma" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Job Title <span className="text-red-400">*</span></label>
                <Input className="mt-1" placeholder="e.g. Registered Nurse" value={form.job_title}
                  onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Gender</label>
                <select 
                  className="w-full mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.gender ?? ''}
                  onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="" disabled>Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Services & Skills</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {[...allAvailableServices.map(s => s.title), 'All Services'].map(service => {
                  const active = form.services?.includes(service);
                  return (
                    <button type="button" key={service}
                      onClick={() => setForm(f => ({
                        ...f,
                        services: active 
                          ? f.services!.filter(s => s !== service)
                          : service === 'All Services' ? ['All Services'] : [...(f.services?.filter(s=>s !== 'All Services')||[]), service]
                      }))}
                      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                        active ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {service}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <Input className="mt-1" placeholder="98765 43210" value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Aadhaar</label>
                <Input className="mt-1" placeholder="0000 0000 0000" value={form.aadhaar_number ?? ''}
                  onChange={e => setForm(f => ({ ...f, aadhaar_number: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Date of Birth</label>
                <Input className="mt-1" type="date" value={form.dob ?? ''}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Residential Address</label>
                <Input className="mt-1" placeholder="Full Address" value={form.address ?? ''}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Experience</label>
                <Input className="mt-1" placeholder="e.g. 5 Years" value={(form as any).experience ?? ''}
                  onChange={e => setForm(f => ({ ...f, experience: e.target.value } as any))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">ID Proofs & Documents</label>
              <div 
                className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => docInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 text-center">Click to upload Aadhaar, PAN, or other proofs</p>
                <input ref={docInputRef} type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleDocumentChange} />
              </div>
              
              {form.documents && form.documents.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.documents.map((doc, idx) => (
                    <div key={idx} className="flex flex-row items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-md text-xs">
                      <span className="truncate flex-1 font-medium text-slate-700">{doc.name}</span>
                      <button type="button" onClick={() => removeDocument(idx)} className="ml-2 text-red-500 hover:text-red-700 p-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100">
               <div>
                <label className="text-sm font-medium text-slate-700 text-xs uppercase tracking-wider">Payment Scheme</label>
                <select 
                  className="w-full mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.preferred_payment_type}
                  onChange={e => {
                    const newType = e.target.value as any;
                    setForm(f => ({ ...f, preferred_payment_type: newType }));
                  }}
                >
                  <option value="monthly">Daily Rate</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="short_term">Fixed Monthly Salary</option>
                </select>
              </div>
               <div>
                <label className="text-sm font-medium text-slate-700 text-xs uppercase tracking-wider">
                  {form.preferred_payment_type === 'hourly' ? 'Hourly Rate (₹)' : 
                   form.preferred_payment_type === 'short_term' ? 'Fixed Monthly Rate (₹)' : 
                   'Daily Rate (₹)'}
                </label>
                <Input type="number" className="mt-1" 
                  value={
                    form.preferred_payment_type === 'hourly' ? form.hourly_rate :
                    form.preferred_payment_type === 'short_term' ? form.short_term_daily_rate :
                    form.monthly_daily_rate
                  }
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (form.preferred_payment_type === 'hourly') {
                        setForm(f => ({ ...f, hourly_rate: val }));
                    } else if (form.preferred_payment_type === 'short_term') {
                        setForm(f => ({ ...f, short_term_daily_rate: val }));
                    } else {
                        setForm(f => ({ ...f, monthly_daily_rate: val }));
                    }
                  }} 
                />
              </div>
              
              {form.preferred_payment_type === 'hourly' && (
                <div className="col-span-2 pt-2 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-700 text-xs uppercase tracking-wider">
                    Shift Duration (Hours / Day) <span className="text-red-400">*</span>
                  </label>
                  <select 
                    className="w-full mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.shift_hours || ''}
                    onChange={e => setForm(f => ({ ...f, shift_hours: Number(e.target.value) }))}
                  >
                    <option value="" disabled>Select shift duration...</option>
                    <option value={8}>8 Hours</option>
                    <option value={10}>10 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-white gap-2" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign to Client Dialog ───────────────────────────────

interface AssignDialogProps {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

function AssignDialog({ employee, open, onClose, onAssigned }: AssignDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [depositPaid, setDepositPaid] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string; whatsappSent: boolean; whatsappError?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // New client inline form
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const debouncedSearch = useDebounce(clientSearch, 250);

  useEffect(() => {
    if (!open) { setResult(null); setSelectedClient(null); setNotes(''); setClientSearch(''); setShowNewClient(false); }
  }, [open]);

  useEffect(() => {
    // Search crm_leads instead of clients
    const validStages = ['Form Submitted', 'Staff Assigned', 'Active Client', 'Deposit Pending', 'Trial in Progress'];
    supabase.from('crm_leads')
      .select('id, name, phone, whatsapp_number, pipeline_stage')
      .in('pipeline_stage', validStages)
      .ilike('name', `%${debouncedSearch}%`)
      .limit(20)
      .then(({ data }) => {
        const formatted = (data ?? []).map(l => ({
          id: l.id,
          client_name: l.name,
          company_name: l.pipeline_stage, // Use stage as "company" info for clarity
          phone_number: l.whatsapp_number || l.phone
        }));
        setClients(formatted);
      });
  }, [debouncedSearch]);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) { toast.error('Client name required.'); return; }
    setIsCreatingClient(true);
    try {
      const { data, error } = await supabase.from('clients')
        .insert({ client_name: newClientName.trim(), phone_number: newClientPhone.trim() || null })
        .select().single();
      if (error) throw error;
      setSelectedClient(data);
      setShowNewClient(false);
      setNewClientName('');
      setNewClientPhone('');
      toast.success('Client added!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleAssign = async () => {
    if (!employee || !selectedClient) { toast.error('Please select a client.'); return; }
    setIsSubmitting(true);
    try {
      const res = await assignWorkerToClient(employee.id, selectedClient.id, notes, depositPaid);
      setResult({ url: res.shareableUrl, whatsappSent: res.whatsappSent, whatsappError: res.whatsappError });
      onAssigned();
    } catch (err: any) {
      toast.error(err.message ?? 'Assignment failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUrl = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            {result ? 'Assignment Successful!' : 'Assign to Client'}
          </DialogTitle>
        </DialogHeader>

        {/* Success screen */}
        {result ? (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800">{employee.full_name} assigned!</p>
                {result.whatsappSent
                  ? <p className="text-xs text-emerald-600 mt-0.5">WhatsApp notification sent ✅</p>
                  : <p className="text-xs text-amber-600 mt-0.5">WhatsApp not sent — {result.whatsappError ?? 'no phone on file'}</p>}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-wider">Shareable ID Card Link</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-700 flex-1 truncate font-mono">{result.url}</span>
                <button onClick={copyUrl} className="shrink-0 text-slate-400 hover:text-primary transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90 text-white">Done</Button>
          </div>
        ) : (
          /* Assignment form */
          <div className="space-y-4 mt-2">
            {/* Employee info card */}
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
              <Avatar className="w-11 h-11 ring-2 ring-primary/10">
                {employee.photo_url && <AvatarImage src={employee.photo_url} alt={employee.full_name} />}
                <AvatarFallback className="bg-primary text-white text-sm font-bold">
                  {getInitials(employee.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{employee.full_name}</p>
                <p className="text-xs text-primary font-medium">{employee.job_title}</p>
                <p className="font-mono text-[10px] text-slate-400 mt-0.5">{employee.employee_id}</p>
              </div>
            </div>

            {/* Client selector */}
            <div className="relative">
              <label className="text-sm font-medium text-slate-700">Select Client <span className="text-red-400">*</span></label>
              <div className="mt-1 relative">
                <Input
                  placeholder="Search for a client..."
                  value={selectedClient ? selectedClient.client_name : clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setClientDropdownOpen(true); }}
                  onFocus={() => setClientDropdownOpen(true)}
                  className="pr-8"
                />
                {selectedClient && (
                  <button
                    onClick={() => { setSelectedClient(null); setClientSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {clientDropdownOpen && !selectedClient && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clients.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">No clients found</div>
                  ) : (
                    clients.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-primary/5 text-sm text-slate-700 flex items-center gap-2 transition-colors"
                        onClick={() => { setSelectedClient(c); setClientDropdownOpen(false); }}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                           <span className="font-bold flex-1 truncate">{c.client_name}</span>
                           <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter shrink-0">
                                {c.company_name}
                           </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 w-full mt-0.5">
                          <span className="truncate">{c.phone_number || 'No contact'}</span>
                          <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                            Select <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                  <button
                    className="w-full text-left px-3 py-2.5 border-t border-slate-100 text-xs text-primary font-medium hover:bg-primary/5 flex items-center gap-2"
                    onClick={() => { setClientDropdownOpen(false); setShowNewClient(true); }}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add New Client
                  </button>
                </div>
              )}
            </div>

            {/* Inline new client form */}
            {showNewClient && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">New Client</p>
                <Input placeholder="Client Name *" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
                <Input placeholder="WhatsApp Phone (optional)" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-white"
                    onClick={handleCreateClient} disabled={isCreatingClient}>
                    {isCreatingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Client'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewClient(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
                <textarea
                  rows={2}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent"
                  placeholder="Any special instructions..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Deposit Paid (₹)</label>
                 <Input type="number" className="mt-1 border-slate-200" placeholder="0" value={depositPaid || ''}
                   onChange={e => setDepositPaid(Number(e.target.value) || 0)} />
                 <p className="text-[10px] text-slate-400 mt-1">Amount client paid upfront for this assignment.</p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={handleAssign}
                disabled={isSubmitting || !selectedClient}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                {isSubmitting ? 'Assigning...' : 'Assign & Send Link'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── ID Card Preview Dialog ────────────────────────────────

function IDCardPreviewDialog({ employee, open, onClose }: { employee: Employee | null; open: boolean; onClose: () => void }) {
  if (!employee) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" /> ID Card Preview
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-4 gap-6">
          <div id="id-card-capture">
            <EmployeeIDCard
              employeeName={employee.full_name}
              employeeId={employee.employee_id}
              jobTitle={employee.job_title}
              photoUrl={employee.photo_url}
              aadhaarNumber={employee.aadhaar_number}
              address={employee.address}
              dob={employee.dob}
              duty={employee.preferred_payment_type === 'hourly'
                ? `${employee.shift_hours ?? '—'} HRS (Day)`
                : employee.preferred_payment_type === 'monthly'
                ? 'Monthly'
                : 'Short Term'}
              experience={employee.experience}
              gender={employee.gender}
              variant="preview"
            />
          </div>
          
          <div className="w-full flex flex-col gap-2">
            <p className="text-[10px] text-slate-400 text-center px-4">This ID card is for internal identification. Click download to save a copy for the employee.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs h-9" onClick={onClose}>Close</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-white text-xs h-9 gap-2" 
                onClick={() => window.print()}>
                <ExternalLink className="w-3.5 h-3.5" /> Print / Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Staff Details Dialog ──────────────────────────────────

function StaffDetailsDialog({ employee, open, onClose }: { employee: Employee | null; open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setLoading(true);
      getEmployeeDocuments(employee.id).then(d => {
        setDocs(d);
        setLoading(false);
      });
    }
  }, [open, employee]);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none shadow-2xl p-0 overflow-hidden">
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-primary/95 to-brand-teal p-6 text-white">
          <div className="flex justify-between items-start">
            <div className="flex gap-4 items-center">
              <Avatar className="w-20 h-20 border-4 border-white/20 shadow-xl">
                {employee.photo_url && <AvatarImage src={employee.photo_url} />}
                <AvatarFallback className="text-xl font-bold bg-white text-primary">
                  {getInitials(employee.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{employee.full_name}</h2>
                <p className="opacity-90 font-medium">{employee.job_title}</p>
                <div className="flex gap-2 mt-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase border border-white/10">{employee.employee_id}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/10">{employee.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Personal Data */}
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-primary/10 rounded-lg"><Users className="w-4 h-4 text-primary" /></div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Profile</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Aadhaar Identification</p>
                      <p className="text-sm font-semibold text-slate-800">{employee.aadhaar_number || 'Not Linked'}</p>
                    </div>
                    <Shield className="w-5 h-5 text-emerald-500/30" />
                  </div>
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-300" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Primary Contact</p>
                      <p className="text-sm font-semibold text-slate-800">{employee.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-300 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Current Address</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{employee.address || 'Address not listed'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-primary/10 rounded-lg"><Briefcase className="w-4 h-4 text-primary" /></div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Financial Meta</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">
                      {employee.preferred_payment_type === 'hourly' 
                        ? 'Hourly Rate' 
                        : employee.preferred_payment_type === 'short_term' 
                          ? 'Per Service Charge' 
                          : 'Monthly Rate'}
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      ₹{
                        (employee.preferred_payment_type === 'hourly' 
                          ? employee.hourly_rate 
                          : employee.preferred_payment_type === 'short_term' 
                            ? employee.short_term_daily_rate 
                            : employee.monthly_daily_rate
                        )?.toLocaleString('en-IN') || 0
                      }
                    </p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Payment Scheme</p>
                    <p className="text-sm border border-primary/20 bg-primary/10 px-2 py-0.5 rounded-full inline-block font-bold text-primary uppercase tracking-widest text-[10px]">
                      {employee.preferred_payment_type === 'hourly' ? 'Hourly' : employee.preferred_payment_type === 'short_term' ? 'Per Service' : 'Monthly Base'}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Documents */}
            <div className="space-y-6">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg"><FileText className="w-4 h-4 text-primary" /></div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uploaded ID Proofs</h4>
                  </div>
                  {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </div>
                
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {docs.length === 0 && !loading ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                      <p className="text-xs text-slate-400">No documents verification on file</p>
                    </div>
                  ) : (
                    docs.map(doc => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors">{doc.file_name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{doc.file_type?.split('/')?.[1] || 'Verification Doc'}</p>
                          </div>
                        </div>
                        <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                          <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                        </div>
                      </a>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <Button onClick={onClose} className="px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-200">
              Close Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Employee Rates Dialog ───────────────────────────

function EditEmployeeDialog({ employee, open, onClose, onSaved }: {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
  onSaved: (emp: Employee) => void;
}) {
  const [form, setForm] = useState({
    preferred_payment_type: 'monthly' as 'monthly' | 'hourly' | 'short_term',
    monthly_daily_rate: 0,
    hourly_rate: 0,
    short_term_daily_rate: 0,
    shift_hours: 0,
    job_title: '',
    phone: '',
    address: '',
  } as {
    preferred_payment_type: 'hourly' | 'monthly' | 'short_term';
    monthly_daily_rate: number;
    hourly_rate: number;
    short_term_daily_rate: number;
    shift_hours: number;
    job_title: string;
    phone: string;
    address: string;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        preferred_payment_type: employee.preferred_payment_type ?? 'monthly',
        monthly_daily_rate: employee.monthly_daily_rate ?? 0,
        hourly_rate: employee.hourly_rate ?? 0,
        short_term_daily_rate: employee.short_term_daily_rate ?? 0,
        shift_hours: employee.shift_hours ?? 8,
        job_title: employee.job_title ?? '',
        phone: employee.phone ?? '',
        address: employee.address ?? '',
      });
    }
  }, [employee]);

  if (!employee) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .update({
          preferred_payment_type: form.preferred_payment_type,
          monthly_daily_rate: form.monthly_daily_rate,
          hourly_rate: form.hourly_rate,
          short_term_daily_rate: form.short_term_daily_rate,
          shift_hours: form.shift_hours,
          job_title: form.job_title,
          phone: form.phone || null,
          address: form.address || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Employee updated successfully!');
      onSaved(data as Employee);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" /> Edit Employee
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Title</label>
            <Input className="mt-1" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
            <Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Address</label>
            <Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100">
             <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Scheme</label>
              <select
                className="w-full mt-1 flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.preferred_payment_type}
                onChange={e => setForm(f => ({ ...f, preferred_payment_type: e.target.value as any }))}
              >
                <option value="monthly">Daily Rate</option>
                <option value="hourly">Hourly Rate</option>
                <option value="short_term">Fixed Monthly Salary</option>
              </select>
            </div>
             <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {form.preferred_payment_type === 'hourly' ? 'Hourly Rate (₹)' : 
                 form.preferred_payment_type === 'short_term' ? 'Fixed Monthly Rate (₹)' : 
                 'Daily Rate (₹)'}
              </label>
              <Input type="number" className="mt-1" 
                value={
                  form.preferred_payment_type === 'hourly' ? form.hourly_rate :
                  form.preferred_payment_type === 'short_term' ? form.short_term_daily_rate :
                  form.monthly_daily_rate
                }
                onChange={e => {
                  const val = Number(e.target.value);
                  if (form.preferred_payment_type === 'hourly') {
                      setForm(f => ({ ...f, hourly_rate: val }));
                  } else if (form.preferred_payment_type === 'short_term') {
                      setForm(f => ({ ...f, short_term_daily_rate: val }));
                  } else {
                      setForm(f => ({ ...f, monthly_daily_rate: val }));
                  }
                }} 
              />
            </div>
            
            {form.preferred_payment_type === 'hourly' && (
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Shift Duration (Hours / Day)
                </label>
                <select 
                  className="w-full mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={form.shift_hours || ''}
                  onChange={e => setForm(f => ({ ...f, shift_hours: Number(e.target.value) }))}
                >
                  <option value="" disabled>Select shift duration...</option>
                  <option value={8}>8 Hours</option>
                  <option value={10}>10 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button className="bg-primary hover:bg-primary/90 text-white gap-2" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Available Workers Tab ─────────────────────────────────

function AvailableWorkersTab({ onAssign, onPreview, onViewDetails }: {
  onAssign: (emp: Employee) => void;
  onPreview: (emp: Employee) => void;
  onViewDetails: (emp: Employee) => void;
}) {
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAvailableEmployees();
      setEmployees(data);
    } catch { toast.error('Failed to load available workers.'); }
    finally { setIsLoading(false); }
  }, []);

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to remove ${emp.full_name}? This will permanently delete their record.`)) return;
    try {
      await deleteEmployee(emp.id);
      toast.success(`${emp.full_name} removed from directory.`);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete employee.');
    }
  };

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e =>
    !debouncedSearch ||
    e.full_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    e.job_title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, role, or ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <WorkerCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No available workers{search ? ' matching your search' : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(emp => (
            <div key={emp.id} className="group bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 flex flex-col gap-5 relative overflow-hidden">
              {/* Top Accent Gradient (subtle) */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-brand-teal/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-start justify-between min-w-0">
                <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0 pr-2" onClick={() => onViewDetails(emp)}>
                  <Avatar className="w-14 h-14 ring-4 ring-slate-50 group-hover:ring-primary/10 transition-all duration-500 shrink-0">
                    {emp.photo_url && <AvatarImage src={emp.photo_url} alt={emp.full_name} className="object-cover" />}
                    <AvatarFallback className="bg-gradient-to-br from-primary to-[#063b3c] text-white font-bold text-lg">
                      {getInitials(emp.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 text-[15px] truncate group-hover:text-primary transition-colors">{emp.full_name}</h3>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{emp.job_title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Available</span>
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onViewDetails(emp)} className="gap-2 text-xs">
                      <Shield className="w-3.5 h-3.5" /> Full Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPreview(emp)} className="gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5" /> Preview ID Card
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditEmployee(emp)} className="gap-2 text-xs text-primary focus:text-primary">
                      <Edit2 className="w-3.5 h-3.5" /> Edit Employee
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(emp)} className="gap-2 text-xs text-red-500 focus:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-col gap-2.5 py-4 border-y border-slate-50/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Skills
                  </span>
                  <span className="text-slate-700 font-semibold truncate max-w-[120px]">
                    {emp.services && emp.services.length > 0 ? emp.services[0] + (emp.services.length > 1 ? '...' : '') : 'General'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Phone className="w-3 h-3" /> Contact
                  </span>
                  <span className="text-slate-700 font-semibold">{emp.phone || 'No Phone'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> joined
                  </span>
                  <span className="text-slate-700 font-semibold">{new Date(emp.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-10 border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all rounded-xl text-xs font-semibold"
                  onClick={() => onPreview(emp)}>
                  ID Card
                </Button>
                <Button size="sm" className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl text-xs font-bold shadow-lg shadow-primary/10 transition-all active:scale-95"
                  onClick={() => onAssign(emp)}>
                  <Briefcase className="w-3.5 h-3.5" /> Assign
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <EditEmployeeDialog
      employee={editEmployee}
      open={!!editEmployee}
      onClose={() => setEditEmployee(null)}
      onSaved={(updated) => {
        setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditEmployee(null);
      }}
    />
    </>
  );
}


// ── Active Assignments Tab ─────────────────────────────────

function ActiveAssignmentsTab({ onPreview }: { onPreview: (emp: Employee) => void }) {
  const [assignments, setAssignments] = useState<ActiveAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [releasingConfirm, setReleasingConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_assignments')
        .select(`
          *,
          employee:employees(*),
          client:clients(id, client_name, phone_number)
        `)
        .eq('assignment_status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      // Fetch id_card_links for each assignment
      const enriched = await Promise.all(
        (data ?? []).map(async (a: any) => {
          const { data: link } = await supabase
            .from('id_card_links')
            .select('token, is_active')
            .eq('assignment_id', a.id)
            .eq('is_active', true)
            .maybeSingle();

          const token = link?.token ?? null;
          const shareableUrl = token ? `${window.location.origin}/id-card/${token}` : null;
          return {
            ...a,
            employee: a.employee, // supabase alias handles this
            client: a.client,
            shareableUrl,
            token
          };
        })
      );
      setAssignments(enriched);
    } catch (err: any) {
      console.error('Assignments load error:', err);
      toast.error('Failed to load active deployments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (a: ActiveAssignment) => {
    setCompleting(a.id);
    try {
      await deactivateIDCardLink(a.id, 'completed');
      toast.success(`Assignment for ${a.employee.full_name} completed.`);
      setAssignments(prev => prev.filter(x => x.id !== a.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally { setCompleting(null); }
  };

  const handleResend = async (a: ActiveAssignment) => {
    if (!a.shareableUrl) { toast.error('No shareable link available.'); return; }
    if (!a.client?.phone_number) { toast.error('Client has no phone number on file.'); return; }
    setResending(a.id);
    try {
      const err = await sendIDCardLinkToClient(
        a.client.phone_number, a.employee.full_name, a.employee.job_title, a.shareableUrl
      );
      if (err) toast.error(`WhatsApp failed: ${err}`);
      else toast.success('ID card link resent via WhatsApp! 📱');
    } finally { setResending(null); }
  };

  const handleRelease = async (a: ActiveAssignment) => {
    setReleasing(a.id);
    try {
      // Deactivate ID card link, cancel assignment, revert employee status
      await deactivateIDCardLink(a.id, 'cancelled');
      // Also revert CRM lead back to 'Form Submitted' if still in staff/deposit stages
      await supabase
        .from('crm_leads')
        .update({ pipeline_stage: 'Form Submitted' })
        .eq('id', a.client_id)
        .in('pipeline_stage', ['Staff Assigned', 'Deposit Pending']);
      toast.success(`${a.employee.full_name} released — they are now available for new assignments.`);
      setAssignments(prev => prev.filter(x => x.id !== a.id));
      setReleasingConfirm(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setReleasing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-slate-800 tracking-tight">
            {assignments.length} ACTIVE DEPLOYMENT{assignments.length !== 1 ? 'S' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2 h-9 rounded-xl border-slate-200 text-slate-600">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="bg-white border border-slate-100/80 rounded-[2rem] overflow-hidden shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {['Staff Member', 'ID No.', 'Client Name', 'Deployment Date', 'Auth Link', 'Deployment Actions'].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : assignments.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-20 text-center text-slate-400">
                        <div className="w-16 h-16 rounded-full bg-slate-50 mx-auto mb-4 flex items-center justify-center opacity-40">
                          <Briefcase className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-bold text-slate-300 uppercase tracking-widest text-xs">No active deployments found</p>
                      </td>
                    </tr>
                  )
                  : assignments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group/row">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3.5">
                          <Avatar className="w-10 h-10 ring-2 ring-slate-100 group-hover/row:ring-primary/20 transition-all duration-300">
                            {a.employee.photo_url && <AvatarImage src={a.employee.photo_url} alt={a.employee.full_name} className="object-cover" />}
                            <AvatarFallback className="bg-primary text-white text-xs font-bold">
                              {getInitials(a.employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-slate-800 group-hover/row:text-primary transition-colors">{a.employee.full_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{a.employee.job_title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200">
                          {a.employee.employee_id}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <p className="font-bold text-slate-700">{a.client?.client_name ?? '—'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Confirmed</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-500">
                        {new Date(a.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        {a.shareableUrl ? (
                          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-white p-1 rounded-lg border border-transparent hover:border-slate-200 transition-all w-fit">
                            <span className="font-mono text-[10px] text-slate-500 max-w-[80px] truncate ml-1">...{a.token?.slice(-8)}</span>
                            <div className="flex items-center gap-0.5 ml-1 pr-1 border-l border-slate-200 pl-1">
                               <CopyButton text={a.shareableUrl} />
                               <a href={a.shareableUrl} target="_blank" rel="noreferrer"
                                className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                                <ExternalLink className="w-3 h-3" />
                               </a>
                            </div>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="ghost" className="h-8 px-3 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold gap-1.5 rounded-xl border border-emerald-100"
                            onClick={() => onPreview(a.employee)}>
                            <Shield className="w-3 h-3" /> ID Card
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-3 text-xs bg-primary/5 text-primary hover:bg-primary/10 font-bold gap-1.5 rounded-xl border border-primary/10"
                            onClick={() => handleResend(a)} disabled={resending === a.id}>
                            {resending === a.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <MessageCircle className="w-3 h-3" />}
                            Resend Link
                          </Button>

                          {releasingConfirm === a.id ? (
                            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                              <span className="text-[10px] font-bold text-amber-700 whitespace-nowrap">Release this worker?</span>
                              <button
                                onClick={() => handleRelease(a)}
                                disabled={releasing === a.id}
                                className="text-[10px] font-black text-red-600 hover:text-red-700 ml-1 disabled:opacity-50"
                              >
                                {releasing === a.id ? '...' : 'Yes, Release'}
                              </button>
                              <button
                                onClick={() => setReleasingConfirm(null)}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 ml-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost"
                              className="h-8 px-3 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold rounded-xl border border-amber-100 gap-1.5"
                              onClick={() => setReleasingConfirm(a.id)}>
                              <RotateCcw className="w-3 h-3" /> Release
                            </Button>
                          )}

                          <Button size="sm" variant="ghost"
                            className="h-8 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-xl"
                            onClick={() => handleComplete(a)} disabled={completing === a.id}>
                            {completing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Terminate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── All Employees Tab ─────────────────────────────────────

function AllEmployeesTab({ onPreview, onViewDetails, refreshTrigger }: { 
  onPreview: (emp: Employee) => void; 
  onViewDetails: (emp: Employee) => void;
  refreshTrigger: number; 
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState<{ emp: Employee, newStatus: EmployeeStatus } | null>(null);
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .is('deleted_at', null)
        .order('full_name', { ascending: true });
      if (error) throw error;
      setEmployees(data ?? []);
    } catch { toast.error('Failed to load employees.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleStatusChange = async (emp: Employee, newStatus: EmployeeStatus) => {
    if (emp.status === 'assigned' && newStatus === 'available') {
      setConfirmStatusChange({ emp, newStatus });
      return;
    }

    setUpdatingId(emp.id);
    try {
      const updated = await updateEmployeeStatus(emp.id, newStatus);
      setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
      toast.success(`${emp.full_name} → ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setUpdatingId(null); }
  };

  const executeStatusChange = async () => {
    if (!confirmStatusChange) return;
    const { emp, newStatus } = confirmStatusChange;
    
    setUpdatingId(emp.id);
    const targetStatus = newStatus;
    setConfirmStatusChange(null);
    
    try {
      // Find active assignment
      const { data: assignment } = await supabase
        .from('worker_assignments')
        .select('id')
        .eq('employee_id', emp.id)
        .eq('assignment_status', 'active')
        .maybeSingle();

      if (assignment) {
        await deactivateIDCardLink(assignment.id, 'cancelled');
        // deactivateIDCardLink updates the employee status to available automatically
      } else {
        await updateEmployeeStatus(emp.id, targetStatus);
      }
      
      // Refresh list
      load();
      toast.success(`${emp.full_name} is now ${targetStatus} and released from client.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = employees.filter(e => {
    const q = debouncedSearch.toLowerCase();
    const matchSearch = !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q) || e.job_title.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            className="pl-10 h-11 bg-white border-slate-200 rounded-xl focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm" 
            placeholder="Search name, role, or ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <div className="flex p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/50">
            {(['all', 'available', 'assigned', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 whitespace-nowrap
                  ${statusFilter === s 
                    ? 'bg-white text-primary shadow-sm shadow-slate-200 translate-z-0 scale-[1.02]' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'}`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <Button 
             variant="outline" 
             size="icon" 
             onClick={load} 
             className="h-9 w-9 border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors shadow-sm shrink-0"
             title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-100/80 rounded-[2rem] overflow-hidden shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {['Worker info', 'Services & Payment', 'Status', 'Quick Actions'].map(h => (
                   <th key={h} className={`px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ${h === 'Quick Actions' ? 'text-right' : ''}`}>
                    {h}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-24 text-center text-slate-400">
                        <div className="w-16 h-16 rounded-full bg-slate-50 mx-auto mb-4 flex items-center justify-center opacity-40">
                          <Users className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-bold text-slate-300 uppercase tracking-widest text-xs">No employees found in directory</p>
                      </td>
                    </tr>
                  )
                  : filtered.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-all group/row cursor-pointer" onClick={() => onViewDetails(emp)}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="w-11 h-11 ring-2 ring-slate-100 group-hover/row:ring-primary/20 transition-all duration-300 shadow-sm">
                              {emp.photo_url && <AvatarImage src={emp.photo_url} alt={emp.full_name} className="object-cover" />}
                              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white text-xs font-bold">
                                {getInitials(emp.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-transform duration-300 group-hover/row:scale-110
                              ${emp.status === 'available' ? 'bg-emerald-400' : emp.status === 'assigned' ? 'bg-blue-400' : 'bg-slate-300'}`} 
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 group-hover/row:text-primary transition-colors text-base tracking-tight">{emp.full_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                {emp.employee_id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{emp.job_title}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-[180px]">
                            {emp.services && emp.services.length > 0 ? (
                              emp.services.map(s => (
                                <span key={s} className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shadow-sm border border-slate-200">
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No services listed</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                              {emp.preferred_payment_type === 'hourly' ? 'Hourly' : emp.preferred_payment_type === 'short_term' ? 'Per Service' : 'Monthly Base'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {statusBadge(emp.status)}
                      </td>
                      <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                           <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 hover:bg-primary/5 hover:text-primary rounded-xl transition-all border border-slate-100"
                            onClick={() => onPreview(emp)}>
                            <ExternalLink className="w-3 h-3 mr-1.5" /> ID Card
                           </Button>
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100 transition-colors"
                                disabled={updatingId === emp.id}>
                                {updatingId === emp.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-2xl shadow-xl border-slate-100/60 backdrop-blur-lg bg-white/95">
                               <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Update status</p>
                              {(['available', 'assigned', 'inactive'] as EmployeeStatus[]).map(s => (
                                <DropdownMenuItem key={s} onClick={() => handleStatusChange(emp, s)}
                                  className={`rounded-xl px-3 py-2 mb-0.5 last:mb-0 transition-colors cursor-pointer
                                    ${emp.status === s ? 'bg-primary/5 text-primary font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                  {emp.status === s && <Check className="w-3.5 h-3.5 ml-auto" />}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Directory Summary
           </p>
           <p className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
             {filtered.length} Staff Members <span className="text-slate-300 mx-1">|</span> {statusFilter === 'all' ? 'All Records' : statusFilter.toUpperCase()}
           </p>
        </div>
      </div>

      {/* Confirmation Dialog for Status Change */}
      <Dialog open={!!confirmStatusChange} onOpenChange={(open) => !open && setConfirmStatusChange(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirm Status Change
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              You are moving <span className="font-bold text-slate-900">{confirmStatusChange?.emp.full_name}</span> from <span className="font-bold text-blue-600">Assigned</span> to <span className="font-bold text-emerald-600">Available</span>.
            </p>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-xs text-amber-700 font-medium">
                This will automatically release the worker from their currently assigned client and deactivate their active ID card link. Are you sure you want to proceed?
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmStatusChange(null)}>
              Cancel
            </Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={executeStatusChange}
            >
              Yes, Make Available
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Recycle Bin Tab ───────────────────────────────────────

function RecycleBinTab({ refreshTrigger }: { refreshTrigger: number }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDeletedEmployees();
      setEmployees(data);
    } catch { toast.error('Failed to load recycle bin.'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleRestore = async (emp: Employee) => {
    setActingId(emp.id);
    try {
      await restoreEmployee(emp.id);
      toast.success(`${emp.full_name} restored to directory.`);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally { setActingId(null); }
  };

  const handlePermanentDelete = async (emp: Employee) => {
    if (!confirm(`WARNING: Are you sure you want to PERMANENTLY delete ${emp.full_name}? This cannot be undone.`)) return;
    setActingId(emp.id);
    try {
      await permanentlyDeleteEmployee(emp.id);
      toast.success(`${emp.full_name} permanently removed.`);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally { setActingId(null); }
  };

  const handleWipeAll = async () => {
    if (employees.length === 0) return;
    if (!confirm(`CRITICAL WARNING: Are you sure you want to PERMANENTLY delete ALL ${employees.length} records in the recycle bin? This action is IRREVERSIBLE.`)) return;
    
    setIsLoading(true);
    try {
      await permanentlyDeleteAllDeletedEmployees();
      toast.success(`Successfully cleared ${employees.length} records from recycle bin.`);
      setEmployees([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-red-500" />
           </div>
           <p className="text-sm font-bold text-slate-800 tracking-tight uppercase">
              RECYCLE BIN <span className="text-slate-400 ml-1">({employees.length})</span>
           </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleWipeAll} 
            disabled={isLoading || employees.length === 0}
            className="gap-2 h-9 rounded-xl bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20 font-bold disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <Trash2 className="w-3.5 h-3.5" /> Wipe All Trash
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="gap-2 h-9 rounded-xl border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Bin
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-100/80 rounded-[2rem] overflow-hidden shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {['Staff Member', 'Job Title', 'Last Status', 'Deleted On', 'Actions'].map(h => (
                   <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                : employees.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                        <div className="w-16 h-16 rounded-full bg-slate-50 mx-auto mb-4 flex items-center justify-center opacity-40">
                          <Trash2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-bold text-slate-300 uppercase tracking-widest text-xs">No records in recycle bin</p>
                      </td>
                    </tr>
                  )
                  : employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-all group/row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <Avatar className="w-10 h-10 ring-2 ring-slate-100 transition-all duration-300">
                            {emp.photo_url && <AvatarImage src={emp.photo_url} alt={emp.full_name} className="object-cover" />}
                            <AvatarFallback className="bg-slate-200 text-slate-500 text-xs font-bold">
                              {getInitials(emp.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-slate-700">{emp.full_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{emp.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{emp.job_title}</td>
                      <td className="px-6 py-4 opacity-70 scale-90 origin-left">{statusBadge(emp.status)}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs font-medium italic">
                        {(emp as any).deleted_at ? new Date((emp as any).deleted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recently'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-3 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100"
                            onClick={() => handleRestore(emp)}
                            disabled={actingId === emp.id}
                          >
                            <RotateCcw className="w-3 h-3 mr-1.5" /> Restore
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-3 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                            onClick={() => handlePermanentDelete(emp)}
                            disabled={actingId === emp.id}
                          >
                            <Trash2 className="w-3 h-3 mr-1.5" /> Wipe
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

interface WorkerAllocationProps {
  isEmbedded?: boolean;
}

export default function WorkerAllocation({ isEmbedded = false }: WorkerAllocationProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null);
  const [detailsEmployee, setDetailsEmployee] = useState<Employee | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);


  // Auto-seed Alexander Mitchell if missing
  useEffect(() => {
    const seedAlexander = async () => {
      try {
        const { data: existing } = await supabase.from('employees').select('id').eq('full_name', 'Alexander Mitchell').single();
        if (!existing) {
          // Add Alexander if he doesn't exist
          await supabase.from('employees').insert({
            full_name: 'Alexander Mitchell',
            job_title: 'Senior Registered Nurse',
            department: 'ICU / Critical Care',
            status: 'available',
            photo_url: 'https://images.unsplash.com/photo-1576091160550-217359f42f8c?q=80&w=2070&auto=format&fit=crop',
            phone: '919876543210',
            address: 'Navi Mumbai, MH',
            hourly_rate: 0,
            monthly_daily_rate: 1500,
            short_term_daily_rate: 1800,
            deposit_received: 15000,
            employee_id: 'EMP-001234'
          });
          setRefreshTrigger(t => t + 1);
        }
      } catch (e) {
        console.warn('Auto-seed check failed:', e);
      }
    };
    seedAlexander();
  }, []);

  const handleEmployeeCreated = (emp: Employee, autoPreview = false) => {
    setRefreshTrigger(t => t + 1);
    toast.success(`${emp.full_name} added to directory!`);
    if (autoPreview) {
      setPreviewEmployee(emp);
    }
  };

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'p-6'}`}>
      {/* Header - only show if not embedded */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Worker Allocation</h1>
            <p className="text-sm text-slate-500 mt-1">Assign healthcare workers to clients and manage digital ID cards</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-md shadow-primary/20 gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add New Employee
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="available" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-slate-100/80 backdrop-blur-md border border-slate-200/50 p-1.5 rounded-2xl shadow-sm">
            <TabsTrigger value="available" className="gap-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all duration-300">
              <Users className="w-3.5 h-3.5" /> Available Workers
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all duration-300">
              <Briefcase className="w-3.5 h-3.5" /> Deployments
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-xl px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all duration-300">
              <Shield className="w-3.5 h-3.5" /> Directory
            </TabsTrigger>
            <TabsTrigger value="deleted" className="gap-2.5 data-[state=active]:bg-white data-[state=active]:text-red-500 data-[state=active]:shadow-sm rounded-xl px-5 py-2 text-[11px] font-black uppercase tracking-wider transition-all duration-300">
              <Trash2 className="w-3.5 h-3.5" /> Trash
            </TabsTrigger>
          </TabsList>

          {isEmbedded && (
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white shadow-sm gap-2 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Employee
            </Button>
          )}
        </div>

        <TabsContent value="available">
          <AvailableWorkersTab
            onAssign={emp => setAssignEmployee(emp)}
            onPreview={emp => setPreviewEmployee(emp)}
            onViewDetails={emp => setDetailsEmployee(emp)}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <ActiveAssignmentsTab onPreview={emp => setPreviewEmployee(emp)} />
        </TabsContent>

        <TabsContent value="all">
          <AllEmployeesTab 
            onPreview={emp => setPreviewEmployee(emp)} 
            onViewDetails={emp => setDetailsEmployee(emp)}
            refreshTrigger={refreshTrigger} 
          />
        </TabsContent>


        <TabsContent value="deleted">
          <RecycleBinTab refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddEmployeeDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={handleEmployeeCreated}
      />
      <AssignDialog
        employee={assignEmployee}
        open={!!assignEmployee}
        onClose={() => setAssignEmployee(null)}
        onAssigned={() => setRefreshTrigger(t => t + 1)}
      />
      <IDCardPreviewDialog
        employee={previewEmployee}
        open={!!previewEmployee}
        onClose={() => setPreviewEmployee(null)}
      />
      <StaffDetailsDialog
        employee={detailsEmployee}
        open={!!detailsEmployee}
        onClose={() => setDetailsEmployee(null)}
      />
    </div>
  );
}
