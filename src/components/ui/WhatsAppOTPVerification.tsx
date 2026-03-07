import { useState, useRef, useEffect } from "react";

type Step = "phone" | "otp" | "verified";

interface OTPVerificationProps {
  initialPhone?: string;
  onVerified?: (phoneNumber: string) => void;
  onClose?: () => void;
}

export default function WhatsAppOTPVerification({
  initialPhone = "",
  onVerified,
  onClose,
}: OTPVerificationProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, "").slice(-10)); // Strip country code if present
  const [countryCode, setCountryCode] = useState("+1");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    if (!phone.trim() || phone.length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `${countryCode}${phone}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setStep("otp");
      startResendTimer();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);

      // DEV_MODE Support: If backend gives back a mock OTP, pre-fill it for easy testing
      if (data.mockCode) {
        console.log(`[DEV_MODE] Auto-filling backend OTP: ${data.mockCode}`);
        setOtp(data.mockCode.split(""));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `${countryCode}${phone}`, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      setVerified(true);
      setStep("verified");
      setTimeout(() => onVerified?.(`${countryCode}${phone}`), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Incorrect code. Try again.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `${countryCode}${phone}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      startResendTimer();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-otp-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

        .whatsapp-otp-overlay {
          position: fixed;
          inset: 0;
          background: rgba(5, 20, 15, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: 'DM Sans', sans-serif;
        }

        .otp-card {
          background: #fff;
          border-radius: 24px;
          padding: 40px 36px;
          width: 100%;
          max-width: 420px;
          position: relative;
          box-shadow: 0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
          animation: cardIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .otp-close {
          position: absolute;
          top: 18px; right: 18px;
          width: 32px; height: 32px;
          border: none;
          background: #f1f5f2;
          border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #667768;
          font-size: 18px;
          line-height: 1;
          transition: background 0.15s, color 0.15s;
        }
        .otp-close:hover { background: #e2ebe4; color: #1a2e1f; }

        .otp-wa-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 20px;
          box-shadow: 0 8px 24px rgba(37, 211, 102, 0.28);
        }

        .otp-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0d1f12;
          margin: 0 0 6px;
          letter-spacing: -0.3px;
        }

        .otp-subtitle {
          font-size: 14px;
          color: #677a6d;
          margin: 0 0 28px;
          line-height: 1.5;
        }

        .otp-subtitle strong {
          color: #1a2e1f;
          font-weight: 500;
        }

        .phone-row {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .country-select {
          width: 88px;
          padding: 12px 10px;
          border: 1.5px solid #d8e4da;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #0d1f12;
          background: #f8fbf8;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
          flex-shrink: 0;
        }
        .country-select:focus { border-color: #25D366; background: #fff; }

        .phone-input {
          flex: 1;
          padding: 12px 16px;
          border: 1.5px solid #d8e4da;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #0d1f12;
          background: #f8fbf8;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .phone-input::placeholder { color: #a8bfad; }
        .phone-input:focus { border-color: #25D366; background: #fff; }

        .otp-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #25D366 0%, #1aab54 100%);
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          letter-spacing: 0.1px;
        }
        .otp-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .otp-btn:active:not(:disabled) { transform: translateY(0); }
        .otp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .otp-boxes {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .otp-box {
          width: 48px; height: 56px;
          border: 2px solid #d8e4da;
          border-radius: 12px;
          text-align: center;
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: #0d1f12;
          background: #f8fbf8;
          outline: none;
          transition: border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.2s;
          caret-color: #0d1f12; /* Made caret dark and highly visible */
        }
        .otp-box:focus {
          border-color: #25D366;
          background: #fff;
          transform: scale(1.05);
          box-shadow: 0 0 0 4px rgba(37,211,102,0.2); /* Stronger focus ring */
        }
        .otp-box.filled {
          border-color: #25D366;
          background: #f0fdf4;
        }

        .resend-row {
          text-align: center;
          font-size: 13.5px;
          color: #677a6d;
          margin-top: 16px;
        }

        .resend-btn {
          background: none;
          border: none;
          color: #25D366;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: opacity 0.2s;
        }
        .resend-btn:disabled { color: #a8bfad; cursor: default; }

        .back-btn {
          background: none;
          border: none;
          color: #677a6d;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          cursor: pointer;
          padding: 0;
          display: flex; align-items: center; gap: 4px;
          margin-bottom: 20px;
          transition: color 0.15s;
        }
        .back-btn:hover { color: #1a2e1f; }

        .otp-error {
          background: #fff1f1;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13.5px;
          margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }

        .verified-check {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        .progress-dots {
          display: flex; gap: 6px; margin-bottom: 28px;
        }
        .progress-dot {
          height: 3px; border-radius: 2px;
          transition: all 0.3s;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="otp-card">
        {onClose && (
          <button className="otp-close" onClick={onClose} aria-label="Close">×</button>
        )}

        {/* Progress indicator */}
        <div className="progress-dots">
          {(["phone", "otp", "verified"] as Step[]).map((s, i) => (
            <div
              key={s}
              className="progress-dot"
              style={{
                width: step === s ? 24 : 8,
                background: i <= ["phone", "otp", "verified"].indexOf(step) ? "#25D366" : "#d8e4da",
              }}
            />
          ))}
        </div>

        {/* ─── STEP: Phone ─── */}
        {step === "phone" && (
          <>
            <div className="otp-wa-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C7.373 2 2 7.373 2 14c0 2.09.537 4.054 1.478 5.762L2 26l6.452-1.449A11.95 11.95 0 0014 26c6.627 0 12-5.373 12-12S20.627 2 14 2z" fill="white" fillOpacity=".2" />
                <path d="M19.5 17.1c-.3-.15-1.77-.873-2.045-.972-.275-.099-.474-.148-.674.149-.2.297-.772.972-.946 1.172-.174.199-.349.224-.648.074-.3-.149-1.264-.466-2.408-1.486-.89-.794-1.49-1.774-1.664-2.073-.174-.3-.018-.461.13-.61.134-.132.299-.348.448-.522.15-.174.2-.298.3-.497.099-.198.05-.373-.025-.522-.075-.149-.674-1.623-.923-2.22-.243-.583-.49-.504-.674-.513l-.572-.01c-.2 0-.523.075-.797.373-.274.298-1.047 1.023-1.047 2.495 0 1.473 1.072 2.897 1.222 3.096.149.199 2.109 3.22 5.11 4.514.714.308 1.272.492 1.707.63.717.228 1.37.196 1.886.119.575-.086 1.77-.724 2.02-1.423.248-.7.248-1.297.173-1.423-.074-.124-.274-.198-.573-.348z" fill="white" />
              </svg>
            </div>
            <h2 className="otp-title">Verify via WhatsApp</h2>
            <p className="otp-subtitle">
              We'll send a 6-digit code to your WhatsApp number to confirm your identity.
            </p>

            <div className="phone-row">
              <select
                className="country-select"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+91">🇮🇳 +91</option>
                <option value="+27">🇿🇦 +27</option>
                <option value="+234">🇳🇬 +234</option>
                <option value="+254">🇰🇪 +254</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+49">🇩🇪 +49</option>
                <option value="+33">🇫🇷 +33</option>
                <option value="+55">🇧🇷 +55</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+65">🇸🇬 +65</option>
              </select>
              <input
                className="phone-input"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
              />
            </div>

            {error && (
              <div className="otp-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button className="otp-btn" onClick={handleSendOTP} disabled={loading}>
              {loading ? <span className="spinner" /> : "Send WhatsApp Code →"}
            </button>
          </>
        )}

        {/* ─── STEP: OTP ─── */}
        {step === "otp" && (
          <>
            <button className="back-btn" onClick={() => { setStep("phone"); setError(""); setOtp(["", "", "", "", "", ""]); }}>
              ← Back
            </button>

            <div className="otp-wa-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="6" y="10" width="16" height="13" rx="2" stroke="white" strokeWidth="2" />
                <path d="M10 10V8a4 4 0 018 0v2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="16" r="1.5" fill="white" />
                <path d="M14 17.5V19.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="otp-title">Enter the code</h2>
            <p className="otp-subtitle">
              Sent to <strong>{countryCode} {phone}</strong> via WhatsApp. Check your messages.
            </p>

            <div className="otp-boxes" onPaste={handleOTPPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  className={`otp-box ${digit ? "filled" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                />
              ))}
            </div>

            {error && (
              <div className="otp-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              className="otp-btn"
              onClick={handleVerifyOTP}
              disabled={loading || otp.join("").length < 6}
            >
              {loading ? <span className="spinner" /> : "Verify Code →"}
            </button>

            <div className="resend-row">
              Didn't receive it?{" "}
              <button
                className="resend-btn"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
              </button>
            </div>
          </>
        )}

        {/* ─── STEP: Verified ─── */}
        {step === "verified" && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div className="verified-check">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M10 18l6 6 10-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="otp-title" style={{ textAlign: "center" }}>Verified!</h2>
            <p className="otp-subtitle" style={{ textAlign: "center" }}>
              Your WhatsApp number <strong>{countryCode} {phone}</strong> is now connected. Our AI assistant will reach out shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
