import { User } from 'lucide-react';

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
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: 350,
          height: 220,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          backgroundColor: '#ffffff',
          outline: '1px solid #e2e8f0',
          fontFamily: 'Inter, system-ui, sans-serif',
          flexShrink: 0,
        }}
      >

        {/* ── Decorative background dots ─────────────── */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <pattern id="dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#1aa6a8" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* ── Gradient header bar ────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 64,
          background: 'linear-gradient(to right, #1aa6a8, #34c7c9)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, zIndex: 10,
        }}>
          {/* Brand icon */}
          <div style={{
            width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 6,
          }}>
            <img
              src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg"
              alt="99Care"
              style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1, letterSpacing: '-0.5px', margin: 0 }}>99Care</p>
            <p style={{ color: 'rgba(240,253,253,0.85)', fontSize: 9, marginTop: 3, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500, margin: '3px 0 0' }}>Employee Identification</p>
          </div>
          {/* ID chip */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>
            <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>{employeeId}</span>
          </div>
        </div>

        {/* ── Card body ──────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0, bottom: 36,
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, zIndex: 10,
        }}>

          {/* ── Photo / Avatar ──────────────────────── */}
          <div style={{
            width: 76, height: 76, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 3px #f0fdfa, 0 0 0 5px rgba(26,166,168,0.2)',
          }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={employeeName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #1aa6a8, #063b3c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {employeeName ? (
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                    {getInitials(employeeName)}
                  </span>
                ) : (
                  <User size={28} color="#fff" />
                )}
              </div>
            )}
          </div>

          {/* Employee info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ color: '#1e293b', fontWeight: 700, fontSize: 16, lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {employeeName}
            </h2>
            <p style={{ color: '#1aa6a8', fontWeight: 600, fontSize: 11, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {jobTitle}
            </p>

            {/* Divider */}
            <div style={{ marginTop: 8, marginBottom: 8, height: 1, background: 'linear-gradient(to right, #ccfbf1, transparent)' }} />

            {/* ID + Aadhaar rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>ID</span>
                <span style={{
                  fontFamily: 'monospace', color: '#334155', fontWeight: 700, fontSize: 13,
                  backgroundColor: '#f8fafc', padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e2e8f0', letterSpacing: '0.08em',
                }}>
                  {employeeId}
                </span>
              </div>

              {aadhaarNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>Aadhaar</span>
                  <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em' }}>
                    {aadhaarNumber.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  </span>
                </div>
              )}
            </div>

            {/* Barcode-style decoration */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 8, height: 16 }}>
              {[3,5,2,7,4,6,3,8,5,2,6,4,7,3,5,2,6,8,4,3,7,5,2,6].map((h, i) => (
                <div key={i} style={{ width: 2, height: `${h * 1.5}px`, backgroundColor: '#ccfbf1', borderRadius: 1 }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom stripe ──────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
          background: 'linear-gradient(to right, #063b3c, #0b4f50, #1aa6a8)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 10,
        }}>
          <p style={{ color: 'rgba(240,253,253,0.7)', fontSize: 9, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
            Authorized Personnel Only
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#34d399', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#6ee7b7', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active</span>
          </div>
        </div>

        {/* ── PREVIEW watermark (admin only) ─────────── */}
        {variant === 'preview' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 20, transform: 'rotate(-20deg)',
          }}>
            <span style={{ color: 'rgba(15,118,110,0.04)', fontSize: 40, fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', userSelect: 'none' }}>
              99CARE
            </span>
          </div>
        )}

        {/* Corner trim */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 0, height: 0, zIndex: 10,
          borderLeft: '30px solid transparent', borderTop: '30px solid rgba(255,255,255,0.2)',
        }} />
      </div>
    </div>
  );
}

export default EmployeeIDCard;
