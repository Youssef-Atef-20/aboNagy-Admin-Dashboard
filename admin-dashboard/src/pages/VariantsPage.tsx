import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ChevronDown, ChevronLeft } from 'lucide-react';
import { variantsService } from '../services/variants';
import { productsService } from '../services/products';
import { useAuth } from '../contexts/AuthContext';
import { RESTAURANT_ID } from '../lib/constants';
import type { Product, ProductVariant } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';

// ─── Schema ───────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'اسم الاختيار مطلوب'),
  price: z.preprocess(
    (v) => (v === '' ? 0 : Number(v)),
    z.number().min(0, 'السعر يجب أن يكون صفرًا أو أكثر')
  ),
  sort_order: z.preprocess(
    (v) => (v === '' ? 0 : Number(v)),
    z.number().int().min(0)
  ),
});

type FormData = {
  name: string;
  price: number;
  sort_order: number;
};

// ─── Variant Form ──────────────────────────────────────────

function VariantForm({
  defaultValues,
  onSubmit,
  loading,
  onCancel,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => Promise<void>;
  loading: boolean;
  onCancel: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = useForm<FormData, any, FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { sort_order: 0, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        id="var-name"
        label="اسم الاختيار"
        placeholder="مثال: عادي، كبير، دبل..."
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        id="var-price"
        label="السعر (جنيه)"
        type="number"
        min={0}
        step="0.01"
        placeholder="0"
        error={typeof errors.price?.message === 'string' ? errors.price.message : undefined}
        {...register('price')}
      />
      <Input
        id="var-order"
        label="ترتيب العرض"
        type="number"
        min={0}
        {...register('sort_order')}
      />
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={loading}>
          إلغاء
        </Button>
        <Button type="submit" loading={loading}>
          حفظ
        </Button>
      </div>
    </form>
  );
}

// ─── Product Row (collapsible) ─────────────────────────────

function ProductVariantRow({
  product,
  variants,
  canCreate,
  canEdit,
  canDelete,
  onCreateVariant,
  onEditVariant,
  onDeleteVariant,
}: {
  product: Product;
  variants: ProductVariant[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onCreateVariant: (product: Product) => void;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (variant: ProductVariant) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
      {/* Product header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="
          w-full flex items-center justify-between px-4 py-3
          bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]
          transition-colors duration-150 text-right
        "
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown size={15} className="text-[var(--color-text-3)]" />
          ) : (
            <ChevronLeft size={15} className="text-[var(--color-text-3)]" />
          )}
          <span className="text-sm font-semibold text-[var(--color-text)]">{product.name}</span>
          <span className="text-xs text-[var(--color-text-3)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full">
            {variants.length} اختيار
          </span>
        </div>
        {canCreate && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreateVariant(product); }}
            className="
              flex items-center gap-1 text-xs font-medium
              text-[var(--color-accent)] hover:text-[var(--color-accent-h)]
              transition-colors
            "
          >
            <Plus size={13} />
            إضافة اختيار
          </button>
        )}
      </button>

      {/* Variants list */}
      {open && (
        <div className="border-t border-[var(--color-border)]">
          {variants.length === 0 ? (
            <p className="text-center py-5 text-sm text-[var(--color-text-3)]">
              لا توجد اختيارات لهذا المنتج بعد.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between px-6 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--color-text)]">{variant.name}</span>
                    <span className="text-sm font-semibold text-[var(--color-accent)]">
                      {variant.price.toLocaleString('ar-EG')} ج
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditVariant(variant)}
                        aria-label="تعديل"
                      >
                        <Pencil size={13} />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteVariant(variant)}
                        aria-label="حذف"
                        className="text-[var(--color-danger)]"
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export function VariantsPage() {
  const { can } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [loading, setLoading] = useState(true);

  const [createTarget, setCreateTarget] = useState<Product | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<ProductVariant | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductVariant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const [prodRes, varRes] = await Promise.all([
      productsService.list(),
      variantsService.listAll(RESTAURANT_ID),
    ]);

    const prods = (prodRes.data as Product[]) ?? [];
    setProducts(prods);

    // Group variants by product_id
    const grouped: Record<string, ProductVariant[]> = {};
    prods.forEach((p) => { grouped[p.id] = []; });
    ((varRes.data as ProductVariant[]) ?? []).forEach((v) => {
      if (grouped[v.product_id]) grouped[v.product_id].push(v);
    });
    setVariantsByProduct(grouped);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate(data: FormData) {
    if (!createTarget) return;
    setCreateLoading(true);
    await variantsService.create({ ...data, product_id: createTarget.id });
    setCreateLoading(false);
    setCreateTarget(null);
    refresh();
  }

  async function handleEdit(data: FormData) {
    if (!editTarget) return;
    setEditLoading(true);
    await variantsService.update(editTarget.id, data);
    setEditLoading(false);
    setEditTarget(null);
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await variantsService.remove(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    refresh();
  }

  const canCreate = can('create_variants');
  const canEdit = can('update_variants');
  const canDelete = can('delete_variants');

  return (
    <div className="max-w-4xl mx-auto space-y-5" data-aos="fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">الاختيارات والأسعار</h2>
          <p className="text-sm text-[var(--color-text-2)] mt-0.5">
            إدارة اختيارات وأسعار كل منتج
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <Card>
          <p className="text-center py-8 text-sm text-[var(--color-text-3)]">
            لا توجد منتجات. أضف منتجات أولًا من صفحة المنتجات.
          </p>
        </Card>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductVariantRow
              key={product.id}
              product={product}
              variants={variantsByProduct[product.id] ?? []}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onCreateVariant={setCreateTarget}
              onEditVariant={setEditTarget}
              onDeleteVariant={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={!!createTarget}
        onClose={() => setCreateTarget(null)}
        title={`إضافة اختيار — ${createTarget?.name}`}
      >
        <VariantForm
          onSubmit={handleCreate}
          loading={createLoading}
          onCancel={() => setCreateTarget(null)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="تعديل الاختيار"
      >
        {editTarget && (
          <VariantForm
            defaultValues={{
              name: editTarget.name,
              price: editTarget.price,
              sort_order: editTarget.sort_order,
            }}
            onSubmit={handleEdit}
            loading={editLoading}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف الاختيار"
        message={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟`}
        confirmLabel="حذف"
        loading={deleteLoading}
      />
    </div>
  );
}
