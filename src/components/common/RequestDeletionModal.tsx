import React, { useState } from 'react';
import { ShieldAlert, X, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { submitDeletionRequest, type DeletionEntityType, type DeletionActionType } from '../../services/deletionService';

interface RequestDeletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    entityType: DeletionEntityType;
    entityId: string;
    entityName: string;
    defaultActionType?: DeletionActionType;
    metadata?: Record<string, any>;
}

export const RequestDeletionModal: React.FC<RequestDeletionModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    entityType,
    entityId,
    entityName,
    defaultActionType = 'move_to_trash',
    metadata = {},
}) => {
    const { user } = useAuth();
    const [actionType, setActionType] = useState<DeletionActionType>(defaultActionType);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error('You must be signed in to submit a deletion request.');
            return;
        }

        setIsSubmitting(true);
        try {
            await submitDeletionRequest({
                entityType,
                entityId,
                entityName,
                actionType,
                reason,
                requestedById: user.id || user.username,
                requestedByName: user.name || user.username,
                metadata,
            });

            toast.success(`Deletion request for ${entityName} submitted to System Admin.`, {
                description: 'The record will remain in place until the Admin reviews and approves it.',
                duration: 5000,
            });

            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('Failed to submit deletion request:', err);
            toast.error(err.message || 'Failed to submit request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Request Deletion from Admin</h3>
                            <p className="text-[11px] text-slate-500">Admin approval required to delete records</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Notice */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                        <p>
                            Only <strong>System Admin</strong> accounts can directly delete data from the OS.
                        </p>
                        <p className="text-slate-500 text-[11px]">
                            Submit this request to send an approval notification to the System Admin.
                        </p>
                    </div>

                    {/* Target Item Card */}
                    <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/60 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                                Target {entityLabel}
                            </span>
                            <p className="text-sm font-bold text-slate-900 mt-0.5">{entityName}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-800">
                            {entityLabel}
                        </span>
                    </div>

                    {/* Action Type Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Requested Action
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setActionType('move_to_trash')}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center ${
                                    actionType === 'move_to_trash'
                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-2xs ring-2 ring-amber-200/50'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Move to Trash
                            </button>
                            <button
                                type="button"
                                onClick={() => setActionType('permanent_delete')}
                                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center ${
                                    actionType === 'permanent_delete'
                                        ? 'bg-red-100 border-red-300 text-red-900 font-bold shadow-2xs ring-2 ring-red-200/50'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Permanent Delete
                            </button>
                        </div>
                    </div>

                    {/* Reason input */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Reason for Deletion <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Duplicate record, client closed service, erroneous entry..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none text-slate-800 placeholder:text-slate-400"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    Submit Request
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestDeletionModal;
