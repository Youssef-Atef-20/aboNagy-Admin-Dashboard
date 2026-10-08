import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, PowerOff, Power,
  KeyRound, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { adminsService } from '../services/admins';
import { supabase } from '../lib/supabase';
import type { AdminPermission, PermissionKey, RestaurantUser } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, Thead, Th, Tbody, Tr, Td } from '../components/ui/Table';
import { PermissionsChecker } from '../components/permissions/PermissionsChecker';

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  username: z
    .string()
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .max(30, 'اسم المستخدم يجب أن يكون 30 حرفًا كحد أقصى')
    .regex(/^[a-zA-Z0-9_]+$/, 'يُسمح فقط بالحروف الإنجليزية والأرقام وعلامة _'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

const editUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'يُسمح فقط بالحروف الإنجليزية والأرقام وعلامة _'),
});

const changePasswordSchema = z.object({
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

type CreateFormData = z.infer<typeof createSchema>;
type EditUsernameData = z.infer<typeof editUsernameSchema>;
type ChangePasswordData = z.infer<typeof changePasswordSchema>;

// ─── Helpers ───────────────────────────────────────────────

/** Call the Supabase Edge Function for privileged auth operations */
async function callAdminEdgeFunction(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-auth', {
    body: { action, ...payload },
  });
  return { data, error };
}

// ─── Create Admin Form ─────────────────────────────────────

function CreateAdminModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormData, any, CreateFormData>({ resolver: zodResolver(createSchema) as never });

  function handleClose() {
    reset();
    setPermissions(new Set());
    setServerError('');
    onClose();
  }

  async function onSubmit(data: CreateFormData) {
    setServerError('');
    setLoading(true);

    try {
      // Check username availability
      const available = await adminsService.checkUsernameAvailable(data.username);
      if (!available) {
        setServerError('اسم المستخدم مستخدم بالفعل.');
        return;
      }

      // Create auth user, restaurant_users row, and permissions via Edge Function (privileged)
      const { data: efData, error: efError } = await callAdminEdgeFunction('create_admin', {
        username: data.username,
        password: data.password,
        permissions: [...permissions],
      });

      if (efError || !efData?.success) {
        setServerError(efData?.error || 'فشل إنشاء الحساب. حاول مرة أخرى.');
        return;
      }

      handleClose();
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="إضافة مسؤول جديد"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" form="create-admin-form" loading={loading}>
            إضافة المسؤول
          </Button>
        </>
      }
    >
      <form id="create-admin-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 w-full" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              id="create-username"
              label="اسم المستخدم"
              placeholder="مثال: ahmed_manager"
              autoComplete="username"
              error={errors.username?.message}
              {...register('username')}
            />
          </div>
          <Input
            id="create-password"
            label="كلمة المرور"
            type="password"
            autoComplete="new-password"
            placeholder="8 أحرف على الأقل"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            id="create-confirm"
            label="تأكيد كلمة المرور"
            type="password"
            autoComplete="new-password"
            placeholder="أعد إدخال كلمة المرور"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        {/* Permissions */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-text)]">الصلاحيات</p>
            <span className="text-xs text-[var(--color-text-3)]">
              {permissions.size > 0 ? `${permissions.size} صلاحية محددة` : 'لم يتم تحديد أي صلاحية'}
            </span>
          </div>
          <PermissionsChecker
            selected={permissions}
            onChange={setPermissions}
            disabled={loading}
          />
        </div>

        {serverError && (
          <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-sm">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Edit Username Modal ────────────────────────────────────

function EditUsernameModal({
  admin,
  onClose,
  onSuccess,
}: {
  admin: RestaurantUser | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditUsernameData, any, EditUsernameData>({
    resolver: zodResolver(editUsernameSchema) as never,
    defaultValues: { username: admin?.username ?? '' },
  });

  async function onSubmit(data: EditUsernameData) {
    if (!admin) return;
    setServerError('');
    setLoading(true);

    try {
      const available = await adminsService.checkUsernameAvailable(data.username, admin.user_id);
      if (!available) {
        setServerError('اسم المستخدم مستخدم بالفعل.');
        return;
      }

      // Update username in restaurant_users only (no Auth email change needed)
      const { error: updateError } = await adminsService.updateUsername(admin.user_id, data.username);
      if (updateError) {
        setServerError('فشل تحديث اسم المستخدم.');
        return;
      }

      reset();
      onClose();
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={!!admin}
      onClose={onClose}
      title="تغيير اسم المستخدم"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" form="edit-username-form" loading={loading}>
            حفظ
          </Button>
        </>
      }
    >
      <form id="edit-username-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          id="edit-username"
          label="اسم المستخدم الجديد"
          autoComplete="username"
          error={errors.username?.message}
          {...register('username')}
        />
        {serverError && (
          <div className="px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-sm">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Change Password Modal ─────────────────────────────────

function ChangePasswordModal({
  admin,
  onClose,
}: {
  admin: RestaurantUser | null;
  onClose: () => void;
}) {
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordData, any, ChangePasswordData>({ resolver: zodResolver(changePasswordSchema) as never });

  function handleClose() {
    reset();
    setServerError('');
    setSuccess(false);
    onClose();
  }

  async function onSubmit(data: ChangePasswordData) {
    if (!admin) return;
    setServerError('');
    setLoading(true);

    try {
      const { data: efData, error: efError } = await callAdminEdgeFunction('change_password', {
        target_user_id: admin.user_id,
        password: data.password,
      });

      if (efError || !efData?.success) {
        setServerError(efData?.error || 'فشل تغيير كلمة المرور.');
        return;
      }

      setSuccess(true);
      reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={!!admin}
      onClose={handleClose}
      title="تغيير كلمة المرور"
      footer={
        !success ? (
          <>
            <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" form="change-password-form" loading={loading}>
              تغيير كلمة المرور
            </Button>
          </>
        ) : undefined
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center">
            <ShieldCheck size={22} className="text-[var(--color-success)]" />
          </div>
          <p className="text-sm text-[var(--color-text)] font-medium">تم تغيير كلمة المرور بنجاح</p>
          <Button variant="secondary" onClick={handleClose}>إغلاق</Button>
        </div>
      ) : (
        <form id="change-password-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-sm">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>كلمة المرور الجديدة لـ <strong>{admin?.username}</strong></span>
          </div>
          <Input
            id="new-password"
            label="كلمة المرور الجديدة"
            type="password"
            autoComplete="new-password"
            placeholder="8 أحرف على الأقل"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            id="confirm-new-password"
            label="تأكيد كلمة المرور الجديدة"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {serverError && (
            <div className="px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-sm">
              {serverError}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

// ─── Edit Permissions Modal ─────────────────────────────────

function EditPermissionsModal({
  admin,
  currentPermissions,
  onClose,
  onSuccess,
}: {
  admin: RestaurantUser | null;
  currentPermissions: Set<PermissionKey>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set(currentPermissions));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPermissions(new Set(currentPermissions));
  }, [currentPermissions, admin]);

  async function handleSave() {
    if (!admin) return;
    setLoading(true);
    await adminsService.setPermissions(admin.user_id, [...permissions]);
    setLoading(false);
    onClose();
    onSuccess();
  }

  return (
    <Modal
      open={!!admin}
      onClose={onClose}
      title="تعديل الصلاحيات"
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSave} loading={loading}>
            حفظ الصلاحيات
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-2)]">
            صلاحيات المسؤول: <strong className="text-[var(--color-text)] font-semibold">{admin?.username}</strong>
          </p>
          <span className="text-xs text-[var(--color-text-3)]">
            {permissions.size > 0 ? `${permissions.size} صلاحية محددة` : 'لم يتم تحديد أي صلاحية'}
          </span>
        </div>

        <PermissionsChecker selected={permissions} onChange={setPermissions} disabled={loading} />
      </div>
    </Modal>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export function AdminsPage() {
  const [admins, setAdmins] = useState<RestaurantUser[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Set<PermissionKey>>>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUsernameTarget, setEditUsernameTarget] = useState<RestaurantUser | null>(null);
  const [changePasswordTarget, setChangePasswordTarget] = useState<RestaurantUser | null>(null);
  const [editPermsTarget, setEditPermsTarget] = useState<RestaurantUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<RestaurantUser | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await adminsService.list();
    const adminList = (data as RestaurantUser[]) ?? [];
    setAdmins(adminList);

    // Load permissions for each admin in parallel
    const permResults = await Promise.all(
      adminList.map((a) => adminsService.getPermissions(a.user_id))
    );
    const map: Record<string, Set<PermissionKey>> = {};
    adminList.forEach((a, i) => {
      const perms = ((permResults[i].data as AdminPermission[]) ?? []).map(
        (p) => p.permission
      );
      map[a.user_id] = new Set(perms);
    });
    setPermissionsMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleToggleActive() {
    if (!toggleTarget) return;
    setToggleLoading(true);
    await adminsService.setActive(toggleTarget.user_id, !toggleTarget.is_active);
    setToggleLoading(false);
    setToggleTarget(null);
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await adminsService.softDelete(deleteTarget.user_id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-5" data-aos="fade-up">
      <Card padding={false}>
        <div className="p-5">
          <CardHeader
            title="المسؤولون"
            description="إدارة حسابات المسؤولين وصلاحياتهم"
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={15} />
                إضافة مسؤول
              </Button>
            }
          />
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && admins.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--color-text-3)]">
            لا يوجد مسؤولون حتى الآن.
          </p>
        )}

        {!loading && admins.length > 0 && (
          <Table>
            <Thead>
              <tr>
                <Th>اسم المستخدم</Th>
                <Th>الحالة</Th>
                <Th>الصلاحيات</Th>
                <Th className="text-left">الإجراءات</Th>
              </tr>
            </Thead>
            <Tbody>
              {admins.map((admin) => {
                const perms = permissionsMap[admin.user_id] ?? new Set();
                return (
                  <Tr key={admin.user_id}>
                    <Td className="font-medium">{admin.username}</Td>
                    <Td>
                      <Badge variant={admin.is_active ? 'success' : 'danger'}>
                        {admin.is_active ? 'نشط' : 'معطّل'}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-sm text-[var(--color-text-2)]">
                        {perms.size} صلاحية
                      </span>
                    </Td>
                    <Td className="text-left">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditUsernameTarget(admin)}
                          title="تغيير اسم المستخدم"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setChangePasswordTarget(admin)}
                          title="تغيير كلمة المرور"
                        >
                          <KeyRound size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditPermsTarget(admin)}
                          title="تعديل الصلاحيات"
                        >
                          <ShieldCheck size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setToggleTarget(admin)}
                          title={admin.is_active ? 'تعطيل' : 'تفعيل'}
                          className={admin.is_active ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}
                        >
                          {admin.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(admin)}
                          title="إزالة"
                          className="text-[var(--color-danger)]"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Card>
      </div>

      {/* Modals rendered outside animated AOS container */}
      <CreateAdminModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={refresh}
      />

      <EditUsernameModal
        admin={editUsernameTarget}
        onClose={() => setEditUsernameTarget(null)}
        onSuccess={refresh}
      />

      <ChangePasswordModal
        admin={changePasswordTarget}
        onClose={() => setChangePasswordTarget(null)}
      />

      {editPermsTarget && (
        <EditPermissionsModal
          admin={editPermsTarget}
          currentPermissions={permissionsMap[editPermsTarget.user_id] ?? new Set()}
          onClose={() => setEditPermsTarget(null)}
          onSuccess={refresh}
        />
      )}

      {/* Toggle Active Confirm */}
      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleTarget?.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        message={
          toggleTarget?.is_active
            ? `هل تريد تعطيل حساب "${toggleTarget?.username}"؟ لن يتمكن من تسجيل الدخول.`
            : `هل تريد إعادة تفعيل حساب "${toggleTarget?.username}"؟`
        }
        confirmLabel={toggleTarget?.is_active ? 'تعطيل' : 'تفعيل'}
        loading={toggleLoading}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="إزالة المسؤول"
        message={`هل تريد إزالة "${deleteTarget?.username}"؟ سيتم تعطيل الحساب وإزالة الصلاحيات مع الحفاظ على سجل العمليات.`}
        confirmLabel="إزالة"
        loading={deleteLoading}
      />
    </>
  );
}
