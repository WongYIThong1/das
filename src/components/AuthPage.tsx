'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
  ApiRequestError,
  loginStart,
  registerStart,
  registerMfaSetup,
  storePendingLoginAuth,
  storePendingRegisterAuth,
} from '../lib/auth-api';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  mode: AuthMode;
  inviteCode?: string;
  onNavigate: (path: string) => void;
}

const copyByMode: Record<AuthMode, { title: string; subtitle: string; cta: string; swapText: string; swapHref: string }> = {
  login: {
    title: 'Welcome back',
    subtitle: 'Use your existing credentials, then complete TOTP verification.',
    cta: 'Continue to 2FA',
    swapText: 'New here? Create an account',
    swapHref: '/register',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Set up the workspace details first, then bind TOTP before entering.',
    cta: 'Continue to 2FA',
    swapText: 'Already have an account? Sign in',
    swapHref: '/login',
  },
};

const usernamePattern = /^[A-Za-z0-9._-]{3,32}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function buildEmailAddress(localValue: string, selectedDomain: string) {
  const trimmedValue = localValue.trim();
  if (!trimmedValue) {
    return '';
  }
  if (trimmedValue.includes('@')) {
    return trimmedValue;
  }
  return `${trimmedValue}@${selectedDomain}`;
}

export function AuthPage({ mode, inviteCode, onNavigate }: AuthPageProps) {
  const content = copyByMode[mode];
  const {
    activeInviteCode,
    clearActiveInviteCode,
    clearPendingAuthFlow,
    setActiveInviteCode,
    setPendingAuthFlow,
  } = useAuth();
  const [isDomainOpen, setIsDomainOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('my365.net');
  const availableDomains = ['my365.net', 'my365biz.app'];
  const [emailLocal, setEmailLocal] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const domainMenuRef = useRef<HTMLDivElement | null>(null);

  const getPasswordStrength = (value: string) => {
    if (!value) {
      return { score: 0, label: 'Too weak' };
    }
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    const label =
      score >= 4 ? 'Strong' : score >= 3 ? 'Good' : score >= 2 ? 'Fair' : 'Too weak';
    return { score, label };
  };

  useEffect(() => {
    setIsDomainOpen(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'register') {
      clearActiveInviteCode();
      return;
    }

    if (inviteCode?.trim()) {
      setActiveInviteCode(inviteCode.trim());
    }
  }, [clearActiveInviteCode, inviteCode, mode, setActiveInviteCode]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!domainMenuRef.current?.contains(event.target as Node)) {
        setIsDomainOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmedEmailLocal = emailLocal.trim();
    const email = buildEmailAddress(trimmedEmailLocal, selectedDomain);

    if (mode === 'login') {
      if (!trimmedEmailLocal || !password) {
        toast.error('Email and password are required.');
        return;
      }
      if (!emailPattern.test(email)) {
        toast.error('Please enter a valid email address.');
        return;
      }
    } else if (!username.trim() || !trimmedEmailLocal || !password) {
      toast.error('Username, email, and password are required.');
      return;
    } else {
      if (!activeInviteCode?.trim()) {
        toast.error('Please use a valid invite link to create your account.');
        return;
      }
      if (!usernamePattern.test(username.trim())) {
        toast.error('Username must be 3-32 characters and only use letters, numbers, dot, underscore, or dash.');
        return;
      }
      if (!emailPattern.test(email)) {
        toast.error('Please enter a valid email address.');
        return;
      }
      if (password.length < 12) {
        toast.error('Password must be at least 12 characters.');
        return;
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        toast.error('Password must include upper, lower, number, and symbol.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await clearPendingAuthFlow();

      if (mode === 'register') {
        const registerResponse = await registerStart({
          name: username.trim(),
          email,
          password,
          inviteCode: activeInviteCode,
        });
        const enrollResponse = await registerMfaSetup({
          email,
          password,
        });
        const pendingResponse = await storePendingRegisterAuth({
          mode: 'register',
          requiresEnrollment: registerResponse.mfaRequired,
          secret: enrollResponse.secret,
          otpauth: enrollResponse.otpauth,
          qrImageSrc: `data:image/png;base64,${enrollResponse.qrPngBase64}`,
          email,
          password,
          inviteCode: activeInviteCode,
          identifierOrEmail: email,
        });
        setPendingAuthFlow(pendingResponse.pendingAuthFlow);
      } else {
        const loginResponse = await loginStart({
          email,
          password,
        });

        console.info('loginResponse', loginResponse);

        if (!loginResponse.mfaToken) {
          throw new ApiRequestError(
            `Login response: ${JSON.stringify(loginResponse)}`,
            401
          );
        }
        const pendingResponse = await storePendingLoginAuth({
          mode: 'login',
          requiresEnrollment: false,
          identifierOrEmail: email,
          mfaToken: loginResponse.mfaToken,
          expiresIn: loginResponse.expiresIn,
        });
        setPendingAuthFlow(pendingResponse.pendingAuthFlow);
      }

      toast.success(mode === 'register' ? 'Account created. Continue to OTP setup.' : 'Continue on the TOTP page.');
      onNavigate('/totp');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to start authentication. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-stretch justify-center gap-10 px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-md self-center rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg md:p-10"
        >
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-semibold text-zinc-900">{content.title}</h2>
            <p className="text-sm text-zinc-500">{content.subtitle}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="e.g. han.li"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 transition focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={emailLocal}
                    onChange={(event) => setEmailLocal(event.target.value)}
                    placeholder="username"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 transition focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div ref={domainMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDomainOpen((open) => !open)}
                    className="flex h-full min-w-[168px] items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    aria-haspopup="listbox"
                    aria-expanded={isDomainOpen}
                  >
                    <span className="truncate">@{selectedDomain}</span>
                    <motion.span
                      animate={{ rotate: isDomainOpen ? 180 : 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="flex items-center text-zinc-400"
                    >
                      <ChevronDown size={16} />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {isDomainOpen && (
                      <motion.div
                        role="listbox"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute right-0 z-10 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
                      >
                        {availableDomains.map((domain) => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => {
                              setSelectedDomain(domain);
                              setIsDomainOpen(false);
                            }}
                            className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition ${
                              selectedDomain === domain
                                ? 'bg-zinc-50 font-semibold text-zinc-900'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            }`}
                            role="option"
                            aria-selected={selectedDomain === domain}
                          >
                            @{domain}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.02 }}
            >
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter a strong password"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 transition focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
              {mode === 'register' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                    <span>Password strength</span>
                    <span>{getPasswordStrength(password).label}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.min((getPasswordStrength(password).score / 5) * 100, 100)}%`,
                        backgroundColor:
                          getPasswordStrength(password).score >= 4
                            ? '#10b981'
                            : getPasswordStrength(password).score >= 3
                            ? '#f59e0b'
                            : getPasswordStrength(password).score >= 2
                            ? '#f97316'
                            : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
              className="mt-8 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSubmitting ? 'Please wait...' : content.cta}
            </motion.button>
          </form>

          {mode === 'register' && (
            <button
              type="button"
              onClick={() => {
                clearActiveInviteCode();
                onNavigate(content.swapHref);
              }}
              className="mt-4 w-full text-center text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              {content.swapText}
            </button>
          )}
        </motion.section>
      </div>
    </div>
  );
}
