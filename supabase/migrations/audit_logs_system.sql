-- ============================================================
-- AUDIT LOGGING SYSTEM MIGRATION FOR ABU NAGY
-- ============================================================

-- 1. Create audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_entity_id uuid;
  v_user_id uuid;
  v_old_data jsonb := null;
  v_new_data jsonb := null;
BEGIN
  v_user_id := auth.uid();

  -- If called without an authenticated user on restaurant_users/admin_permissions,
  -- skip inserting from trigger because the Edge Function explicitly records the audit log with the verified owner's ID.
  IF v_user_id IS NULL AND (TG_TABLE_NAME = 'restaurant_users' OR TG_TABLE_NAME = 'admin_permissions') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'product_variants' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT p.restaurant_id INTO v_restaurant_id FROM public.products p WHERE p.id = OLD.product_id;
      v_entity_id := OLD.id;
      v_old_data := to_jsonb(OLD);
    ELSE
      SELECT p.restaurant_id INTO v_restaurant_id FROM public.products p WHERE p.id = NEW.product_id;
      v_entity_id := NEW.id;
      IF TG_OP = 'UPDATE' THEN v_old_data := to_jsonb(OLD); END IF;
      v_new_data := to_jsonb(NEW);
    END IF;
  ELSIF TG_TABLE_NAME = 'categories' OR TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'DELETE' THEN
      v_restaurant_id := OLD.restaurant_id;
      v_entity_id := OLD.id;
      v_old_data := to_jsonb(OLD);
    ELSE
      v_restaurant_id := NEW.restaurant_id;
      v_entity_id := NEW.id;
      IF TG_OP = 'UPDATE' THEN v_old_data := to_jsonb(OLD); END IF;
      v_new_data := to_jsonb(NEW);
    END IF;
  ELSIF TG_TABLE_NAME = 'restaurant_users' OR TG_TABLE_NAME = 'admin_permissions' THEN
    IF TG_OP = 'DELETE' THEN
      v_restaurant_id := OLD.restaurant_id;
      v_entity_id := OLD.user_id;
      v_old_data := to_jsonb(OLD);
    ELSE
      v_restaurant_id := NEW.restaurant_id;
      v_entity_id := NEW.user_id;
      IF TG_OP = 'UPDATE' THEN v_old_data := to_jsonb(OLD); END IF;
      v_new_data := to_jsonb(NEW);
    END IF;
  END IF;

  IF v_restaurant_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      restaurant_id,
      user_id,
      action,
      entity_type,
      entity_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      v_restaurant_id,
      v_user_id,
      TG_OP,
      TG_TABLE_NAME,
      v_entity_id,
      v_old_data,
      v_new_data,
      now()
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 2. Create triggers for all audited tables
DROP TRIGGER IF EXISTS audit_categories_trigger ON public.categories;
CREATE TRIGGER audit_categories_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_product_variants_trigger ON public.product_variants;
CREATE TRIGGER audit_product_variants_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_restaurant_users_trigger ON public.restaurant_users;
CREATE TRIGGER audit_restaurant_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_users
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_admin_permissions_trigger ON public.admin_permissions;
CREATE TRIGGER audit_admin_permissions_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.admin_permissions
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. RLS Policies on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authorized users can view audit logs" ON public.audit_logs;

CREATE POLICY "Authorized users can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  is_owner(restaurant_id) OR has_permission(restaurant_id, 'view_audit_logs')
);
