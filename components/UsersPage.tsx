import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Users as UsersIcon,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';
import { Language, AuthMetadata } from '../types';
import { DICTIONARY } from '../constants';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type UserRecord = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  is_active: boolean;
  group?: { id: number; name: string } | null;
  company?: { id: number; name: string } | null;
};

type GroupRecord = { id: number; name: string };

type CreateUserFormState = {
  username: string;
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  group_id: number | '';
};

interface UsersPageProps {
  lang: Language;
  sessionMeta?: AuthMetadata | null;
}

const initialCreateForm: CreateUserFormState = {
  username: '',
  password: '',
  email: '',
  first_name: '',
  last_name: '',
  is_active: true,
  group_id: '',
};

const signalLoading = (start: boolean) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(start ? 'app:loading:start' : 'app:loading:stop'));
  }
};

const normalizeGroup = (value: any): { id: number; name: string } | null => {
  const id = Number(value?.id);
  const name = typeof value?.name === 'string' ? value.name : '';
  if (!id || !name) return null;
  return { id, name };
};

const normalizeUser = (value: any): UserRecord | null => {
  const id = Number(value?.id);
  const username = typeof value?.username === 'string' ? value.username : '';
  if (!id || !username) return null;

  return {
    id,
    username,
    email: typeof value?.email === 'string' ? value.email : '',
    first_name: typeof value?.first_name === 'string' ? value.first_name : '',
    last_name: typeof value?.last_name === 'string' ? value.last_name : '',
    is_staff: Boolean(value?.is_staff),
    is_active: Boolean(value?.is_active),
    group: normalizeGroup(value?.group),
    company: normalizeGroup(value?.company),
  };
};

const extractApiError = (payload: any, fallback: string) => {
  if (!payload) return fallback;
  if (typeof payload?.detail === 'string' && payload.detail.trim()) return payload.detail;
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;

  if (Array.isArray(payload?.non_field_errors) && payload.non_field_errors.length) {
    return String(payload.non_field_errors[0]);
  }

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.trim()) {
      return `${key}: ${value}`;
    }
    if (Array.isArray(value) && value.length) {
      return `${key}: ${String(value[0])}`;
    }
  }

  return fallback;
};

