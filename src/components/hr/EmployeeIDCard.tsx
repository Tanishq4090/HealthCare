import { User } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────

interface EmployeeIDCardProps {
  employeeName: string;
  employeeId: string;
  jobTitle: string;
  photoUrl: string | null;
  aadhaarNumber?: string | null;
  address?: string | null;
  dob?: string | null;
  duty?: string | null;          // e.g. "10HRS (Day)"
  experience?: string | null;    // e.g. "5 Years"
  gender?: string | null;
  variant?: 'preview' | 'public';
}

// ── Helpers ───────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Calculate age from ISO date string */
function calcAge(dob: string | null | undefined): string {
  if (!dob) return '—';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return `${age}`;
}

// ── Component ─────────────────────────────────────────────

export function EmployeeIDCard({
  employeeName,
  employeeId,
  jobTitle,
  photoUrl,
  aadhaarNumber,
  address,
  dob,
  duty,
  experience,
  gender,
  variant = 'preview',
}: EmployeeIDCardProps) {

  const age = calcAge(dob);

  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── Card ─────────────────────────────────────── */}
      <div
        id="employee-id-card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: 360,
          borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
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

        {/* ── Gradient header bar ─────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #063b3c 0%, #1aa6a8 100%)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Brand icon */}
            <div style={{
              width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 6,
            }}>
              <img
                src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg"
                alt="99Care"
                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1, margin: 0 }}>99Care</p>
              <p style={{ color: 'rgba(240,253,253,0.8)', fontSize: 8, marginTop: 2, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, margin: '2px 0 0' }}>Employee Identification</p>
            </div>
          </div>
          {/* ID chip */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '4px 10px' }}>
            <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>{employeeId}</span>
          </div>
        </div>

        {/* ── Card body ────────────────────────────────── */}
        <div style={{
          display: 'flex',
          padding: '16px 16px 14px',
          gap: 14,
          position: 'relative',
          zIndex: 10,
        }}>

          {/* ── Photo column ─────────────────────────── */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Photo */}
            <div style={{
              width: 84, height: 84, borderRadius: 12,
              overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0,0,0,0.14), 0 0 0 3px #f0fdfa, 0 0 0 5px rgba(26,166,168,0.25)',
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
                    <span style={{ color: '#fff', fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                      {getInitials(employeeName)}
                    </span>
                  ) : (
                    <User size={28} color="#fff" />
                  )}
                </div>
              )}
            </div>

            {/* ID badge below photo */}
            <div style={{
              backgroundColor: '#f0fdfa',
              border: '1px solid #99f6e4',
              borderRadius: 6,
              padding: '3px 8px',
              textAlign: 'center',
            }}>
              <span style={{ color: '#0f766e', fontFamily: 'monospace', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>
                {employeeId}
              </span>
            </div>
          </div>

          {/* ── Info column ──────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + Role */}
            <h2 style={{ color: '#0f172a', fontWeight: 800, fontSize: 15, lineHeight: 1.4, margin: '0 0 2px', wordBreak: 'break-word' }}>
              {employeeName}
            </h2>
            <p style={{ color: '#1aa6a8', fontWeight: 700, fontSize: 10, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {jobTitle}
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: 'linear-gradient(to right, #ccfbf1, transparent)', marginBottom: 8 }} />

            {/* Detail rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* Duty */}
              {duty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, width: 54, flexShrink: 0 }}>Duty</span>
                  <div style={{ color: '#1e293b', fontSize: 11, fontWeight: 700, backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 4, padding: '2px 8px', letterSpacing: '0.04em', display: 'inline-block' }}>
                    {duty}
                  </div>
                </div>
              )}

              {/* Experience */}
              {experience && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, width: 54, flexShrink: 0 }}>Exp.</span>
                  <span style={{ color: '#334155', fontSize: 11, fontWeight: 600 }}>{experience}</span>
                </div>
              )}

              {/* Age & Gender */}
              {(dob || gender) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, width: 54, flexShrink: 0 }}>Basic</span>
                  <div style={{ color: '#334155', fontSize: 11, fontWeight: 600 }}>{age !== '—' ? `${age} yrs` : ''}{gender ? (age !== '—' ? ` • ${gender}` : gender) : ''}</div>
                </div>
              )}

              {/* Address */}
              {address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, width: 54, flexShrink: 0, paddingTop: 1 }}>Address</span>
                  <div style={{ color: '#475569', fontSize: 10, fontWeight: 500, lineHeight: 1.35 }}>{address}</div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Bottom stripe ───────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #063b3c, #0b4f50, #1aa6a8)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px',
          position: 'relative', zIndex: 10,
        }}>
          <p style={{ color: 'rgba(240,253,253,0.7)', fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
            Authorized Personnel Only
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#34d399' }} />
            <span style={{ color: '#6ee7b7', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active</span>
          </div>
        </div>

        {/* ── PREVIEW watermark (admin only) ─────────── */}
        {variant === 'preview' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 20, transform: 'rotate(-20deg)',
          }}>
            <span style={{ color: 'rgba(15,118,110,0.04)', fontSize: 48, fontWeight: 900, letterSpacing: '0.4em', textTransform: 'uppercase', userSelect: 'none' }}>
              99CARE
            </span>
          </div>
        )}

        {/* Corner trim */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 0, height: 0, zIndex: 10,
          borderLeft: '28px solid transparent', borderTop: '28px solid rgba(255,255,255,0.15)',
        }} />
      </div>
    </div>
  );
}

export default EmployeeIDCard;
