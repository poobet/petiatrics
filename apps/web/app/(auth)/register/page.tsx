'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PawPrint, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@petiatrics/ui';
import { Input } from '@petiatrics/ui';
import { Label } from '@petiatrics/ui';
import { Alert } from '@petiatrics/ui';
import { apiClient, ApiError } from '../../../lib/api-client';

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const tCommon = useTranslations('common');
  const tErr = useTranslations('errors');

  const [form, setForm] = useState({
    clinicName: '',
    taxId: '',
    phone: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post('/auth/register-request', {
        clinicName: form.clinicName,
        taxId: form.taxId,
        phone: form.phone || undefined,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(tErr('generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h1>
            <p className="text-gray-600 mb-6">{t('successMessage')}</p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                {t('loginLink')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <PawPrint className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">{t('subtitle')}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-b pb-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Clinic Information
              </h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="clinicName">{t('clinicName')} *</Label>
                  <Input
                    id="clinicName"
                    name="clinicName"
                    required
                    value={form.clinicName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="taxId">{t('taxId')} *</Label>
                    <Input
                      id="taxId"
                      name="taxId"
                      required
                      value={form.taxId}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">{t('phone')}</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Owner Account
              </h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerName">{t('ownerName')} *</Label>
                  <Input
                    id="ownerName"
                    name="ownerName"
                    required
                    value={form.ownerName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerEmail">{t('ownerEmail')} *</Label>
                  <Input
                    id="ownerEmail"
                    name="ownerEmail"
                    type="email"
                    required
                    value={form.ownerEmail}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerPassword">{t('ownerPassword')} *</Label>
                  <Input
                    id="ownerPassword"
                    name="ownerPassword"
                    type="password"
                    required
                    minLength={8}
                    value={form.ownerPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? t('submitting') : t('submit')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {t('alreadyHaveAccount')}{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                {tCommon('back')}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Petiatrics © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
