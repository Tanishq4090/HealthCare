import { User } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// ── Types ─────────────────────────────────────────────────

interface EmployeeIDCardProps {
  employeeName: string;
  employeeId: string;
  jobTitle: string;
  photoUrl: string | null;
  aadhaarNumber?: string | null;
  variant?: 'preview' | 'public';
}

// ── Helpers ───────────────────────────────────────────────

/** Returns the initials of a name for the avatar fallback (e.g. "Anita Sharma" → "AS") */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Component ─────────────────────────────────────────────

export function EmployeeIDCard({
  employeeName,
  employeeId,
  jobTitle,
  photoUrl,
  aadhaarNumber,
  variant = 'preview',
}: EmployeeIDCardProps) {
  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── Card ───────────────────────────────────────── */}
      <div
        id="employee-id-card"
        className="
          relative overflow-hidden
          w-[350px] h-[220px]
          rounded-2xl shadow-2xl
          bg-white
          ring-1 ring-slate-200
          select-none
        "
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >

        {/* ── Decorative background dots ─────────────── */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <pattern id="dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#1aa6a8" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* ── Gradient header bar ────────────────────── */}
        <div className="absolute top-0 left-0 right-0 h-[64px] bg-gradient-to-r from-[#1aa6a8] to-[#34c7c9] flex items-center px-4 gap-2.5 z-10">
          {/* Brand icon */}
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0 p-1.5">
            <img 
              src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" 
              alt="99Care" 
              className="w-full h-full object-contain brightness-0 invert" 
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px] leading-none tracking-tight">99Care</p>
            <p className="text-teal-50 text-[9px] mt-0.5 tracking-widest uppercase leading-none font-medium">Employee Identification</p>
          </div>
          {/* ID chip */}
          <div className="bg-white/20 rounded-md px-2 py-0.5">
            <span className="text-white font-mono text-[10px] font-bold tracking-wider">{employeeId}</span>
          </div>
        </div>

        {/* ── Card body ──────────────────────────────── */}
        <div className="absolute top-[64px] left-0 right-0 bottom-[36px] flex items-center px-5 gap-4 z-10">

          {/* Photo */}
          <div className="shrink-0" style={{ width: 80, height: 80 }}>
            <Avatar className="w-full h-full ring-4 ring-teal-50 ring-offset-2 shadow-md">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt={employeeName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-[#1aa6a8] to-[#063b3c] text-white text-2xl font-bold">
                {photoUrl ? null : (
                  employeeName ? getInitials(employeeName) : <User className="w-8 h-8" />
                )}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Employee info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-slate-800 font-bold text-[16px] leading-tight truncate">
              {employeeName}
            </h2>
            <p className="text-[#1aa6a8] font-semibold text-[11px] mt-0.5 uppercase tracking-wider truncate">
              {jobTitle}
            </p>

            {/* Divider */}
            <div className="my-2 h-px bg-gradient-to-r from-teal-100 to-transparent" />

            {/* ID row */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[9px] uppercase tracking-widest font-semibold">ID</span>
                <span className="font-mono text-slate-700 font-bold text-[13px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 tracking-wider">
                  {employeeId}
                </span>
              </div>
              
              {aadhaarNumber && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[9px] uppercase tracking-widest font-semibold">Aadhaar</span>
                  <span className="font-mono text-slate-600 font-bold text-[11px] tracking-wider">
                    {aadhaarNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  </span>
                </div>
              )}
            </div>

            {/* Barcode-style decoration */}
            <div className="flex items-end gap-[2px] mt-2 h-4">
              {[3,5,2,7,4,6,3,8,5,2,6,4,7,3,5,2,6,8,4,3,7,5,2,6].map((h, i) => (
                <div
                  key={i}
                  className="bg-teal-100 rounded-[1px]"
                  style={{ width: '2px', height: `${h * 1.5}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom stripe ──────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 h-[36px] bg-gradient-to-r from-[#063b3c] via-[#0b4f50] to-[#1aa6a8] flex items-center justify-between px-4 z-10">
          <p className="text-teal-50 text-[9px] font-medium tracking-widest uppercase">
            Authorized Personnel Only
          </p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 text-[9px] font-bold uppercase tracking-wider">Active</span>
          </div>
        </div>

        {/* ── PREVIEW watermark (admin only) ─────────── */}
        {variant === 'preview' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 rotate-[-20deg]">
            <span className="text-teal-900/5 text-[40px] font-black tracking-[0.4em] uppercase select-none">
              99CARE
            </span>
          </div>
        )}

        <div className="absolute top-0 right-0 w-0 h-0 border-l-[30px] border-l-transparent border-t-[30px] border-t-white/20 z-10" />
      </div>
    </div>
  );
}

export default EmployeeIDCard;
