'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

type Employee = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleTitle: string;
  permissions: string | string[];
};

type SubAdmin = Employee & {
  isActive: boolean;
  hasInviteToken: boolean;
};

const PERMISSION_OPTIONS = [
  'manage_tutors',
  'manage_students',
  'manage_lessons',
  'manage_courses',
  'manage_reviews',
  'manage_payments',
  'manage_employees',
  'manage_settings',
  'view_reports',
  'impersonate_users',
];

const emptyForm = { firstName: '', lastName: '', email: '', roleTitle: '', permissions: '' };

export default function EmployeesTab() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '' });

  const employeesQuery = useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => {
      const { data } = await apiClient.get<Employee[]>('/admin/employees');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await apiClient.post('/admin/employees', {
        ...payload,
        permissions: payload.permissions.split(',').map(p => p.trim()).filter(Boolean),
      });
      return data;
    },
    onSuccess: (data: { temporaryPassword?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      closeModal();
      if (data?.temporaryPassword) {
        alert(
          lang === 'ar'
            ? `تم إنشاء حساب الموظف. كلمة المرور المؤقتة: ${data.temporaryPassword}`
            : `Employee account created. Temporary password: ${data.temporaryPassword}`,
        );
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & typeof form) => {
      const { data } = await apiClient.put(`/admin/employees/${id}`, {
        ...payload,
        permissions: payload.permissions.split(',').map(p => p.trim()).filter(Boolean),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      closeModal();
    },
  });

  const subadminsQuery = useQuery<SubAdmin[]>({
    queryKey: ['admin-subadmins'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/subadmins');
      return data;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: typeof inviteForm) => {
      const { data } = await apiClient.post('/admin/subadmins/invite', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subadmins'] });
      setInviteModal(false);
      setInviteForm({ firstName: '', lastName: '', email: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      roleTitle: emp.roleTitle,
      permissions: Array.isArray(emp.permissions) ? emp.permissions.join(', ') : (emp.permissions || ''),
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (lang === 'ar' ? !confirm('هل أنت متأكد من حذف هذا الموظف؟') : !confirm('Delete this employee?')) return;
    deleteMutation.mutate(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {employeesQuery.data?.length ?? 0} {lang === 'ar' ? 'موظف' : 'employees'}
        </span>
        <button onClick={openAdd} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          {lang === 'ar' ? 'إضافة موظف' : 'Add Employee'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المسمى الوظيفي' : 'Role'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : employeesQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'لا يوجد موظفون' : 'No employees'}
                  </td>
                </tr>
              ) : (
                employeesQuery.data?.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{emp.firstName} {emp.lastName}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{emp.email}</td>
                    <td className="px-4 py-3"><span className="badge text-xs" style={{ background: 'rgba(212, 163, 83,0.1)', color: '#D4A353', border: '1px solid rgba(212, 163, 83,0.2)' }}>{emp.roleTitle}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(Array.isArray(emp.permissions) ? emp.permissions : (emp.permissions || '').split(',').map(p => p.trim()).filter(Boolean)).map((p) => (
                          <span key={p} className="badge text-xs" style={{ background: 'var(--bg-light)', color: 'var(--text-muted)' }}>{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <button onClick={() => openEdit(emp)} className="btn-ghost px-2 py-1 text-xs">{lang === 'ar' ? 'تعديل' : 'Edit'}</button>
                      <button onClick={() => handleDelete(emp.id)} className="btn-ghost px-2 py-1 text-xs" style={{ color: '#ef4444' }}>{lang === 'ar' ? 'حذف' : 'Delete'}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-lg rounded-2xl animate-scale-in" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                {editingId ? (lang === 'ar' ? 'تعديل موظف' : 'Edit Employee') : (lang === 'ar' ? 'إضافة موظف' : 'Add Employee')}
              </h3>
              <button onClick={closeModal} className="btn-ghost px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الاسم الأول' : 'First Name'}</label>
                  <input className="input-field" value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'اسم العائلة' : 'Last Name'}</label>
                  <input className="input-field" value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                <input className="input-field" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'المسمى الوظيفي' : 'Role Title'}</label>
                <input className="input-field" value={form.roleTitle} onChange={(e) => setForm(f => ({ ...f, roleTitle: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الصلاحيات (مفصولة بفواصل)' : 'Permissions (comma separated)'}</label>
                <input className="input-field" value={form.permissions} onChange={(e) => setForm(f => ({ ...f, permissions: e.target.value }))} placeholder="manage_tutors, manage_courses, view_reports" />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {PERMISSION_OPTIONS.join(', ')}
                </p>
              </div>
            </form>
            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn-secondary">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite SubAdmin Section */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
            {lang === 'ar' ? 'دعوة مشرف فرعي' : 'Invite Sub-Admin'}
          </h3>
          <button onClick={() => setInviteModal(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {lang === 'ar' ? 'دعوة' : 'Invite'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-light)' }}>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
              </tr>
            </thead>
            <tbody>
              {subadminsQuery.isLoading ? (
                <tr><td colSpan={4} className="px-4 py-3"><div className="h-5 skeleton rounded w-3/4" /></td></tr>
              ) : subadminsQuery.data?.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? 'لا يوجد مشرفون فرعيون' : 'No sub-admins'}</td></tr>
              ) : (
                subadminsQuery.data?.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-main)' }}>{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{s.email}</td>
                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <span className="badge text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>{lang === 'ar' ? 'نشط' : 'Active'}</span>
                      ) : s.hasInviteToken ? (
                        <span className="badge text-xs" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>{lang === 'ar' ? 'في انتظار القبول' : 'Pending'}</span>
                      ) : (
                        <span className="badge text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{lang === 'ar' ? 'غير نشط' : 'Inactive'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(Array.isArray(s.permissions)
                          ? s.permissions
                          : s.permissions
                            ? s.permissions.split(',')
                            : []
                        ).map((p) => (
                          <span key={p} className="badge text-xs" style={{ background: 'var(--bg-light)', color: 'var(--text-muted)' }}>{p}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl animate-scale-in" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'دعوة مشرف فرعي' : 'Invite Sub-Admin'}</h3>
              <button onClick={() => setInviteModal(false)} className="btn-ghost px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                <input className="input-field" type="email" value={inviteForm.email} onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'الاسم الأول' : 'First Name'}</label>
                  <input className="input-field" value={inviteForm.firstName} onChange={(e) => setInviteForm(f => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{lang === 'ar' ? 'اسم العائلة' : 'Last Name'}</label>
                  <input className="input-field" value={inviteForm.lastName} onChange={(e) => setInviteForm(f => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button type="button" onClick={() => setInviteModal(false)} className="btn-secondary">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button
                type="button"
                onClick={() => inviteMutation.mutate(inviteForm)}
                disabled={inviteMutation.isPending}
                className="btn-primary"
              >
                {inviteMutation.isPending ? (lang === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (lang === 'ar' ? 'إرسال الدعوة' : 'Send Invite')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
