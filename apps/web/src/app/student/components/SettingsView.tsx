'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import NotificationPreferencesPanel from '@/components/NotificationPreferencesPanel';

type SettingsSection = 'profile' | 'email' | 'password' | 'payments' | 'history' | 'notifications' | 'danger';

interface PaymentMethod {
  id: string;
  type: string;
  last4?: string;
  isDefault: boolean;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

const sections: { key: SettingsSection; labelAr: string; labelEn: string }[] = [
  { key: 'profile', labelAr: 'ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ', labelEn: 'Profile' },
  { key: 'email', labelAr: 'طھط؛ظٹظٹط± ط§ظ„ط¨ط±ظٹط¯', labelEn: 'Change Email' },
  { key: 'password', labelAr: 'ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', labelEn: 'Password' },
  { key: 'payments', labelAr: 'ط·ط±ظ‚ ط§ظ„ط¯ظپط¹', labelEn: 'Payment Methods' },
  { key: 'history', labelAr: 'ط³ط¬ظ„ ط§ظ„ط¯ظپط¹', labelEn: 'Payment History' },
  { key: 'notifications', labelAr: 'ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ', labelEn: 'Notifications' },
  { key: 'danger', labelAr: 'ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨', labelEn: 'Delete Account' },
];

export default function SettingsView() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/payment-methods');
      return data;
    },
  });

  const { data: paymentHistory = [] } = useQuery<PaymentRecord[]>({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const { data } = await apiClient.get('/students/payment-history');
      return data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const { data: res } = await apiClient.put('/students/profile', data);
      return res;
    },
    onSuccess: () => showSuccess(t('طھظ… طھط­ط¯ظٹط« ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ', 'Profile updated successfully')),
  });

  const changeEmailMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      const { data: res } = await apiClient.patch('/users/change-email', {
        newEmail: data.newEmail,
        currentPassword: data.password,
      });
      return res;
    },
    onSuccess: () => {
      showSuccess(t('طھظ… طھط؛ظٹظٹط± ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'Email changed successfully'));
      setEmailForm({ newEmail: '', password: '' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const { data: res } = await apiClient.patch('/users/change-password', data);
      return res;
    },
    onSuccess: () => {
      showSuccess(t('طھظ… طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Password changed successfully'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await apiClient.delete('/users/me');
      return res;
    },
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="card p-6 space-y-5">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ', 'Profile')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ط§ط³ظ… ط§ظ„ط£ظˆظ„', 'First Name')}</label>
                <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ط§ط³ظ… ط§ظ„ط£ط®ظٹط±', 'Last Name')}</label>
                <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ', 'Phone')}</label>
                <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder={t('ط£ط¯ط®ظ„ ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ', 'Enter phone number')} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ظ…ظ†ط·ظ‚ط© ط§ظ„ط²ظ…ظ†ظٹط©', 'Timezone')}</label>
                <select value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} className="input-field text-sm">
                  <option value={profileForm.timezone}>{profileForm.timezone}</option>
                </select>
              </div>
            </div>
            <button onClick={() => updateProfileMutation.mutate(profileForm)} disabled={updateProfileMutation.isPending} className="btn-primary mt-2">
              {updateProfileMutation.isPending ? t('ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...', 'Saving...') : t('ط­ظپط¸ ط§ظ„طھط؛ظٹظٹط±ط§طھ', 'Save Changes')}
            </button>
          </div>
        );

      case 'email':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('طھط؛ظٹظٹط± ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ', 'Change Email')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط­ط§ظ„ظٹ:', 'Current email:')} <span className="font-semibold" style={{ color: 'var(--text-main)' }}>{user?.email}</span>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¬ط¯ظٹط¯', 'New Email')}</label>
              <input type="email" value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ظ„ظ„طھط£ظƒظٹط¯', 'Password to confirm')}</label>
              <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} className="input-field text-sm" />
            </div>
            <button onClick={() => changeEmailMutation.mutate(emailForm)} disabled={changeEmailMutation.isPending || !emailForm.newEmail || !emailForm.password} className="btn-primary">
              {t('طھط؛ظٹظٹط± ط§ظ„ط¨ط±ظٹط¯', 'Change Email')}
            </button>
          </div>
        );

      case 'password':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Change Password')}</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط­ط§ظ„ظٹط©', 'Current Password')}</label>
              <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط¬ط¯ظٹط¯ط©', 'New Password')}</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('طھط£ظƒظٹط¯ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Confirm New Password')}</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <button
              onClick={() => {
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  alert(t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± ظ…طھط·ط§ط¨ظ‚ط©', 'Passwords do not match'));
                  return;
                }
                changePasswordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
              }}
              disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="btn-primary"
            >
              {t('طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Change Password')}
            </button>
          </div>
        );

      case 'payments':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('ط·ط±ظ‚ ط§ظ„ط¯ظپط¹', 'Payment Methods')}</h3>
            {paymentMethods.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ظ„ط§ طھظˆط¬ط¯ ط·ط±ظ‚ ط¯ظپط¹ ظ…ط¶ط§ظپط©', 'No payment methods added yet')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-light)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{pm.type}</p>
                        {pm.last4 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>**** {pm.last4}</p>}
                      </div>
                    </div>
                    {pm.isDefault && (
                      <span className="badge text-[10px]" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353' }}>
                        {t('ط§ظپطھط±ط§ط¶ظٹ', 'Default')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>{t('ط³ط¬ظ„ ط§ظ„ط¯ظپط¹', 'Payment History')}</h3>
            {paymentHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ظ„ط§ طھظˆط¬ط¯ ظ…ط¹ط§ظ…ظ„ط§طھ ط¨ط¹ط¯', 'No transactions yet')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-light)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>${record.amount}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{record.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(record.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                      </p>
                      <span
                        className="badge text-[10px] mt-1"
                        style={{
                          background: record.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: record.status === 'approved' ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {record.status === 'approved' ? t('ظ…ظƒطھظ…ظ„', 'Approved') : t('ظپط´ظ„', 'Failed')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'notifications':
        return (
          <NotificationPreferencesPanel lang={lang} t={t} />
        );

      case 'danger':
        return (
          <div className="card p-6 space-y-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <h3 className="text-lg font-bold" style={{ color: '#ef4444' }}>{t('ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨', 'Delete Account')}</h3>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t('ط­ط°ظپ ط­ط³ط§ط¨ظƒ ط³ظٹط¤ط¯ظٹ ط¥ظ„ظ‰ ط¥ط²ط§ظ„ط© ط¬ظ…ظٹط¹ ط¨ظٹط§ظ†ط§طھظƒ ط¨ط´ظƒظ„ ط¯ط§ط¦ظ…. ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط±ط§ط¬ط¹ ط¹ظ† ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط،.', 'Deleting your account will permanently remove all your data. This action cannot be undone.')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {t('ط§ظƒطھط¨ "ط­ط°ظپ" ظ„طھط£ظƒظٹط¯ ط§ظ„ط­ط°ظپ', 'Type "delete" to confirm')}
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="input-field text-sm"
                placeholder={t('ط­ط°ظپ', 'delete')}
              />
            </div>
            <button
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteConfirm !== (lang === 'ar' ? 'ط­ط°ظپ' : 'delete') || deleteAccountMutation.isPending}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: '#ef4444' }}
            >
              {deleteAccountMutation.isPending ? t('ط¬ط§ط±ظٹ ط§ظ„ط­ط°ظپ...', 'Deleting...') : t('ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨', 'Delete Account')}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex gap-6">
      <nav className="w-56 shrink-0">
        <div className="card p-2 sticky top-24" style={{ border: '1px solid var(--border-color)' }}>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full text-right px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === s.key ? 'text-[#D4A353]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              style={{ background: activeSection === s.key ? 'rgba(212, 163, 83,0.08)' : 'transparent' }}
            >
              {lang === 'ar' ? s.labelAr : s.labelEn}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        {successMsg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold animate-slide-up" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
            {successMsg}
          </div>
        )}
        {renderSection()}
      </div>
    </div>
  );
}

