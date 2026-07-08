'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';

export default function SettingsView() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const t = (ar: string, en: string) => isAr ? ar : en;

  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [teachingLanguages, setTeachingLanguages] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyBrowser, setNotifyBrowser] = useState(true);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>{t('الإعدادات', 'Settings')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('إدارة إعدادات حسابك.', 'Manage your account settings.')}</p>
      </div>

      {/* Profile Editing */}
      <div className="card-dark p-6 space-y-5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('الملف الشخصي', 'Profile')}</h3>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('السيرة الذاتية', 'Bio')}</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('قدم نفسك للطلاب...', 'Introduce yourself to students...')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('التخصص', 'Specialization')}</label>
          <input
            className="input-field"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder={t('مثال: قواعد، محادثة', 'e.g. Grammar, Conversation')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('لغات التدريس', 'Teaching Languages')}</label>
            <input
              className="input-field"
              value={teachingLanguages}
              onChange={(e) => setTeachingLanguages(e.target.value)}
              placeholder={t('العربية، الإنجليزية', 'Arabic, English')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('السعر للساعة ($)', 'Hourly Rate ($)')}</label>
            <input
              className="input-field"
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>
        <button className="btn-primary">{t('حفظ التغييرات', 'Save Changes')}</button>
      </div>

      {/* Password Change */}
      <div className="card-dark p-6 space-y-5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('تغيير كلمة المرور', 'Change Password')}</h3>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('كلمة المرور الحالية', 'Current Password')}</label>
          <input className="input-field" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('كلمة المرور الجديدة', 'New Password')}</label>
            <input className="input-field" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('تأكيد كلمة المرور', 'Confirm Password')}</label>
            <input className="input-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary">{t('تغيير كلمة المرور', 'Change Password')}</button>
      </div>

      {/* Availability Link */}
      <div className="card-dark p-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('إدارة المواعيد', 'Manage Availability')}</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('حدد أوقات التدريس المتاحة.', 'Set your available teaching hours.')}</p>
        </div>
        <Link href="/tutor/availability" className="btn-outline-gold text-sm px-4 py-2">
          {t('فتح التقويم', 'Open Calendar')}
        </Link>
      </div>

      {/* Notification Preferences */}
      <div className="card-dark p-6 space-y-5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('إشعارات', 'Notifications')}</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-main)' }}>{t('إشعارات البريد الإلكتروني', 'Email Notifications')}</span>
            <button
              onClick={() => setNotifyEmail(!notifyEmail)}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifyEmail ? 'bg-[var(--primary-color)]' : ''}`}
              style={{ background: notifyEmail ? 'var(--primary-color)' : 'var(--border-color)' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyEmail ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-main)' }}>{t('إشعارات SMS', 'SMS Notifications')}</span>
            <button
              onClick={() => setNotifySms(!notifySms)}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifySms ? 'bg-[var(--primary-color)]' : ''}`}
              style={{ background: notifySms ? 'var(--primary-color)' : 'var(--border-color)' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifySms ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-main)' }}>{t('إشعارات المتصفح', 'Browser Notifications')}</span>
            <button
              onClick={() => setNotifyBrowser(!notifyBrowser)}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifyBrowser ? 'bg-[var(--primary-color)]' : ''}`}
              style={{ background: notifyBrowser ? 'var(--primary-color)' : 'var(--border-color)' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${notifyBrowser ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>
        <button className="btn-primary">{t('حفظ الإعدادات', 'Save Settings')}</button>
      </div>
    </div>
  );
}
