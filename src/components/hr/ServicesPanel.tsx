/**
 * ServicesPanel — UI for managing the service lifecycle.
 *
 * Features:
 * - View all active / ended services
 * - Assign workers to a service
 * - Release workers from a service
 * - End a service (auto-releases workers + deposit settlement)
 * - Trigger monthly billing batch
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Briefcase, Users, Calendar, IndianRupee, UserMinus,
    XCircle, Play, Loader2, ChevronDown, ChevronRight, RefreshCw,
    AlertTriangle, CheckCircle2, Clock, Search, Plus, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import {
    getActiveServices, getAllServices,
    releaseWorker, endService, generateMonthlyBilling,
    type ServiceWithDetails, type EndServiceResult,
} from '../../services/serviceLifecycle';

// ── Helpers ─────────────────────────────────────────────────

function statusBadge(status: string) {
    const map: Record<string, { label: string; className: string }> = {
        active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ended: { label: 'Ended', className: 'bg-slate-100 text-slate-500 border-slate-200' },
    };
    const { label, className } = map[status] ?? map.active;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            {label}
        </span>
    );
}

function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
}

// ── Component ───────────────────────────────────────────────

interface ServicesPanelProps {
    isEmbedded?: boolean;
    onOpenManualInvoice?: () => void;
    onPrepareInvoice?: (service: ServiceWithDetails) => void;
    onRecordCollection?: (service: ServiceWithDetails, bill?: any) => void;
}

export default function ServicesPanel({ 
    isEmbedded = false, 
    onOpenManualInvoice,
    onPrepareInvoice,
    onRecordCollection,
}: ServicesPanelProps) {
    const [services, setServices] = useState<ServiceWithDetails[]>([]);
    const [paidClients, setPaidClients] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [expandedService, setExpandedService] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('active');
    const [releasingId, setReleasingId] = useState<string | null>(null);
    const [endingServiceId, setEndingServiceId] = useState<string | null>(null);
    const [showEndConfirm, setShowEndConfirm] = useState<string | null>(null);
    const [endResult, setEndResult] = useState<EndServiceResult | null>(null);
    const [isBillingRunning, setIsBillingRunning] = useState(false);

    const fetchServices = useCallback(async () => {
        setIsLoading(true);
        try {
            const [servicesData, paymentsRes] = await Promise.all([
                statusFilter === 'all'
                    ? getAllServices()
                    : statusFilter === 'active'
                        ? getActiveServices()
                        : (await getAllServices()).filter(s => s.status === 'ended'),
                supabase.from('payments').select('client_name').eq('payment_type', 'service'),
            ]);

            setServices(servicesData);
            const paid = new Set((paymentsRes.data || []).map((p: any) => (p.client_name || '').trim().toLowerCase()));
            setPaidClients(paid);
        } catch (err: any) {
            toast.error(err.message || 'Failed to load services');
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchServices(); }, [fetchServices]);

    const filtered = services.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        const clientName = s.clients?.client_name?.toLowerCase() || '';
        return clientName.includes(q) || s.service_type?.toLowerCase().includes(q);
    });

    // ── Actions ─────────────────────────────────────────────

    const handleReleaseWorker = async (assignmentId: string) => {
        setReleasingId(assignmentId);
        try {
            const result = await releaseWorker(assignmentId);
            if (result.success) {
                toast.success(`Worker released. ${result.days_counted || 0} days counted for final payslip.`);
                fetchServices();
            } else {
                toast.error(result.error || 'Failed to release worker');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setReleasingId(null);
        }
    };

    const handleEndService = async (serviceId: string) => {
        setEndingServiceId(serviceId);
        setShowEndConfirm(null);
        try {
            const result = await endService(serviceId);
            if (result.success) {
                setEndResult(result);
                toast.success('Service ended successfully. See settlement details.');
                fetchServices();
            } else {
                toast.error(result.error || 'Failed to end service');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setEndingServiceId(null);
        }
    };

    const handleMonthlyBilling = async () => {
        setIsBillingRunning(true);
        try {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            const result = await generateMonthlyBilling(monthStart, monthEnd);
            if (result.success) {
                toast.success(`Monthly billing complete: ${result.bills_created} bills, ${result.payslips_created} payslips generated.`);
                fetchServices();
            } else {
                toast.error(result.error || 'Billing failed');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsBillingRunning(false);
        }
    };

    // ── Render ───────────────────────────────────────────────

    return (
        <div className={isEmbedded ? 'flex flex-col h-full' : 'p-6 space-y-6'}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                        <Briefcase className="w-5 h-5 text-[#1AA6A8]" /> Service Lifecycle Manager
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {services.filter(s => s.status === 'active').length} active service(s)
                    </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search client..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#1AA6A8] w-44"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#1AA6A8]"
                    >
                        <option value="active">Active</option>
                        <option value="ended">Ended</option>
                        <option value="all">All</option>
                    </select>
                    {onOpenManualInvoice && (
                        <button
                            onClick={onOpenManualInvoice}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <FileText className="w-4 h-4" /> Manual Invoice
                        </button>
                    )}
                    <button
                        onClick={handleMonthlyBilling}
                        disabled={isBillingRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#1AA6A8] text-white rounded-lg hover:bg-[#148B8D] disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isBillingRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
                        Run Monthly Billing
                    </button>
                    <button
                        onClick={fetchServices}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Service List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No services found</p>
                        <p className="text-sm">Services are created when a worker is assigned to a client.</p>
                    </div>
                ) : (
                    filtered.map(service => {
                        const isExpanded = expandedService === service.id;
                        const activeWorkers = (service.service_worker_assignments || []).filter(a => !a.end_date);
                        const allWorkers = service.service_worker_assignments || [];
                        
                        const startDate = service.start_date ? new Date(service.start_date + 'T00:00:00') : null;
                        const endDate = service.end_date ? new Date(service.end_date + 'T00:00:00') : null;
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        const isUpcoming = startDate ? startDate.getTime() > today.getTime() : false;
                        const isOngoing = !service.end_date;

                        let durationBadgeText = 'Ongoing';
                        let durationTitle = 'Ongoing';
                        let durationRateNote = 'Full month rate applies';

                        if (isUpcoming && startDate) {
                            const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            durationBadgeText = `Starts in ${diffDays}d`;
                            durationTitle = `Starts ${format(startDate, 'dd MMM')}`;
                            durationRateNote = isOngoing ? 'Open-ended (Full month rate)' : 'Scheduled service';
                        } else if (isOngoing && startDate) {
                            const daysActive = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                            durationBadgeText = `${daysActive} days (Ongoing)`;
                            durationTitle = `${daysActive} days`;
                            durationRateNote = 'Open-ended (Full month rate)';
                        } else if (startDate && endDate) {
                            const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                            durationBadgeText = `${totalDays} days`;
                            durationTitle = `${totalDays} days`;
                            durationRateNote = totalDays >= 30 ? 'Full month rate applies' : 'Short-term rate applies';
                        }

                        return (
                            <div key={service.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Service Header */}
                                <button
                                    onClick={() => setExpandedService(isExpanded ? null : service.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1AA6A8] to-[#148B8D] flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {(service.clients?.client_name || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-slate-900 text-sm truncate">
                                                    {service.clients?.client_name || 'Unknown Client'}
                                                </p>
                                                {statusBadge(service.status)}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {service.start_date ? format(new Date(service.start_date + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {activeWorkers.length} worker{activeWorkers.length !== 1 ? 's' : ''}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {durationBadgeText}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {/* Financial Action Buttons */}
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            {onPrepareInvoice && service.status === 'active' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPrepareInvoice(service);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-colors"
                                                >
                                                    <FileText className="w-3.5 h-3.5 text-emerald-600" /> Prepare Invoice
                                                </button>
                                            )}
                                        </div>

                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-500">Rates</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {formatCurrency(service.complete_month_daily_rate)}/day
                                            </p>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-500">Deposit</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {formatCurrency(service.deposit_amount)}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-4 space-y-4">
                                        {/* Rate Summary */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Month Rate</p>
                                                <p className="text-lg font-black text-slate-800 mt-0.5">{formatCurrency(service.complete_month_daily_rate)}<span className="text-xs font-normal text-slate-400">/day</span></p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Short-Term Rate</p>
                                                <p className="text-lg font-black text-slate-800 mt-0.5">{formatCurrency(service.incomplete_month_daily_rate)}<span className="text-xs font-normal text-slate-400">/day</span></p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deposit</p>
                                                <p className="text-lg font-black text-slate-800 mt-0.5">{formatCurrency(service.deposit_amount)}</p>
                                                <p className="text-[10px] text-slate-400 capitalize">{service.deposit_status}</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</p>
                                                <p className="text-lg font-black text-slate-800 mt-0.5">{durationTitle}</p>
                                                <p className="text-[10px] text-slate-400">{durationRateNote}</p>
                                            </div>
                                        </div>

                                        {/* Workers Table */}
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                                Worker Assignments ({allWorkers.length})
                                            </h3>
                                            {allWorkers.length === 0 ? (
                                                <p className="text-sm text-slate-400 py-3">No workers assigned yet.</p>
                                            ) : (
                                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                                                <th className="text-left px-3 py-2">Worker</th>
                                                                <th className="text-left px-3 py-2">Start</th>
                                                                <th className="text-left px-3 py-2">End</th>
                                                                <th className="text-left px-3 py-2">Status</th>
                                                                <th className="text-right px-3 py-2">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {allWorkers.map(asgn => (
                                                                <tr key={asgn.id} className="hover:bg-slate-50">
                                                                    <td className="px-3 py-2.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-7 h-7 rounded-full bg-[#1AA6A8]/10 flex items-center justify-center text-[#1AA6A8] font-bold text-[10px]">
                                                                                {(asgn.employees?.full_name || '?')[0]}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-semibold text-slate-800 text-xs">{asgn.employees?.full_name || 'Unknown'}</p>
                                                                                <p className="text-[10px] text-slate-400">{asgn.employees?.job_title || ''}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-xs text-slate-600">
                                                                        {asgn.start_date ? format(new Date(asgn.start_date), 'dd MMM yyyy') : '—'}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-xs text-slate-600">
                                                                        {asgn.end_date ? format(new Date(asgn.end_date), 'dd MMM yyyy') : <span className="text-emerald-500 font-semibold">Ongoing</span>}
                                                                    </td>
                                                                    <td className="px-3 py-2.5">
                                                                        {asgn.end_date ? (
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Released</span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Active</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right">
                                                                        {!asgn.end_date && service.status === 'active' && (
                                                                            <button
                                                                                onClick={() => handleReleaseWorker(asgn.id)}
                                                                                disabled={releasingId === asgn.id}
                                                                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                                                                            >
                                                                                {releasingId === asgn.id
                                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                                    : <UserMinus className="w-3 h-3" />}
                                                                                Release
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Monthly Invoices & Billing History */}
                                            {(() => {
                                                const bills = service.service_bills || [];
                                                const sortedBills = [...bills].sort((a, b) => new Date(b.created_at || b.period_start).getTime() - new Date(a.created_at || a.period_start).getTime());

                                                return (
                                                    <div className="mt-5 pt-4 border-t border-slate-100">
                                                        <div className="flex items-center justify-between mb-2.5">
                                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                                <FileText className="w-3.5 h-3.5 text-[#1AA6A8]" /> Monthly Invoices & Billing Ledger ({sortedBills.length})
                                                            </h4>
                                                            {sortedBills.length > 0 && (
                                                                <span className="text-xs text-slate-500 font-semibold">
                                                                    Total Billed: {formatCurrency(sortedBills.reduce((sum, b) => sum + (b.amount || 0), 0))}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {sortedBills.length === 0 ? (
                                                            <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                                                                No monthly invoices recorded yet. Click <strong className="text-slate-600">"Prepare Invoice"</strong> above to generate and log the first billing cycle.
                                                            </div>
                                                        ) : (
                                                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                                                                <table className="w-full text-left text-xs">
                                                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                        <tr>
                                                                            <th className="px-3 py-2.5">Billing Period</th>
                                                                            <th className="px-3 py-2.5">Days</th>
                                                                            <th className="px-3 py-2.5">Daily Rate</th>
                                                                            <th className="px-3 py-2.5">Amount</th>
                                                                            <th className="px-3 py-2.5">Status</th>
                                                                            <th className="px-3 py-2.5 text-right">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {sortedBills.map((bill, bIdx) => {
                                                                            let noteData: any = {};
                                                                            try {
                                                                                noteData = bill.notes ? JSON.parse(bill.notes) : {};
                                                                            } catch {
                                                                                noteData = {};
                                                                            }
                                                                            const isPaid = noteData.status === 'paid' || paidClients.has((service.clients?.client_name || '').trim().toLowerCase());
                                                                            const pdfUrl = noteData.invoice_pdf_url;
                                                                            const invNo = noteData.invoice_number || (bill.type === 'final' ? 'FINAL-SETTLEMENT' : `INV-M${bIdx + 1}`);

                                                                            return (
                                                                                <tr key={bill.id || bIdx} className="hover:bg-slate-50/60 transition-colors">
                                                                                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                                                                                        <div className="flex flex-col">
                                                                                            <span>
                                                                                                {bill.period_start ? format(new Date(bill.period_start), 'dd MMM yyyy') : '—'} To {bill.period_end ? format(new Date(bill.period_end), 'dd MMM yyyy') : '—'}
                                                                                            </span>
                                                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                                                {invNo} {bill.type === 'final' && '• Final Settlement'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-3 py-2.5 text-slate-600 font-medium">
                                                                                        {bill.total_days} day{bill.total_days !== 1 ? 's' : ''}
                                                                                    </td>
                                                                                    <td className="px-3 py-2.5 text-slate-600 font-medium">
                                                                                        {formatCurrency(bill.daily_rate_used || 0)}/day
                                                                                    </td>
                                                                                    <td className="px-3 py-2.5 font-bold text-slate-900">
                                                                                        {formatCurrency(bill.amount || 0)}
                                                                                    </td>
                                                                                    <td className="px-3 py-2.5">
                                                                                        {isPaid ? (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                                                <Clock className="w-3 h-3 text-amber-600" /> Pending Collection
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                                                                                        {pdfUrl && (
                                                                                            <a
                                                                                                href={pdfUrl}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1AA6A8] hover:text-[#148B8D] hover:underline px-2 py-1"
                                                                                            >
                                                                                                <FileText className="w-3 h-3" /> View PDF
                                                                                            </a>
                                                                                        )}
                                                                                        {!isPaid && onRecordCollection && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    onRecordCollection(service, bill);
                                                                                                }}
                                                                                                className="inline-flex items-center gap-1 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-2.5 py-1 rounded-md transition-colors shadow-2xs"
                                                                                            >
                                                                                                <IndianRupee className="w-3 h-3" /> Record Collection
                                                                                            </button>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Lifecycle Action Footer */}
                                        {service.status === 'active' && (
                                            <div className="border-t border-slate-100 pt-3 flex items-center justify-end bg-slate-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                                                {showEndConfirm === service.id ? (
                                                    <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                                        <p className="text-xs text-red-700">
                                                            Release all {activeWorkers.length} worker(s) & settle deposit?
                                                        </p>
                                                        <button
                                                            onClick={() => handleEndService(service.id)}
                                                            disabled={endingServiceId === service.id}
                                                            className="px-2.5 py-1 text-xs font-bold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            {endingServiceId === service.id
                                                                ? <Loader2 className="w-3 h-3 animate-spin inline" />
                                                                : 'Confirm End'}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowEndConfirm(null)}
                                                            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowEndConfirm(service.id)}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-2xs"
                                                    >
                                                        <XCircle className="w-4 h-4 text-red-500" /> End Service & Settle
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* End Service Settlement Result Modal */}
            {endResult && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEndResult(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            <h3 className="text-lg font-bold text-slate-900">Service Ended — Settlement Summary</h3>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">Total Days</span>
                                <span className="font-bold">{endResult.total_lifetime_days}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">Rate Used</span>
                                <span className="font-bold">{formatCurrency(endResult.rate_used || 0)}/day</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">True Cost</span>
                                <span className="font-bold">{formatCurrency(endResult.true_cost || 0)}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">Previously Billed</span>
                                <span className="font-bold">{formatCurrency(endResult.previously_billed || 0)}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">Deposit</span>
                                <span className="font-bold">{formatCurrency(endResult.deposit || 0)}</span>
                            </div>
                            <div className={`flex justify-between p-3 rounded-lg border-2 ${
                                (endResult.settlement || 0) > 0
                                    ? 'bg-amber-50 border-amber-300'
                                    : (endResult.settlement || 0) < 0
                                        ? 'bg-emerald-50 border-emerald-300'
                                        : 'bg-slate-50 border-slate-300'
                            }`}>
                                <span className="font-bold text-slate-700">
                                    {(endResult.settlement || 0) > 0 ? 'Client Owes' : (endResult.settlement || 0) < 0 ? 'Refund to Client' : 'Settled'}
                                </span>
                                <span className="font-black text-lg">
                                    {formatCurrency(Math.abs(endResult.settlement || 0))}
                                </span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                                <span className="text-slate-500">Workers Released</span>
                                <span className="font-bold">{endResult.workers_released}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setEndResult(null)}
                            className="w-full py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
