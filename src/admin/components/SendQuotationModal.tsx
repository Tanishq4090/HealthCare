import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SendQuotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: any;
    onDispatch: (quotationData: any) => void;
}

const inclusionsOptions = [
    'Medication reminders', 'Vital monitoring', 'Bathing assistance', 'Meal preparation',
    'Physiotherapy exercises', 'Wound care', 'Companionship', 'Hospital accompaniment'
];

export const SendQuotationModal: React.FC<SendQuotationModalProps> = ({ isOpen, onClose, lead, onDispatch }) => {
    const [serviceName, setServiceName] = useState('');
    const [serviceCategory, setServiceCategory] = useState('Home nursing');
    const [recipientCondition, setRecipientCondition] = useState('');
    const [hoursPerDay, setHoursPerDay] = useState('');
    const [daysPerWeek, setDaysPerWeek] = useState('');
    const [shiftType, setShiftType] = useState('Day shift');
    const [startDate, setStartDate] = useState('');
    const [duration, setDuration] = useState('Open-ended');
    const [completeMonthRate, setCompleteMonthRate] = useState('');
    const [incompleteMonthRate, setIncompleteMonthRate] = useState('');
    const [deposit, setDeposit] = useState('');
    const [selectedInclusions, setSelectedInclusions] = useState<string[]>(['Medication reminders', 'Vital monitoring']);
    
    // Auto-calculated
    const [estimatedTotal, setEstimatedTotal] = useState(0);

    // Messaging
    const [messageTemplate, setMessageTemplate] = useState('Standard quotation');
    const [language, setLanguage] = useState('English');
    const [customMessage, setCustomMessage] = useState(`We can customise the hours or services to better suit your family's needs — just reply here and we'll adjust the quote.`);
    const [validUntil, setValidUntil] = useState('');

    useEffect(() => {
        if (completeMonthRate && !isNaN(Number(completeMonthRate))) {
            setEstimatedTotal(Number(completeMonthRate) * 30); // Simple estimation, can be customized
        } else {
            setEstimatedTotal(0);
        }
    }, [completeMonthRate]);

    useEffect(() => {
        if (isOpen && lead) {
            setDaysPerWeek('7'); // Default to 7 days
            if (lead.notes) {
                const serviceMatch = lead.notes.match(/Service:\s*(.+)/i);
                if (serviceMatch && serviceMatch[1] && serviceMatch[1] !== 'Unknown') {
                    const sName = serviceMatch[1].trim();
                    setServiceName(sName);
                    // Guess category
                    const nameLower = sName.toLowerCase();
                    if (nameLower.includes('baby') || nameLower.includes('mother') || nameLower.includes('new born')) setServiceCategory('Mother & baby');
                    else if (nameLower.includes('elder') || nameLower.includes('old age')) setServiceCategory('Elder care');
                    else if (nameLower.includes('post-op') || nameLower.includes('surgery')) setServiceCategory('Post-op care');
                    else if (nameLower.includes('physio')) setServiceCategory('Physiotherapy');
                }
                
                const shiftMatch = lead.notes.match(/Shift:\s*(.+)/i);
                if (shiftMatch && shiftMatch[1]) {
                    const shiftStr = shiftMatch[1].toLowerCase();
                    if (shiftStr.includes('24') || shiftStr.includes('live')) {
                        setShiftType('24/7 Live-in');
                        setHoursPerDay('24');
                    } else if (shiftStr.includes('10') || shiftStr.includes('12')) {
                        setShiftType('Day shift');
                        setHoursPerDay(shiftStr.match(/\d+/)?.[0] || '10');
                    } else if (shiftStr.includes('day') || shiftStr.includes('general')) {
                        setShiftType('Day shift');
                        setHoursPerDay('10');
                    } else if (shiftStr.includes('night')) {
                        setShiftType('Night shift');
                        setHoursPerDay('10');
                    }
                }
                
                const careForMatch = lead.notes.match(/Care for:\s*(.+)/i);
                if (careForMatch && careForMatch[1]) {
                    setRecipientCondition(careForMatch[1].trim());
                }
            }
        }
    }, [isOpen, lead]);

    if (!isOpen) return null;

    const toggleInclusion = (item: string) => {
        setSelectedInclusions(prev => 
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };

    const handleDispatch = () => {
        if (!serviceName.trim()) return toast.error('Please enter the Service Name.');
        if (!recipientCondition.trim()) return toast.error('Please specify the Care Recipient Condition.');
        if (!hoursPerDay) return toast.error('Please enter Hours per day.');
        if (!daysPerWeek) return toast.error('Please enter Days per week.');
        if (!startDate) return toast.error('Please select a Proposed Start Date.');
        if (!completeMonthRate) return toast.error('Please enter the Complete Month Rate.');
        if (!incompleteMonthRate) return toast.error('Please enter the Incomplete Month Rate.');
        if (!validUntil) return toast.error('Please select a Quote Valid Until date.');

        onDispatch({
            serviceName,
            serviceCategory,
            recipientCondition,
            hoursPerDay: Number(hoursPerDay) || null,
            daysPerWeek: Number(daysPerWeek) || null,
            shiftType,
            startDate,
            duration,
            completeMonthRate: Number(completeMonthRate) || null,
            incompleteMonthRate: Number(incompleteMonthRate) || null,
            deposit: Number(deposit) || 0,
            estimatedTotal,
            inclusions: selectedInclusions,
            messageTemplate,
            language,
            customMessage,
            validUntil
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-[#1e1e1e] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-300 font-sans my-auto">
                {/* Header */}
                <div className="bg-[#168a8b] px-6 py-4 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center">
                            <span className="text-xl">📄</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold leading-tight text-white">Send quotation</h2>
                            <p className="text-white/80 text-xs">AI WhatsApp agent — human-reviewed before dispatch</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Lead Summary Ribbon */}
                <div className="bg-[#2a2a2a] px-6 py-3 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#168a8b] text-white flex items-center justify-center text-xs font-bold">
                            {lead?.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-200">{lead?.name}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-[#168a8b]/20 text-[#2dd4bf] rounded-full border border-[#168a8b]/30">
                            {lead?.pipeline_stage}
                        </span>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 opacity-60">📞</span> {lead?.phone || lead?.whatsapp_number}
                    </div>
                </div>

                {/* Body (Scrollable) */}
                <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-8">
                    
                    {/* SERVICE DETAILS */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Service Details
                            </h3>
                            <span className="text-xs text-slate-500 italic">What are you quoting for?</span>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Service name *</label>
                                <input 
                                    type="text" 
                                    value={serviceName}
                                    onChange={e => setServiceName(e.target.value)}
                                    placeholder="e.g. Home nursing care, Post-operative care, Elder companion" 
                                    className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2dd4bf] transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Service category *</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Home nursing', 'Elder care', 'Post-op care', 'Physiotherapy', 'Mother & baby', 'Other'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setServiceCategory(cat)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${serviceCategory === cat ? 'bg-[#168a8b]/20 text-[#2dd4bf] border-[#168a8b]' : 'bg-[#2a2a2a] text-slate-400 border-slate-700 hover:border-slate-500'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Care recipient age & condition *</label>
                                <input 
                                    type="text" 
                                    value={recipientCondition}
                                    onChange={e => setRecipientCondition(e.target.value)}
                                    placeholder="e.g. 72 years, diabetic, mobility limited" 
                                    className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#2dd4bf] transition-colors"
                                />
                            </div>
                        </div>
                    </section>

                    <hr className="border-slate-800" />

                    {/* SCHEDULE & HOURS */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Schedule & Hours
                            </h3>
                            <span className="text-xs text-slate-500 italic">Defines the scope of work</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Hours per day *</label>
                                <input type="number" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} placeholder="e.g. 12" className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Days per week *</label>
                                <input type="number" value={daysPerWeek} onChange={e => setDaysPerWeek(e.target.value)} placeholder="e.g. 7" className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Shift type</label>
                                <select value={shiftType} onChange={e => setShiftType(e.target.value)} className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] appearance-none">
                                    <option>Day shift</option>
                                    <option>Night shift</option>
                                    <option>24/7 Live-in</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Proposed start date *</label>
                                <div className="relative">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] [color-scheme:dark]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Duration / contract length</label>
                                <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] appearance-none">
                                    <option>Open-ended</option>
                                    <option>1 month</option>
                                    <option>3 months</option>
                                    <option>6 months</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <hr className="border-slate-800" />

                    {/* PRICING */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Pricing
                            </h3>
                            <span className="text-xs text-slate-500 italic">Both rates required</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Complete month rate (per day) *</label>
                                <input type="number" value={completeMonthRate} onChange={e => setCompleteMonthRate(e.target.value)} placeholder="e.g. ₹800" className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Incomplete month rate (per day) *</label>
                                <input type="number" value={incompleteMonthRate} onChange={e => setIncompleteMonthRate(e.target.value)} placeholder="e.g. ₹1,500" className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]" />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Deposit required</label>
                            <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="e.g. ₹5,000" className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf]" />
                        </div>

                        <div className="bg-[#168a8b]/10 border border-[#168a8b]/20 rounded-lg p-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-slate-200">Estimated monthly total</p>
                                <p className="text-xs text-slate-500">auto-calculated from above</p>
                            </div>
                            <span className="text-lg font-bold text-[#2dd4bf]">₹{estimatedTotal.toLocaleString()}</span>
                        </div>
                    </section>

                    <hr className="border-slate-800" />

                    {/* WHAT'S INCLUDED */}
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> What's Included
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {inclusionsOptions.map(inc => (
                                <button
                                    key={inc}
                                    onClick={() => toggleInclusion(inc)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedInclusions.includes(inc) ? 'bg-white/10 text-white border-white/30' : 'bg-[#2a2a2a] text-slate-400 border-slate-700 hover:border-slate-500'}`}
                                >
                                    {inc}
                                </button>
                            ))}
                        </div>
                    </section>

                    <hr className="border-slate-800" />

                    {/* PERSONALISED NOTE */}
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Personalised Note To Client
                        </h3>
                        
                        <div className="mb-4">
                            <div className="flex justify-between items-end mb-1.5">
                                <label className="block text-xs font-medium text-slate-400">Message (sent on WhatsApp with the quote)</label>
                                <span className="text-[10px] text-slate-500">{customMessage.length} / 300</span>
                            </div>
                            <textarea 
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                rows={3}
                                className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] resize-none"
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Message template</label>
                                <select value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] appearance-none">
                                    <option>Standard quotation</option>
                                    <option>Urgent quotation</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-[#2a2a2a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2dd4bf] appearance-none">
                                    <option>English</option>
                                    <option>Hindi</option>
                                    <option>Hinglish</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-6 border border-slate-700 rounded-lg overflow-hidden flex items-stretch">
                            <div className="bg-[#2a2a2a] px-3 flex items-center border-r border-slate-700">
                                <input type="checkbox" className="rounded border-slate-500 bg-transparent text-[#168a8b] focus:ring-[#168a8b]" defaultChecked />
                            </div>
                            <div className="flex-1 bg-[#2a2a2a] px-3 py-2 flex items-center justify-between">
                                <label className="text-sm text-slate-300">Quote valid until</label>
                                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="bg-transparent border-none outline-none text-sm text-white [color-scheme:dark]" />
                            </div>
                            <div className="px-3 flex items-center text-xs text-slate-500 italic bg-[#2a2a2a]">
                                Set an expiry to create urgency
                            </div>
                        </div>

                        <div className="bg-[#dcfce7] text-[#166534] px-4 py-3 rounded-lg text-xs font-medium flex items-start gap-2 border border-[#bbf7d0]">
                            <span className="shrink-0 mt-0.5">ℹ️</span>
                            <p>This quote will be reviewed by your team before being sent. No message leaves without human confirmation.</p>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-[#1e1e1e] flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-slate-700 text-slate-300 hover:bg-[#2a2a2a] transition">
                        Cancel
                    </button>
                    <button onClick={handleDispatch} className="flex-[2] py-2.5 rounded-lg text-sm font-semibold bg-[#168a8b] text-white hover:bg-[#115e59] transition flex justify-center items-center gap-2">
                        <span>💬</span> Confirm & dispatch quote
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
            `}} />
        </div>
    );
};
