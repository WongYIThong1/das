'use client';

import { Mail, Building2, Shield, CheckCircle2, ShieldAlert, KeyRound, UserRound, Fingerprint } from 'lucide-react';
import { useAuth } from './AuthProvider';

export function ProfilePage() {
  const { profile } = useAuth();

  if (!profile) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-zinc-50 to-zinc-100/50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-8 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Account Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">Your authenticated workspace identity and security posture.</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl space-y-6 p-8">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
              <UserRound size={18} className="text-zinc-600" />
              Profile
            </h2>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Username</p>
              <p className="mt-2 text-base font-semibold text-zinc-900">{profile.username}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Email</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Mail size={16} className="text-zinc-400" />
                {profile.email}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Company</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
                <Building2 size={16} className="text-zinc-400" />
                {profile.company}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Book ID</p>
              <p className="mt-2 flex items-center gap-2 break-all font-mono text-sm text-zinc-900">
                <KeyRound size={16} className="text-zinc-400" />
                {profile.bookId}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">User ID</p>
              <p className="mt-2 flex items-center gap-2 break-all font-mono text-sm text-zinc-900">
                <Fingerprint size={16} className="text-zinc-400" />
                {profile.userId}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Profile Status</p>
              <p className="mt-2 text-base font-semibold capitalize text-zinc-900">{profile.status}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
              <Shield size={18} className="text-zinc-600" />
              Security
            </h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-white">
                  {profile.mfaEnabled ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Two-Factor Authentication</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {profile.mfaEnabled ? 'TOTP is enabled for this account.' : 'TOTP is not enabled for this account.'}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  profile.mfaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {profile.mfaEnabled ? 'Enabled' : 'Required'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
