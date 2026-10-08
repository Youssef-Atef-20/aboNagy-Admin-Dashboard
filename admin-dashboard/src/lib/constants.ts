import type { PermissionKey } from '../types';

/**
 * Centralized Arabic labels for permission keys.
 * Database keys stay English; only the UI labels are Arabic.
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_categories: 'عرض الأقسام',
  create_categories: 'إضافة الأقسام',
  update_categories: 'تعديل الأقسام',
  delete_categories: 'حذف الأقسام',

  view_products: 'عرض المنتجات',
  create_products: 'إضافة المنتجات',
  update_products: 'تعديل المنتجات',
  delete_products: 'حذف المنتجات',

  view_variants: 'عرض الاختيارات والأسعار',
  create_variants: 'إضافة الاختيارات والأسعار',
  update_variants: 'تعديل الاختيارات والأسعار',
  delete_variants: 'حذف الاختيارات والأسعار',

  manage_admins: 'إدارة المسؤولين',
  view_audit_logs: 'عرض سجل العمليات',
};

/**
 * Permission groups for rendering checkboxes in the UI.
 */
export const PERMISSION_GROUPS: {
  label: string;
  keys: PermissionKey[];
}[] = [
  {
    label: 'الأقسام',
    keys: ['view_categories', 'create_categories', 'update_categories', 'delete_categories'],
  },
  {
    label: 'المنتجات',
    keys: ['view_products', 'create_products', 'update_products', 'delete_products'],
  },
  {
    label: 'الاختيارات والأسعار',
    keys: ['view_variants', 'create_variants', 'update_variants', 'delete_variants'],
  },
  {
    label: 'أخرى',
    keys: ['manage_admins', 'view_audit_logs'],
  },
];

/** The fixed restaurant ID for أبو ناجي */
export const RESTAURANT_ID = '0c3f2f1a-03d9-46d3-9410-17384e3b896d';