export const UsersPage: React.FC<UsersPageProps> = ({ lang, sessionMeta }) => {
  const t = DICTIONARY[lang];
  const isSuperAdmin = Boolean(sessionMeta?.isSuperuser);

  const text = lang === 'ar'
    ? {
      pageSubtitleSuper: 'إنشاء مستخدمين جدد وإدارة المجموعات من نفس الصفحة.',
      pageSubtitleStandard: 'يمكنك إنشاء مستخدمين داخل نفس الشركة أو المؤسسة المرتبطة بحسابك.',
      createCardTitle: 'إضافة مستخدم',
      createCardSubtitle: 'سيتم نسخ الشركة أو المؤسسة تلقائياً من المستخدم الحالي.',
      adminToolsEnabled: 'أدوات إدارة المستخدمين والمجموعات متاحة لك كمشرف عام.',
      limitedAccessNote: 'عرض جميع المستخدمين وإسناد المجموعات متاحان للمشرف العام فقط.',
      createUsernameLabel: 'اسم المستخدم',
      createPasswordLabel: 'كلمة المرور',
      createEmailLabel: 'البريد الإلكتروني',
      createFirstNameLabel: 'الاسم الأول',
      createLastNameLabel: 'الاسم الأخير',
      createActiveLabel: 'حساب نشط',
      createGroupLabel: 'المجموعة عند الإنشاء',
      createGroupHintSuper: 'اختياري. إذا اخترت مجموعة فسيتم ربط المستخدم بها مباشرة.',
      createGroupHintStandard: 'إسناد مجموعة أثناء الإنشاء متاح للمشرف العام فقط.',
      createSubmit: 'إنشاء المستخدم',
      createSubmitLoading: 'جارٍ الإنشاء...',
      createSuccess: 'تم إنشاء المستخدم بنجاح',
      createError: 'تعذر إنشاء المستخدم',
      managedUsersTitle: 'المستخدمون الحاليون',
      managedUsersSubtitle: 'تغيير المجموعة الحالية يتطلب صلاحيات المشرف العام.',
      noUsersVisible: 'لا يوجد مستخدمون لعرضهم.',
      fullNameLabel: 'الاسم الكامل',
      companyLabel: 'الشركة',
      noValue: '—',
      activeLabel: 'نشط',
      inactiveLabel: 'غير نشط',
      staffLabel: 'موظف',
    }
    : {
      pageSubtitleSuper: 'Create users and manage groups from the same page.',
      pageSubtitleStandard: 'Create users inside the same company or organization linked to your account.',
      createCardTitle: 'Add user',
      createCardSubtitle: 'The company or organization is copied automatically from the authenticated user.',
      adminToolsEnabled: 'User and group management tools are enabled for your superadmin session.',
      limitedAccessNote: 'Viewing all users and assigning groups remain limited to superadmin.',
      createUsernameLabel: 'Username',
      createPasswordLabel: 'Password',
      createEmailLabel: 'Email',
      createFirstNameLabel: 'First name',
      createLastNameLabel: 'Last name',
      createActiveLabel: 'Active account',
      createGroupLabel: 'Group on creation',
      createGroupHintSuper: 'Optional. If selected, the new user is assigned to that group immediately.',
      createGroupHintStandard: 'Assigning a group during creation is available to superadmin only.',
      createSubmit: 'Create user',
      createSubmitLoading: 'Creating...',
      createSuccess: 'User created successfully',
      createError: 'Could not create user',
      managedUsersTitle: 'Existing users',
      managedUsersSubtitle: 'Changing the current group requires superadmin permissions.',
      noUsersVisible: 'No users to display.',
      fullNameLabel: 'Full name',
      companyLabel: 'Company',
      noValue: '—',
      activeLabel: 'Active',
      inactiveLabel: 'Inactive',
      staffLabel: 'Staff',
    };

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Record<number, number | ''>>({});
  const [userGroup, setUserGroup] = useState<Record<number, { id: number; name: string } | null>>({});
  const [createForm, setCreateForm] = useState<CreateUserFormState>(initialCreateForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);

  const loadUsers = async () => {
    if (!isSuperAdmin) return;

    setIsUsersLoading(true);
    signalLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/users`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const normalizedUsers = items.map(normalizeUser).filter(Boolean) as UserRecord[];

      setUsers(normalizedUsers);

      const groupMap: Record<number, { id: number; name: string } | null> = {};
      const selectedMap: Record<number, number | ''> = {};

      normalizedUsers.forEach((user) => {
        if (user.group?.id && user.group?.name) {
          groupMap[user.id] = user.group;
          selectedMap[user.id] = user.group.id;
        }
      });

      setUserGroup(groupMap);
      setSelectedGroup(selectedMap);
    } catch (err) {
      console.error('Failed to load users', err);
      setMessage({ type: 'error', text: t.usersLoadFailed });
    } finally {
      setIsUsersLoading(false);
      signalLoading(false);
    }
  };

  const loadGroups = async () => {
    if (!isSuperAdmin) return;

    setIsGroupsLoading(true);
    signalLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/groups/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray((data as any)?.results) ? (data as any).results : Array.isArray(data) ? data : [];
      const normalized = items
        .map((group: any) => ({ id: Number(group?.id), name: typeof group?.name === 'string' ? group.name : '' }))
        .filter((group) => group.id && group.name);

      setGroups(normalized);
    } catch (err) {
      console.error('Failed to load groups', err);
      setMessage({ type: 'error', text: t.groupsLoadFailed });
    } finally {
      setIsGroupsLoading(false);
      signalLoading(false);
    }
  };

  useEffect(() => {
    setMessage(null);
    if (isSuperAdmin) {
      loadUsers();
      loadGroups();
    } else {
      setUsers([]);
      setGroups([]);
      setSelectedGroup({});
      setUserGroup({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, isSuperAdmin]);

  const handleCreateFormChange = <K extends keyof CreateUserFormState>(key: K, value: CreateUserFormState[K]) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsCreatingUser(true);
    setMessage(null);
    signalLoading(true);

    const bodyPayload: Record<string, unknown> = {
      username: createForm.username.trim(),
      password: createForm.password,
      email: createForm.email.trim(),
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      is_active: createForm.is_active,
    };

    if (isSuperAdmin && typeof createForm.group_id === 'number') {
      bodyPayload.group_id = createForm.group_id;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': lang === 'ar' ? 'ar' : 'en',
        },
        body: JSON.stringify(bodyPayload),
      });

      const raw = await res.text();
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }

      if (!res.ok) {
        throw new Error(extractApiError(payload, text.createError));
      }

      const createdUser = normalizeUser(payload);

      if (createdUser && isSuperAdmin) {
        setUsers((prev) => {
          const next = prev.filter((user) => user.id !== createdUser.id);
          return [createdUser, ...next];
        });

        if (createdUser.group) {
          setUserGroup((prev) => ({ ...prev, [createdUser.id]: createdUser.group }));
          setSelectedGroup((prev) => ({ ...prev, [createdUser.id]: createdUser.group!.id }));
        }
      }

      setCreateForm(initialCreateForm);
      setMessage({ type: 'success', text: text.createSuccess });
    } catch (err) {
      console.error('Failed to create user', err);
      setMessage({
        type: 'error',
        text: err instanceof Error && err.message ? err.message : text.createError,
      });
    } finally {
      setIsCreatingUser(false);
      signalLoading(false);
    }
  };

  const assignToGroup = async (userId: number) => {
    if (!isSuperAdmin) {
      setMessage({ type: 'error', text: t.staffOnly });
      return;
    }

    const groupId = selectedGroup[userId];
    if (!groupId || typeof groupId !== 'number') {
      setMessage({ type: 'error', text: (t as any).assignGroupSelectionRequired || t.groupSelectionRequired });
      return;
    }

    setAssigningUserId(userId);
    setMessage(null);
    signalLoading(true);

    try {
      const res = await authFetch(`${API_BASE_URL}/api/users/assign-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': lang === 'ar' ? 'ar' : 'en',
        },
        body: JSON.stringify({ user_id: userId, group_id: groupId }),
      });

      const raw = await res.text();
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }

      if (!res.ok) {
        throw new Error(extractApiError(payload, t.assignError));
      }

      const group = normalizeGroup(payload?.group);
      if (group) {
        setUserGroup((prev) => ({ ...prev, [userId]: group }));
        setSelectedGroup((prev) => ({ ...prev, [userId]: group.id }));
      }

      setMessage({ type: 'success', text: t.assignSuccess });
    } catch (err) {
      console.error('Failed to assign group', err);
      setMessage({
        type: 'error',
        text: err instanceof Error && err.message ? err.message : t.assignError,
      });
    } finally {
      setAssigningUserId(null);
      signalLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-water-600 dark:text-water-300">
              <UsersIcon size={20} />
              <p className="text-sm font-semibold uppercase tracking-wide">{t.users}</p>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.usersPageTitle}</h1>
            <p className="text-slate-500 dark:text-slate-300">
              {isSuperAdmin ? text.pageSubtitleSuper : text.pageSubtitleStandard}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-300 flex items-center gap-2">
              <ShieldCheck size={14} />
              {isSuperAdmin ? text.adminToolsEnabled : text.limitedAccessNote}
            </p>
          </div>

          {isSuperAdmin && (
            <div className="flex gap-2">
              <button
                onClick={loadUsers}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <RefreshCw size={16} className={isUsersLoading ? 'animate-spin' : ''} />
                {t.refresh}
              </button>
              <button
                onClick={loadGroups}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <RefreshCw size={16} className={isGroupsLoading ? 'animate-spin' : ''} />
                {t.refreshGroups || t.refresh}
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200'
            : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-200'
            }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-water-50 dark:bg-water-900/20 text-water-600 dark:text-water-300 flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{text.createCardTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">{text.createCardSubtitle}</p>
          </div>
        </div>

        <form onSubmit={createUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createUsernameLabel}</span>
              <input
                type="text"
                value={createForm.username}
                onChange={(event) => handleCreateFormChange('username', event.target.value)}
                autoComplete="username"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createPasswordLabel}</span>
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => handleCreateFormChange('password', event.target.value)}
                autoComplete="new-password"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createEmailLabel}</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => handleCreateFormChange('email', event.target.value)}
                autoComplete="email"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createFirstNameLabel}</span>
              <input
                type="text"
                value={createForm.first_name}
                onChange={(event) => handleCreateFormChange('first_name', event.target.value)}
                autoComplete="given-name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createLastNameLabel}</span>
              <input
                type="text"
                value={createForm.last_name}
                onChange={(event) => handleCreateFormChange('last_name', event.target.value)}
                autoComplete="family-name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
              />
            </label>

            {isSuperAdmin ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createGroupLabel}</span>
                <select
                  value={createForm.group_id}
                  onChange={(event) => handleCreateFormChange('group_id', event.target.value ? Number(event.target.value) : '')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
                >
                  <option value="">{t.selectGroup}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  {isGroupsLoading ? t.processing : text.createGroupHintSuper}
                </p>
              </label>
            ) : (
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{text.createGroupLabel}</span>
                <div className="px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-sm text-slate-500 dark:text-slate-300">
                  {text.createGroupHintStandard}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pt-2">
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(event) => handleCreateFormChange('is_active', event.target.checked)}
                  className="rounded border-slate-300 text-water-600 focus:ring-water-500"
                />
                <span>{text.createActiveLabel}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isCreatingUser}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-water-600 text-white text-sm font-semibold hover:bg-water-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreatingUser && <Loader2 size={16} className="animate-spin" />}
              {isCreatingUser ? text.createSubmitLoading : text.createSubmit}
            </button>
          </div>
        </form>
      </div>

      {isSuperAdmin ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{text.managedUsersTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">{text.managedUsersSubtitle}</p>
          </div>

          {isUsersLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              {t.processing}
            </div>
          ) : !users.length ? (
            <p className="text-sm text-slate-500">{text.noUsersVisible}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {users.map((user) => {
                const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');

                return (
                  <div key={user.id} className="p-4 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900 dark:text-white">{user.username}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{user.email || text.noValue}</p>
                        {fullName && (
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                            {text.fullNameLabel}: {fullName}
                          </p>
                        )}
                        {user.company?.name && (
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                            {text.companyLabel}: {user.company.name}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                          {t.currentGroup || 'Current group'}: {userGroup[user.id]?.name || text.noValue}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {user.is_staff && (
                          <span className="px-2 py-1 text-[11px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                            {text.staffLabel}
                          </span>
                        )}
                        {user.is_active ? (
                          <span className="px-2 py-1 text-[11px] rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200">
                            {text.activeLabel}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-[11px] rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {text.inactiveLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <select
                        value={selectedGroup[user.id] ?? ''}
                        onChange={(event) => {
                          const value = event.target.value ? Number(event.target.value) : '';
                          setSelectedGroup((prev) => ({ ...prev, [user.id]: value }));
                        }}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
                      >
                        <option value="">{t.selectGroup}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => assignToGroup(user.id)}
                        disabled={assigningUserId === user.id}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-water-600 text-white text-sm font-semibold hover:bg-water-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {assigningUserId === user.id && <Loader2 size={16} className="animate-spin" />}
                        {t.assignGroup}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTriangle size={16} />
          <span>{text.limitedAccessNote}</span>
        </div>
      )}
    </div>
  );
};
