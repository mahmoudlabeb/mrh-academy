'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Link from 'next/link';
import NotificationPreferencesPanel from '@/components/NotificationPreferencesPanel';

type TutorProfile = {
  bio?: string;
  specialization?: string;
  languages?: string[];
  hourlyRate?: number;
};

export default function SettingsView() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [teachingLanguages, setTeachingLanguages] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const profileQuery = useQuery({
    queryKey: ['tutor-profile'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile>('/tutors/me/profile');
      return data;
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setBio(profileQuery.data.bio || '');
      setSpecialization(profileQuery.data.specialization || '');
      setTeachingLanguages((profileQuery.data.languages || []).join(', '));
      setHourlyRate(
        profileQuery.data.hourlyRate != null
          ? String(profileQuery.data.hourlyRate)
          : '',
      );
    }
  }, [profileQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const languages = teachingLanguages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      const { data } = await apiClient.put('/tutors/me/profile', {
        bio,
        specialization,
        languages,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
      setProfileMessage(t('طھظ… ط­ظپط¸ ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ', 'Profile saved'));
    },
    onError: () => {
      setProfileMessage(t('ظپط´ظ„ ط§ظ„ط­ظپط¸', 'Save failed'));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error('mismatch');
      }
      await apiClient.patch('/users/change-password', {
        currentPassword,
        newPassword,
      });
    },
    onSuccess: () => {
      setPasswordMessage(t('طھظ… طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Password changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => {
      setPasswordMessage(
        err.message === 'mismatch'
          ? t('ظƒظ„ظ…ط§طھ ط§ظ„ظ…ط±ظˆط± ط؛ظٹط± ظ…طھط·ط§ط¨ظ‚ط©', 'Passwords do not match')
          : t('ظپط´ظ„ طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Password change failed'),
      );
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
          {t('ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ', 'Settings')}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t('ط¥ط¯ط§ط±ط© ط¥ط¹ط¯ط§ط¯ط§طھ ط­ط³ط§ط¨ظƒ.', 'Manage your account settings.')}
        </p>
      </div>

      <div className="card-dark p-6 space-y-5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
          {t('ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ', 'Profile')}
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
            {t('ط§ظ„ط³ظٹط±ط© ط§ظ„ط°ط§طھظٹط©', 'Bio')}
          </label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('ظ‚ط¯ظ… ظ†ظپط³ظƒ ظ„ظ„ط·ظ„ط§ط¨...', 'Introduce yourself to students...')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
            {t('ط§ظ„طھط®طµطµ', 'Specialization')}
          </label>
          <input
            className="input-field"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder={t('ظ…ط«ط§ظ„: ظ‚ظˆط§ط¹ط¯طŒ ظ…ط­ط§ط¯ط«ط©', 'e.g. Grammar, Conversation')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('ظ„ط؛ط§طھ ط§ظ„طھط¯ط±ظٹط³', 'Teaching Languages')}
            </label>
            <input
              className="input-field"
              value={teachingLanguages}
              onChange={(e) => setTeachingLanguages(e.target.value)}
              placeholder={t('ط§ظ„ط¹ط±ط¨ظٹط©طŒ ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹط©', 'Arabic, English')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('ط§ظ„ط³ط¹ط± ظ„ظ„ط³ط§ط¹ط© ($)', 'Hourly Rate ($)')}
            </label>
            <input
              className="input-field"
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>
        {profileMessage && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{profileMessage}</p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={saveProfileMutation.isPending}
          onClick={() => saveProfileMutation.mutate()}
        >
          {t('ط­ظپط¸ ط§ظ„طھط؛ظٹظٹط±ط§طھ', 'Save Changes')}
        </button>
      </div>

      <div className="card-dark p-6 space-y-5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
          {t('طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Change Password')}
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
            {t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط­ط§ظ„ظٹط©', 'Current Password')}
          </label>
          <input
            className="input-field"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط§ظ„ط¬ط¯ظٹط¯ط©', 'New Password')}
            </label>
            <input
              className="input-field"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-main)' }}>
              {t('طھط£ظƒظٹط¯ ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Confirm Password')}
            </label>
            <input
              className="input-field"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        {passwordMessage && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{passwordMessage}</p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={changePasswordMutation.isPending}
          onClick={() => changePasswordMutation.mutate()}
        >
          {t('طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±', 'Change Password')}
        </button>
      </div>

      <div className="card-dark p-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
            {t('ط¥ط¯ط§ط±ط© ط§ظ„ظ…ظˆط§ط¹ظٹط¯', 'Manage Availability')}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('ط­ط¯ط¯ ط£ظˆظ‚ط§طھ ط§ظ„طھط¯ط±ظٹط³ ط§ظ„ظ…طھط§ط­ط©.', 'Set your available teaching hours.')}
          </p>
        </div>
        <Link href="/tutor/availability" className="btn-outline-gold text-sm px-4 py-2">
          {t('ظپطھط­ ط§ظ„طھظ‚ظˆظٹظ…', 'Open Calendar')}
        </Link>
      </div>

      <div className="card-dark p-6 space-y-5">
        <NotificationPreferencesPanel lang={lang} t={t} />
      </div>
    </div>
  );
}


