import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

import { RESTAURANT_ID } from '../lib/constants';

import type { AuditLog } from '../types';

import { Card, CardHeader } from '../components/ui/Card';

import { Table, Thead, Th, Tbody, Tr, Td } from '../components/ui/Table';

import { Badge } from '../components/ui/Badge';

const ENTITY_LABELS: Record<string, string> = {
  categories: 'الأقسام',
  products: 'المنتجات',
  product_variants: 'الاختيارات',
  restaurant_users: 'المسؤولون',
  admin_permissions: 'الصلاحيات',
};

const ACTION_LABELS: Record<
  string,
  {
    label: string;
    variant: 'success' | 'accent' | 'danger' | 'warning' | 'default';
  }
> = {
  INSERT: { label: 'إضافة', variant: 'success' },
  UPDATE: { label: 'تحديث', variant: 'accent' },
  DELETE: { label: 'حذف', variant: 'danger' },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, { username: string; role: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');

      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('created_at', { ascending: false })
        .limit(200);

      if (err) {
        setError('حدث خطأ أثناء تحميل السجل.');
      } else {
        const rawLogs = (data as AuditLog[]) ?? [];
        setLogs(rawLogs);

        // Resolve usernames from restaurant_users where user_id = audit_logs.user_id
        const userIds = Array.from(
          new Set(rawLogs.map((l) => l.user_id).filter((id): id is string => Boolean(id)))
        );

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('restaurant_users')
            .select('user_id, username, role')
            .eq('restaurant_id', RESTAURANT_ID)
            .in('user_id', userIds);

          if (usersData) {
            const map: Record<string, { username: string; role: string }> = {};
            for (const u of usersData) {
              map[u.user_id] = { username: u.username, role: u.role };
            }
            setUsersMap(map);
          }
        }
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-5" data-aos="fade-up">
      <Card padding={false}>
        <div className="p-5">
          <CardHeader
            title="سجل العمليات"
            description="سجل تفصيلي لجميع العمليات التي تمت على البيانات"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-5 pb-5">
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
            <p className="text-xs text-[var(--color-text-3)] mt-1">
              قد تكون هذه الميزة تحتاج إلى إعداد مشغّلات قاعدة البيانات لتسجيل
              العمليات تلقائيًا.
            </p>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <p className="text-center py-12 text-sm text-[var(--color-text-3)]">
            لا توجد سجلات حتى الآن.
          </p>
        )}

        {!loading && !error && logs.length > 0 && (
          <Table>
            <Thead>
              <tr>
                <Th>المستخدم</Th>
                <Th>العملية</Th>
                <Th>نوع البيانات</Th>
                <Th>التاريخ</Th>
              </tr>
            </Thead>

            <Tbody>
              {logs.map((log) => {
                const action = ACTION_LABELS[log.action] ?? {
                  label: log.action,
                  variant: 'default' as const,
                };

                const userInfo = log.user_id ? usersMap[log.user_id] : null;

                return (
                  <Tr key={log.id}>
                    <Td>
                      {userInfo ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text)]">
                            {userInfo.username}
                          </span>
                          <Badge variant={userInfo.role === 'owner' ? 'accent' : 'default'}>
                            {userInfo.role === 'owner' ? 'المالك' : 'مسؤول'}
                          </Badge>
                        </div>
                      ) : log.user_id ? (
                        <span className="text-sm font-medium text-[var(--color-text-2)]">
                          مسؤول ({log.user_id.slice(0, 8)})
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-3)]">النظام</span>
                      )}
                    </Td>

                    <Td>
                      <Badge variant={action.variant}>
                        {action.label}
                      </Badge>
                    </Td>

                    <Td>
                      <span className="text-sm text-[var(--color-text-2)]">
                        {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                      </span>
                    </Td>

                    <Td>
                      <span className="text-xs text-[var(--color-text-3)]">
                        {formatDate(log.created_at)}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}