'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type PlatformSettings = {
  platform_name: string;
  contact_email: string;
  default_lesson_price: number;
  maintenance_mode: boolean;
};

export default function SettingsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<PlatformSettings>('/admin/settings');
      return data;
    },
  });

  const [form, setForm] = useState<PlatformSettings>({
    platform_name: '',
    contact_email: '',
    default_lesson_price: 0,
    maintenance_mode: false,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        ...settingsQuery.data,
        maintenance_mode: settingsQuery.data.maintenance_mode === true || String(settingsQuery.data.maintenance_mode) === 'true',
      });
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: PlatformSettings) => {
      const { data } = await apiClient.put('/admin/settings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-5" style={{ color: 'var(--text-main)' }}>
          {lang === 'ar' ? 'إعدادات المنصة' : 'Platform Settings'}
        </h3>

        {settingsQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-4 skeleton rounded w-1/4 mb-2" />
                <div className="h-10 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'اسم المنصة' : 'Platform Name'}
              </label>
              <input
                className="input-field"
                value={form.platform_name}
                onChange={(e) => setForm(f => ({ ...f, platform_name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'البريد الإلكتروني للتواصل' : 'Contact Email'}
              </label>
              <input
                className="input-field"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'سعر الدرس الافتراضي' : 'Default Lesson Price'}
              </label>
              <input
                className="input-field"
                type="number"
                min={0}
                step={0.5}
                value={form.default_lesson_price}
                onChange={(e) => setForm(f => ({ ...f, default_lesson_price: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="w-10 h-5 rounded-full transition-colors relative" style={{ background: form.maintenance_mode ? '#D4A353' : 'var(--border-color)' }}>
                  <input
                    type="checkbox"
                    checked={form.maintenance_mode}
                    onChange={(e) => setForm(f => ({ ...f, maintenance_mode: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.maintenance_mode ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                  {lang === 'ar' ? 'وضع الصيانة' : 'Maintenance Mode'}
                </span>
              </label>
              <p className="text-xs mt-1 me-12" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'عند التفعيل، سيتم عرض صفحة صيانة للمستخدمين' : 'When enabled, users will see a maintenance page'}
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                  </span>
                ) : (
                  lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'
                )}
              </button>

              {updateMutation.isSuccess && (
                <span className="me-4 text-sm" style={{ color: '#22c55e' }}>
                  {lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
