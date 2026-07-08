'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  { key: 'profile', labelAr: 'الملف الشخصي', labelEn: 'Profile' },
  { key: 'email', labelAr: 'تغيير البريد', labelEn: 'Change Email' },
  { key: 'password', labelAr: 'كلمة المرور', labelEn: 'Password' },
  { key: 'payments', labelAr: 'طرق الدفع', labelEn: 'Payment Methods' },
  { key: 'history', labelAr: 'سجل الدفع', labelEn: 'Payment History' },
  { key: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications' },
  { key: 'danger', labelAr: 'حذف الحساب', labelEn: 'Delete Account' },
];

export default function SettingsView() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = (ar: string, en: string) => lang === 'ar' ? ar : en;
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
    onSuccess: () => showSuccess(t('تم تحديث الملف الشخصي', 'Profile updated successfully')),
  });

  const changeEmailMutation = useMutation({
    mutationFn: async (data: typeof emailForm) => {
      const { data: res } = await apiClient.put('/auth/email', data);
      return res;
    },
    onSuccess: () => {
      showSuccess(t('تم تغيير البريد الإلكتروني', 'Email changed successfully'));
      setEmailForm({ newEmail: '', password: '' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const { data: res } = await apiClient.put('/auth/password', data);
      return res;
    },
    onSuccess: () => {
      showSuccess(t('تم تغيير كلمة المرور', 'Password changed successfully'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { data: res } = await apiClient.delete('/auth/account');
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
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('الملف الشخصي', 'Profile')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('الاسم الأول', 'First Name')}</label>
                <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('الاسم الأخير', 'Last Name')}</label>
                <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('رقم الهاتف', 'Phone')}</label>
                <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder={t('أدخل رقم الهاتف', 'Enter phone number')} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('المنطقة الزمنية', 'Timezone')}</label>
                <select value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} className="input-field text-sm">
                  <option value={profileForm.timezone}>{profileForm.timezone}</option>
                </select>
              </div>
            </div>
            <button onClick={() => updateProfileMutation.mutate(profileForm)} disabled={updateProfileMutation.isPending} className="btn-primary mt-2">
              {updateProfileMutation.isPending ? t('جاري الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
            </button>
          </div>
        );

      case 'email':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('تغيير البريد الإلكتروني', 'Change Email')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('البريد الحالي:', 'Current email:')} <span className="font-semibold" style={{ color: 'var(--text-main)' }}>{user?.email}</span>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('البريد الجديد', 'New Email')}</label>
              <input type="email" value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('كلمة المرور للتأكيد', 'Password to confirm')}</label>
              <input type="password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} className="input-field text-sm" />
            </div>
            <button onClick={() => changeEmailMutation.mutate(emailForm)} disabled={changeEmailMutation.isPending || !emailForm.newEmail || !emailForm.password} className="btn-primary">
              {t('تغيير البريد', 'Change Email')}
            </button>
          </div>
        );

      case 'password':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('تغيير كلمة المرور', 'Change Password')}</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('كلمة المرور الحالية', 'Current Password')}</label>
              <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('كلمة المرور الجديدة', 'New Password')}</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>{t('تأكيد كلمة المرور', 'Confirm New Password')}</label>
              <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="input-field text-sm" />
            </div>
            <button
              onClick={() => {
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  alert(t('كلمة المرور غير متطابقة', 'Passwords do not match'));
                  return;
                }
                changePasswordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
              }}
              disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="btn-primary"
            >
              {t('تغيير كلمة المرور', 'Change Password')}
            </button>
          </div>
        );

      case 'payments':
        return (
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('طرق الدفع', 'Payment Methods')}</h3>
            {paymentMethods.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد طرق دفع مضافة', 'No payment methods added yet')}</p>
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
                        {t('افتراضي', 'Default')}
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
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>{t('سجل الدفع', 'Payment History')}</h3>
            {paymentHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد معاملات بعد', 'No transactions yet')}</p>
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
                        {record.status === 'approved' ? t('مكتمل', 'Approved') : t('فشل', 'Failed')}
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
          <div className="card p-6 space-y-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('إعدادات الإشعارات', 'Notification Preferences')}</h3>
            {[
              { key: 'lesson_reminders', labelAr: 'تذكير بالدروس', labelEn: 'Lesson Reminders' },
              { key: 'new_messages', labelAr: 'الرسائل الجديدة', labelEn: 'New Messages' },
              { key: 'promotions', labelAr: 'العروض والتخفيضات', labelEn: 'Promotions & Offers' },
              { key: 'payment_updates', labelAr: 'تحديثات الدفع', labelEn: 'Payment Updates' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-4 rounded-xl cursor-pointer" style={{ background: 'var(--bg-light)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                  {lang === 'ar' ? item.labelAr : item.labelEn}
                </span>
                <div className="relative w-10 h-5 rounded-full transition-colors cursor-pointer" style={{ background: '#D4A353' }}>
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" />
                </div>
              </label>
            ))}
          </div>
        );

      case 'danger':
        return (
          <div className="card p-6 space-y-4" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
            <h3 className="text-lg font-bold" style={{ color: '#ef4444' }}>{t('حذف الحساب', 'Delete Account')}</h3>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {t('حذف حسابك سيؤدي إلى إزالة جميع بياناتك بشكل دائم. لا يمكن التراجع عن هذا الإجراء.', 'Deleting your account will permanently remove all your data. This action cannot be undone.')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {t('اكتب "حذف" لتأكيد الحذف', 'Type "delete" to confirm')}
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="input-field text-sm"
                placeholder={t('حذف', 'delete')}
              />
            </div>
            <button
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteConfirm !== (lang === 'ar' ? 'حذف' : 'delete') || deleteAccountMutation.isPending}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: '#ef4444' }}
            >
              {deleteAccountMutation.isPending ? t('جاري الحذف...', 'Deleting...') : t('حذف الحساب', 'Delete Account')}
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
