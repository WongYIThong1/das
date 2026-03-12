'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp';
import { ApiRequestError, loginTotpVerify, registerTotpVerify } from '../lib/auth-api';

interface TotpPageProps {
  onNavigate: (path: string) => void;
  onVerified: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function TotpPage({ onNavigate, onVerified }: TotpPageProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pendingAuthFlow, clearPendingAuthFlow, refreshProfile } = useAuth();

  useEffect(() => {
    if (!pendingAuthFlow) {
      onNavigate('/login');
    }
  }, [onNavigate, pendingAuthFlow]);

  if (!pendingAuthFlow) {
    return null;
  }

  const isEnrollmentFlow = pendingAuthFlow.requiresEnrollment;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const sanitizedCode = code.replace(/\D/g, '').slice(0, 6);
    if (sanitizedCode.length !== 6) {
      toast.error('Enter a valid 6-digit TOTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (pendingAuthFlow.mode === 'register') {
        if (!pendingAuthFlow.factorId) {
          throw new Error('Missing TOTP factor for registration.');
        }
        await registerTotpVerify({
          registrationTicket: pendingAuthFlow.ticket,
          factorId: pendingAuthFlow.factorId,
          code: sanitizedCode,
        });
      } else {
        await loginTotpVerify({
          loginTicket: pendingAuthFlow.ticket,
          factorId: pendingAuthFlow.factorId,
          code: sanitizedCode,
        });
      }

      clearPendingAuthFlow();
      const profile = await refreshProfile();
      if (!profile) {
        throw new Error('Session was created, but profile loading failed.');
      }
      toast.success('2FA verified. Workspace ready.');
      onVerified();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to verify the TOTP code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-xl rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_24px_60px_rgba(24,24,27,0.08)]"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <ShieldCheck size={14} />
            TOTP
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-sm leading-7 text-zinc-500">
              {isEnrollmentFlow
                ? 'Scan the QR code in your authenticator app, then enter the 6-digit code to finish setup.'
                : 'Enter the 6-digit code from your authenticator app to continue.'}
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Pending identity</p>
            <p className="mt-3 text-lg font-medium text-zinc-950">{pendingAuthFlow.identifierOrEmail}</p>
          </div>

          {isEnrollmentFlow && (
            <div className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Authenticator QR</p>
                <div
                  className="mt-3 flex justify-center rounded-2xl bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: pendingAuthFlow.qrCodeSvg ?? '' }}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Secret</p>
                  <p className="mt-2 break-all rounded-2xl bg-white px-4 py-3 font-mono text-sm text-zinc-900">
                    {pendingAuthFlow.secret ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Factor ID</p>
                  <p className="mt-2 break-all rounded-2xl bg-white px-4 py-3 font-mono text-sm text-zinc-900">
                    {pendingAuthFlow.factorId ?? '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                TOTP Code
              </label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-3xl bg-zinc-950 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting ? 'Verifying...' : 'Verify and enter workspace'}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
              <button
                type="button"
                onClick={() => {
                  clearPendingAuthFlow();
                  onNavigate(pendingAuthFlow.mode === 'register' ? '/register' : '/login');
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
              >
                <ArrowLeft size={16} />
                Change previous details
              </button>

              <p className="text-xs text-zinc-400">{isEnrollmentFlow ? 'Enrollment required.' : 'Verification required.'}</p>
            </div>
          </form>
        </motion.section>
      </div>
    </div>
  );
}
