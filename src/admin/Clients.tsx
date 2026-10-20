import React, { useState, useEffect, useMemo } from 'react';
import { Search, Star, Users, Building, MessageSquare, X, Phone, Wallet, History as HistoryIcon, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, MapPin, UserMinus, Calendar, Plus, Trash2, ArchiveRestore, Clock, ShieldCheck, CheckCircle2, Receipt, Send, Copy, Download, ExternalLink, Check, RefreshCw, Table, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Info, Eye, SlidersHorizontal, Settings, FileSpreadsheet, EyeOff, CheckSquare, Square, Filter, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ClientDetailsModal from './components/ClientDetailsModal';
import { restartClientService } from '../services/serviceLifecycle';
import { generateAndUploadInvoicePdf } from '../utils/generateInvoicePdf';
import { extractCity } from '../utils/crm';
import { useAuth } from '../contexts/AuthContext';
import RequestDeletionModal from '../components/common/RequestDeletionModal';

const GOOGLE_PLACE_ID = 'ChIJnbC9IuxN4DsRXEWEnUc0HF8';
const GOOGLE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;
const GOOGLE_MAPS_URL = `https://www.google.com/maps/place/?q=place_id:${GOOGLE_PLACE_ID}`;

export default function Clients() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const restartClientId = searchParams.get('restart');
    const [clients, setClients] = useState<any[]>([]);

    const [workflows, setWorkflows] = useState({
        reviewCollection: true,
    });


    const [inspectingClient, setInspectingClient] = useState<any>(null);

    // Search and View All filters
    const [searchQuery, setSearchQuery] = useState('');
    const [viewAllMonths, setViewAllMonths] = useState(true);

    // View Mode & Sorting state
    const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
        try {
            return (localStorage.getItem('99care_clients_view_mode') as 'table' | 'cards') || 'table';
        } catch {
            return 'table';
        }
    });
    const toggleViewMode = (mode: 'table' | 'cards') => {
        setViewMode(mode);
        try {
            localStorage.setItem('99care_clients_view_mode', mode);
        } catch {}
    };
    const [sortField, setSortField] = useState<'displayId' | 'name' | 'city' | 'phone' | 'workerCount' | 'securityDeposit' | 'totalBilled' | 'status' | 'created_at'>('displayId');
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
    const [copiedClientIdBadge, setCopiedClientIdBadge] = useState<string | null>(null);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    const handleWhatsAppDirect = (client: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const rawPhone = (client.phone || '').replace(/\D/g, '');
        const cleanPhone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;
        const msg = `Namaste ${client.name} ji! 🙏\n99 Care Support Team ki taraf se hum aapse connect kar rahe hain.`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleCopyPhone = (phone: string, clientId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(phone);
        setCopiedPhoneId(clientId);
        toast.success('Phone number copied to clipboard');
        setTimeout(() => setCopiedPhoneId(null), 2000);
    };

    const handleCopyClientId = (idToCopy: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(idToCopy);
        setCopiedClientIdBadge(idToCopy);
        toast.success(`Copied ID: ${idToCopy}`);
        setTimeout(() => setCopiedClientIdBadge(null), 2000);
    };

    // Extended Filters state
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedDepositFilter, setSelectedDepositFilter] = useState<string>('all');
    const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');
    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
    const [maskPhoneNumbers, setMaskPhoneNumbers] = useState<boolean>(false);

    // Auto-Review Collection Config Modal
    const [isAutoReviewModalOpen, setIsAutoReviewModalOpen] = useState(false);
    const [reviewConfig, setReviewConfig] = useState({
        delayDays: 14,
        channels: { whatsapp: true, sms: false, email: false },
        language: 'gu' as 'gu' | 'hi' | 'en',
        skipOpenComplaints: true,
        skipTrial: true,
        skipAlreadyAsked: true,
        targetFamilyContact: true,
        twoStepSurvey: true,
        customMessage: '',
    });

    const toggleSelectClient = (clientId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedClientIds(prev => {
            const next = new Set(prev);
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return next;
        });
    };

    const toggleSelectAll = (items: any[]) => {
        if (selectedClientIds.size === items.length && items.length > 0) {
            setSelectedClientIds(new Set());
        } else {
            setSelectedClientIds(new Set(items.map(c => c.id)));
        }
    };

    const exportToCSV = (clientsToExport: any[]) => {
        if (!clientsToExport || clientsToExport.length === 0) {
            toast.error('No clients to export');
            return;
        }

        const headers = [
            'Client ID',
            'Full UUID',
            'Client Name',
            'City',
            'Phone',
            'Service Type',
            'Shift Hours',
            'Caregivers Count',
            'Active Caregivers',
            'Security Deposit (INR)',
            'Deposit Status',
            'Lifetime Billed (INR)',
            'Lifetime Paid (INR)',
            'Balance Due (INR)',
            'Status',
            'Joined Date'
        ];

        const rows = clientsToExport.map(c => {
            const activeSvc = c.activeService;
            const sType = activeSvc?.service_type || 'General Home Care';
            const sShift = activeSvc?.shift_hours ? `${activeSvc.shift_hours}h` : '10h';
            const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '';

            return [
                c.displayId || '',
                c.id || '',
                `"${(c.name || '').replace(/"/g, '""')}"`,
                `"${(c.city || extractCity(c) || '').replace(/"/g, '""')}"`,
                `"${c.phone || ''}"`,
                `"${sType.replace(/"/g, '""')}"`,
                sShift,
                c.activeWorkerCount || 0,
                `"${(c.activeWorkerNames || []).join(', ').replace(/"/g, '""')}"`,
                c.securityDeposit || 0,
                c.depositStatus || 'pending',
                c.totalBilled || 0,
                c.totalPaid || 0,
                c.balanceDue || 0,
                c.status || 'Active',
                dateStr
            ].join(',');
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `99Care_Clients_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(`Exported ${clientsToExport.length} clients to CSV! 📁`);
    };

    const formatPhoneNumber = (phone: string, masked: boolean) => {
        if (!phone) return 'N/A';
        if (!masked) return phone;
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length >= 10) {
            const prefix = cleaned.slice(-10, -7);
            const suffix = cleaned.slice(-2);
            return `+91 ${prefix} •••• ${suffix}`;
        }
        return phone;
    };

    // City filter state
    const [selectedCity, setSelectedCity] = useState<string>('all');
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState<boolean>(false);

    // Monthly slider state
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Restart Service modal state
    const [restartModal, setRestartModal] = useState<any>(null);
    const [restartServiceType, setRestartServiceType] = useState('Old Age Care');
    const [restartShiftHours, setRestartShiftHours] = useState(10);
    const [restartStartDate, setRestartStartDate] = useState('');
    const [restartEndDate, setRestartEndDate] = useState('');
    const [restartIsOngoing, setRestartIsOngoing] = useState(true);
    const [restartCompleteRate, setRestartCompleteRate] = useState<number | ''>(800);
    const [restartIncompleteRate, setRestartIncompleteRate] = useState<number | ''>(1500);
    const [restartDepositAmount, setRestartDepositAmount] = useState<number | ''>(5000);
    const [restartDepositStatus, setRestartDepositStatus] = useState<'collected' | 'pending'>('pending');
    const [restartDepositMethod, setRestartDepositMethod] = useState('UPI');
    const [restartWorkers, setRestartWorkers] = useState<any[]>([]);
    const [restartWorkerSearch, setRestartWorkerSearch] = useState('');
    const [restartSelectedWorkers, setRestartSelectedWorkers] = useState<any[]>([]);
    const [restartNotes, setRestartNotes] = useState('');
    const [isRestartSubmitting, setIsRestartSubmitting] = useState(false);

    const toggleRestartWorker = (w: any) => {
        setRestartSelectedWorkers(prev => {
            const exists = prev.some(item => item.id === w.id);
            if (exists) return prev.filter(item => item.id !== w.id);

            // Guard: Prevent selecting worker who is already deployed to another client
            if (w.status && w.status.toLowerCase() === 'assigned') {
                toast.error(`${w.full_name || 'Worker'} is currently deployed to ${w.assigned_client || 'another client'}. Please release them before reassigning.`);
                return prev;
            }

            return [...prev, w];
        });
    };

    // Deposit Invoice & Payment Modal State
    const [depositModal, setDepositModal] = useState<{
        client: any;
        depositAmount: number;
        depositStatus: 'collected' | 'pending' | 'settled';
        serviceName: string;
        startDate: string;
        allCycles: any[];
        pastDepositTotal: number;
    } | null>(null);
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('UPI');
    const [depositPaymentAmount, setDepositPaymentAmount] = useState<number | ''>(5000);
    const [depositPaymentDate, setDepositPaymentDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [depositPaymentRef, setDepositPaymentRef] = useState('');
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [generatedInvoiceUrl, setGeneratedInvoiceUrl] = useState<string | null>(null);
    const [copiedInvoiceLink, setCopiedInvoiceLink] = useState(false);

    const generateDepositRef = (method: string) => {
        const cleanMethod = (method || 'UPI').toUpperCase().replace(/\s+/g, '-');
        const randomPart = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
        return `${cleanMethod}-${randomPart}`;
    };

    const openDepositModal = (client: any) => {
        const activeSvc = client.activeService || (client.services && client.services[0]);
        const currentCycle = client.allServiceCycles?.find((c: any) => c.isCurrent);
        const serviceName = currentCycle?.serviceType || (activeSvc?.service_type && activeSvc.service_type !== 'date_range' && activeSvc.service_type !== 'open_ended' ? activeSvc.service_type : 'Home Care Service');
        const startDate = activeSvc?.start_date || new Date().toISOString().split('T')[0];
        const amount = client.securityDeposit || 5000;
        const initialMethod = 'UPI';

        setDepositModal({
            client,
            depositAmount: amount,
            depositStatus: client.depositStatus || 'pending',
            serviceName,
            startDate,
            allCycles: client.allServiceCycles || [],
            pastDepositTotal: client.pastDepositTotal || 0,
        });
        setDepositPaymentAmount(amount);
        setDepositPaymentMethod(initialMethod);
        setDepositPaymentRef(generateDepositRef(initialMethod));
        const d = new Date();
        setDepositPaymentDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setGeneratedInvoiceUrl(null);
        setCopiedInvoiceLink(false);
    };

    const handleShareDepositWhatsApp = (client: any, amount: number, serviceName: string, startDate: string, pdfUrl?: string) => {
        const rawPhone = (client.phone || '').replace(/\D/g, '');
        const cleanPhone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;

        let msg = `Namaste ${client.name} ji! 🙏\n\nAapka 99 Care security deposit invoice ready hai.\n\n💰 *Security Deposit Amount*: ₹${amount.toLocaleString('en-IN')}\n💼 *Service*: ${serviceName}\n📅 *Start Date*: ${startDate}\n\n*Payment Details:*\n• UPI ID: 99care@upi\n• Google Pay / PhonePe / Paytm: 99care@upi\n• Bank: 99 Care Healthcare Services\n  A/C: 921020048192841\n  IFSC: UTIB0000160\n  Axis Bank, Surat\n`;

        if (pdfUrl) {
            msg += `\n📄 *Invoice PDF*: ${pdfUrl}\n`;
        }

        msg += `\nPayment complete karne ke baad kripya yahan transaction screenshot share karein taaki humari team verify kar sake.\n\nDhanyawad,\n99 Care Support Team`;

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    };

    const handleShareDepositReceiptWhatsApp = (client: any, amount: number, method: string, ref: string, serviceName: string, paymentDate?: string) => {
        const rawPhone = (client.phone || '').replace(/\D/g, '');
        const cleanPhone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`;
        const dateObj = paymentDate ? new Date(paymentDate.includes('T') ? paymentDate : `${paymentDate}T12:00:00`) : new Date();
        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        const msg = `Namaste ${client.name} ji! 🙏\n\nHumne aapka 99 Care security deposit payment successfully receive kar liya hai.\n\n💰 *Amount Received*: ₹${amount.toLocaleString('en-IN')}\n💳 *Payment Mode*: ${method}\n🔖 *Reference ID*: ${ref}\n💼 *Service*: ${serviceName}\n📅 *Date*: ${formattedDate}\n\nAapki care service smoothly active hai. Kisi bhi sahayata ke liye humse sampark karein.\n\nDhanyawad,\n99 Care Support Team`;

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    };

    const handleGenerateDepositPdf = async () => {
        if (!depositModal) return;
        setIsGeneratingPdf(true);
        try {
            const invNum = `DEP-${Math.floor(100000 + Math.random() * 900000)}`;
            const pdfUrl = await generateAndUploadInvoicePdf({
                clientId: depositModal.client.id,
                clientName: depositModal.client.name,
                clientPhone: depositModal.client.phone,
                invoiceNumber: invNum,
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                serviceName: `Security Deposit — ${depositModal.serviceName}`,
                servicePeriod: `${depositModal.startDate} to Ongoing`,
                days: 1,
                ratePerDay: Number(depositModal.depositAmount),
                grossAmount: Number(depositModal.depositAmount),
                previouslyBilled: 0,
                depositCollected: 0,
                settlementAmount: Number(depositModal.depositAmount),
                isFinalSettlement: false,
            });

            setGeneratedInvoiceUrl(pdfUrl);
            toast.success('Deposit invoice PDF generated successfully!');
        } catch (err: any) {
            console.error('Error generating deposit invoice PDF:', err);
            toast.error(`Failed to generate PDF: ${err.message || 'Error'}`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleRecordDepositPayment = async () => {
        if (!depositModal) return;
        const amount = Number(depositPaymentAmount) || depositModal.depositAmount;
        if (amount <= 0) return toast.error('Please enter a valid deposit amount.');

        const finalRef = depositPaymentRef.trim() || generateDepositRef(depositPaymentMethod);
        setIsRecordingPayment(true);
        try {
            const client = depositModal.client;
            const nowIso = new Date().toISOString();
            const paymentDateIso = depositPaymentDate
                ? (depositPaymentDate.includes('T') ? new Date(depositPaymentDate).toISOString() : new Date(`${depositPaymentDate}T12:00:00`).toISOString())
                : nowIso;

            // 1. Update active service
            await supabase
                .from('services')
                .update({
                    deposit_status: 'collected',
                    deposit_amount: amount,
                    updated_at: nowIso,
                })
                .eq('client_id', client.id)
                .eq('status', 'active');

            // 2. Update active worker_assignments
            await supabase
                .from('worker_assignments')
                .update({
                    deposit_paid: amount,
                    deposit_amount: amount,
                    deposit_invoice_sent: true,
                })
                .eq('client_id', client.id)
                .eq('assignment_status', 'active');

            // 3. Insert record in payments table (connected to Global Payment History & Finance)
            const { error: insertPayError } = await supabase.from('payments').insert([{
                client_name: client.name,
                amount: amount,
                payment_date: paymentDateIso,
                payment_type: 'deposit',
                recorded_by: 'admin',
                transaction_ref: finalRef,
            }]);

            if (insertPayError) throw insertPayError;

            // 4. Ensure lead is in Active Client and sync service role
            await supabase.from('crm_leads').update({
                pipeline_stage: 'Active Client',
                assigned_worker_role: depositModal.serviceName || undefined,
                updated_at: nowIso,
            }).eq('id', client.id);

            // 5. Connect Activity Log in crm_lead_activity
            await supabase.from('crm_lead_activity').insert([{
                lead_id: client.id,
                event_type: 'payment_recorded',
                description: `Deposit collection recorded: ₹${amount.toLocaleString('en-IN')} via ${depositPaymentMethod} (Ref: ${finalRef}, Date: ${depositPaymentDate})`,
                created_at: paymentDateIso,
                metadata: {
                    amount,
                    payment_type: 'deposit',
                    payment_method: depositPaymentMethod,
                    transaction_ref: finalRef,
                    payment_date: paymentDateIso,
                }
            }]);

            toast.success(`Deposit payment of ₹${amount.toLocaleString('en-IN')} recorded for ${client.name}! 🎉`, {
                action: {
                    label: 'WhatsApp Receipt',
                    onClick: () => handleShareDepositReceiptWhatsApp(client, amount, depositPaymentMethod, finalRef, depositModal.serviceName, depositPaymentDate),
                },
                duration: 6000,
            });

            setDepositModal(null);
            fetchClients();
        } catch (err: any) {
            console.error('Failed to record deposit payment:', err);
            toast.error(`Failed to record deposit payment: ${err.message || 'Error'}`);
        } finally {
            setIsRecordingPayment(false);
        }
    };

    // Track which clients have had review sent this session
    const [reviewSentIds, setReviewSentIds] = useState<Set<string>>(new Set());
    const [googleReviews, setGoogleReviews] = useState<any>(null);
    const [isLoadingGoogleReviews, setIsLoadingGoogleReviews] = useState(false);

    const toggleWorkflow = (key: keyof typeof workflows) => {
        setWorkflows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const monthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const prevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const nextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const now = new Date();
        const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const next = new Date(y, m, 1);
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        if (nextKey <= nowKey) setSelectedMonth(nextKey);
    };

    const isClientInMonth = (client: any, ym: string) => {
        // 1. Client registered / joined in this month (UTC or local)
        if (client.created_at) {
            const utcKey = client.created_at.slice(0, 7);
            if (utcKey === ym) return true;
        }

        // 2. Client started a service in this specific month
        if (client.services && client.services.length > 0) {
            for (const s of client.services) {
                const sStart = s.start_date ? s.start_date.slice(0, 7) : '';
                if (sStart === ym) return true;
            }
        }

        return false;
    };

    // Remove from pipeline confirmation state
    const { user } = useAuth();
    const [requestDeleteClient, setRequestDeleteClient] = useState<any>(null);
    const [removeConfirmClient, setRemoveConfirmClient] = useState<any>(null);
    const [deleteConfirmClient, setDeleteConfirmClient] = useState<any>(null);
    const [viewingTrash, setViewingTrash] = useState(false);

    const handleDeleteClientClick = (client: any) => {
        if (user?.role !== 'admin') {
            setRequestDeleteClient(client);
        } else {
            setDeleteConfirmClient(client);
        }
    };

    const handleRemoveFromPipeline = async (client: any) => {
        const isArchived = client.status === 'Archived';

        if (isArchived) {
            // Add back to pipeline — move to Closed Won
            try {
                await supabase.from('crm_leads').update({ pipeline_stage: 'Closed Won' }).eq('id', client.id);
                setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Closed Won' } : c));
                toast.success(`${client.name} added back to pipeline as Closed Won.`);
            } catch (err: any) {
                toast.error(`Failed: ${err.message}`);
            }
            return;
        }

        // Show inline confirmation modal
        setRemoveConfirmClient(client);
    };

    const confirmRemoveFromPipeline = async () => {
        if (!removeConfirmClient) return;
        const client = removeConfirmClient;
        setRemoveConfirmClient(null);
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Archived' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Archived' } : c));
            toast.success(`${client.name} removed from pipeline. Still visible in Client Master.`);
        } catch (err: any) {
            toast.error(`Failed: ${err.message}`);
        }
    };

    const confirmTemporaryDelete = async () => {
        if (!deleteConfirmClient) return;
        if (user?.role !== 'admin') {
            toast.error('Only System Admin can delete records.');
            setDeleteConfirmClient(null);
            return;
        }
        const client = deleteConfirmClient;
        setDeleteConfirmClient(null);
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Trash' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Trash' } : c));
            toast.success(`${client.name} moved to trash.`);
        } catch (err: any) {
            toast.error(`Failed to move to trash: ${err.message}`);
        }
    };
    
    const handleRestoreClient = async (client: any) => {
        try {
            const { error } = await supabase.from('crm_leads').update({ pipeline_stage: 'Archived' }).eq('id', client.id);
            if (error) throw error;
            setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Archived' } : c));
            toast.success(`${client.name} restored from trash.`);
        } catch (err: any) {
            toast.error(`Failed to restore: ${err.message}`);
        }
    };

    const confirmDeleteClient = async () => {
        if (!deleteConfirmClient) return;
        if (user?.role !== 'admin') {
            toast.error('Only System Admin can delete records.');
            setDeleteConfirmClient(null);
            return;
        }
        const client = deleteConfirmClient;
        setDeleteConfirmClient(null);
        try {
            // First attempt to delete from crm_leads in case it's a foreign key parent
            await supabase.from('crm_leads').delete().eq('id', client.id);
            // Then delete from clients table
            const { error } = await supabase.from('clients').delete().eq('id', client.id);
            if (error) throw error;
            
            setClients(prev => prev.filter(c => c.id !== client.id));
            toast.success(`${client.name} permanently deleted from master database.`);
        } catch (err: any) {
            toast.error(`Failed to delete: ${err.message}`);
        }
    };

    const openRestartModal = async (client: any) => {
        setRestartModal(client);

        // Extract previous service configuration if available
        const services = client.services || [];
        const lastService = services.length > 0 ? services[services.length - 1] : null;

        let leadInterest = '';
        let leadQuotedRate = 0;
        try {
            const { data: leadData } = await supabase
                .from('crm_leads')
                .select('service_interest, quoted_monthly_rate')
                .eq('id', client.id)
                .maybeSingle();
            if (leadData) {
                leadInterest = leadData.service_interest || '';
                leadQuotedRate = leadData.quoted_monthly_rate || 0;
            }
        } catch {}

        const initialService = lastService?.service_type || leadInterest || 'Old Age Care';
        const rawHours = lastService?.hours_per_day || 10;
        const initialHours = rawHours >= 20 ? 24 : 10;
        const initialComplete = lastService?.complete_month_daily_rate || (leadQuotedRate ? Math.round(leadQuotedRate / 30) : 800);
        const initialIncomplete = lastService?.incomplete_month_daily_rate || 1500;
        const todayStr = new Date().toISOString().split('T')[0];

        setRestartServiceType(initialService);
        setRestartShiftHours(initialHours);
        setRestartStartDate(todayStr);
        setRestartEndDate('');
        setRestartIsOngoing(true);
        setRestartCompleteRate(initialComplete);
        setRestartIncompleteRate(initialIncomplete);
        setRestartDepositAmount(5000);
        setRestartDepositStatus('collected');
        setRestartDepositMethod('UPI');
        setRestartWorkerSearch('');
        setRestartSelectedWorkers([]);
        setRestartNotes('');

        // Fetch workers with their stored 10hr and 24hr daily payout rates
        const { data } = await supabase
            .from('employees')
            .select('id, full_name, job_title, status, photo_url, rate_10hr, rate_24hr, assigned_client')
            .order('full_name');
        setRestartWorkers(data || []);
    };

    const handleRestartService = async () => {
        if (!restartStartDate) return toast.error('Please select a service start date.');
        if (!restartServiceType.trim()) return toast.error('Please specify the service name.');
        if (!restartCompleteRate || Number(restartCompleteRate) <= 0) return toast.error('Please enter a valid complete month daily rate.');
        if (!restartIncompleteRate || Number(restartIncompleteRate) <= 0) return toast.error('Please enter a valid incomplete month daily rate.');
        if (restartSelectedWorkers.length === 0) return toast.error('Please select at least one staff member to assign.');

        setIsRestartSubmitting(true);
        try {
            // Automatically determine worker payout according to their stored shift rate
            const workersPayload = restartSelectedWorkers.map(w => ({
                workerId: w.id,
                workerPayoutRate: restartShiftHours === 24
                    ? (w.rate_24hr ? Number(w.rate_24hr) : undefined)
                    : (w.rate_10hr ? Number(w.rate_10hr) : undefined)
            }));

            const result = await restartClientService({
                clientId: restartModal.id,
                clientName: restartModal.name,
                serviceType: restartServiceType.trim(),
                hoursPerDay: Number(restartShiftHours) === 24 ? 24 : 10,
                startDate: restartStartDate,
                endDate: restartIsOngoing ? null : (restartEndDate || null),
                completeMonthDailyRate: Number(restartCompleteRate),
                incompleteMonthDailyRate: Number(restartIncompleteRate),
                depositAmount: Number(restartDepositAmount) || 0,
                depositStatus: restartDepositStatus,
                depositPaymentMethod: restartDepositMethod,
                workers: workersPayload,
                notes: restartNotes.trim() || undefined,
            });

            if (!result.success) throw new Error(result.error);

            toast.success(`Service restarted for ${restartModal.name}! 🎉 Moved back to Active Client.`);
            setRestartModal(null);
            fetchClients();
        } catch (err: any) {
            console.error('Failed to restart service:', err);
            toast.error(`Failed to restart service: ${err.message || 'Unknown error'}`);
        } finally {
            setIsRestartSubmitting(false);
        }
    };


    const handleRequestReview = async (client: any) => {
        if (!client.phone) {
            toast.error("No phone number found for this client. Please update the profile.");
            return;
        }

        const toastId = toast.loading(`Sending WhatsApp Review request to ${client.name}...`);
        
        try {
            // Standardize phone
            let phoneDigits = client.phone.replace(/\D/g, '');
            if (phoneDigits.length === 10) phoneDigits = `91${phoneDigits}`;

            const firstName = client.name.split(' ')[0] || 'there';

            const { data, error } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                body: {
                    phone: phoneDigits,
                    useTemplate: true,
                    templateName: 'client_review_request',
                    templateParams: [firstName]
                }
            });

            if (error) throw error;
            if (data?.success === false) throw new Error(data.error || "Meta API error");

            toast.success('Review request sent successfully! ✅', { id: toastId });
            setReviewSentIds(prev => new Set(prev).add(client.id));
        } catch (err: any) {
            console.error('WhatsApp Review fail:', err);
            toast.error(`WhatsApp failed: ${err.message || 'Check connection'}`, { id: toastId });
        }
    };


    const fetchClients = async () => {
        try {
            // 1. Fetch leads to map pipeline_stage and service metadata
            // Also fetch all records from the clients table
            const [leadsResult, allClientsRes] = await Promise.all([
                supabase.from('crm_leads').select('id, name, phone, whatsapp_number, email, source, created_at, pipeline_stage, notes, assigned_worker_role'),
                supabase.from('clients').select('*').order('created_at', { ascending: false })
            ]);

            if (leadsResult.error) throw leadsResult.error;
            if (allClientsRes.error) throw allClientsRes.error;

            const allLeads = leadsResult.data || [];
            // Build a map of lead_id -> pipeline_stage and lead_id -> lead data for status badge and service metadata
            const stageMap: Record<string, string> = {};
            const leadMap: Record<string, any> = {};
            allLeads.forEach(l => {
                stageMap[l.id] = l.pipeline_stage || 'Archived';
                leadMap[l.id] = l;
            });

            const clientData = [...(allClientsRes.data || [])];
            const existingClientIds = new Set(clientData.map(c => c.id));

            // Self-heal: If any confirmed active lead in CRM is missing from clients table, include and persist it
            const activeLeads = allLeads.filter(l => ['Active Client', 'Monthly Billing', 'Closed Won'].includes(l.pipeline_stage));
            const missingLeads = activeLeads.filter(l => !existingClientIds.has(l.id));
            if (missingLeads.length > 0) {
                missingLeads.forEach(l => {
                    const fallbackClient = {
                        id: l.id,
                        client_name: l.name,
                        company_name: null,
                        phone_number: l.phone || l.whatsapp_number || null,
                        email: l.email || null,
                        source: l.source || null,
                        created_at: l.created_at,
                    };
                    clientData.push(fallbackClient);
                    supabase.from('clients').upsert({
                        id: l.id,
                        client_name: l.name,
                        phone_number: l.phone || l.whatsapp_number || null,
                        email: l.email || null,
                        source: l.source || null,
                        created_at: l.created_at,
                    }, { onConflict: 'id' }).then();
                });
            }

            // 3. Fetch worker_assignments with employee status & dates
            const { data: allAssignmentsData, error: assignAllError } = await supabase
                .from('worker_assignments')
                .select('id, client_id, assignment_status, employee_id, deposit_amount, deposit_paid, start_date, end_date, service_type, assigned_at, notes, employees(status, full_name)');

            if (assignAllError) throw assignAllError;

            // 4. Fetch payment data for deposit fallback & all services with deposit info
            const [{ data: depositPaymentsData, error: paymentsError }, { data: allServicesData }] = await Promise.all([
                supabase
                    .from('payments')
                    .select('client_name, amount, payment_type')
                    .eq('payment_type', 'deposit'),
                supabase
                    .from('services')
                    .select('id, client_id, service_type, start_date, end_date, status, deposit_amount, deposit_status, created_at, notes, service_bills(*), service_worker_assignments(id, employee_id, start_date, end_date, employees(status, full_name))')
            ]);

            if (paymentsError) throw paymentsError;

            const assignments = allAssignmentsData || [];
            const depositPayments = depositPaymentsData || [];
            const services = allServicesData || [];

            // Build unified workerMap keyed by client_id combining BOTH worker_assignments AND service_worker_assignments
            const allWorkersByClient: Record<string, Set<string>> = {};
            const activeWorkersByClient: Record<string, Set<string>> = {};

            const ensureSets = (clientId: string) => {
                if (!allWorkersByClient[clientId]) allWorkersByClient[clientId] = new Set();
                if (!activeWorkersByClient[clientId]) activeWorkersByClient[clientId] = new Set();
            };

            const todayStr = new Date().toISOString().split('T')[0];

            // 1. Process worker_assignments
            assignments.forEach((a: any) => {
                if (!a.client_id) return;
                ensureSets(a.client_id);
                if (a.employee_id) allWorkersByClient[a.client_id].add(a.employee_id);
                const empStatus = a.employees?.status;
                const isActive = a.assignment_status === 'active' && (!a.end_date || a.end_date >= todayStr) && (empStatus === 'assigned' || empStatus === 'Active' || empStatus === 'available');
                if (isActive && a.employee_id) {
                    activeWorkersByClient[a.client_id].add(a.employee_id);
                }
            });

            // 2. Process service_worker_assignments from services
            services.forEach((s: any) => {
                if (!s.client_id) return;
                ensureSets(s.client_id);
                (s.service_worker_assignments || []).forEach((swa: any) => {
                    if (swa.employee_id) allWorkersByClient[s.client_id].add(swa.employee_id);
                    const empStatus = swa.employees?.status;
                    const isActive = s.status === 'active' && (!swa.end_date || swa.end_date >= todayStr) && (empStatus === 'assigned' || empStatus === 'Active' || empStatus === 'available');
                    if (isActive && swa.employee_id) {
                        activeWorkersByClient[s.client_id].add(swa.employee_id);
                    }
                });
            });

            const workerMap: Record<string, { workerCount: number, activeWorkerCount: number }> = {};
            Object.keys(allWorkersByClient).forEach(cid => {
                workerMap[cid] = {
                    workerCount: allWorkersByClient[cid].size,
                    activeWorkerCount: activeWorkersByClient[cid].size
                };
            });

            const normalizeClientName = (name?: string | null) => (name || '').trim().toLowerCase();

            // Map deposits by client name for legacy fallback
            const paidDepositByClientName: Record<string, number> = {};
            depositPayments.forEach(p => {
                const clientName = normalizeClientName(p.client_name);
                if (!clientName) return;
                paidDepositByClientName[clientName] = (paidDepositByClientName[clientName] || 0) + (Number(p.amount) || 0);
            });

            // 5. Map database clients to UI structure (Per-service deposit calculation - NEVER merge across cycles)
            // Qualification rule:
            // For a lead's first service, they should only appear in Client Master Database AFTER the deposit is collected.
            // If the same client starts another service after this ends, they should remain in Client Master Database.
            const qualifiedClients = (clientData || []).filter(c => {
                const clientServices = services.filter(s => s.client_id === c.id);
                const clientAssignments = assignments.filter(a => a.client_id === c.id);

                // Has this client ever had a deposit collected or settled, or payment recorded?
                const hasCollectedOrSettledDeposit = clientServices.some(s => s.deposit_status === 'collected' || s.deposit_status === 'settled')
                    || clientAssignments.some(a => Number(a.deposit_paid) > 0)
                    || (paidDepositByClientName[normalizeClientName(c.client_name)] || 0) > 0;

                // Has this client completed any historical / ended service?
                const hasCompletedHistoricalService = clientServices.some(s => s.status !== 'active')
                    || clientAssignments.some(a => a.assignment_status === 'completed' || a.assignment_status === 'ended');

                const leadStage = leadMap[c.id]?.pipeline_stage;
                const isPreDepositLead = ['New Lead', 'New', 'New Inquiry', 'In Discussion', 'Quotation Sent', 'Consent Form', 'Staff Assigned', 'Deposit Pending'].includes(leadStage);

                // If this lead is on their first service and deposit is NOT collected yet, don't show in Client Master Database
                if (isPreDepositLead && !hasCollectedOrSettledDeposit && !hasCompletedHistoricalService) {
                    return false;
                }

                return true;
            });

            // Stable map of clientId -> permanent readable ID: CL-0001, CL-0002... based on registration chronology
            const clientOrderMap = new Map<string, string>();
            [...qualifiedClients]
                .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
                .forEach((c, idx) => {
                    clientOrderMap.set(c.id, `CL-${String(idx + 1).padStart(4, '0')}`);
                });

            const enrichedClients = qualifiedClients.map(c => {
                const clientServices = services.filter(s => s.client_id === c.id);
                const clientAssignments = assignments.filter(a => a.client_id === c.id);

                const activeService = clientServices.find(s => s.status === 'active');
                const activeAssignment = clientAssignments.find(a => a.assignment_status === 'active');

                const latestService = [...clientServices].sort((a, b) => new Date(b.created_at || b.start_date || 0).getTime() - new Date(a.created_at || a.start_date || 0).getTime())[0];
                const latestAssignment = [...clientAssignments].sort((a, b) => new Date(b.assigned_at || b.start_date || 0).getTime() - new Date(a.assigned_at || a.start_date || 0).getTime())[0];

                let depositAmount = 0;
                let depositStatus: 'collected' | 'pending' | 'settled' = 'collected';

                if (activeService) {
                    depositAmount = Number(activeService.deposit_amount) || 5000;
                    depositStatus = (activeService.deposit_status as 'collected' | 'pending' | 'settled') || 'pending';
                } else if (latestService) {
                    depositAmount = Number(latestService.deposit_amount) || 0;
                    depositStatus = (latestService.deposit_status as 'collected' | 'pending' | 'settled') || 'settled';
                } else if (activeAssignment) {
                    depositAmount = Number(activeAssignment.deposit_amount) || 0;
                    depositStatus = (Number(activeAssignment.deposit_paid) >= depositAmount && depositAmount > 0) ? 'collected' : 'pending';
                } else {
                    depositAmount = paidDepositByClientName[normalizeClientName(c.client_name)] || 0;
                    depositStatus = 'settled';
                }

                // Build unified service cycles history with deposit tracking
                const leadInfo = leadMap[c.id];
                const formatServiceLabel = (type?: string, notes?: string) => {
                    if (type && type !== 'date_range' && type !== 'open_ended' && type !== 'one_day' && type.trim() !== '') {
                        return type;
                    }
                    if (leadInfo?.assigned_worker_role) return leadInfo.assigned_worker_role;
                    if (leadInfo?.notes) {
                        const match = leadInfo.notes.match(/Service:\s*([^\n\r]+)/i);
                        if (match && match[1]?.trim()) return match[1].trim();
                    }
                    if (notes) {
                        const match = notes.match(/Service:\s*([^\n\r]+)/i);
                        if (match && match[1]?.trim()) return match[1].trim();
                    }
                    return 'Home Care Service';
                };

                const allServiceCycles: any[] = [];
                if (clientServices.length > 0) {
                    const sortedServices = [...clientServices].sort((a, b) => new Date(b.created_at || b.start_date || 0).getTime() - new Date(a.created_at || a.start_date || 0).getTime());
                    sortedServices.forEach(s => {
                        const isCurrent = activeService ? s.id === activeService.id : s.id === latestService?.id;
                        allServiceCycles.push({
                            id: s.id,
                            serviceType: formatServiceLabel(s.service_type, s.notes),
                            startDate: s.start_date,
                            endDate: s.end_date,
                            isCurrent: isCurrent,
                            depositAmount: Number(s.deposit_amount) || 0,
                            depositStatus: isCurrent ? depositStatus : (s.deposit_status || 'settled'),
                        });
                    });
                }
                
                // Also incorporate any historical assignments not already represented in services
                if (clientAssignments.length > 0) {
                    const sortedAsgns = [...clientAssignments].sort((a, b) => new Date(b.assigned_at || b.start_date || 0).getTime() - new Date(a.assigned_at || a.start_date || 0).getTime());
                    sortedAsgns.forEach(a => {
                        const alreadyRepresented = allServiceCycles.some(cyc => 
                            (cyc.id === a.id) || 
                            (a.start_date && cyc.startDate && a.start_date.split('T')[0] === cyc.startDate.split('T')[0])
                        );
                        if (!alreadyRepresented) {
                            const isCurrent = !activeService && (activeAssignment ? a.id === activeAssignment.id : a.id === latestAssignment?.id);
                            allServiceCycles.push({
                                id: a.id,
                                serviceType: formatServiceLabel(a.service_type, a.notes),
                                startDate: a.start_date,
                                endDate: a.end_date,
                                isCurrent: isCurrent,
                                depositAmount: Number(a.deposit_amount) || 0,
                                depositStatus: isCurrent ? depositStatus : 'settled',
                            });
                        }
                    });
                }

                let pastDepositTotal = allServiceCycles
                    .filter(cyc => !cyc.isCurrent)
                    .reduce((sum, cyc) => sum + (Number(cyc.depositAmount) || 0), 0);

                // Fallback: If past cycles didn't explicitly store deposit, but payments ledger has recorded historical deposits
                const totalPaidDeposits = paidDepositByClientName[normalizeClientName(c.client_name)] || 0;
                if (pastDepositTotal <= 0 && totalPaidDeposits > depositAmount) {
                    pastDepositTotal = totalPaidDeposits - depositAmount;
                }

                // Calculate Lifetime Billed and Balance from service_bills
                const clientBills = (clientServices || []).flatMap((s: any) => s.service_bills || []);
                const totalBilled = clientBills.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
                const totalPaid = clientBills
                    .filter((b: any) => b.status === 'paid' || b.payment_status === 'paid')
                    .reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
                const balanceDue = Math.max(0, totalBilled - totalPaid);

                // Extract active caregiver names
                const activeWorkerNames = Array.from(new Set(
                    (activeService?.service_worker_assignments || [])
                        .filter((swa: any) => !swa.end_date || swa.end_date >= todayStr)
                        .map((swa: any) => swa.employees?.full_name)
                        .filter(Boolean)
                )) as string[];
                const empObj: any = activeAssignment?.employees;
                const activeEmpName = Array.isArray(empObj) ? empObj[0]?.full_name : empObj?.full_name;
                if (activeWorkerNames.length === 0 && activeEmpName) {
                    activeWorkerNames.push(activeEmpName);
                }

                return {
                    id: c.id,
                    displayId: clientOrderMap.get(c.id) || `CL-${String(c.id).substring(0, 4).toUpperCase()}`,
                    name: c.client_name,
                    phone: c.phone_number,
                    email: c.email || '-',
                    contact: c.client_name,
                    status: stageMap[c.id] || 'Active',
                    workerCount: workerMap[c.id]?.workerCount || 0,
                    activeWorkerCount: workerMap[c.id]?.activeWorkerCount || 0,
                    activeWorkerNames: activeWorkerNames,
                    totalBilled: totalBilled,
                    totalPaid: totalPaid,
                    balanceDue: balanceDue,
                    lifetimeValue: `₹${totalBilled.toLocaleString('en-IN')}`,
                    securityDeposit: depositAmount,
                    depositStatus: depositStatus,
                    pastDepositTotal: pastDepositTotal,
                    allServiceCycles: allServiceCycles,
                    activeService: activeService || latestService,
                    activeAssignment: activeAssignment || latestAssignment,
                    created_at: c.created_at,
                    city: extractCity({ ...c, ...leadInfo }),
                    services: clientServices,
                    assignments: clientAssignments,
                };
            });

            setClients(enrichedClients);
        } catch (error) {
            console.error('Error fetching client data:', error);
            toast.error('Failed to load dynamic client data');
        }
    };

    const fetchGoogleReviews = async () => {
        setIsLoadingGoogleReviews(true);
        try {
            const { data, error } = await supabase.functions.invoke('get-google-reviews');
            if (error) throw error;
            setGoogleReviews(data);
        } catch (error) {
            console.warn('Google reviews unavailable:', error);
            setGoogleReviews({ success: false, error: 'Unable to load Google reviews.' });
        } finally {
            setIsLoadingGoogleReviews(false);
        }
    };

    useEffect(() => {
        fetchClients();
        fetchGoogleReviews();
    }, []);

    useEffect(() => {
        if (restartClientId && clients.length > 0) {
            const target = clients.find(c => c.id === restartClientId);
            if (target) {
                openRestartModal(target);
            }
        }
    }, [restartClientId, clients]);

    // Distinct service types for filter dropdown
    const availableServiceTypes = useMemo(() => {
        const set = new Set<string>();
        clients.forEach(c => {
            if (c.activeService?.service_type) set.add(c.activeService.service_type);
        });
        return Array.from(set).sort();
    }, [clients]);

    // Filtered clients list
    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            if (viewingTrash) {
                return c.status === 'Trash';
            }
            if (c.status === 'Trash') return false;

            // Status filter
            if (selectedStatus !== 'all' && c.status !== selectedStatus) {
                return false;
            }

            // Deposit filter
            if (selectedDepositFilter !== 'all') {
                if (selectedDepositFilter === 'paid' && c.depositStatus !== 'collected') return false;
                if (selectedDepositFilter === 'pending' && c.depositStatus !== 'pending') return false;
            }

            // Service Type filter
            if (selectedServiceFilter !== 'all') {
                const sType = c.activeService?.service_type || '';
                if (!sType.toLowerCase().includes(selectedServiceFilter.toLowerCase())) return false;
            }

            // City filter
            if (selectedCity !== 'all') {
                const cCity = c.city || extractCity(c);
                if (cCity.toLowerCase() !== selectedCity.toLowerCase()) return false;
            }

            // Search query filter (matches readable displayId like CL-0037, UUID, name, phone, email)
            if (searchQuery.trim()) {
                const rawQ = searchQuery.trim().toLowerCase();
                const strippedQ = rawQ.replace(/^(client\s*id|id)\s*[:#-]?\s*/i, '').trim();
                const cleanQ = rawQ.replace(/[^a-z0-9]/g, '');
                const cleanStrippedQ = strippedQ.replace(/[^a-z0-9]/g, '');

                const clientIdStr = (c.id || '').toLowerCase();
                const displayIdStr = (c.displayId || '').toLowerCase();
                const cleanClientId = clientIdStr.replace(/[^a-z0-9]/g, '');
                const cleanDisplayId = displayIdStr.replace(/[^a-z0-9]/g, '');

                const idMatch = clientIdStr.includes(rawQ) ||
                                displayIdStr.includes(rawQ) ||
                                (strippedQ.length > 0 && (clientIdStr.includes(strippedQ) || displayIdStr.includes(strippedQ))) ||
                                (cleanQ.length >= 2 && (cleanClientId.includes(cleanQ) || cleanDisplayId.includes(cleanQ))) ||
                                (cleanStrippedQ.length >= 2 && (cleanClientId.includes(cleanStrippedQ) || cleanDisplayId.includes(cleanStrippedQ)));

                const nameMatch = (c.name || '').toLowerCase().includes(rawQ) ||
                                  (strippedQ.length > 0 && (c.name || '').toLowerCase().includes(strippedQ));
                const phoneMatch = (c.phone || '').toLowerCase().includes(rawQ) ||
                                   (cleanQ.length >= 4 && (c.phone || '').replace(/\D/g, '').includes(cleanQ));
                const emailMatch = (c.email || '').toLowerCase().includes(rawQ);

                if (!nameMatch && !phoneMatch && !emailMatch && !idMatch) return false;
            }

            // When searching or viewAllMonths is true, don't restrict by month
            if (viewAllMonths || searchQuery.trim()) return true;

            return isClientInMonth(c, selectedMonth);
        });
    }, [clients, viewingTrash, selectedStatus, selectedDepositFilter, selectedServiceFilter, selectedCity, searchQuery, viewAllMonths, selectedMonth]);

    // Sorted clients list
    const sortedClients = useMemo(() => {
        return [...filteredClients].sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];

            if (sortField === 'created_at') {
                valA = new Date(a.created_at || 0).getTime();
                valB = new Date(b.created_at || 0).getTime();
            } else if (sortField === 'securityDeposit' || sortField === 'totalBilled' || sortField === 'workerCount') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [filteredClients, sortField, sortAsc]);

    // KPI Metrics
    const totalActiveDeployments = useMemo(() => {
        return filteredClients.reduce((acc, c) => acc + (c.activeWorkerCount || 0), 0);
    }, [filteredClients]);

    const totalActiveDeposits = useMemo(() => {
        return filteredClients.reduce((acc, c) => acc + (c.depositStatus === 'collected' ? (c.securityDeposit || 0) : 0), 0);
    }, [filteredClients]);

    const totalLifetimeRevenue = useMemo(() => {
        return filteredClients.reduce((acc, c) => acc + (c.totalBilled || 0), 0);
    }, [filteredClients]);

    const totalOutstandingBalance = useMemo(() => {
        return filteredClients.reduce((acc, c) => acc + (c.balanceDue || 0), 0);
    }, [filteredClients]);

    const renderSortIcon = (field: typeof sortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 inline ml-1 opacity-60" />;
        }
        return sortAsc ? (
            <ArrowUp className="w-3.5 h-3.5 text-teal-600 inline ml-1" />
        ) : (
            <ArrowDown className="w-3.5 h-3.5 text-teal-600 inline ml-1" />
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
            {/* Top Bar with Title and Global Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">Client Master Database</h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            {clients.filter(c => c.status !== 'Trash').length} Clients Total
                        </span>
                    </div>
                    <p className="text-slate-600 mt-1 text-sm font-medium">Manage permanent clients, lifetime revenue, staff deployments, and automated review collection.</p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => exportToCSV(filteredClients)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs active:scale-95 cursor-pointer"
                        title="Export current filtered list to CSV"
                    >
                        <Download className="w-4 h-4 text-teal-600" />
                        Export CSV
                    </button>
                    <button 
                        onClick={() => navigate('/admin/billing?tab=history')}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    >
                        <HistoryIcon className="w-4 h-4 text-primary" />
                        Global Payment History
                    </button>
                </div>
            </div>

            {/* Operational & Financial KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                        <span>Active Clients</span>
                        <Users className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="mt-2">
                        <p className="text-2xl font-extrabold text-slate-900">{filteredClients.length}</p>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                            {filteredClients.filter(c => c.status === 'Active Client' || c.status === 'Monthly Billing').length} Live in care
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                        <span>Caregiver Shifts</span>
                        <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="mt-2">
                        <p className="text-2xl font-extrabold text-slate-900">{totalActiveDeployments}</p>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Deployed staff assigned
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                        <span>Deposits Held</span>
                        <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="mt-2">
                        <p className="text-2xl font-extrabold text-emerald-700">₹{totalActiveDeposits.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Safeguarded security deposits
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-600 text-xs font-bold uppercase tracking-wider">
                        <span>Lifetime Invoiced</span>
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="mt-2">
                        <p className="text-2xl font-extrabold text-slate-900">₹{totalLifetimeRevenue.toLocaleString('en-IN')}</p>
                        <p className="text-xs font-semibold mt-0.5">
                            {totalOutstandingBalance > 0 ? (
                                <span className="text-amber-700 font-bold">₹{totalOutstandingBalance.toLocaleString('en-IN')} pending</span>
                            ) : (
                                <span className="text-emerald-700 font-bold">100% Settled</span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`grid ${viewMode === 'table' ? 'grid-cols-1' : 'lg:grid-cols-3'} gap-6 flex-1`}>
                {/* Client List Container */}
                <div className={`${viewMode === 'table' ? 'col-span-full' : 'lg:col-span-2'} bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col`}>
                    {/* Primary Controls Toolbar */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        {/* Upper Toolbar: Search, View Mode Toggle, Month Navigator, and Trash */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            {/* Search Box with Clear Button & Explicit Placeholder */}
                            <div className="relative flex-1 min-w-[260px] max-w-lg">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search by Name, Phone (+91), or Client ID (e.g. CL-0037)..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/20 focus:border-[#1AA6A8] transition-all font-medium"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                                        title="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* View Mode Toggle: Compact Table vs Cards */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                                    <button
                                        onClick={() => toggleViewMode('table')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                            viewMode === 'table'
                                                ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                        title="Compact sortable table view (resolves bulky card scrolling)"
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                        Table
                                    </button>
                                    <button
                                        onClick={() => toggleViewMode('cards')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                            viewMode === 'cards'
                                                ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                        title="Detailed card view"
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        Cards
                                    </button>
                                </div>

                                {/* View Trash button */}
                                <button
                                    onClick={() => setViewingTrash(!viewingTrash)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border cursor-pointer ${
                                        viewingTrash 
                                            ? 'bg-red-50 text-red-600 border-red-200 font-bold' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {viewingTrash ? 'Exit Trash' : 'Trash'}
                                </button>
                            </div>
                        </div>

                        {/* Secondary Filter Bar: Segmented Month, City, Status, Deposit, Service & Phone Masking */}
                        <div className="flex items-center justify-between gap-2.5 flex-wrap pt-2 border-t border-slate-200/80">
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* All vs By Month segmented tabs with explanatory Tooltip */}
                                {(() => {
                                    const activeClients = clients.filter(c => {
                                        if (c.status === 'Trash') return false;
                                        if (selectedCity !== 'all') {
                                            const city = c.city || extractCity(c);
                                            if (city.toLowerCase() !== selectedCity.toLowerCase()) return false;
                                        }
                                        return true;
                                    });
                                    const mCount = activeClients.filter(c => isClientInMonth(c, selectedMonth)).length;
                                    return (
                                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs items-center">
                                            <button
                                                onClick={() => setViewAllMonths(true)}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                    viewAllMonths
                                                        ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                                title="View complete all-time permanent client database"
                                            >
                                                All Clients ({activeClients.length})
                                            </button>
                                            <button
                                                onClick={() => setViewAllMonths(false)}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                    !viewAllMonths
                                                        ? 'bg-[#1AA6A8] text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                                title={`View clients who joined in ${monthLabel(selectedMonth)}`}
                                            >
                                                By Month ({mCount})
                                            </button>
                                            <div 
                                                className="px-1 text-slate-400 hover:text-slate-600 cursor-help"
                                                title="Why counts differ: 'All Clients' includes your entire roster of 37 clients across all months. 'By Month' filters to only clients enrolled in the selected billing period."
                                            >
                                                <Info className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Month Navigator */}
                                <div className={`flex items-center bg-white border rounded-lg overflow-hidden transition-all ${
                                    !viewAllMonths 
                                        ? 'border-[#1AA6A8] ring-2 ring-[#1AA6A8]/20 shadow-xs' 
                                        : 'border-slate-200 opacity-80 hover:opacity-100'
                                }`}>
                                    <button 
                                        onClick={() => {
                                            setViewAllMonths(false);
                                            prevMonth();
                                        }} 
                                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 transition-colors font-bold text-xs cursor-pointer"
                                        title="Previous Month"
                                    >
                                        ‹
                                    </button>
                                    <span 
                                        onClick={() => setViewAllMonths(false)}
                                        className={`px-2.5 py-1 text-xs font-bold min-w-[115px] text-center border-x border-slate-200 select-none cursor-pointer transition-colors ${
                                            !viewAllMonths ? 'text-[#1AA6A8] bg-teal-50/50' : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                        title="Click to view by this month"
                                    >
                                        {monthLabel(selectedMonth)}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            setViewAllMonths(false);
                                            nextMonth();
                                        }} 
                                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 transition-colors font-bold text-xs cursor-pointer"
                                        title="Next Month"
                                    >
                                        ›
                                    </button>
                                </div>

                                {/* City Filter Dropdown */}
                                {(() => {
                                    const baseClients = clients.filter(c => {
                                        if (c.status === 'Trash') return false;
                                        if (!viewAllMonths && !isClientInMonth(c, selectedMonth)) return false;
                                        return true;
                                    });
                                    const counts: Record<string, number> = {};
                                    baseClients.forEach(c => {
                                        const city = c.city || extractCity(c);
                                        counts[city] = (counts[city] || 0) + 1;
                                    });
                                    const cityList = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
                                    if (!cityList.includes('Surat')) cityList.push('Surat');

                                    return (
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                                    selectedCity !== 'all'
                                                        ? 'bg-sky-50 border-sky-300 text-sky-700 ring-2 ring-sky-200/50'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                                                <span>{selectedCity === 'all' ? 'City: All' : selectedCity}</span>
                                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isCityDropdownOpen && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-30"
                                                        onClick={() => setIsCityDropdownOpen(false)}
                                                    />
                                                    <div className="absolute left-0 mt-1.5 w-52 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                                                        <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                                            Filter by City
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCity('all');
                                                                setIsCityDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                                selectedCity === 'all' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <span>All Cities</span>
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                                                                {baseClients.length}
                                                            </span>
                                                        </button>
                                                        {cityList.map(cName => (
                                                            <button
                                                                key={cName}
                                                                onClick={() => {
                                                                    setSelectedCity(cName);
                                                                    setIsCityDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                                    selectedCity === cName ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                                    {cName}
                                                                </span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                                                                    {counts[cName] || 0}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Status Filter */}
                                <select
                                    value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border bg-white cursor-pointer transition-colors ${
                                        selectedStatus !== 'all' ? 'bg-teal-50 border-teal-300 text-teal-800' : 'border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <option value="all">Status: All</option>
                                    <option value="Active Client">Active Client</option>
                                    <option value="Monthly Billing">Monthly Billing</option>
                                    <option value="Closed Won">Closed Won</option>
                                    <option value="Archived">Archived</option>
                                </select>

                                {/* Deposit Status Filter */}
                                <select
                                    value={selectedDepositFilter}
                                    onChange={e => setSelectedDepositFilter(e.target.value)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border bg-white cursor-pointer transition-colors ${
                                        selectedDepositFilter !== 'all' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <option value="all">Deposit: All</option>
                                    <option value="paid">Deposit Paid</option>
                                    <option value="pending">Deposit Pending</option>
                                </select>

                                {/* Service Type Filter */}
                                {availableServiceTypes.length > 0 && (
                                    <select
                                        value={selectedServiceFilter}
                                        onChange={e => setSelectedServiceFilter(e.target.value)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border bg-white cursor-pointer transition-colors ${
                                            selectedServiceFilter !== 'all' ? 'bg-purple-50 border-purple-300 text-purple-800' : 'border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <option value="all">Service: All</option>
                                        {availableServiceTypes.map(st => (
                                            <option key={st} value={st}>{st}</option>
                                        ))}
                                    </select>
                                )}

                                {/* Reset Filter Button if active */}
                                {(selectedStatus !== 'all' || selectedDepositFilter !== 'all' || selectedServiceFilter !== 'all' || selectedCity !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setSelectedStatus('all');
                                            setSelectedDepositFilter('all');
                                            setSelectedServiceFilter('all');
                                            setSelectedCity('all');
                                        }}
                                        className="text-xs text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer px-1"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>

                            {/* Phone Masking Toggle (DPDP compliance / healthcare privacy) */}
                            <button
                                onClick={() => setMaskPhoneNumbers(!maskPhoneNumbers)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                    maskPhoneNumbers
                                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                                title="Toggle phone number masking for healthcare privacy & DPDP Act compliance"
                            >
                                {maskPhoneNumbers ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                <span>{maskPhoneNumbers ? 'Phones Masked' : 'Mask Phones'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Empty State */}
                    {sortedClients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center p-6">
                            <Calendar className="w-12 h-12 text-slate-200 mb-3" />
                            <p className="text-base font-bold text-slate-700">
                                {viewingTrash 
                                    ? 'Trash is empty' 
                                    : searchQuery 
                                        ? 'No matching clients found' 
                                        : selectedCity !== 'all' 
                                            ? `No clients found for ${selectedCity}${viewAllMonths ? '' : ' in ' + monthLabel(selectedMonth)}` 
                                            : `No clients found matching the selected filters`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                {viewingTrash ? 'Deleted records will show up here.' : searchQuery ? 'Try searching by full phone number, client name, or readable ID like CL-0037.' : 'You can view all clients or clear current filters.'}
                            </p>
                            <div className="flex items-center gap-2 mt-4">
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Clear Search
                                    </button>
                                )}
                                {!viewAllMonths && !viewingTrash && (
                                    <button
                                        onClick={() => setViewAllMonths(true)}
                                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1AA6A8] hover:bg-[#15898A] rounded-lg transition-colors shadow-2xs cursor-pointer"
                                    >
                                        View All Clients ({clients.filter(c => c.status !== 'Trash').length})
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : viewMode === 'table' ? (
                        /* ================= COMPACT TABLE VIEW ================= */
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50/90 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs select-none">
                                    <tr>
                                        <th className="p-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={sortedClients.length > 0 && selectedClientIds.size === sortedClients.length}
                                                onChange={() => toggleSelectAll(sortedClients)}
                                                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                                title="Select all"
                                            />
                                        </th>
                                        <th 
                                            onClick={() => handleSort('displayId')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Client ID {renderSortIcon('displayId')}</span>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('name')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap min-w-[160px]"
                                        >
                                            <span className="flex items-center">Client &amp; City {renderSortIcon('name')}</span>
                                        </th>
                                        <th className="p-3 whitespace-nowrap min-w-[170px]">
                                            Contact Actions
                                        </th>
                                        <th className="p-3 whitespace-nowrap min-w-[140px]">
                                            Service &amp; Shift
                                        </th>
                                        <th 
                                            onClick={() => handleSort('workerCount')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Caregivers {renderSortIcon('workerCount')}</span>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('securityDeposit')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Deposit {renderSortIcon('securityDeposit')}</span>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('totalBilled')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Lifetime Billed {renderSortIcon('totalBilled')}</span>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('status')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Status {renderSortIcon('status')}</span>
                                        </th>
                                        <th 
                                            onClick={() => handleSort('created_at')}
                                            className="p-3 cursor-pointer hover:bg-slate-100/70 transition-colors whitespace-nowrap"
                                        >
                                            <span className="flex items-center">Joined Date {renderSortIcon('created_at')}</span>
                                        </th>
                                        <th className="p-3 text-right whitespace-nowrap">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedClients.map((client, idx) => {
                                        const isSelected = selectedClientIds.has(client.id);
                                        const activeSvc = client.activeService;
                                        const serviceType = activeSvc?.service_type || 'General Care';
                                        const shiftHours = activeSvc?.shift_hours ? `${activeSvc.shift_hours}h Shift` : '10h Shift';

                                        return (
                                            <tr
                                                key={client.id}
                                                onClick={() => setInspectingClient(client)}
                                                className={`group transition-colors cursor-pointer ${
                                                    isSelected ? 'bg-teal-50/70 hover:bg-teal-50' : idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50'
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => toggleSelectClient(client.id, e as any)}
                                                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                                    />
                                                </td>

                                                {/* Readable Client ID */}
                                                <td className="p-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-slate-400 font-mono w-4">
                                                            {idx + 1}.
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleCopyClientId(client.displayId, e)}
                                                            className="inline-flex items-center gap-1 font-mono font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer group/id"
                                                            title={`Permanent Client ID: ${client.displayId}\nFull UUID: ${client.id}\nClick to copy`}
                                                        >
                                                            <span>{client.displayId}</span>
                                                            {copiedClientIdBadge === client.displayId ? (
                                                                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 text-teal-600 opacity-60 group-hover/id:opacity-100 shrink-0" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Client Name & City */}
                                                <td className="p-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors text-sm">
                                                            {client.name}
                                                        </span>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
                                                            <span className="text-[11px] font-semibold text-sky-700">
                                                                {client.city || extractCity(client)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Contact: Phone, Quick Call, Quick WhatsApp, Quick Copy */}
                                                <td className="p-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-semibold text-slate-700">
                                                            {formatPhoneNumber(client.phone, maskPhoneNumbers)}
                                                        </span>
                                                        {client.phone && (
                                                            <div className="flex items-center gap-0.5">
                                                                <a
                                                                    href={`tel:${client.phone}`}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="p-1 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                                                                    title={`Call ${client.phone}`}
                                                                >
                                                                    <Phone className="w-3.5 h-3.5" />
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={e => handleWhatsAppDirect(client, e)}
                                                                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                                                    title="Open direct WhatsApp conversation"
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={e => handleCopyPhone(client.phone, client.id, e)}
                                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                                                    title="Copy phone number"
                                                                >
                                                                    {copiedPhoneId === client.id ? (
                                                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                                    ) : (
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Service & Shift */}
                                                <td className="p-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-800 text-xs truncate max-w-[150px]">
                                                            {serviceType}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {shiftHours}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Caregivers */}
                                                <td className="p-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5" title={(client.activeWorkerNames || []).join(', ') || 'No workers currently deployed'}>
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            <Users className="w-3 h-3 text-slate-500" />
                                                            {client.activeWorkerCount}
                                                        </span>
                                                        {client.activeWorkerNames && client.activeWorkerNames.length > 0 && (
                                                            <span className="text-xs text-slate-600 truncate max-w-[110px] font-medium">
                                                                {client.activeWorkerNames[0]}
                                                                {client.activeWorkerNames.length > 1 ? ` +${client.activeWorkerNames.length - 1}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Deposit */}
                                                <td className="p-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-900 text-xs">
                                                                ₹{client.securityDeposit.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border ${
                                                                client.depositStatus === 'pending'
                                                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                            }`}>
                                                                {client.depositStatus === 'pending' ? 'Pending' : 'Paid'}
                                                            </span>
                                                        </div>
                                                        {client.pastDepositTotal > 0 && (
                                                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                                                ₹{client.pastDepositTotal.toLocaleString('en-IN')} settled
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Lifetime Billed */}
                                                <td className="p-3 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs">
                                                            ₹{client.totalBilled.toLocaleString('en-IN')}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            Paid: ₹{client.totalPaid.toLocaleString('en-IN')}
                                                            {client.balanceDue > 0 && (
                                                                <span className="text-amber-700 font-bold ml-1">
                                                                    (Due: ₹{client.balanceDue.toLocaleString('en-IN')})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                        client.status === 'Closed Won' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                        client.status === 'Monthly Billing' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                        client.status === 'Active Client' ? 'bg-teal-100 text-teal-700 border border-teal-200' :
                                                        client.status === 'Archived' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                                        client.status === 'Trash' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {client.status === 'Closed Won' ? 'Closed' :
                                                         client.status === 'Monthly Billing' ? 'Billing' :
                                                         client.status === 'Active Client' ? 'Active' :
                                                         client.status === 'Archived' ? 'Archived' :
                                                         client.status === 'Trash' ? 'Trash' :
                                                         client.status}
                                                    </span>
                                                </td>

                                                {/* Registration Date */}
                                                <td className="p-3 whitespace-nowrap text-slate-700 font-medium text-xs">
                                                    {client.created_at ? new Date(client.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                </td>

                                                {/* Actions */}
                                                <td className="p-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Full View Details Modal */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setInspectingClient(client)}
                                                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Inspect complete client file & service history"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>

                                                        {/* Deposit invoice/receipt modal */}
                                                        <button
                                                            type="button"
                                                            onClick={() => openDepositModal(client)}
                                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                                client.depositStatus === 'pending'
                                                                    ? 'text-amber-700 hover:bg-amber-100 bg-amber-50'
                                                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                                            }`}
                                                            title={client.depositStatus === 'pending' ? 'Collect deposit payment or share invoice' : 'View deposit receipt & history'}
                                                        >
                                                            <Receipt className="w-4 h-4" />
                                                        </button>

                                                        {/* Review request button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRequestReview(client)}
                                                            className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Send Google review / satisfaction feedback request"
                                                        >
                                                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                                        </button>

                                                        {/* Restart Service if closed */}
                                                        {client.status === 'Closed Won' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openRestartModal(client)}
                                                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Restart service onboarding"
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Archive / Remove button with clear label/tooltip */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveFromPipeline(client)}
                                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                                client.status === 'Archived'
                                                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                            }`}
                                                            title={client.status === 'Archived' ? 'Restore client to active CRM pipeline' : 'Archive client from active roster'}
                                                        >
                                                            {client.status === 'Archived' ? (
                                                                <Plus className="w-4 h-4" />
                                                            ) : (
                                                                <UserMinus className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* ================= MODERN CARDS VIEW ================= */
                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            {sortedClients.map((client, idx) => (
                                <div 
                                    key={client.id} 
                                    onClick={() => setInspectingClient(client)} 
                                    className="p-4 rounded-xl border border-slate-200 hover:border-teal-500/40 hover:shadow-md transition-all bg-white group cursor-pointer"
                                >
                                    {/* 1. Card Top Bar: Deterministic Client ID CL-0037 + Row Index + High-Contrast Date + Status */}
                                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100 flex-wrap">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Human Readable Client ID badge with copy */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleCopyClientId(client.displayId, e)}
                                                className="inline-flex items-center gap-1.5 font-mono font-bold text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200/90 shadow-2xs transition-colors cursor-pointer group/id"
                                                title={`Permanent Client ID: ${client.displayId}\nFull UUID: ${client.id}\nClick to copy`}
                                            >
                                                <span className="text-[10px] uppercase font-bold text-teal-700">ID</span>
                                                <span className="text-xs">{client.displayId}</span>
                                                {copiedClientIdBadge === client.displayId ? (
                                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <Copy className="w-3 h-3 text-teal-600 opacity-60 group-hover/id:opacity-100 shrink-0" />
                                                )}
                                            </button>

                                            {/* Sequence indicator in current view */}
                                            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={`Row #${idx + 1} of ${sortedClients.length} clients`}>
                                                #{idx + 1}
                                            </span>

                                            <span className="text-slate-300">•</span>
                                            <span className="text-xs text-slate-600 font-medium">
                                                {idx + 1} of {sortedClients.length} clients
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                            {/* High Contrast Date Label */}
                                            {client.created_at && (
                                                <span className="text-xs text-slate-600 font-medium hidden sm:inline-block">
                                                    Added {new Date(client.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                client.status === 'Closed Won' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                client.status === 'Monthly Billing' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                client.status === 'Active Client' ? 'bg-teal-100 text-teal-700 border border-teal-200' :
                                                client.status === 'Archived' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                                client.status === 'Trash' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {client.status === 'Closed Won' ? 'Closed' :
                                                 client.status === 'Monthly Billing' ? 'Billing' :
                                                 client.status === 'Active Client' ? 'Active' :
                                                 client.status === 'Archived' ? 'Archived' :
                                                 client.status === 'Trash' ? 'Trash' :
                                                 client.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. Client Main Header: Building Icon + Name + City + Caregivers */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                                            <Building className="w-5 h-5 text-teal-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors text-base truncate">
                                                    {client.name}
                                                </h3>
                                                {(() => {
                                                    const city = client.city || extractCity(client);
                                                    return (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider shrink-0">
                                                            <MapPin className="w-2.5 h-2.5 text-sky-600" /> {city}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 font-medium">
                                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{client.activeWorkerCount} Active Staff</span>
                                                {client.activeWorkerNames && client.activeWorkerNames.length > 0 && (
                                                    <span className="text-slate-500">
                                                        ({client.activeWorkerNames.join(', ')})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 3. 4-Column Operational & Financial Metric Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 pt-3 border-t border-slate-100">
                                        {/* Box 1: Contact with Direct Call, WhatsApp & Copy */}
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <Phone className="w-3 h-3 text-slate-400" /> Contact
                                            </p>
                                            <p className="text-sm font-bold text-slate-800 truncate font-mono">
                                                {formatPhoneNumber(client.phone, maskPhoneNumbers)}
                                            </p>
                                            <div className="flex items-center gap-1 mt-2 pt-1 border-t border-slate-200/60" onClick={e => e.stopPropagation()}>
                                                {client.phone && (
                                                    <>
                                                        <a
                                                            href={`tel:${client.phone}`}
                                                            className="flex-1 py-1 text-[11px] font-bold text-slate-700 hover:text-teal-700 bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center justify-center gap-1 transition-colors"
                                                            title="Direct Call"
                                                        >
                                                            <Phone className="w-3 h-3" /> Call
                                                        </a>
                                                        <button
                                                            type="button"
                                                            onClick={e => handleWhatsAppDirect(client, e)}
                                                            className="flex-1 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                                            title="WhatsApp Message"
                                                        >
                                                            <MessageSquare className="w-3 h-3" /> Chat
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={e => handleCopyPhone(client.phone, client.id, e)}
                                                            className="p-1 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded transition-colors cursor-pointer"
                                                            title="Copy phone"
                                                        >
                                                            {copiedPhoneId === client.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Box 2: Service Details */}
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400" /> Service &amp; Shift
                                            </p>
                                            <p className="text-xs font-bold text-slate-900 truncate">
                                                {client.activeService?.service_type || 'General Care'}
                                            </p>
                                            <p className="text-[11px] text-slate-600 font-semibold mt-1">
                                                {client.activeService?.shift_hours ? `${client.activeService.shift_hours}-Hour Shift` : '10-Hour Shift'}
                                            </p>
                                        </div>

                                        {/* Box 3: Security Deposit (Fixing Issue #2 & #8 Overflow & Labeling) */}
                                        <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                                            client.depositStatus === 'pending'
                                                ? 'bg-amber-50/60 border-amber-200'
                                                : 'bg-emerald-50/50 border-emerald-200'
                                        }`}>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                                        client.depositStatus === 'pending' ? 'text-amber-800' : 'text-emerald-800'
                                                    }`}>
                                                        <Wallet className="w-3 h-3" /> Deposit
                                                    </p>
                                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${
                                                        client.depositStatus === 'pending'
                                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    }`}>
                                                        {client.depositStatus === 'pending' ? 'Pending' : 'Paid'}
                                                    </span>
                                                </div>
                                                <p className={`text-base font-extrabold mt-1 ${
                                                    client.depositStatus === 'pending' ? 'text-amber-900' : 'text-emerald-800'
                                                }`}>
                                                    ₹{client.securityDeposit.toLocaleString('en-IN')}
                                                </p>
                                                {client.pastDepositTotal > 0 && (
                                                    <p className="text-[10px] text-slate-600 font-semibold mt-0.5 truncate" title="Previous service deposit settled upon completion">
                                                        Prev Settled: ₹{client.pastDepositTotal.toLocaleString('en-IN')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Button on its own dedicated bottom line: NO OVERFLOW! */}
                                            <div className="mt-2 pt-1 border-t border-slate-200/40" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => openDepositModal(client)}
                                                    className={`w-full text-[11px] font-bold py-1 px-2 rounded-lg border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                                        client.depositStatus === 'pending'
                                                            ? 'text-amber-800 bg-amber-100 hover:bg-amber-200 border-amber-300'
                                                            : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
                                                    }`}
                                                >
                                                    <Receipt className="w-3 h-3" />
                                                    {client.depositStatus === 'pending' ? 'Collect Deposit' : 'Deposit History'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Box 4: Lifetime Value (Total Billed, Total Paid, Balance Due) */}
                                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3 text-slate-400" /> Lifetime Value
                                            </p>
                                            <div>
                                                <p className="text-base font-extrabold text-slate-900">
                                                    ₹{client.totalBilled.toLocaleString('en-IN')}
                                                </p>
                                                <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                                                    Paid: ₹{client.totalPaid.toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-1 border-t border-slate-200/60 text-[11px]">
                                                {client.balanceDue > 0 ? (
                                                    <span className="text-amber-700 font-bold">
                                                        Due: ₹{client.balanceDue.toLocaleString('en-IN')}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-700 font-bold">
                                                        Zero Outstanding
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Card Bottom Action Bar: View, Review, Restart, Archive */}
                                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Details Button */}
                                            <button
                                                type="button"
                                                onClick={() => setInspectingClient(client)}
                                                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-teal-600" />
                                                View File
                                            </button>

                                            {/* Star Review Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleRequestReview(client)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                                                    reviewSentIds.has(client.id)
                                                        ? 'text-slate-600 bg-slate-100 border border-slate-200'
                                                        : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                {reviewSentIds.has(client.id) ? 'Review Sent' : 'Review'}
                                            </button>

                                            {/* Restart Service Button if Closed Won */}
                                            {client.status === 'Closed Won' && (
                                                <button
                                                    type="button"
                                                    onClick={() => openRestartModal(client)}
                                                    className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Restart Service
                                                </button>
                                            )}
                                        </div>

                                        {/* Archive / Restore Button with Clear Label (Issue #4 resolved) */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFromPipeline(client)}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                                                client.status === 'Archived'
                                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                                    : 'text-slate-600 hover:text-red-600 bg-white hover:bg-red-50 border-slate-200 hover:border-red-200'
                                            }`}
                                            title={client.status === 'Archived' ? 'Restore client to active CRM pipeline' : 'Archive client from active roster'}
                                        >
                                            {client.status === 'Archived' ? (
                                                <>
                                                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Restore Client</span>
                                                </>
                                            ) : (
                                                <>
                                                    <UserMinus className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-500" />
                                                    <span>Archive Client</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Automation & Google Reviews Panel */}
                <div className={`flex flex-col ${viewMode === 'table' ? 'grid grid-cols-1 md:grid-cols-2' : ''} gap-6`}>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-slate-900">Client Automations</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Post-conversion feedback workflows.</p>
                            </div>
                            <button
                                onClick={() => setIsAutoReviewModalOpen(true)}
                                className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Configure automation delay, channels, language, and compliance rules"
                            >
                                <Settings className="w-3.5 h-3.5 text-teal-600" />
                                Settings
                            </button>
                        </div>
                        <div className="p-4 sm:p-5 space-y-4">
                            <div className={`p-4 rounded-xl border transition-colors ${workflows.reviewCollection ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Star className={`w-5 h-5 ${workflows.reviewCollection ? 'text-amber-600 fill-amber-500' : 'text-slate-400'}`} />
                                        <h3 className={`font-bold ${workflows.reviewCollection ? 'text-amber-900' : 'text-slate-600'}`}>Auto-Review Collection</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('reviewCollection')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.reviewCollection ? 'bg-amber-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.reviewCollection ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                    Automatically sends review requests {reviewConfig.delayDays} days after joining via WhatsApp/SMS in Gujarati &amp; Hindi.
                                </p>
                                <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800 font-semibold">
                                    <span>Rules: Skip complaints &amp; active trials</span>
                                    <button
                                        onClick={() => setIsAutoReviewModalOpen(true)}
                                        className="underline hover:text-amber-900 cursor-pointer"
                                    >
                                        Edit rules →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100">
                            <h2 className="font-bold text-slate-900">Client Automations</h2>
                            <p className="text-sm text-slate-500 mt-1">Post-conversion workflows.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className={`p-4 rounded-lg border transition-colors ${workflows.reviewCollection ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Star className={`w-5 h-5 ${workflows.reviewCollection ? 'text-amber-600' : 'text-slate-400'}`} />
                                        <h3 className={`font-semibold ${workflows.reviewCollection ? 'text-amber-700' : 'text-slate-600'}`}>Auto-Review Collection</h3>
                                    </div>
                                    <button
                                        onClick={() => toggleWorkflow('reviewCollection')}
                                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${workflows.reviewCollection ? 'bg-amber-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${workflows.reviewCollection ? 'right-0.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500">Automatically sends a feedback request to clients 14 days after joining, requesting a review.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                Google Reviews
                            </h3>
                            <a href={googleReviews?.googleMapsUri || GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-bold text-primary hover:underline">
                                View All →
                            </a>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                    <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 text-sm">{googleReviews?.displayName || '99 Care'} — Google Reviews</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {isLoadingGoogleReviews ? (
                                            <span className="text-xs text-slate-500">Loading live reviews...</span>
                                        ) : googleReviews?.success ? (
                                            <>
                                                <span className="text-sm font-bold text-slate-900">{Number(googleReviews.rating || 0).toFixed(1)}</span>
                                                <span className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Star
                                                            key={star}
                                                            className={`w-3.5 h-3.5 ${star <= Math.round(googleReviews.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
                                                        />
                                                    ))}
                                                </span>
                                                <span className="text-xs text-slate-500">{googleReviews.userRatingCount || 0} reviews</span>
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-500">Connect Google API key to show live reviews</span>
                                        )}
                                    </div>
                                </div>
                                <a href={googleReviews?.googleMapsUri || GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                                    Open
                                </a>
                            </div>

                            {googleReviews?.success && googleReviews.reviews?.length > 0 ? (
                                <div className="space-y-3">
                                    {googleReviews.reviews.slice(0, 3).map((review: any, index: number) => (
                                        <div key={`${review.publishTime || index}-${review.name}`} className="p-4 bg-white rounded-xl border border-slate-200">
                                            <div className="flex items-start gap-3">
                                                {review.photoUri ? (
                                                    <img src={review.photoUri} alt={review.name} className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                        {String(review.name || 'G').charAt(0)}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{review.name}</p>
                                                        <span className="text-[10px] text-slate-400 shrink-0">{review.relativePublishTimeDescription}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 mt-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`w-3 h-3 ${star <= Number(review.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                    {review.text && (
                                                        <p className="text-xs text-slate-600 leading-relaxed mt-2 line-clamp-3">"{review.text}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-400 text-center">
                                    {googleReviews?.error || 'Live Google reviews will appear here after the Google Places API key is configured.'}
                                </p>
                            )}
                        </div>
                        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs text-slate-500">Tap "View All" to see all Google reviews</p>
                            <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Leave a Review
                            </a>
                        </div>
                    </div>
                </div>
            </div>


            {/* Comprehensive Restart Service Modal */}
            {restartModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shadow-xs">
                                    <RotateCcw className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Restart Service Onboarding</h2>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                                        <span className="font-bold text-slate-800">{restartModal.name}</span>
                                        {restartModal.phone && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{restartModal.phone}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setRestartModal(null)} 
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body: Scrollable */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                            {/* 1. Service Selection & Shift Duration */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <Clock className="w-4 h-4 text-teal-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Service &amp; Shift Configuration</h3>
                                </div>

                                {/* Preset Service Buttons */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Service Category</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {['Old Age Care', 'New Born Baby Care', 'Japa Maid / Mother Care', 'Patient Care', 'Nursing Services'].map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setRestartServiceType(cat)}
                                                className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all ${
                                                    restartServiceType === cat
                                                        ? 'bg-teal-500 text-white border-teal-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={restartServiceType}
                                        onChange={e => setRestartServiceType(e.target.value)}
                                        placeholder="Or type custom service name..."
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8]"
                                    />
                                </div>

                                {/* Shift Hours & Start Date */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Shift Duration</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { h: 10, label: '10-Hour Shift' },
                                                { h: 24, label: '24-Hour Live-in' }
                                            ].map(s => (
                                                <button
                                                    key={s.h}
                                                    type="button"
                                                    onClick={() => setRestartShiftHours(s.h)}
                                                    className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all ${
                                                        restartShiftHours === s.h
                                                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Start Date *</label>
                                        <input
                                            type="date"
                                            value={restartStartDate}
                                            onChange={e => setRestartStartDate(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30 focus:border-[#1AA6A8]"
                                        />
                                    </div>
                                </div>

                                {/* Duration: Ongoing vs Fixed End Date */}
                                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-700">Duration Format</label>
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-xs font-bold text-teal-600 hover:opacity-80">
                                            <input
                                                type="checkbox"
                                                checked={restartIsOngoing}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setRestartIsOngoing(checked);
                                                    if (checked) setRestartEndDate('');
                                                }}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                            />
                                            <span>Ongoing (No End Date)</span>
                                        </label>
                                    </div>

                                    {restartIsOngoing ? (
                                        <div 
                                            onClick={() => setRestartIsOngoing(false)}
                                            className="w-full px-3 py-2 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 text-teal-800 text-xs font-semibold flex items-center justify-between cursor-pointer hover:bg-teal-50 transition-colors"
                                            title="Click to specify a custom end date"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                                Active ongoing service with automatic monthly billing cycles
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-teal-200 px-2 py-0.5 rounded text-teal-700">
                                                Ongoing
                                            </span>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-[11px] text-slate-500 font-semibold mb-1">Service End Date</label>
                                            <input
                                                type="date"
                                                value={restartEndDate}
                                                onChange={e => setRestartEndDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Service Quoting & Daily Rates */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <Wallet className="w-4 h-4 text-indigo-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Service Quoting &amp; Daily Rates</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-800">Complete Month Rate *</label>
                                            <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">≥ 30 Days</span>
                                        </div>
                                        <div className="relative mt-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartCompleteRate}
                                                onChange={e => setRestartCompleteRate(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 800"
                                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                            ≈ ₹{((Number(restartCompleteRate) || 0) * 30).toLocaleString('en-IN')}/month standard cycle
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/30">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-800">Partial Month Rate *</label>
                                            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">&lt; 30 Days</span>
                                        </div>
                                        <div className="relative mt-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartIncompleteRate}
                                                onChange={e => setRestartIncompleteRate(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 1500"
                                                className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                            Applied if care concludes before 30 days
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Security Deposit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">3. Security Deposit Collection</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Amount (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={restartDepositAmount}
                                                onChange={e => setRestartDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="e.g. 5000"
                                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Status</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setRestartDepositStatus('collected')}
                                                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                                                    restartDepositStatus === 'collected'
                                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                Already Collected
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRestartDepositStatus('pending')}
                                                className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                                                    restartDepositStatus === 'pending'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                Pending / Bill Later
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {restartDepositStatus === 'collected' && (
                                    <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-emerald-900 mb-1">Payment Method</label>
                                            <select
                                                value={restartDepositMethod}
                                                onChange={e => setRestartDepositMethod(e.target.value)}
                                                className="w-full px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold bg-white text-slate-800"
                                            >
                                                <option value="UPI">UPI / GPay / PhonePe</option>
                                                <option value="Cash">Cash</option>
                                                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                                                <option value="Cheque">Cheque</option>
                                            </select>
                                        </div>
                                        <div className="text-xs text-emerald-800 font-medium pt-4">
                                            ₹{(Number(restartDepositAmount) || 0).toLocaleString('en-IN')} will be recorded in deposit ledger
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Staff Member Assignment (Multi-Worker Support) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-purple-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">4. Assign Staff Member(s) *</h3>
                                    </div>
                                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                        {restartSelectedWorkers.length} selected • {restartWorkers.filter(w => w.status === 'available').length} available
                                    </span>
                                </div>

                                {/* Worker Search */}
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={restartWorkerSearch}
                                        onChange={e => setRestartWorkerSearch(e.target.value)}
                                        placeholder="Search available caregivers by name or role..."
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>

                                {/* Worker List */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {restartWorkers
                                        .filter(w => {
                                            if (!restartWorkerSearch.trim()) return true;
                                            const q = restartWorkerSearch.toLowerCase();
                                            return (w.full_name || '').toLowerCase().includes(q) || (w.job_title || '').toLowerCase().includes(q);
                                        })
                                        .map(w => {
                                            const isSelected = restartSelectedWorkers.some(sw => sw.id === w.id);
                                            const isAvail = w.status === 'available';
                                            const isAssignedElsewhere = !isAvail && !isSelected;
                                            return (
                                                <button
                                                    key={w.id}
                                                    type="button"
                                                    onClick={() => toggleRestartWorker(w)}
                                                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                                                        isSelected
                                                            ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-600/20 shadow-xs'
                                                            : isAssignedElsewhere
                                                                ? 'border-slate-200 bg-slate-50/60 opacity-60 hover:border-amber-300 hover:bg-amber-50/30'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                                        isSelected ? 'bg-purple-600 text-white' : isAssignedElsewhere ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {w.full_name?.charAt(0) || 'W'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-xs text-slate-900 truncate">{w.full_name}</p>
                                                            {isSelected ? (
                                                                 <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                                                            ) : isAssignedElsewhere ? (
                                                                <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Deployed</span>
                                                            ) : (
                                                                <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] text-slate-500 truncate">{w.job_title || 'Caregiver'}</span>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                                                isAvail ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {isAvail ? 'Available' : w.assigned_client ? `Deployed (${w.assigned_client})` : (w.status || 'Assigned')}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                            Pay: {restartShiftHours === 24 ? `24h: ₹${w.rate_24hr || '-'}/day` : `10h: ₹${w.rate_10hr || '-'}/day`}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>

                                {/* Selected Workers Panel */}
                                {restartSelectedWorkers.length > 0 && (
                                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-purple-900">
                                                Assigned Staff ({restartSelectedWorkers.length}):
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setRestartSelectedWorkers([])}
                                                className="text-[11px] text-purple-600 hover:text-red-500 font-semibold transition-colors"
                                            >
                                                Clear all
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {restartSelectedWorkers.map(w => {
                                                const dailyPay = restartShiftHours === 24
                                                    ? (w.rate_24hr || 0)
                                                    : (w.rate_10hr || 0);
                                                return (
                                                    <div key={w.id} className="p-2 bg-white rounded-lg border border-purple-200/80 flex items-center justify-between text-xs shadow-2xs">
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <p className="font-bold text-slate-900 truncate">{w.full_name}</p>
                                                            <p className="text-[10px] text-purple-700 font-semibold">
                                                                ₹{dailyPay.toLocaleString('en-IN')}/day <span className="text-slate-400 font-normal">({restartShiftHours}h rate)</span>
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleRestartWorker(w)}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors"
                                                            title="Remove worker"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 5. Additional Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Care Notes &amp; Special Instructions (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={restartNotes}
                                    onChange={e => setRestartNotes(e.target.value)}
                                    placeholder="Doctor guidelines, shift timings, patient conditions..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1AA6A8]/30"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-500">
                                {restartSelectedWorkers.length > 0 ? (
                                    <span>
                                        Staff: <strong className="text-slate-800">{restartSelectedWorkers.map(w => w.full_name).join(', ')}</strong> ({restartSelectedWorkers.length} assigned) • Rate: <strong className="text-slate-800">₹{restartCompleteRate}/day</strong>
                                    </span>
                                ) : (
                                    <span className="text-amber-600 font-medium">⚠️ Please select at least one staff member to proceed</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setRestartModal(null)}
                                    className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestartService}
                                    disabled={isRestartSubmitting || !restartStartDate || restartSelectedWorkers.length === 0 || !restartServiceType}
                                    className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isRestartSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Confirm &amp; Restart Service
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Remove from Pipeline Confirmation Modal */}
            {removeConfirmClient && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                                <UserMinus className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Remove from Pipeline?</h2>
                                <p className="text-xs text-slate-500">{removeConfirmClient.name} will stay in Client Master Database</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-slate-600">This will remove <strong>{removeConfirmClient.name}</strong> from the CRM pipeline. Their record, billing history, and all data will remain in the Client Master Database.</p>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setRemoveConfirmClient(null)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                <button onClick={confirmRemoveFromPipeline} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Remove</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmClient && user?.role === 'admin' && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Delete Permanently?</h2>
                                <p className="text-xs text-slate-500">{deleteConfirmClient.name} will be removed completely.</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-slate-600">This will permanently delete <strong>{deleteConfirmClient.name}</strong> from the entire database. This action cannot be undone.</p>
                            <div className="flex gap-3 pt-1 flex-col sm:flex-row">
                                <button onClick={() => setDeleteConfirmClient(null)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                                {deleteConfirmClient.status !== 'Trash' && (
                                    <button onClick={confirmTemporaryDelete} className="flex-1 py-2.5 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shadow-sm">Move to Trash</button>
                                )}
                                <button onClick={confirmDeleteClient} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Delete Forever</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Non-Admin Deletion Request Modal */}
            {requestDeleteClient && (
                <RequestDeletionModal
                    isOpen={Boolean(requestDeleteClient)}
                    onClose={() => setRequestDeleteClient(null)}
                    entityType="client"
                    entityId={requestDeleteClient.id}
                    entityName={requestDeleteClient.name || 'Client'}
                    defaultActionType={requestDeleteClient.status === 'Trash' ? 'permanent_delete' : 'move_to_trash'}
                />
            )}

            {/* Deposit Invoice & Payment Modal */}
            {depositModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 border border-slate-100">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                                    <Receipt className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Security Deposit Management</h2>
                                    <p className="text-xs text-slate-500">
                                        {depositModal.client.name} • {depositModal.client.phone || 'No Phone'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDepositModal(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                            {/* Summary Card */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Service</span>
                                    <p className="font-bold text-sm text-slate-800">{depositModal.serviceName}</p>
                                    <span className="text-xs text-slate-500">Start Date: {depositModal.startDate}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                        {depositModal.depositStatus === 'collected' ? 'Collected Deposit' : 'Pending Deposit'}
                                    </span>
                                    <p className={`text-xl font-extrabold ${depositModal.depositStatus === 'collected' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        ₹{depositModal.depositAmount.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>

                            {/* Service Cycles & Previous Deposit Breakdown */}
                            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <HistoryIcon className="w-3.5 h-3.5 text-primary" /> Service Cycles &amp; Deposit History
                                    </h3>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        {depositModal.allCycles?.length || 1} Cycle{(depositModal.allCycles?.length || 1) > 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {depositModal.allCycles && depositModal.allCycles.length > 0 ? (
                                        depositModal.allCycles.map((cycle: any, idx: number) => (
                                            <div
                                                key={cycle.id || idx}
                                                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                                    cycle.isCurrent
                                                        ? 'bg-white border-amber-200 shadow-2xs'
                                                        : 'bg-slate-100/70 border-slate-200 opacity-90'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800">
                                                            {cycle.serviceType}
                                                        </span>
                                                        {cycle.isCurrent ? (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                                                                Current Service
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-600 uppercase">
                                                                Previous Service (Ended)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        {cycle.startDate || 'Start'} {cycle.endDate ? `to ${cycle.endDate}` : 'to Ongoing'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-extrabold text-sm text-slate-900">
                                                        ₹{Number(cycle.depositAmount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${
                                                        cycle.isCurrent
                                                            ? (depositModal.depositStatus === 'collected' ? 'text-emerald-700' : 'text-amber-700')
                                                            : 'text-slate-500'
                                                    }`}>
                                                        {cycle.isCurrent
                                                            ? (depositModal.depositStatus === 'collected' ? '✓ Paid' : '⏳ Pending')
                                                            : '✓ Settled on End'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">{depositModal.serviceName}</span>
                                            <span className="font-extrabold text-slate-900">₹{depositModal.depositAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                </div>

                                {depositModal.pastDepositTotal > 0 && (
                                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Previous Service Deposit (Settled):</span>
                                        <span className="font-bold text-slate-700">₹{depositModal.pastDepositTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Section 1: Share Deposit Invoice */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                                    <Send className="w-4 h-4 text-emerald-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">1. Share Deposit Invoice</h3>
                                </div>

                                <p className="text-xs text-slate-500">
                                    Send payment request directly to the client via WhatsApp, or generate an official PDF invoice.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleShareDepositWhatsApp(
                                            depositModal.client,
                                            depositModal.depositAmount,
                                            depositModal.serviceName,
                                            depositModal.startDate,
                                            generatedInvoiceUrl || undefined
                                        )}
                                        className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                                    >
                                        <MessageSquare className="w-4 h-4" /> Send on WhatsApp
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleGenerateDepositPdf}
                                        disabled={isGeneratingPdf}
                                        className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {isGeneratingPdf ? (
                                            <RotateCcw className="w-4 h-4 animate-spin text-slate-500" />
                                        ) : (
                                            <Download className="w-4 h-4 text-slate-600" />
                                        )}
                                        {generatedInvoiceUrl ? 'Regenerate PDF' : 'Generate PDF Invoice'}
                                    </button>
                                </div>

                                {generatedInvoiceUrl && (
                                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span className="font-semibold text-emerald-900 truncate">Invoice PDF Ready</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedInvoiceUrl);
                                                    setCopiedInvoiceLink(true);
                                                    setTimeout(() => setCopiedInvoiceLink(false), 2000);
                                                }}
                                                className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                                            >
                                                {copiedInvoiceLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                {copiedInvoiceLink ? 'Copied' : 'Copy Link'}
                                            </button>
                                            <a
                                                href={generatedInvoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2.5 py-1 bg-emerald-600 rounded-lg text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" /> View
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Record Payment Received (Only if pending / not yet collected) */}
                            {depositModal.depositStatus === 'collected' ? (
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                                                    Security Deposit Already Collected
                                                </h4>
                                                <p className="text-xs text-emerald-700 mt-0.5">
                                                    ₹{depositModal.depositAmount.toLocaleString('en-IN')} has been collected and is securely held in reserve for {depositModal.serviceName}.
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase shrink-0">
                                            ✓ In Reserve
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                                        <Wallet className="w-4 h-4 text-blue-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">2. Record Payment Received</h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                                                <span>Amount Received (₹) *</span>
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-200 uppercase">
                                                    Fixed Deposit
                                                </span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    disabled
                                                    value={`₹${depositModal.depositAmount.toLocaleString('en-IN')}`}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-100/80 cursor-not-allowed focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                                            <select
                                                value={depositPaymentMethod}
                                                onChange={e => {
                                                    const m = e.target.value;
                                                    setDepositPaymentMethod(m);
                                                    setDepositPaymentRef(generateDepositRef(m));
                                                }}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            >
                                                <option value="UPI">UPI / GPay / PhonePe</option>
                                                <option value="Cash">Cash</option>
                                                <option value="Bank Transfer">Bank Transfer (IMPS / NEFT)</option>
                                                <option value="Cheque">Cheque</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Received Date *</label>
                                            <div className="relative">
                                                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={depositPaymentDate}
                                                    onChange={e => setDepositPaymentDate(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-semibold text-slate-600">
                                                    Transaction Reference ID (Auto-Generated)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setDepositPaymentRef(generateDepositRef(depositPaymentMethod))}
                                                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                                                    title="Generate new reference code"
                                                >
                                                    <RefreshCw className="w-2.5 h-2.5" /> Re-roll ID
                                                </button>
                                            </div>
                                            <div className="relative flex items-center">
                                                <input
                                                    type="text"
                                                    value={depositPaymentRef}
                                                    onChange={e => setDepositPaymentRef(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(depositPaymentRef);
                                                        toast.success('Reference ID copied');
                                                    }}
                                                    className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors cursor-pointer"
                                                    title="Copy Reference ID"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Automatically linked to Payment Ledger, CRM Activity, and Client Billing history.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setDepositModal(null)}
                                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>

                            {depositModal.depositStatus !== 'collected' && (
                                <button
                                    type="button"
                                    onClick={handleRecordDepositPayment}
                                    disabled={isRecordingPayment || !depositPaymentAmount || Number(depositPaymentAmount) <= 0}
                                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {isRecordingPayment ? <RotateCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Confirm Payment Received
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Floating Bulk Action Toolbar */}
            {selectedClientIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-teal-500 text-slate-900 font-bold text-xs flex items-center justify-center">
                            {selectedClientIds.size}
                        </span>
                        <span className="text-sm font-semibold whitespace-nowrap">Clients Selected</span>
                    </div>
                    <div className="h-4 w-px bg-slate-700 hidden sm:block" />
                    <button
                        onClick={() => {
                            const selectedList = clients.filter(c => selectedClientIds.has(c.id));
                            exportToCSV(selectedList);
                        }}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-xs"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Selected (CSV)
                    </button>
                    <button
                        onClick={() => {
                            const selectedList = clients.filter(c => selectedClientIds.has(c.id));
                            const phones = selectedList.map(c => c.phone).filter(Boolean);
                            navigator.clipboard.writeText(phones.join(', '));
                            toast.success(`Copied ${phones.length} phone numbers for bulk broadcast!`);
                        }}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        Copy Broadcast Phones
                    </button>
                    <button
                        onClick={() => setSelectedClientIds(new Set())}
                        className="text-slate-400 hover:text-white text-xs font-medium underline transition-colors cursor-pointer whitespace-nowrap ml-1"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Configurable Auto-Review Collection Settings Modal */}
            {isAutoReviewModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center shadow-xs">
                                    <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Auto-Review Collection Rules</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Automated post-onboarding feedback &amp; Google review automation</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsAutoReviewModalOpen(false)} 
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
                            {/* 1. Delay Configuration */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    1. Trigger Delay
                                </label>
                                <p className="text-slate-500 mb-2">When should the review feedback request be sent to the family?</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[7, 14, 21, 30].map(days => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => setReviewConfig(prev => ({ ...prev, delayDays: days }))}
                                            className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                reviewConfig.delayDays === days
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {days} Days {days === 14 ? '(Default)' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Communication Channels */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    2. Communication Channels
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, desc: 'High open rate' },
                                        { key: 'sms', label: 'SMS Text', icon: Phone, desc: 'Direct message' },
                                        { key: 'email', label: 'Email', icon: Send, desc: 'Detailed format' },
                                    ].map(ch => {
                                        const isChecked = (reviewConfig.channels as any)[ch.key];
                                        return (
                                            <div
                                                key={ch.key}
                                                onClick={() => setReviewConfig(prev => ({
                                                    ...prev,
                                                    channels: { ...prev.channels, [ch.key]: !isChecked }
                                                }))}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isChecked ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900">{ch.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400 pointer-events-none"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1">{ch.desc}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Primary Language */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    3. Language Preference
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
                                        { code: 'hi', label: 'Hindi (हिंदी)' },
                                        { code: 'en', label: 'English' }
                                    ].map(lang => (
                                        <button
                                            key={lang.code}
                                            type="button"
                                            onClick={() => setReviewConfig(prev => ({ ...prev, language: lang.code as any }))}
                                            className={`py-2 px-3 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                reviewConfig.language === lang.code
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Compliance & Operational Rules Checklist */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    4. Exclusion &amp; Compliance Rules
                                </label>
                                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={reviewConfig.skipOpenComplaints}
                                            onChange={e => setReviewConfig(prev => ({ ...prev, skipOpenComplaints: e.target.checked }))}
                                            className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-900">Skip clients with open complaints</span>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Prevents sending automated review invitations if staff replacement or service complaint is currently unresolved.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60">
                                        <input
                                            type="checkbox"
                                            checked={reviewConfig.skipTrial}
                                            onChange={e => setReviewConfig(prev => ({ ...prev, skipTrial: e.target.checked }))}
                                            className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-900">Skip clients on active trial</span>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Only trigger once client converts into permanent regular monthly billing.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60">
                                        <input
                                            type="checkbox"
                                            checked={reviewConfig.targetFamilyContact}
                                            onChange={e => setReviewConfig(prev => ({ ...prev, targetFamilyContact: e.target.checked }))}
                                            className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-900">Address elderly patient requests to Family Contact</span>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Addresses message to the daughter, son, or guardian contact person instead of elderly bedridden patients.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60">
                                        <input
                                            type="checkbox"
                                            checked={reviewConfig.twoStepSurvey}
                                            onChange={e => setReviewConfig(prev => ({ ...prev, twoStepSurvey: e.target.checked }))}
                                            className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="font-bold text-slate-900">Google Policy Compliant Flow (Private Check + Open Public Link)</span>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Conducts private 1-5 satisfaction check first, while keeping the Google Review link accessible to 100% of respondents to comply with Google review solicitation guidelines.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* 5. Live Message Template Preview */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    5. Template Message Preview
                                </label>
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-slate-800 space-y-1 font-mono text-[11px]">
                                    {reviewConfig.language === 'gu' && (
                                        <p>
                                            "નમસ્તે [પરિવારજન] જી! 🙏<br />
                                            99 Care ની સેવાઓ સાથે આપનો અનુભવ કેવો રહ્યો? આપનો અભિપ્રાય અમારા માટે ખૂબ જ કિંમતી છે.<br />
                                            કૃપા કરીને Google પર આપનો પ્રતિભાવ આપો: {GOOGLE_REVIEW_URL}"
                                        </p>
                                    )}
                                    {reviewConfig.language === 'hi' && (
                                        <p>
                                            "नमस्ते [Family Contact] जी! 🙏<br />
                                            99 Care की सेवाओं के साथ आपका अनुभव कैसा रहा? आपका रिव्यू हमारे लिए बहुत महत्वपूर्ण है।<br />
                                            कृपया Google पर अपना फीडबैक शेयर करें: {GOOGLE_REVIEW_URL}"
                                        </p>
                                    )}
                                    {reviewConfig.language === 'en' && (
                                        <p>
                                            "Namaste [Family Contact] ji! 🙏<br />
                                            How was your care experience with 99 Care? Your feedback helps other families find reliable healthcare support: {GOOGLE_REVIEW_URL}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsAutoReviewModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAutoReviewModalOpen(false);
                                    toast.success('Auto-review collection rules updated successfully! ⭐');
                                }}
                                className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Save Rules &amp; Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
