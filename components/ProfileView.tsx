import React, { useEffect, useMemo, useState } from 'react';
import { AuthMetadata, Language } from '../types';
import { DICTIONARY } from '../constants';
import { User, Mail, Phone, Briefcase, Save, Shield, Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { authFetch, authMetadataFromPayload, saveAuthMetadata } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

interface ProfileViewProps {
  lang: Language;
  sessionMeta?: AuthMetadata | null;
  onProfileUpdate?: (metadata: AuthMetadata) => void;
}

type ProfileForm = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
};

const formFromMetadata = (meta?: AuthMetadata | null): ProfileForm => ({
  username: meta?.username || '',
  email: meta?.email || '',
  first_name: meta?.firstName || '',
  last_name: meta?.lastName || '',
  phone: meta?.phone || '',
});

const formFromPayload = (payload: any, fallback?: AuthMetadata | null): ProfileForm => ({
  username: String(payload?.username ?? fallback?.username ?? ''),
  email: String(payload?.email ?? fallback?.email ?? ''),
  first_name: String(payload?.first_name ?? fallback?.firstName ?? ''),
  last_name: String(payload?.last_name ?? fallback?.lastName ?? ''),
  phone: String(payload?.phone ?? fallback?.phone ?? ''),
});

export const ProfileView: React.FC<ProfileViewProps> = ({ lang, sessionMeta, onProfileUpdate }) => {
  const t = DICTIONARY[lang];
  const [form, setForm] = useState<ProfileForm>(() => formFromMetadata(sessionMeta));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roleLabel = sessionMeta?.isSuperuser
    ? 'Superadmin'
    : sessionMeta?.isStaff
      ? 'Staff'
      : 'User';

  const displayName = useMemo(() => {
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ').trim();
    return fullName || form.username || (lang === 'ar' ? 'System User' : 'System User');
  }, [form.first_name, form.last_name, form.username, lang]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setIsLoading(true);
      setMessage(null);
      try {
        const res = await authFetch(`${API_BASE_URL}/api/profile/`, {
          headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
        });
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok) {
          throw new Error(payload?.detail || text || 'Failed to load profile');
        }
        if (!cancelled) {
          setForm(formFromPayload(payload, sessionMeta));
          const nextMeta = {
            ...(sessionMeta || {}),
            ...authMetadataFromPayload(payload),
            permissions: sessionMeta?.permissions,
          };
          saveAuthMetadata(nextMeta);
          onProfileUpdate?.(nextMeta);
        }
      } catch (error) {
        console.error('Failed to load profile', error);
        if (!cancelled) {
          setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load profile' });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      setMessage({ type: 'error', text: 'Username is required.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': lang === 'ar' ? 'ar' : 'en',
        },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim(),
        }),
      });
      const text = await res.text();
      const payload = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const detail = payload?.detail || payload?.username?.[0] || payload?.email?.[0] || text || 'Failed to save profile';
        throw new Error(detail);
      }

      setForm(formFromPayload(payload, sessionMeta));
      const nextMeta = {
        ...(sessionMeta || {}),
        ...authMetadataFromPayload(payload),
        permissions: sessionMeta?.permissions,
      };
      saveAuthMetadata(nextMeta);
      onProfileUpdate?.(nextMeta);
      setMessage({ type: 'success', text: 'Profile saved.' });
    } catch (error) {
      console.error('Failed to save profile', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <div className="relative mb-20">
        <div className="h-48 bg-gradient-to-r from-water-600 to-slate-700 rounded-xl shadow-md"></div>
        <div className="absolute -bottom-12 left-8 flex items-end gap-6">
          <div className="w-32 h-32 rounded-full bg-white dark:bg-slate-800 p-1.5 shadow-xl">
            <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden">
              <User size={60} />
            </div>
          </div>
          <div className="pb-2">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white drop-shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-1 rounded-lg inline-block mb-1">
              {displayName}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 font-medium bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-0.5 rounded-lg">
              {roleLabel}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Shield size={18} className="text-water-500" />
              {t.role}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Briefcase size={16} className="text-slate-400" />
                <span>{sessionMeta?.group?.name || roleLabel}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Building2 size={16} className="text-slate-400" />
                <span>{sessionMeta?.company?.name || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
              {t.personalInfo}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.name}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                  <input
                    type="text"
                    value={form.username}
                    onChange={event => updateField('username', event.target.value)}
                    autoComplete="username"
                    className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.email}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={event => updateField('email', event.target.value)}
                    autoComplete="email"
                    className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">First name</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={event => updateField('first_name', event.target.value)}
                  autoComplete="given-name"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Last name</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={event => updateField('last_name', event.target.value)}
                  autoComplete="family-name"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.phone}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={event => updateField('phone', event.target.value)}
                    autoComplete="tel"
                    className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.role}</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                  <input
                    type="text"
                    value={roleLabel}
                    disabled
                    className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={isLoading || isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-water-600 text-white rounded-lg hover:bg-water-700 transition-colors font-medium shadow-lg shadow-water-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={18} />
                )}
                {t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
