import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, AlertTriangle, RefreshCw, Image as ImageIcon, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EmployeeIDCard } from '../../components/hr/EmployeeIDCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { downloadIDCardAsPDF, downloadIDCardAsPNG } from '../../utils/downloadIDCard';
import type { Employee } from '../../types/hr';

// ── Types ─────────────────────────────────────────────────

type PageState = 'loading' | 'valid' | 'expired' | 'invalid' | 'error';

interface CardData {
  employee: Pick<Employee, 'full_name' | 'employee_id' | 'job_title' | 'photo_url' | 'aadhaar_number' | 'address' | 'dob' | 'preferred_payment_type' | 'shift_hours' | 'experience' | 'gender'>;
}

// ── Skeleton ──────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="w-[350px] space-y-3">
      <Skeleton className="w-full h-[220px] rounded-2xl" />
      <Skeleton className="h-10 w-48 mx-auto rounded-lg" />
    </div>
  );
}

// ── Status Screens ────────────────────────────────────────

function StatusScreen({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-8 px-6 max-w-sm">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function PublicIDCard() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);

  const handleDownloadPdf = async () => {
    if (!cardData) return;
    setIsDownloadingPdf(true);
    await downloadIDCardAsPDF('employee-id-card', cardData.employee.employee_id);
    setIsDownloadingPdf(false);
  };

  const handleDownloadPng = async () => {
    if (!cardData) return;
    setIsDownloadingPng(true);
    await downloadIDCardAsPNG('employee-id-card', cardData.employee.employee_id);
    setIsDownloadingPng(false);
  };

  const fetchCardData = async () => {
    if (!token) {
      setState('invalid');
      return;
    }

    setState('loading');
    setCardData(null);

    try {
      // 1. Look up the token in id_card_links (no auth required — RLS allows anon read)
      const { data: link, error: linkError } = await supabase
        .from('id_card_links')
        .select('id, employee_id, is_active, expires_at')
        .eq('token', token)
        .single();

      if (linkError || !link) {
        setState('invalid');
        return;
      }

      // 2. Check active flag
      if (!link.is_active) {
        setState('invalid');
        return;
      }

      // 3. Check expiry
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setState('expired');
        return;
      }

      // 4. Fetch employee details (only safe, non-sensitive fields)
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('full_name, employee_id, job_title, photo_url, aadhaar_number, address, dob, preferred_payment_type, shift_hours, experience, gender')
        .eq('id', link.employee_id)
        .single();

      if (empError || !employee) {
        setState('error');
        setErrorMsg('Could not load employee details. Please try again.');
        return;
      }

      setCardData({ employee });
      setState('valid');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMsg(msg);
      setState('error');
    }
  };

  useEffect(() => {
    fetchCardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-100 flex flex-col">

      {/* ── Header branding ──────────────────────────────── */}
      <header className="py-6 px-4 flex items-center justify-center gap-3">
        <div className="w-10 h-10 bg-white shadow-sm ring-1 ring-slate-100 rounded-xl flex items-center justify-center p-1.5">
          <img src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" alt="99Care" className="w-full h-full object-contain" />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">99Care</span>
      </header>

      {/* ── Divider ──────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-teal-200 to-transparent mx-8" />

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 gap-6">

        {/* Loading */}
        {state === 'loading' && <CardSkeleton />}

        {/* Valid — show the ID card */}
        {state === 'valid' && cardData && (
          <>
            <p className="text-sm text-slate-500 font-medium tracking-wide uppercase">
              Employee Identity Card
            </p>
            <EmployeeIDCard
              employeeName={cardData.employee.full_name}
              employeeId={cardData.employee.employee_id}
              jobTitle={cardData.employee.job_title}
              photoUrl={cardData.employee.photo_url}
              aadhaarNumber={cardData.employee.aadhaar_number}
              address={cardData.employee.address}
              dob={cardData.employee.dob}
              duty={cardData.employee.preferred_payment_type === 'hourly'
                ? `${cardData.employee.shift_hours ?? '—'} HRS (Day)`
                : cardData.employee.preferred_payment_type === 'monthly'
                ? 'Monthly'
                : 'Short Term'}
              experience={cardData.employee.experience as any}
              gender={cardData.employee.gender}
              variant="public"
            />
            
            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full max-w-[350px]">
              <Button
                variant="outline"
                className="flex-1 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 gap-2"
                onClick={handleDownloadPng}
                disabled={isDownloadingPng || isDownloadingPdf}
              >
                {isDownloadingPng ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-teal-500" />
                )}
                {isDownloadingPng ? 'Saving...' : 'Save Image'}
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-[#1aa6a8] to-[#0b4f50] hover:from-[#0b4f50] hover:to-[#1aa6a8] text-white shadow-sm gap-2"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPng || isDownloadingPdf}
              >
                {isDownloadingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </>
        )}

        {/* Expired */}
        {state === 'expired' && (
          <StatusScreen
            icon={Lock}
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
            title="This ID card link has expired"
            subtitle="The link you followed is no longer valid. Please contact the healthcare provider to request a new link."
          />
        )}

        {/* Invalid / deactivated */}
        {state === 'invalid' && (
          <StatusScreen
            icon={Lock}
            iconColor="text-slate-400"
            iconBg="bg-slate-100"
            title="Invalid or deactivated link"
            subtitle="This ID card link does not exist or has been deactivated by the administrator."
          />
        )}

        {/* Error */}
        {state === 'error' && (
          <StatusScreen
            icon={AlertTriangle}
            iconColor="text-red-500"
            iconBg="bg-red-50"
            title="Something went wrong"
            subtitle={errorMsg || 'Could not load the ID card. Please check your connection and try again.'}
            action={
              <Button
                variant="outline"
                onClick={fetchCardData}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            }
          />
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="py-6 px-4 text-center border-t border-slate-100">
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          This ID card was issued by{' '}
          <span className="font-semibold text-slate-500">99Care</span>.
          If you have concerns about this worker's identity, please contact our support team.
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
            Secured by 99Care
          </span>
        </div>
      </footer>
    </div>
  );
}
