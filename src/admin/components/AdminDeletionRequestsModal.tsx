import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Check, Ban, Loader2, Clock, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
    fetchPendingDeletionRequests,
    fetchAllDeletionRequests,
    approveDeletionRequest,
    rejectDeletionRequest,
    type DeletionRequest
} from '../../services/deletionService';

interface AdminDeletionRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onActionCompleted?: () => void;
}

export const AdminDeletionRequestsModal: React.FC<AdminDeletionRequestsModalProps> = ({
    isOpen,
    onClose,
    onActionCompleted,
}) => {
    const { user } = useAuth();
    const [activeFilter, setActiveFilter] = useState<'pending' | 'all'>('pending');
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const data = activeFilter === 'pending'
                ? await fetchPendingDeletionRequests()
                : await fetchAllDeletionRequests();
            setRequests(data);
        } catch (err: any) {
            console.error('Failed to load deletion requests:', err);
            toast.error('Failed to load deletion requests.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadRequests();
        }
    }, [isOpen, activeFilter]);

    if (!isOpen) return null;

    const handleApprove = async (req: DeletionRequest) => {
        const confirmMsg = req.action_type === 'permanent_delete'
            ? `Permanently delete "${req.entity_name}" (${req.entity_type})? This CANNOT be undone.`
            : `Approve moving "${req.entity_name}" to trash?`;

        if (!window.confirm(confirmMsg)) return;

        setProcessingId(req.id);
        const toastId = toast.loading(`Executing deletion for "${req.entity_name}"...`);
        try {
            await approveDeletionRequest(req, user?.name || user?.username || 'System Admin');
            toast.success(`Request approved. "${req.entity_name}" deleted successfully.`, { id: toastId });
            setRequests(prev => prev.filter(r => r.id !== req.id));
            onActionCompleted?.();
        } catch (err: any) {
            console.error('Error approving deletion request:', err);
            toast.error(`Approval Failed: ${err.message}`, { id: toastId });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await rejectDeletionRequest(requestId, rejectReason, user?.name || user?.username || 'System Admin');
            toast.success('Deletion request rejected.');
            setRejectingId(null);
            setRejectReason('');
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onActionCompleted?.();
        } catch (err: any) {
            console.error('Error rejecting deletion request:', err);
            toast.error(`Failed to reject request: ${err.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
            if (diffMin < 1) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHours = Math.floor(diffMin / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/70 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                Deletion Approval Center
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-200/70 text-amber-900">
                                    Admin Only
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500">Review and authorize deletion requests submitted by staff</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50 text-xs shrink-0">
                    <button
                        onClick={() => setActiveFilter('pending')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                            activeFilter === 'pending'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        Pending Requests
                    </button>
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                            activeFilter === 'all'
                                ? 'bg-slate-800 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        All History
                    </button>
                    <button
                        onClick={loadRequests}
                        disabled={isLoading}
                        className="ml-auto text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                    >
                        Refresh
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                            <p className="text-xs font-medium">Loading requests...</p>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
                            <h4 className="font-bold text-slate-700 text-sm">All clear!</h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {activeFilter === 'pending'
                                    ? 'No pending deletion requests require approval.'
                                    : 'No deletion request history found.'}
                            </p>
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div
                                key={req.id}
                                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-900 text-sm">{req.entity_name}</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase tracking-wide border border-slate-200">
                                                {req.entity_type}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                                    req.action_type === 'permanent_delete'
                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}
                                            >
                                                {req.action_type === 'permanent_delete' ? 'Permanent Delete' : 'Move to Trash'}
                                            </span>
                                            {req.status !== 'pending' && (
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                        req.status === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {req.status.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                            <span>Requested by: <strong className="text-slate-700">{req.requested_by_name}</strong></span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(req.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reason Box */}
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
                                    <span className="font-semibold text-slate-700">Reason: </span>
                                    {req.reason ? req.reason : <span className="italic text-slate-400">No reason provided</span>}
                                </div>

                                {/* Review details if already reviewed */}
                                {req.reviewed_by && (
                                    <div className="text-[11px] text-slate-500 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                                        <span>Reviewed by <strong className="text-slate-700">{req.reviewed_by}</strong> on {req.reviewed_at ? formatTime(req.reviewed_at) : ''}</span>
                                        {req.review_note && <p className="mt-0.5 text-slate-600 italic">Note: {req.review_note}</p>}
                                    </div>
                                )}

                                {/* Inline Reject Reason Input */}
                                {rejectingId === req.id && (
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <input
                                            type="text"
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="Optional reason for rejection..."
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setRejectingId(null)}
                                                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReject(req.id)}
                                                disabled={processingId === req.id}
                                                className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-2xs"
                                            >
                                                Confirm Rejection
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Admin Action Buttons (only for pending) */}
                                {req.status === 'pending' && rejectingId !== req.id && (
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setRejectingId(req.id)}
                                            disabled={processingId === req.id}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5"
                                        >
                                            <Ban className="w-3.5 h-3.5 text-red-500" />
                                            Reject
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(req)}
                                            disabled={processingId === req.id}
                                            className={`px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 ${
                                                req.action_type === 'permanent_delete'
                                                    ? 'bg-red-600 hover:bg-red-700'
                                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                            }`}
                                        >
                                            {processingId === req.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Check className="w-3.5 h-3.5" />
                                            )}
                                            Approve & Execute
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
                    <span>
                        Pending requests are visible to all System Administrators.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-100"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDeletionRequestsModal;
