import { useState, useEffect, useCallback } from 'react';
import { X, Phone, Users, MapPin, Calendar, Clock, Activity, FileText, ClipboardList, Briefcase, ChevronRight, User, History, Wallet, CheckCircle2, RotateCcw, Receipt, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, XCircle, Loader2, Pencil, Save, Copy, Check, HeartPulse, ListChecks, CheckSquare, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { endService, releaseWorker } from '../../services/serviceLifecycle';
import { generateAndUploadInvoicePdf } from '../../utils/generateInvoicePdf';
import { useAuth } from '../../contexts/AuthContext';
import { maskPhoneNumber } from '../../utils/phoneMask';
import { toast } from 'sonner';

const PATIENT_CARE_DUTY_LABELS: Record<string, string> = {
    pateint_bath: 'Patient Bath',
    sponge_bath: 'Sponge Bath',
    massage: 'Massage',
    diaper_change: 'Diaper Change',
    feeding: 'Feeding',
    medication: 'Medication',
    exercise: 'Exercise',
    clean_room: 'Clean Room',
    cut_nails: 'Grooming (Hair/Nails)',
    changing_cloths: 'Change/Wash Clothes',
    change_bedshit: 'Change Bedsheet',
    take_into_hospital: 'Take to Hospital',
    take_in_washroom: 'Take to Washroom',
    urine_bag: 'Urine Bag Care',
    dressing: 'Wound Dressing',
    feed_rt_tube: 'RT Tube Feeding',
};

const BABY_CARE_DUTY_LABELS: Record<string, string> = {
    sponge_bath: 'Sponge Bath',
    massage: 'Massage & Oil Care',
    diaper_change: 'Diaper Change',
    feeding: 'Feeding & Burping',
    medication: 'Medication',
    exercise: 'Exercise & Tummy Time',
    clean_room: 'Clean Room/Nursery',
    cut_nails: 'Grooming (Hair/Nails)',
    changing_cloths: 'Change/Wash Clothes',
    change_bedshit: 'Change Bedsheet',
    pateint_bath: 'Baby Bath',
    take_in_washroom: 'Take to Washroom',
    urine_bag: 'Urine Bag Care',
    dressing: 'Wound Dressing',
    feed_rt_tube: 'RT Tube Feeding',
};

const getDutyLabel = (dutyId: string, formType?: string): string => {
    const map = formType === 'baby_care_form' ? BABY_CARE_DUTY_LABELS : PATIENT_CARE_DUTY_LABELS;
    return map[dutyId] || dutyId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatAgeDisplay = (ageStr?: string, unit?: string) => {
    if (!ageStr) return '—';
    const trimmed = ageStr.trim();
    if (/\b(yrs|years|months|month|days|day|age|kgs|kg)\b/i.test(trimmed)) {
        return trimmed;
    }
    const u = unit?.toLowerCase() || '';
    if (u.includes('day') || u === 'd') return `${trimmed} days`;
    if (u.includes('month') || u === 'mo') return `${trimmed} months`;
    return `${trimmed} yrs`;
};

const resolveServiceCareScope = (svc: any, leadWorkForm: any, allConsents: any, lead: any) => {
    const consentsList: any[] = Array.isArray(allConsents)
        ? allConsents
        : (allConsents ? [allConsents] : []);

    const sType = String(svc?.service_type || svc?.notes || '').toLowerCase();
    const isBabySvc = /baby|maternity|jhapa|japa|infant|child/.test(sType);
    const isPatientSvc = /old age|patient|bedside|elderly|nursing/.test(sType);

    // 1. Match consent by category or start_date or fallback to first
    let matchingConsent = null;
    if (consentsList.length > 0) {
        matchingConsent = consentsList.find((c: any) => {
            const cat = String(c?.service_category || '').toLowerCase();
            if (isBabySvc && /baby|maternity|jhapa|japa|infant|child/.test(cat)) return true;
            if (isPatientSvc && /old age|patient|bedside|elderly|nursing/.test(cat)) return true;
            return false;
        });
        if (!matchingConsent && svc?.start_date) {
            matchingConsent = consentsList.find((c: any) => c?.service_start_date === svc.start_date);
        }
        if (!matchingConsent) {
            matchingConsent = consentsList[0];
        }
    }

    let duties: string[] = [];
    let instructions = '';
    let patientName = matchingConsent?.patient_name || lead?.name || '';
    let age = matchingConsent?.age || '';
    let ageUnit = matchingConsent?.age_unit || '';
    let weight = matchingConsent?.weight || '';
    let relativeName = matchingConsent?.relative_name || '';
    let contactNumber = matchingConsent?.contact_number || lead?.phone || lead?.whatsapp_number || '';
    let altContactNumber = matchingConsent?.alternate_contact_number || '';
    let address = matchingConsent?.address || '';
    let medicalCondition = matchingConsent?.other_details || '';

    let formType: 'baby_care_form' | 'patient_care_form' = isBabySvc ? 'baby_care_form' : 'patient_care_form';

    // 1. Try parsing JSON from svc.notes
    if (svc?.notes && typeof svc.notes === 'string') {
        const trimmed = svc.notes.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed.duties)) duties = parsed.duties;
                if (parsed.instructions || parsed.other_work) instructions = parsed.instructions || parsed.other_work;
                if (parsed.patient_name || parsed.patientName) patientName = parsed.patient_name || parsed.patientName;
                if (parsed.age) age = parsed.age;
                if (parsed.age_unit) ageUnit = parsed.age_unit;
                if (parsed.weight) weight = parsed.weight;
                if (parsed.relative_name) relativeName = parsed.relative_name;
                if (parsed.contact_number) contactNumber = parsed.contact_number;
                if (parsed.alternate_contact_number) altContactNumber = parsed.alternate_contact_number;
                if (parsed.address) address = parsed.address;
                if (parsed.medical_condition) medicalCondition = parsed.medical_condition;
                if (parsed.form_type) formType = parsed.form_type;
            } catch (e) {}
        } else {
            instructions = trimmed;
        }
    }

    // Separate embedded weight from age if legacy record bundled them together (e.g. "50 years & 45kgs")
    if (age && (!weight || weight === '')) {
        const wm = String(age).match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kg\b)/i);
        if (wm) {
            weight = wm[1];
            age = String(age).replace(/(?:&|\band\b|,|\/|\+)?\s*\d+(?:\.\d+)?\s*(?:kgs?|kilos?|kg\b)/gi, '').trim();
        }
    }

    // 2. Match with leadWorkForm if duties not in svc.notes
    if (duties.length === 0 && leadWorkForm && Array.isArray(leadWorkForm.duties) && leadWorkForm.duties.length > 0) {
        if ((isBabySvc && leadWorkForm.form_type === 'baby_care_form') ||
            (isPatientSvc && leadWorkForm.form_type === 'patient_care_form')) {
            duties = leadWorkForm.duties;
            if (!instructions) instructions = leadWorkForm.other_work || '';
            if (leadWorkForm.patient_name && !patientName) patientName = leadWorkForm.patient_name;
            formType = leadWorkForm.form_type;
        }
    }

    // 3. Fallback extraction from lead.notes if still missing fields
    if (!relativeName && lead?.notes) {
        const matchGuardian = lead.notes.match(/guardian:\s*([^\n\)\;]+)/i);
        if (matchGuardian) relativeName = matchGuardian[1].trim();
    }
    if (!address && lead?.notes) {
        const matchLoc = lead.notes.match(/location:\s*([^\n]+)/i);
        if (matchLoc) address = matchLoc[1].trim();
    }
    if (!patientName && lead?.notes) {
        const matchCare = lead.notes.match(/care for:\s*([^(\n]+)/i);
        if (matchCare) patientName = matchCare[1].trim();
    }

    return {
        duties,
        instructions,
        patientName,
        age,
        ageUnit,
        weight,
        relativeName,
        contactNumber,
        altContactNumber,
        address,
        medicalCondition,
        formType,
        matchingConsent
    };
};

