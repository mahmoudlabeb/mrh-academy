'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import { useLanguage } from '@/contexts/language-context';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type TutorProfile = {
  userId: string;
  bio: string;
  specialization: string;
  languages: string[];
  hourlyRate: number;
  status: string;
  rejectionReason: string | null;
  documentUrl: string | null;
  user: User;
};

export default function TutorsTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const apiBaseUrl = getApiBaseUrl();
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editModal, setEditModal] = useState<TutorProfile | null>(null);
  const [editForm, setEditForm] = useState({ bio: '', specialization: '', languages: '', hourlyRate: 0, status: '' });

  const pendingQuery = useQuery({
    queryKey: ['pending-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>('/admin/tutors/pending');
      return data;
    },
  });

  const allQuery = useQuery({
    queryKey: ['all-tutors'],
    queryFn: async () => {
      const { data } = await apiClient.get<TutorProfile[]>('/admin/tutors');
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post(`/admin/tutors/${userId}/approve`);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-tutors'] });
      await queryClient.invalidateQueries({ queryKey: ['all-tutors'] });
      setSelectedTutor(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data } = await apiClient.post(`/admin/tutors/${userId}/reject`, { reason });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-tutors'] });
      await queryClient.invalidateQueries({ queryKey: ['all-tutors'] });
      setSelectedTutor(null);
      setRejectReason('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, ...updates }: { userId: string; bio: string; specialization: string; languages: string; hourlyRate: number; status: string }) => {
      const { data } = await apiClient.put(`/admin/tutors/${userId}`, {
        ...updates,
        languages: updates.languages.split(',').map(l => l.trim()),
      });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['all-tutors'] });
      await queryClient.invalidateQueries({ queryKey: ['pending-tutors'] });
      setEditModal(null);
    },
  });

  const tutors = activeTab === 'pending' ? pendingQuery.data : allQuery.data;
  const isLoading = pendingQuery.isLoading || allQuery.isLoading;

  const openEdit = (tutor: TutorProfile) => {
    setEditModal(tutor);
    setEditForm({
      bio: tutor.bio,
      specialization: tutor.specialization,
      languages: tutor.languages.join(', '),
      hourlyRate: tutor.hourlyRate,
      status: tutor.status,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color: '#D4A353' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => { setActiveTab('pending'); setSelectedTutor(null); }}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'pending' ? 'text-white shadow-sm' : ''}`}
          style={activeTab === 'pending' ? { background: '#D4A353', color: '#0F3A40' } : { color: 'var(--text-muted)' }}
        >
          {lang === 'ar' ? 'قيد الانتظار' : 'Pending'}
          {pendingQuery.data && (
            <span className="me-2 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(0,0,0,0.15)' }}>
              {pendingQuery.data.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('all'); setSelectedTutor(null); }}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'all' ? 'text-white shadow-sm' : ''}`}
          style={activeTab === 'all' ? { background: '#D4A353', color: '#0F3A40' } : { color: 'var(--text-muted)' }}
        >
          {lang === 'ar' ? 'جميع المدرسين' : 'All Tutors'}
        </button>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 space-y-3">
          {tutors?.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'لم يتم العثور على مدرسين' : 'No tutors found'}
              </p>
            </div>
          ) : (
            tutors?.map((tutor) => (
              <div
                key={tutor.userId}
                className="card p-4 cursor-pointer"
                style={selectedTutor?.userId === tutor.userId ? { borderColor: '#D4A353', boxShadow: '0 0 0 2px rgba(212, 163, 83,0.3)' } : {}}
              >
                <div className="flex items-center justify-between" onClick={() => setSelectedTutor(tutor)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: '#D4A353' }}>
                      {tutor.user.firstName[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--text-main)' }}>{tutor.user.firstName} {tutor.user.lastName}</h3>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tutor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge text-xs font-semibold"
                      style={tutor.status === 'pending' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' } : tutor.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {tutor.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : tutor.status === 'approved' ? (lang === 'ar' ? 'معتمد' : 'Approved') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(tutor); }}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedTutor && (
          <div className="w-96 shrink-0">
            <div className="card p-6 animate-scale-in" style={{ position: 'sticky', top: '1rem' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: '#D4A353' }}>
                    {selectedTutor.user.firstName[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{selectedTutor.user.firstName} {selectedTutor.user.lastName}</h2>
                    <span className="badge text-xs font-semibold mt-1"
                      style={selectedTutor.status === 'pending' ? { background: 'rgba(234,179,8,0.1)', color: '#eab308' } : selectedTutor.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      {selectedTutor.status === 'pending' ? (lang === 'ar' ? 'قيد الانتظار' : 'Pending') : selectedTutor.status === 'approved' ? (lang === 'ar' ? 'معتمد' : 'Approved') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedTutor(null)} className="btn-ghost px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <Field label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}>{selectedTutor.user.email}</Field>
                <Field label={lang === 'ar' ? 'التخصص' : 'Specialization'}>{selectedTutor.specialization}</Field>
                <Field label={lang === 'ar' ? 'اللغات' : 'Languages'}>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {selectedTutor.languages.map((langItem) => (
                      <span key={langItem} className="badge" style={{ background: 'var(--bg-light)', color: 'var(--text-muted)' }}>{langItem}</span>
                    ))}
                  </div>
                </Field>
                <Field label={lang === 'ar' ? 'السعر في الساعة' : 'Hourly Rate'}>
                  <span className="text-lg font-bold" style={{ color: '#D4A353' }}>${selectedTutor.hourlyRate.toFixed(2)}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/{lang === 'ar' ? 'ساعة' : 'hr'}</span>
                </Field>
                <Field label={lang === 'ar' ? 'نبذة عني' : 'Bio'}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{selectedTutor.bio}</p>
                </Field>
                {selectedTutor.documentUrl && (
                  <Field label={lang === 'ar' ? 'المستند' : 'Document'}>
                    <div className="flex gap-2 mt-1">
                      <a href={selectedTutor.documentUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {lang === 'ar' ? 'عرض المستند' : 'View Document'}
                      </a>
                      <a href={`${apiBaseUrl}/admin/tutors/${selectedTutor.userId}/pdf`} target="_blank" className="link inline-flex items-center gap-1 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        PDF
                      </a>
                    </div>
                  </Field>
                )}
              </div>

              {selectedTutor.status === 'approved' && (
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await apiClient.post('/admin/impersonate', { userId: selectedTutor.userId });
                        if (data.user) window.location.href = '/';
                      } catch {}
                    }}
                    className="btn-secondary w-full justify-center py-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    {lang === 'ar' ? 'انتحال شخصية المدرس' : 'Impersonate Tutor'}
                  </button>
                </div>
              )}

              {selectedTutor.status === 'pending' && (
                <div className="mt-6 space-y-3 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => approveMutation.mutate(selectedTutor.userId)}
                    disabled={approveMutation.isPending}
                    className="btn-primary w-full py-3"
                  >
                    {approveMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        {lang === 'ar' ? 'جاري الموافقة...' : 'Approving...'}
                      </span>
                    ) : (lang === 'ar' ? 'الموافقة على الطلب' : 'Approve Request')}
                  </button>

                  <div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={lang === 'ar' ? 'أدخل سبب الرفض...' : 'Enter rejection reason...'}
                      className="input-field resize-none"
                      rows={3}
                    />
                    <button
                      onClick={() => rejectMutation.mutate({ userId: selectedTutor.userId, reason: rejectReason })}
                      disabled={rejectMutation.isPending || !rejectReason}
                      className="btn-secondary w-full justify-center py-3 mt-2"
                      style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                    >
                      {rejectMutation.isPending ? (lang === 'ar' ? 'جاري الرفض...' : 'Rejecting...') : (lang === 'ar' ? 'رفض الطلب' : 'Reject Request')}
                    </button>
                  </div>
                </div>
              )}

              {selectedTutor.status !== 'pending' && selectedTutor.rejectionReason && (
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#ef4444' }}>{lang === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}</p>
                    <p className="text-sm" style={{ color: '#ef4444' }}>{selectedTutor.rejectionReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg rounded-2xl animate-scale-in" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'تعديل المدرس' : 'Edit Tutor'} - {editModal.user.firstName} {editModal.user.lastName}
              </h3>
              <button onClick={() => setEditModal(null)} className="btn-ghost px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'نبذة عني' : 'Bio'}</label>
                <textarea className="input-field resize-none" rows={3} value={editForm.bio} onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'التخصص' : 'Specialization'}</label>
                <input className="input-field" value={editForm.specialization} onChange={(e) => setEditForm(f => ({ ...f, specialization: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'اللغات (مفصولة بفواصل)' : 'Languages (comma separated)'}</label>
                <input className="input-field" value={editForm.languages} onChange={(e) => setEditForm(f => ({ ...f, languages: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'السعر في الساعة' : 'Hourly Rate'}</label>
                <input className="input-field" type="number" min={0} step={0.5} value={editForm.hourlyRate} onChange={(e) => setEditForm(f => ({ ...f, hourlyRate: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</label>
                <select className="input-field" value={editForm.status} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
                  <option value="approved">{lang === 'ar' ? 'معتمد' : 'Approved'}</option>
                  <option value="rejected">{lang === 'ar' ? 'مرفوض' : 'Rejected'}</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button onClick={() => setEditModal(null)} className="btn-secondary">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button
                onClick={() => updateMutation.mutate({ userId: editModal.userId, ...editForm })}
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="mt-1 text-sm" style={{ color: 'var(--text-main)' }}>{children}</div>
    </div>
  );
}