interface ClientDetailsModalProps {
    client: any;
    onClose: () => void;
    onServiceUpdated?: () => void;
    onStartNewService?: (client: any) => void;
}

export default function ClientDetailsModal({ client, onClose, onServiceUpdated, onStartNewService }: ClientDetailsModalProps) {
    const { canViewPhoneNumbers } = useAuth();
    const clientId = client?.id;
    const [lead, setLead] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [serviceBills, setServiceBills] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedPastCycles, setExpandedPastCycles] = useState<Record<string, boolean>>({});
    const [isEndingService, setIsEndingService] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [releasingWorkerId, setReleasingWorkerId] = useState<string | null>(null);
    const [copiedClientId, setCopiedClientId] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);

    // Edit Requirements Modal State
    const [isEditingReq, setIsEditingReq] = useState(false);
    const [editReqData, setEditReqData] = useState({
        service: '',
        shift: '',
        careFor: '',
        location: '',
        rawNotes: '',
    });
    const [isSavingReq, setIsSavingReq] = useState(false);

    // Edit Patient Care Consent Modal State
    const [isEditingConsent, setIsEditingConsent] = useState(false);
    const [editConsentData, setEditConsentData] = useState({
        patientName: '',
        age: '',
        weight: '',
        relativeName: '',
        contactNumber: '',
        address: '',
    });
    const [isSavingConsent, setIsSavingConsent] = useState(false);

    const [generatingPdfBillId, setGeneratingPdfBillId] = useState<string | null>(null);

    const handleOpenOrGeneratePdf = async (bill: any, svc: any, invNo: string, bi: number) => {
        let noteData: any = {};
        try { noteData = bill.notes ? JSON.parse(bill.notes) : {}; } catch { noteData = {}; }

        // If PDF URL already exists, open it directly
        if (noteData.invoice_pdf_url) {
            window.open(noteData.invoice_pdf_url, '_blank');
            return;
        }

        const billKey = bill.id || `bill-${bi}`;
        setGeneratingPdfBillId(billKey);
        try {
            const clientName = client?.name || lead?.name || 'Client';
            const clientPhone = client?.phone || lead?.phone || '';
            const consent = lead?.client_consents?.[0];
            const clientAddress = consent?.address || lead?.notes?.match(/Location:\s*([^\n\r]+)/i)?.[1]?.trim() || '';

            const invoiceNum = noteData.invoice_number || invNo || `INV-${bi + 1}`;
            const serviceName = formatServiceLabel(svc?.service_type, svc?.notes);
            const periodStr = `${formatDate(bill.period_start)} to ${formatDate(bill.period_end)}`;

            const pdfUrl = await generateAndUploadInvoicePdf({
                clientId,
                clientName,
                clientPhone,
                clientAddress,
                invoiceNumber: invoiceNum,
                invoiceDate: bill.created_at || bill.period_end,
                dueDate: bill.period_end,
                serviceName,
                servicePeriod: periodStr,
                days: Number(bill.total_days) || 1,
                ratePerDay: Number(bill.daily_rate_used) || (Number(bill.amount) / (Number(bill.total_days) || 1)),
                grossAmount: Number(bill.amount) || 0,
                previouslyBilled: Number(noteData.previously_billed) || 0,
                depositCollected: Number(bill.deposit_applied) || 0,
                settlementAmount: Number(bill.settlement_amount) || Number(bill.amount) || 0,
                isFinalSettlement: bill.type === 'final'
            });

            // Cache URL in bill notes
            noteData.invoice_number = invoiceNum;
            noteData.invoice_pdf_url = pdfUrl;
            if (bill.id) {
                await supabase.from('service_bills').update({
                    notes: JSON.stringify(noteData)
                }).eq('id', bill.id);
            }

            toast.success(`Invoice PDF for ${invoiceNum} generated!`);
            window.open(pdfUrl, '_blank');
            await fetchDetails();
        } catch (err: any) {
            console.error('Failed to generate bill PDF:', err);
            toast.error(`PDF generation failed: ${err.message || 'Unknown error'}`);
        } finally {
            setGeneratingPdfBillId(null);
        }
    };

    const fetchDetails = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Lead (including consents)
            const { data: leadData } = await supabase.from('crm_leads').select('*, client_consents(*)').eq('id', clientId).single();
            setLead(leadData);

            // 2. Fetch Activities
            const { data: actData } = await supabase.from('crm_lead_activity').select('*').eq('lead_id', clientId).order('created_at', { ascending: false });
            setActivities(actData || []);

            // 3. Fetch Quotations
            const { data: quoteData } = await supabase.from('crm_quotations').select('*').eq('lead_id', clientId).order('created_at', { ascending: false });
            setQuotations(quoteData || []);

            // 4. Fetch Assignments
            const { data: assignData } = await supabase.from('worker_assignments').select('*, employees(full_name, job_title)').eq('client_id', clientId).order('assigned_at', { ascending: false });
            setAssignments(assignData || []);

            // 5. Fetch Services and Invoices
            const { data: svcData } = await supabase
                .from('services')
                .select('*, service_bills(*), service_worker_assignments(*, employees(full_name, job_title))')
                .or(`client_id.eq.${clientId},lead_id.eq.${clientId}`)
                .order('created_at', { ascending: false });
            setServices(svcData || []);

            const allBills = (svcData || []).flatMap((s: any) => s.service_bills || []);
            setServiceBills(allBills);
        } catch (err) {
            console.error("Error fetching client details:", err);
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleEndActiveService = async (serviceId: string) => {
        setIsEndingService(true);
        try {
            const result = await endService(serviceId);
            if (!result.success) throw new Error('Failed to end service');
            toast.success(`Service ended & deposit settled! Client moved to Closed Won.`);
            setShowEndConfirm(false);
            onServiceUpdated?.();
            await fetchDetails();
        } catch (err: any) {
            console.error('Failed to end service:', err);
            toast.error(`Failed to end service: ${err.message || 'Unknown error'}`);
        } finally {
            setIsEndingService(false);
        }
    };

    const handleReleaseWorker = async (assignmentId: string, workerName: string) => {
        if (!window.confirm(`Release ${workerName} from this service?\n\nThis will complete their assignment as of today and set their status back to "Available" for other clients.`)) return;
        setReleasingWorkerId(assignmentId);
        try {
            const res = await releaseWorker(assignmentId);
            if (!res.success) throw new Error(res.error || 'Failed to release worker');
            toast.success(`${workerName} has been released and is now Available.`);
            onServiceUpdated?.();
            await fetchDetails();
        } catch (err: any) {
            console.error('Failed to release worker:', err);
            toast.error(err.message || 'Failed to release worker');
        } finally {
            setReleasingWorkerId(null);
        }
    };

    if (!lead && !isLoading) return null;

    // Parse Notes for Form Details
    const parsedNotes: Record<string, string> = {};
    if (lead?.notes) {
        const lines = lead.notes.split('\n');
        lines.forEach((line: string) => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length > 0) {
                parsedNotes[key.trim()] = rest.join(':').trim();
            }
        });
    }

    // Latest Patient Consent (if any)
    const latestConsent = lead?.client_consents && lead.client_consents.length > 0
        ? [...lead.client_consents].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

    // Smart computed fields that intelligently pull from Patient Care Consent and Services if notes were omitted
    const displayService = parsedNotes['Service']
        || lead?.assigned_worker_role
        || latestConsent?.service_category
        || services?.[0]?.service_type
        || lead?.service_interest
        || 'Not specified';

    const displayShift = parsedNotes['Shift']
        || latestConsent?.offered_time
        || (services?.[0]?.hours_per_day ? `${services[0].hours_per_day}-Hour Shift` : null)
        || 'Not specified';

    const displayCareFor = parsedNotes['Care for']
        || (latestConsent?.patient_name
            ? (latestConsent.patient_name.trim().toLowerCase() === (lead?.name || '').trim().toLowerCase()
                ? `${latestConsent.patient_name} (Self)${latestConsent.relative_name ? ` • Guardian: ${latestConsent.relative_name}` : ''}`
                : `${latestConsent.patient_name}${latestConsent.relative_name ? ` • Guardian: ${latestConsent.relative_name}` : ''}`)
            : null)
        || (latestConsent?.relative_name ? `Guardian: ${latestConsent.relative_name}` : null)
        || 'Not specified';

    const displayLocation = parsedNotes['Location']
        || parsedNotes['Address']
        || latestConsent?.address
        || lead?.location
        || lead?.work_form_data?.address
        || 'Not specified';

    const formatAgeDisplay = (ageStr?: string, unit?: string) => {
        if (!ageStr) return '—';
        const trimmed = ageStr.trim();
        if (/\b(yrs|years|months|month|age|kgs|kg)\b/i.test(trimmed)) {
            return trimmed;
        }
        return `${trimmed} ${unit?.toLowerCase() === 'months' ? 'months' : 'yrs'}`;
    };

    const handleOpenEditReq = () => {
        setEditReqData({
            service: parsedNotes['Service'] || (displayService !== 'Not specified' ? displayService : ''),
            shift: parsedNotes['Shift'] || (displayShift !== 'Not specified' ? displayShift : ''),
            careFor: parsedNotes['Care for'] || (displayCareFor !== 'Not specified' ? displayCareFor : ''),
            location: parsedNotes['Location'] || parsedNotes['Address'] || (displayLocation !== 'Not specified' ? displayLocation : ''),
            rawNotes: lead?.notes || '',
        });
        setIsEditingReq(true);
    };

    const handleSaveRequirements = async () => {
        setIsSavingReq(true);
        try {
            const structuredNotes = `Service: ${editReqData.service}\nShift: ${editReqData.shift}\nCare for: ${editReqData.careFor}\nLocation: ${editReqData.location}`;
            const finalNotes = editReqData.rawNotes.trim() ? editReqData.rawNotes.trim() : structuredNotes;

            const { error } = await supabase
                .from('crm_leads')
                .update({
                    notes: finalNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clientId);

            if (error) throw error;
            toast.success('Inquiry requirements saved successfully!');
            setIsEditingReq(false);
            await fetchDetails();
            onServiceUpdated?.();
        } catch (err: any) {
            console.error('Error saving requirements:', err);
            toast.error(`Failed to save requirements: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSavingReq(false);
        }
    };

    const handleOpenEditConsent = () => {
        setEditConsentData({
            patientName: latestConsent?.patient_name || lead?.name || '',
            age: latestConsent?.age || '',
            weight: latestConsent?.weight || '',
            relativeName: latestConsent?.relative_name || '',
            contactNumber: latestConsent?.contact_number || lead?.phone || '',
            address: latestConsent?.address || (displayLocation !== 'Not specified' ? displayLocation : ''),
        });
        setIsEditingConsent(true);
    };

    const handleSaveConsent = async () => {
        setIsSavingConsent(true);
        try {
            if (latestConsent?.id) {
                const { error } = await supabase
                    .from('client_consents')
                    .update({
                        patient_name: editConsentData.patientName,
                        age: editConsentData.age,
                        weight: editConsentData.weight || null,
                        relative_name: editConsentData.relativeName,
                        contact_number: editConsentData.contactNumber,
                        address: editConsentData.address,
                    })
                    .eq('id', latestConsent.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('client_consents')
                    .insert([{
                        lead_id: clientId,
                        patient_name: editConsentData.patientName,
                        age: editConsentData.age,
                        weight: editConsentData.weight || null,
                        relative_name: editConsentData.relativeName,
                        contact_number: editConsentData.contactNumber,
                        address: editConsentData.address,
                        terms_accepted: true,
                    }]);
                if (error) throw error;
            }

            toast.success('Patient care details saved successfully!');
            setIsEditingConsent(false);
            await fetchDetails();
            onServiceUpdated?.();
        } catch (err: any) {
            console.error('Error saving patient details:', err);
            toast.error(`Failed to save patient details: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSavingConsent(false);
        }
    };

    const formatDate = (dStr: string) => {
        if (!dStr) return 'N/A';
        return new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (dStr: string) => {
        if (!dStr) return '';
        return new Date(dStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const formatServiceLabel = (type?: string, notes?: string) => {
        if (type && type !== 'date_range' && type !== 'open_ended' && type !== 'one_day' && type.trim() !== '') {
            return type;
        }
        if (lead?.assigned_worker_role) return lead.assigned_worker_role;
        if (lead?.notes) {
            const match = lead.notes.match(/Service:\s*([^\n\r]+)/i);
            if (match && match[1]?.trim()) return match[1].trim();
        }
        if (notes) {
            const match = notes.match(/Service:\s*([^\n\r]+)/i);
            if (match && match[1]?.trim()) return match[1].trim();
        }
        return 'Home Care Service';
    };

    const activeService = services.find(s => s.status === 'active') || (
        services.length === 0 && assignments.some((a: any) => a.assignment_status === 'active')
            ? {
                id: assignments.find((a: any) => a.assignment_status === 'active')?.id,
                status: 'active',
                service_type: assignments.find((a: any) => a.assignment_status === 'active')?.service_type || 'Home Care Service',
                start_date: assignments.find((a: any) => a.assignment_status === 'active')?.start_date,
                deposit_amount: assignments.find((a: any) => a.assignment_status === 'active')?.deposit_amount || 5000,
                deposit_status: 'collected',
                service_worker_assignments: [],
                service_bills: []
            }
            : null
    );

    // Collect past services from services table
    const dbPastServices = services.filter(s => s.status !== 'active');
    
    // Check if any completed assignments in worker_assignments aren't covered by existing services
    const unrepresentedPastAssignments = (assignments || []).filter((a: any) => {
        if (a.assignment_status === 'active' || a.assignment_status === 'cancelled') return false;
        if (a.notes?.toLowerCase().includes('superseded')) return false;

        const aStart = a.start_date ? a.start_date.split('T')[0] : '';
        const aEnd = a.end_date ? a.end_date.split('T')[0] : '';

        // Covered if it matches or overlaps with ANY service (active or past) in the services table
        const isCovered = (services || []).some((svc: any) => {
            if (svc.id === a.id) return true;
            const sStart = svc.start_date ? svc.start_date.split('T')[0] : '';
            const sEnd = svc.end_date ? svc.end_date.split('T')[0] : sStart;

            // Direct start date match
            if (aStart && sStart && aStart === sStart) return true;

            // Assignment dates fall within service start and end dates
            if (aStart && sStart && sEnd && aStart >= sStart && aStart <= sEnd) return true;

            // Check if service_worker_assignments under this service matches employee or assignment ID
            if (svc.service_worker_assignments?.some((swa: any) => 
                swa.id === a.id || 
                (swa.employee_id === a.employee_id && (
                    swa.start_date?.split('T')[0] === aStart || 
                    swa.end_date?.split('T')[0] === aEnd
                ))
            )) {
                return true;
            }

            return false;
        });

        return !isCovered;
    });

    const syntheticPastServices = unrepresentedPastAssignments.map((a: any) => ({
        id: a.id,
        status: 'ended',
        service_type: a.service_type || 'Home Care Service',
        start_date: a.start_date,
        end_date: a.end_date,
        deposit_amount: a.deposit_amount || 5000,
        deposit_status: 'settled',
        notes: a.notes,
        service_worker_assignments: [{
            id: a.id,
            employee_id: a.employee_id,
            start_date: a.start_date,
            end_date: a.end_date,
            employees: a.employees
        }],
        service_bills: []
    }));

    const pastServices = [...dbPastServices, ...syntheticPastServices];

    const togglePastCycle = (id: string) => {
        setExpandedPastCycles(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Helper to get staff for a specific service cycle
    const getStaffForService = (svc: any) => {
        if (!svc) return [];
        if (svc.service_worker_assignments && svc.service_worker_assignments.length > 0) {
            return svc.service_worker_assignments.map((swa: any) => ({
                id: swa.id,
                employeeId: swa.employee_id,
                name: swa.employees?.full_name || 'Staff Member',
                role: swa.employees?.job_title || 'Care Specialist',
                status: swa.end_date ? 'Completed' : (svc.status === 'active' ? 'Active' : 'Completed'),
                isActive: !swa.end_date && svc.status === 'active',
                startDate: swa.start_date || svc.start_date,
                endDate: swa.end_date || svc.end_date,
            }));
        }
        
        // Fallback: search in worker_assignments (assignments)
        if (svc.status === 'active') {
            const activeAsgns = assignments.filter((a: any) => a.assignment_status === 'active');
            if (activeAsgns.length > 0) {
                return activeAsgns.map((a: any) => ({
                    id: a.id,
                    employeeId: a.employee_id,
                    name: a.employees?.full_name || 'Staff Member',
                    role: a.employees?.job_title || 'Care Specialist',
                    status: 'Active',
                    isActive: true,
                    startDate: a.start_date || svc.start_date,
                    endDate: a.end_date,
                }));
            }
        } else {
            // For past services, find overlapping or completed assignments
            const sStart = svc.start_date ? svc.start_date.split('T')[0] : '';
            const sEnd = svc.end_date ? svc.end_date.split('T')[0] : '';
            const matchingAsgns = assignments.filter((a: any) => {
                if (a.assignment_status === 'active') return false;
                const aStart = a.start_date ? a.start_date.split('T')[0] : '';
                if (sStart && aStart && sEnd) {
                    return aStart >= sStart && aStart <= sEnd;
                }
                return true;
            });
            if (matchingAsgns.length > 0) {
                return matchingAsgns.map((a: any) => ({
                    id: a.id,
                    employeeId: a.employee_id,
                    name: a.employees?.full_name || 'Staff Member',
                    role: a.employees?.job_title || 'Care Specialist',
                    status: 'Completed',
                    isActive: false,
                    startDate: a.start_date || svc.start_date,
                    endDate: a.end_date || svc.end_date,
                }));
            }
        }
        return [];
    };

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-900/40 backdrop-blur-sm justify-end overflow-hidden">
            <div className="w-full max-w-3xl bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
                
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-xl font-bold text-slate-900">{client?.name || lead?.name || 'Client Details'}</h2>
                            <span className={`inline-flex items-center font-bold text-xs px-2.5 py-0.5 rounded-full ${
                                lead?.pipeline_stage === 'Active Client' ? 'bg-teal-100 text-teal-800' :
                                lead?.pipeline_stage === 'Closed Won' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {lead?.pipeline_stage || 'Client'}
                            </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                            {(() => {
                                const rawPhone = client?.phone || lead?.phone;
                                if (!rawPhone) {
                                    return (
                                        <span className="inline-flex items-center gap-1 font-medium text-slate-400">
                                            <Phone className="w-3.5 h-3.5" /> No phone
                                        </span>
                                    );
                                }
                                const displayPhone = maskPhoneNumber(rawPhone, canViewPhoneNumbers);
                                const cleanDigits = rawPhone.replace(/\D/g, '');
                                const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
                                const telDigits = rawPhone.startsWith('+') ? rawPhone : (cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`);
                                return (
                                    <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg">
                                        {canViewPhoneNumbers ? (
                                            <>
                                                <a
                                                    href={`tel:${telDigits}`}
                                                    className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800 hover:text-primary hover:underline transition-colors group/call"
                                                    title={`Click to call ${rawPhone}`}
                                                >
                                                    <Phone className="w-3.5 h-3.5 text-slate-400 group-hover/call:text-primary transition-colors shrink-0" />
                                                    <span>{displayPhone}</span>
                                                </a>
                                                <a
                                                    href={`https://wa.me/${waDigits}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                                    title={`Chat on WhatsApp (${rawPhone})`}
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                </a>
                                            </>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{displayPhone}</span>
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(displayPhone);
                                                setCopiedPhone(true);
                                                toast.success(`Copied phone: ${displayPhone}`);
                                                setTimeout(() => setCopiedPhone(false), 2000);
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                            title="Copy phone number"
                                        >
                                            {copiedPhone ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })()}
                            <span className="text-slate-300">•</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const idToCopy = client?.displayId || clientId;
                                    if (idToCopy) {
                                        navigator.clipboard.writeText(idToCopy);
                                        setCopiedClientId(true);
                                        toast.success(`Client Code ${idToCopy} copied to clipboard!`);
                                        setTimeout(() => setCopiedClientId(false), 2000);
                                    }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 hover:border-teal-300 border border-teal-200/80 text-xs font-mono font-bold text-teal-900 transition-all cursor-pointer group shadow-2xs"
                                title={`Client Code: ${client?.displayId || 'CL'}\nDatabase UUID: ${clientId}\nClick to copy`}
                            >
                                <span className="text-teal-600 text-[11px] font-sans font-medium">Client Code:</span>
                                <span className="font-bold text-teal-950 text-xs select-all">
                                    {client?.displayId || clientId}
                                </span>
                                {copiedClientId ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-teal-600 group-hover:text-teal-800 shrink-0" />
                                )}
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full"></div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                        
                        {/* ========================================================================= */}
                        {/* SECTION 1: ACTIVE SERVICE CYCLE (SCOPED DETAILS)                         */}
                        {/* ========================================================================= */}
                        {activeService ? (
                            <div className="bg-white rounded-2xl border-2 border-emerald-300/80 shadow-sm overflow-hidden">
                                <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    Current Active Service
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-500">
                                                    {activeService.hours_per_day || 10}-Hour Shift
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                                                {formatServiceLabel(activeService.service_type, activeService.notes)}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Deposit</span>
                                            <p className="text-base font-extrabold text-slate-800">
                                                ₹{Number(activeService.deposit_amount || 5000).toLocaleString('en-IN')}
                                                <span className={`ml-1.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                    activeService.deposit_status === 'collected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {activeService.deposit_status === 'collected' ? 'Paid' : 'Pending'}
                                                </span>
                                            </p>
                                        </div>
                                        {showEndConfirm ? (
                                            <div className="flex items-center gap-1.5 p-1.5 bg-red-50 border border-red-200 rounded-xl">
                                                <button
                                                    onClick={() => handleEndActiveService(activeService.id)}
                                                    disabled={isEndingService}
                                                    className="px-2.5 py-1 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                                >
                                                    {isEndingService ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Confirm End
                                                </button>
                                                <button
                                                    onClick={() => setShowEndConfirm(false)}
                                                    disabled={isEndingService}
                                                    className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowEndConfirm(true)}
                                                className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                title="End service, release active workers, calculate final verified billing, and settle deposit"
                                            >
                                                <XCircle className="w-3.5 h-3.5 text-red-500" /> End Service &amp; Settle
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 sm:p-5 space-y-5">
                                    {/* Active Service Meta Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                        {/* Staff Assigned for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Assigned Staff (This Service)</span>
                                            </div>
                                            {(() => {
                                                const staffList = getStaffForService(activeService);
                                                if (staffList.length === 0) {
                                                    return <p className="text-xs text-slate-400 italic">No staff assigned to this service cycle.</p>;
                                                }
                                                return (
                                                    <div className="space-y-2">
                                                        {staffList.map((st: any, i: number) => (
                                                            <div key={i} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                                        {st.name.charAt(0)}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-800 truncate">{st.name}</p>
                                                                        <p className="text-[10px] text-slate-400">{st.role} • {st.status}</p>
                                                                    </div>
                                                                </div>
                                                                {st.isActive && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleReleaseWorker(st.id, st.name)}
                                                                        disabled={releasingWorkerId === st.id}
                                                                        className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                                                        title="Release this caregiver back to Available without ending the client's service"
                                                                    >
                                                                        {releasingWorkerId === st.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Release'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Key Dates for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Key Dates (This Service)</span>
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Service Started:</span>
                                                    <span className="font-bold text-slate-800">{formatDate(activeService.start_date)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Expected End:</span>
                                                    <span className="font-bold text-slate-800">{activeService.end_date ? formatDate(activeService.end_date) : 'Ongoing (Open-Ended)'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Shift Hours:</span>
                                                    <span className="font-bold text-slate-800">{activeService.hours_per_day || 10} Hours/day</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Agreed Rates for this active service */}
                                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                                                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Agreed Rates (This Service)</span>
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Complete Month:</span>
                                                    <span className="font-bold text-slate-800">₹{Number(activeService.complete_month_daily_rate || 800).toLocaleString('en-IN')}/day</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Incomplete Month:</span>
                                                    <span className="font-bold text-slate-800">₹{Number(activeService.incomplete_month_daily_rate || 1500).toLocaleString('en-IN')}/day</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Monthly Est:</span>
                                                    <span className="font-bold text-slate-800">₹{((Number(activeService.complete_month_daily_rate) || 800) * 30).toLocaleString('en-IN')}/mo</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Patient Care Requirements & Shift Scope (This Active Service) */}
                                    {(() => {
                                        const scope = resolveServiceCareScope(activeService, lead?.work_form_data, lead?.client_consents, lead);
                                        return (
                                            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
                                                {/* Header */}
                                                <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 pb-2.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <HeartPulse className="w-4 h-4 text-emerald-700 shrink-0" />
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                                                            Patient Care Requirements &amp; Shift Scope (This Active Service)
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                            {scope.formType === 'baby_care_form' ? '👶 Baby Care' : '🩺 Patient Care'}
                                                            {scope.duties.length > 0 ? ` • ${scope.duties.length} Duties` : ''}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white/90 px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                                                        Read-Only
                                                    </span>
                                                </div>

                                                {/* Patient Care Profile Details Grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                                                    {/* 1. Patient Name */}
                                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                            <User className="w-3 h-3 text-emerald-600" /> Care Recipient / Patient
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-sm">{scope.patientName || '—'}</span>
                                                    </div>

                                                    {/* 2. Age & Weight */}
                                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                            <Activity className="w-3 h-3 text-emerald-600" /> Age &amp; Weight
                                                        </span>
                                                        <span className="font-semibold text-slate-800">
                                                            {scope.age ? formatAgeDisplay(scope.age, scope.ageUnit) : '—'}
                                                            {!String(scope.age || '').toLowerCase().includes('kg') && scope.weight ? `, ${scope.weight} kg` : ''}
                                                        </span>
                                                    </div>

                                                    {/* 3. Guardian / Relative */}
                                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                            <Users className="w-3 h-3 text-emerald-600" /> Relative / Guardian
                                                        </span>
                                                        <span className="font-semibold text-slate-800">{scope.relativeName || '—'}</span>
                                                    </div>

                                                    {/* 4. Contact Phone */}
                                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-emerald-600" /> Contact Number
                                                        </span>
                                                        <span className="font-semibold text-slate-800">
                                                            {scope.contactNumber || '—'}
                                                            {scope.altContactNumber ? ` / ${scope.altContactNumber}` : ''}
                                                        </span>
                                                    </div>

                                                    {/* 5. Care Location / Address */}
                                                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 shadow-2xs sm:col-span-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-emerald-600" /> Patient Care Location
                                                        </span>
                                                        <span className="font-medium text-slate-800 line-clamp-2">{scope.address || '—'}</span>
                                                    </div>
                                                </div>

                                                {/* Medical Condition / Health Notes if present */}
                                                {scope.medicalCondition && (
                                                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 text-xs text-slate-700">
                                                        <span className="font-bold text-emerald-950 block mb-0.5 text-[10px] uppercase flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3 text-emerald-600" /> Medical Condition / Health Notes:
                                                        </span>
                                                        {scope.medicalCondition}
                                                    </div>
                                                )}

                                                {/* Agreed Caregiver Duties */}
                                                <div className="space-y-1.5 pt-1 border-t border-emerald-200/50">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1">
                                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Agreed Caregiver Duties ({scope.duties.length}):
                                                    </span>
                                                    {scope.duties.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {scope.duties.map((duty: string) => (
                                                                <span key={duty} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-emerald-900 border border-emerald-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                                    {getDutyLabel(duty, scope.formType)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-500 italic">
                                                            No specific caregiver duties checklist recorded for this service cycle.
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Special Instructions / Notes */}
                                                {scope.instructions && (
                                                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 text-xs text-slate-700 whitespace-pre-wrap">
                                                        <span className="font-bold text-emerald-900 block mb-0.5 text-[10px] uppercase">Special Instructions &amp; Shift Notes:</span>
                                                        {scope.instructions}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Monthly Billing Ledger for this active service */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                                <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Monthly Billing Ledger (This Active Service)
                                            </h4>
                                            {activeService.service_bills && activeService.service_bills.length > 0 && (
                                                <span className="text-xs font-bold text-emerald-700">
                                                    Cycle Total: ₹{activeService.service_bills.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </div>

                                        {(!activeService.service_bills || activeService.service_bills.length === 0) ? (
                                            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span>Active service cycle in progress. Next monthly invoice will generate upon 30-day mark or service completion.</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {activeService.service_bills.map((bill: any, i: number) => {
                                                    let noteData: any = {};
                                                    try { noteData = bill.notes ? JSON.parse(bill.notes) : {}; } catch { noteData = {}; }
                                                    const invNo = noteData.invoice_number || `INV-${bill.id?.substring(0, 6)}`;
                                                    const billKey = bill.id || `active-bill-${i}`;
                                                    const isGenerating = generatingPdfBillId === billKey;

                                                    return (
                                                        <div key={bill.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                                                            <div>
                                                                <p className="font-bold text-slate-800">
                                                                    {formatDate(bill.period_start)} To {formatDate(bill.period_end)}
                                                                </p>
                                                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                                    {invNo} • {bill.total_days} days @ ₹{bill.daily_rate_used}/day
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-extrabold text-sm text-slate-900">
                                                                    ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenOrGeneratePdf(bill, activeService, invNo, i)}
                                                                    disabled={isGenerating}
                                                                    className="px-2.5 py-1 text-xs font-bold bg-white text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                                                                    title="View or generate invoice PDF"
                                                                >
                                                                    {isGenerating ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                                    ) : (
                                                                        <FileText className="w-3 h-3" />
                                                                    )}
                                                                    <span>PDF</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 bg-gradient-to-r from-amber-50/80 to-orange-50/60 rounded-2xl border border-amber-200/80 text-center space-y-3">
                                <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-xs">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <span>No Active Service Currently Running</span>
                                </div>
                                <p className="text-xs text-slate-600 max-w-md mx-auto">
                                    All previous care services have concluded and deposits have been settled. You can start a fresh service cycle with new dates, rates, and caregiver allocation.
                                </p>
                                {onStartNewService && (
                                    <button
                                        type="button"
                                        onClick={() => onStartNewService(lead || client)}
                                        className="px-4 py-2 text-xs font-bold bg-primary text-white hover:bg-primary/90 rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Start New Service
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* SECTION 2: PREVIOUS SERVICE CYCLES & HISTORICAL LEDGERS                   */}
                        {/* ========================================================================= */}
                        {pastServices.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-slate-800 text-sm">
                                            Previous Service Cycles &amp; Historical Ledgers ({pastServices.length})
                                        </h3>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400">
                                        Archived &amp; Settled
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {pastServices.map((pastSvc: any) => {
                                        const isExpanded = expandedPastCycles[pastSvc.id] ?? true;
                                        const pastStaff = getStaffForService(pastSvc);
                                        const bills = pastSvc.service_bills || [];

                                        return (
                                            <div key={pastSvc.id} className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden text-xs">
                                                {/* Cycle Header */}
                                                <div
                                                    onClick={() => togglePastCycle(pastSvc.id)}
                                                    className="p-3.5 flex items-center justify-between bg-slate-100/80 cursor-pointer hover:bg-slate-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-bold text-sm text-slate-800">
                                                            {formatServiceLabel(pastSvc.service_type, pastSvc.notes)}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                                                            Ended &amp; Settled
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            ({formatDate(pastSvc.start_date)} to {formatDate(pastSvc.end_date)})
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-slate-700">
                                                            Deposit: ₹{Number(pastSvc.deposit_amount || 5000).toLocaleString('en-IN')} (Settled)
                                                        </span>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                </div>

                                                {/* Cycle Details */}
                                                {isExpanded && (
                                                    <div className="p-3.5 space-y-3 bg-white">
                                                        {/* Top Overview: Shift Details, Assigned Staff, Billing Rates */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 text-teal-600" /> Shift &amp; Working Hours
                                                                </span>
                                                                <p className="font-bold text-slate-800 mt-0.5">
                                                                    {pastSvc.hours_per_day || 10}-Hour Shift ({pastSvc.hours_per_day || 10} hrs/day)
                                                                </p>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {(() => {
                                                                        if (!pastSvc.start_date || !pastSvc.end_date) return '';
                                                                        const d1 = new Date(pastSvc.start_date).getTime();
                                                                        const d2 = new Date(pastSvc.end_date).getTime();
                                                                        const days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
                                                                        return `${days} Days Service Window`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                                                                    <Users className="w-3 h-3 text-teal-600" /> Staff Assigned
                                                                </span>
                                                                <p className="font-semibold text-slate-700 mt-0.5">
                                                                    {pastStaff.length > 0
                                                                        ? Array.from(new Set(pastStaff.map((s: any) => `${s.name} (${s.role})`))).join(', ')
                                                                        : 'Past staff record archived'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                                                                    <Wallet className="w-3 h-3 text-teal-600" /> Billing Terms Used
                                                                </span>
                                                                <p className="font-bold text-slate-800 mt-0.5">
                                                                    ₹{pastSvc.complete_month_daily_rate || 800}/day full
                                                                </p>
                                                                <span className="text-[10px] text-slate-500">
                                                                    ₹{pastSvc.incomplete_month_daily_rate || 1500}/day partial
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Patient Care Requirements & Specifics for this specific cycle */}
                                                        {(() => {
                                                            const scope = resolveServiceCareScope(pastSvc, lead?.work_form_data, lead?.client_consents, lead);
                                                            return (
                                                                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-100 space-y-3">
                                                                    {/* Header */}
                                                                    <div className="flex items-center justify-between gap-3 border-b border-teal-200/60 pb-2.5">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <HeartPulse className="w-4 h-4 text-teal-700 shrink-0" />
                                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900">
                                                                                Patient Care Requirements &amp; Shift Scope (This Service)
                                                                            </span>
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                                                                                {scope.formType === 'baby_care_form' ? '👶 Baby Care' : '🩺 Patient Care'}
                                                                                {scope.duties.length > 0 ? ` • ${scope.duties.length} Duties` : ''}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-white/90 px-2 py-0.5 rounded border border-teal-200 shadow-2xs">
                                                                            Read-Only
                                                                        </span>
                                                                    </div>

                                                                    {/* Patient Care Profile Details Grid */}
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                                                                        {/* 1. Patient Name */}
                                                                        <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                                                <User className="w-3 h-3 text-teal-600" /> Care Recipient / Patient
                                                                            </span>
                                                                            <span className="font-bold text-slate-800 text-sm">{scope.patientName || '—'}</span>
                                                                        </div>

                                                                        {/* 2. Age & Weight */}
                                                                        <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                                                <Activity className="w-3 h-3 text-teal-600" /> Age &amp; Weight
                                                                            </span>
                                                                            <span className="font-semibold text-slate-800">
                                                                                {scope.age ? formatAgeDisplay(scope.age, scope.ageUnit) : '—'}
                                                                                {!String(scope.age || '').toLowerCase().includes('kg') && scope.weight ? `, ${scope.weight} kg` : ''}
                                                                            </span>
                                                                        </div>

                                                                        {/* 3. Guardian / Relative */}
                                                                        <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                                                <Users className="w-3 h-3 text-teal-600" /> Relative / Guardian
                                                                            </span>
                                                                            <span className="font-semibold text-slate-800">{scope.relativeName || '—'}</span>
                                                                        </div>

                                                                        {/* 4. Contact Phone */}
                                                                        <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                                                <Phone className="w-3 h-3 text-teal-600" /> Contact Number
                                                                            </span>
                                                                            <span className="font-semibold text-slate-800">
                                                                                {scope.contactNumber || '—'}
                                                                                {scope.altContactNumber ? ` / ${scope.altContactNumber}` : ''}
                                                                            </span>
                                                                        </div>

                                                                        {/* 5. Care Location / Address */}
                                                                        <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100 shadow-2xs sm:col-span-2">
                                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                                                                                <MapPin className="w-3 h-3 text-teal-600" /> Patient Care Location
                                                                            </span>
                                                                            <span className="font-medium text-slate-800 line-clamp-2">{scope.address || '—'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Medical Condition / Health Notes if present */}
                                                                    {scope.medicalCondition && (
                                                                        <div className="p-2.5 bg-white/80 rounded-lg border border-teal-100 text-xs text-slate-700">
                                                                            <span className="font-bold text-teal-950 block mb-0.5 text-[10px] uppercase flex items-center gap-1">
                                                                                <AlertCircle className="w-3 h-3 text-teal-600" /> Medical Condition / Health Notes:
                                                                            </span>
                                                                            {scope.medicalCondition}
                                                                        </div>
                                                                    )}

                                                                    {/* Agreed Caregiver Duties */}
                                                                    <div className="space-y-1.5 pt-1 border-t border-teal-200/50">
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1">
                                                                            <CheckSquare className="w-3.5 h-3.5 text-teal-600" /> Agreed Caregiver Duties ({scope.duties.length}):
                                                                        </span>
                                                                        {scope.duties.length > 0 ? (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {scope.duties.map((duty: string) => (
                                                                                    <span key={duty} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-teal-900 border border-teal-200/90 px-2 py-0.5 rounded-md shadow-2xs">
                                                                                        <Check className="w-3 h-3 text-teal-600" />
                                                                                        {getDutyLabel(duty, scope.formType)}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-xs text-slate-500 italic">
                                                                                No specific caregiver duties checklist recorded for this service cycle.
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* Special Instructions / Notes */}
                                                                    {scope.instructions && (
                                                                        <div className="p-2.5 bg-white/80 rounded-lg border border-teal-100 text-xs text-slate-700 whitespace-pre-wrap">
                                                                            <span className="font-bold text-teal-900 block mb-0.5 text-[10px] uppercase">Special Instructions &amp; Shift Notes:</span>
                                                                            {scope.instructions}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Invoices & Settlement Bills for this cycle */}
                                                        <div className="pt-2 border-t border-slate-100 space-y-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                Invoices &amp; Final Settlement Ledger for this Cycle ({bills.length}):
                                                            </span>
                                                            {bills.length === 0 ? (
                                                                <p className="text-slate-400 italic">No invoices recorded for this cycle.</p>
                                                            ) : (
                                                                bills.map((bill: any, bi: number) => {
                                                                    let noteData: any = {};
                                                                    try { noteData = bill.notes ? JSON.parse(bill.notes) : {}; } catch { noteData = {}; }
                                                                    const invNo = noteData.invoice_number || (bill.type === 'final' ? 'FINAL-SETTLEMENT' : `INV-${bi + 1}`);
                                                                    const billKey = bill.id || `past-bill-${bi}`;
                                                                    const isGenerating = generatingPdfBillId === billKey;

                                                                    return (
                                                                        <div key={bill.id || bi} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                                                                            <div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="font-bold text-slate-800">{formatDate(bill.period_start)} To {formatDate(bill.period_end)}</span>
                                                                                    {bill.type === 'final' && (
                                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 text-[#1AA6A8] uppercase">
                                                                                            Final Settlement
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                                    {invNo} • {bill.total_days} days @ ₹{bill.daily_rate_used}/day
                                                                                    {noteData.previously_billed ? ` (Less ₹${Number(noteData.previously_billed).toLocaleString('en-IN')} prev billed)` : ''}
                                                                                </p>
                                                                                {noteData.refund_amount > 0 && (
                                                                                    <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                                                                                        • Refund Due: ₹{Number(noteData.refund_amount).toLocaleString('en-IN')} (Deposit settled)
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-extrabold text-slate-900 text-sm">
                                                                                    ₹{Number(bill.amount || 0).toLocaleString('en-IN')}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleOpenOrGeneratePdf(bill, pastSvc, invNo, bi)}
                                                                                    disabled={isGenerating}
                                                                                    className="px-2 py-0.5 text-xs font-bold bg-white text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors inline-flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                                                                                    title="View or generate invoice PDF"
                                                                                >
                                                                                    {isGenerating ? (
                                                                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                                                    ) : (
                                                                                        <FileText className="w-3 h-3" />
                                                                                    )}
                                                                                    <span>PDF</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* SECTION 3: MASTER CLIENT PROFILE & PRIMARY PATIENT CONSENT               */}
                        {/* ========================================================================= */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Client Master Profile &amp; Emergency Consent
                                </span>
                                <span className="text-[10px] text-slate-400 italic">
                                    * Specific patient care tasks, shift hours &amp; staff are tracked per service cycle above
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Service Requirements (Initial Intake) */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                                <ClipboardList className="w-4 h-4 text-primary" /> Client Profile &amp; First Inquiry
                                            </h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Original client registration &amp; intake details</p>
                                        </div>
                                        <button
                                            onClick={handleOpenEditReq}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1AA6A8] hover:text-[#148B8D] hover:bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 transition-colors shadow-2xs"
                                            title="Edit inquiry requirements"
                                        >
                                            <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Original Service</span>
                                            <span className="text-sm font-medium text-slate-800">{displayService}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Shift Preference</span>
                                            <span className="text-sm font-medium text-slate-800">{displayShift}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Care For</span>
                                            <span className="text-sm font-medium text-slate-800">{displayCareFor}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Location</span>
                                            <span className="text-sm font-medium text-slate-800 flex items-start gap-1">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                {displayLocation}
                                            </span>
                                        </div>
                                        <div className="flex flex-col pt-2 border-t border-slate-100 space-y-2.5">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Client Code (Short ID)</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="text-xs font-mono bg-teal-50 text-teal-900 border border-teal-200/80 px-2 py-0.5 rounded font-bold">
                                                        {client?.displayId || '—'}
                                                    </code>
                                                    <span className="text-[11px] text-slate-400">Quick code for tables, staff &amp; invoices</span>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-xs font-semibold text-slate-400 uppercase">Database System UUID</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 select-all font-semibold break-all">
                                                        {clientId || '—'}
                                                    </code>
                                                    {clientId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(clientId);
                                                                setCopiedClientId(true);
                                                                toast.success('Database UUID copied to clipboard!');
                                                                setTimeout(() => setCopiedClientId(false), 2000);
                                                            }}
                                                            className="p-1 rounded text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                                            title="Copy Database UUID"
                                                        >
                                                            {copiedClientId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-slate-400">Internal primary key in Supabase database</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Patient & Care Details (from consent) */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                                <User className="w-4 h-4 text-primary" /> Primary Patient Consent &amp; Emergency
                                            </h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Master legal declaration &amp; family contact</p>
                                        </div>
                                        <button
                                            onClick={handleOpenEditConsent}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1AA6A8] hover:text-[#148B8D] hover:bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 transition-colors shadow-2xs"
                                            title="Edit patient care details"
                                        >
                                            <Pencil className="w-3 h-3" /> {latestConsent ? 'Edit' : 'Add'}
                                        </button>
                                    </div>
                                {latestConsent ? (
                                    <div className="space-y-3">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Patient Name</span>
                                            <span className="text-sm font-medium text-slate-800">{latestConsent.patient_name || '—'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Age &amp; Weight</span>
                                            <span className="text-sm font-medium text-slate-800">
                                                {formatAgeDisplay(latestConsent.age, latestConsent.age_unit)}
                                                {latestConsent.weight ? `, ${latestConsent.weight} kg` : ''}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Relative / Guardian</span>
                                            <span className="text-sm font-medium text-slate-800">{latestConsent.relative_name || '—'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold text-slate-400 uppercase">Contact Number</span>
                                            <span className="text-sm font-medium text-slate-800 font-mono">
                                                {latestConsent.contact_number || lead?.phone ? maskPhoneNumber(latestConsent.contact_number || lead?.phone, canViewPhoneNumbers) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-slate-400 text-xs">
                                        <User className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                                        <p>No patient consent recorded yet.</p>
                                        <button
                                            onClick={handleOpenEditConsent}
                                            className="mt-2 text-xs font-bold text-[#1AA6A8] hover:underline"
                                        >
                                            + Add Patient Details
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Caregiver Work Form & Duties Agreement */}
                        {(() => {
                            const workForm = lead?.work_form_data;
                            const hasWf = workForm && Array.isArray(workForm.duties) && workForm.duties.length > 0;
                            const formTitle = workForm?.form_type === 'baby_care_form' ? 'Baby Care Work Form' : 'Patient Care Work Form';

                            return (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                        <div>
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                                <ListChecks className="w-4 h-4 text-primary" /> Master Caregiver Duties &amp; Work Form
                                            </h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Agreed daily checklist and caregiver task protocols</p>
                                        </div>
                                        {hasWf ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Recorded ✓ ({workForm.duties.length} Duties)
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                Not Recorded
                                            </span>
                                        )}
                                    </div>

                                    {hasWf ? (
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <span className="font-semibold text-slate-700">
                                                    Form: <span className="font-bold text-slate-900">{formTitle}</span>
                                                    {workForm.patient_name && ` • Patient: ${workForm.patient_name}`}
                                                </span>
                                                {workForm.updated_at && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Last updated: {new Date(workForm.updated_at).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-1.5">
                                                {workForm.duties.map((duty: string) => (
                                                    <span key={duty} className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50/80 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                        {getDutyLabel(duty, workForm.form_type)}
                                                    </span>
                                                ))}
                                            </div>

                                            {workForm.other_work && (
                                                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700">
                                                    <span className="font-bold text-slate-900 block mb-0.5 text-[10px] uppercase">Special Instructions / Other Work:</span>
                                                    {workForm.other_work}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">
                                            No master work duties form recorded for this client. Duties can also be added individually per service cycle above.
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                        {/* All Notes & Requirements */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-primary" /> Intake Form Raw Notes
                                </h3>
                                <button
                                    onClick={handleOpenEditReq}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1AA6A8] hover:underline"
                                >
                                    <Pencil className="w-3 h-3" /> Edit Notes
                                </button>
                            </div>
                            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {lead?.notes || (
                                    <span className="text-slate-400 italic">
                                        No raw intake form notes logged. Client requirements are captured from patient care details & services.
                                    </span>
                                )}
                            </pre>
                        </div>

                        {/* Complete Activity Timeline */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-sm">
                                <Activity className="w-4 h-4 text-primary" /> Complete Activity Timeline
                            </h3>
                            <div className="relative pl-3 space-y-5 before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
                                {activities.length === 0 ? (
                                    <p className="text-xs text-slate-400 pl-4 italic">No activity recorded yet.</p>
                                ) : (
                                    activities.map((act, i) => (
                                        <div key={i} className="relative pl-6 text-xs">
                                            {/* Timeline Dot */}
                                            <span className="absolute left-[-2px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-white" />
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                                                <h4 className="font-bold text-slate-800">
                                                    {act.event_type === 'form_filled' ? 'Form Submitted' :
                                                     act.event_type === 'call_received' ? 'Call Received' :
                                                     act.event_type === 'quotation_sent' ? 'Quotation Sent' :
                                                     act.event_type === 'stage_changed' ? 'Stage Changed' :
                                                     act.event_type === 'payment_recorded' ? 'Payment Recorded' :
                                                     act.event_type.replace(/_/g, ' ')}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                                                    {formatDate(act.created_at)} • {formatTime(act.created_at)}
                                                </span>
                                            </div>
                                            
                                            <p className="text-slate-600 leading-relaxed">{act.description}</p>
                                            
                                            {/* Metadata Chips */}
                                            {act.metadata && Object.keys(act.metadata).length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {Object.entries(act.metadata).map(([k, v]) => {
                                                        if (k === 'reason' || k === 'lead_name' || !v || typeof v === 'object') return null;
                                                        return (
                                                            <span key={k} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                                <span className="capitalize mr-1 text-slate-400">{k.replace(/_/g, ' ')}:</span> {String(v)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
            {/* Edit Inquiry Requirements Modal */}
            {isEditingReq && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-2xs" onClick={() => setIsEditingReq(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-primary" /> Edit Initial Inquiry Requirements
                            </h3>
                            <button onClick={() => setIsEditingReq(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Original Service</label>
                                <input
                                    type="text"
                                    value={editReqData.service}
                                    onChange={e => setEditReqData({ ...editReqData, service: e.target.value })}
                                    placeholder="e.g. Old Age Care Taker, Maternity Care, Nursing"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Shift Preference</label>
                                <input
                                    type="text"
                                    value={editReqData.shift}
                                    onChange={e => setEditReqData({ ...editReqData, shift: e.target.value })}
                                    placeholder="e.g. 10-Hour Shift, 24/7 Live-in, 12-Hour Day"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Care For</label>
                                <input
                                    type="text"
                                    value={editReqData.careFor}
                                    onChange={e => setEditReqData({ ...editReqData, careFor: e.target.value })}
                                    placeholder="e.g. Self, Mother, Father, Patient Name"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Location / Address</label>
                                <textarea
                                    rows={2}
                                    value={editReqData.location}
                                    onChange={e => setEditReqData({ ...editReqData, location: e.target.value })}
                                    placeholder="Full service / residence location address"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Raw Intake Form Notes (Optional)</label>
                                <textarea
                                    rows={3}
                                    value={editReqData.rawNotes}
                                    onChange={e => setEditReqData({ ...editReqData, rawNotes: e.target.value })}
                                    placeholder="Leave blank to automatically construct structured notes from the above fields"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsEditingReq(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRequirements}
                                disabled={isSavingReq}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#1AA6A8] text-white rounded-lg hover:bg-[#148B8D] disabled:opacity-50 transition-all shadow-sm"
                            >
                                {isSavingReq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save Requirements
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Patient Care Details Modal */}
            {isEditingConsent && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-2xs" onClick={() => setIsEditingConsent(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-primary" /> Edit Patient Care Details
                            </h3>
                            <button onClick={() => setIsEditingConsent(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Patient Name</label>
                                <input
                                    type="text"
                                    value={editConsentData.patientName}
                                    onChange={e => setEditConsentData({ ...editConsentData, patientName: e.target.value })}
                                    placeholder="Patient Full Name"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Age</label>
                                    <input
                                        type="text"
                                        value={editConsentData.age}
                                        onChange={e => setEditConsentData({ ...editConsentData, age: e.target.value })}
                                        placeholder="e.g. 50 years"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Weight</label>
                                    <input
                                        type="text"
                                        value={editConsentData.weight}
                                        onChange={e => setEditConsentData({ ...editConsentData, weight: e.target.value })}
                                        placeholder="e.g. 45 kg"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Relative / Guardian</label>
                                    <input
                                        type="text"
                                        value={editConsentData.relativeName}
                                        onChange={e => setEditConsentData({ ...editConsentData, relativeName: e.target.value })}
                                        placeholder="Guardian Name"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Number</label>
                                    <input
                                        type="text"
                                        value={editConsentData.contactNumber}
                                        onChange={e => setEditConsentData({ ...editConsentData, contactNumber: e.target.value })}
                                        placeholder="Phone number"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Address / Location</label>
                                <textarea
                                    rows={2}
                                    value={editConsentData.address}
                                    onChange={e => setEditConsentData({ ...editConsentData, address: e.target.value })}
                                    placeholder="Patient residence address"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1AA6A8]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsEditingConsent(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveConsent}
                                disabled={isSavingConsent}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#1AA6A8] text-white rounded-lg hover:bg-[#148B8D] disabled:opacity-50 transition-all shadow-sm"
                            >
                                {isSavingConsent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save Patient Details
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
