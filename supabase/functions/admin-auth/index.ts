import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESTAURANT_ID = "0c3f2f1a-03d9-46d3-9410-17384e3b896d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Verify requester is the Abu Nagy owner via verified JWT
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyOwner(req: Request, supabaseAdmin: any) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { isOwner: false, error: "غير مصرح - رمز الدخول مفقود", status: 401 };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { isOwner: false, error: "غير مصرح - جلسة غير صالحة", status: 401 };
  }

  const authUserId = authData.user.id;

  // Check if active owner in restaurant_users
  const { data: ruData, error: ruError } = await supabaseAdmin
    .from("restaurant_users")
    .select("role, is_active")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("user_id", authUserId)
    .single();

  if (ruError || !ruData || ruData.role !== "owner" || !ruData.is_active) {
    return { isOwner: false, error: "صلاحيات غير كافية - هذه العملية مخصصة للمالك فقط", status: 403 };
  }

  return { isOwner: true, user: authData.user };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration missing" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body;

  try {
    // ========================================================
    // 1. LOGIN
    // ========================================================
    if (action === "login") {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (!username || !password) {
        return jsonResponse({ error: "اسم المستخدم وكلمة المرور مطلوبان" }, 400);
      }

      // 1. Look up user in restaurant_users
      const { data: ruData, error: ruError } = await supabaseAdmin
        .from("restaurant_users")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .ilike("username", username)
        .single();

      if (ruError || !ruData) {
        return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." }, 401);
      }

      // 2. Verify active
      if (!ruData.is_active) {
        return jsonResponse({ error: "هذا الحساب غير مفعل حاليًا." }, 403);
      }

      // 3. Resolve corresponding Supabase Auth user
      const authUserId = ruData.user_id;

      const { data: authUserRes, error: authUserError } =
        await supabaseAdmin.auth.admin.getUserById(authUserId);

      if (authUserError || !authUserRes?.user?.email) {
        return jsonResponse({ error: "تعذر العثور على حساب المصادقة." }, 401);
      }

      // 4. Perform Supabase Auth password authentication using internal Auth identifier
      const internalEmail = authUserRes.user.email;
      const { data: sessionData, error: signInError } =
        await supabaseAnon.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

      if (signInError || !sessionData.session) {
        return jsonResponse({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." }, 401);
      }

      // 5. Return authenticated session to client (internal email is NOT exposed)
      return jsonResponse({
        session: sessionData.session,
        user: {
          user_id: ruData.user_id,
          username: ruData.username,
          role: ruData.role,
        },
      });
    }

    // ========================================================
    // 2. CREATE ADMIN
    // ========================================================
    if (action === "create_admin") {
      const ownerCheck = await verifyOwner(req, supabaseAdmin);
      if (!ownerCheck.isOwner) {
        return jsonResponse({ error: ownerCheck.error }, ownerCheck.status);
      }

      const username = typeof body.username === "string" ? body.username.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const permissions = Array.isArray(body.permissions) ? body.permissions : [];

      if (!username || !password) {
        return jsonResponse({ error: "البيانات غير مكتملة" }, 400);
      }

      const cleanUsername = username.toLowerCase();
      if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 30 ||
        !/^[a-zA-Z0-9_]+$/.test(cleanUsername)
      ) {
        return jsonResponse({ error: "اسم المستخدم غير صالح" }, 400);
      }

      if (password.length < 8) {
        return jsonResponse({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
      }

      // Check username uniqueness in Abu Nagy
      const { data: existingUser } = await supabaseAdmin
        .from("restaurant_users")
        .select("user_id")
        .eq("restaurant_id", RESTAURANT_ID)
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return jsonResponse({ error: "اسم المستخدم مستخدم بالفعل." }, 400);
      }

      // Create Supabase Auth user with random internal identifier (decoupled from username)
      const internalEmail = `admin_${crypto.randomUUID()}@auth.local`;
      const { data: newAuthData, error: createAuthError } =
        await supabaseAdmin.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
        });

      if (createAuthError || !newAuthData?.user) {
        return jsonResponse(
          { error: createAuthError?.message || "فشل إنشاء حساب المصادقة." },
          500
        );
      }

      const newAuthUserId = newAuthData.user.id;

      // Create restaurant_users record
      const { data: newRu, error: insertRuError } = await supabaseAdmin
        .from("restaurant_users")
        .insert({
          restaurant_id: RESTAURANT_ID,
          user_id: newAuthUserId,
          username: cleanUsername,
          role: "admin",
          is_active: true,
        })
        .select()
        .single();

      if (insertRuError || !newRu) {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
        return jsonResponse({ error: "فشل حفظ بيانات المسؤول في قاعدة البيانات." }, 500);
      }

      // Insert admin permissions (columns: restaurant_id, user_id, permission)
      if (permissions.length > 0) {
        const permRows = permissions.map((p: string) => ({
          restaurant_id: RESTAURANT_ID,
          user_id: newAuthUserId,
          permission: p,
        }));
        await supabaseAdmin.from("admin_permissions").insert(permRows);
      }

      // Record audit log for admin creation
      await supabaseAdmin.from("audit_logs").insert({
        restaurant_id: RESTAURANT_ID,
        user_id: ownerCheck.user.id,
        action: "INSERT",
        entity_type: "restaurant_users",
        entity_id: newAuthUserId,
        old_data: null,
        new_data: {
          user_id: newAuthUserId,
          username: cleanUsername,
          role: "admin",
          is_active: true,
          permissions,
        },
      });

      return jsonResponse({
        success: true,
        user: {
          user_id: newRu.user_id,
          username: newRu.username,
          role: newRu.role,
        },
      });
    }

    // ========================================================
    // 3. CHANGE PASSWORD
    // ========================================================
    if (action === "change_password") {
      const ownerCheck = await verifyOwner(req, supabaseAdmin);
      if (!ownerCheck.isOwner) {
        return jsonResponse({ error: ownerCheck.error }, ownerCheck.status);
      }

      const targetUserId =
        typeof body.target_user_id === "string" ? body.target_user_id : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (!targetUserId || !password || password.length < 8) {
        return jsonResponse({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
      }

      // Find target user in restaurant_users
      const { data: targetRu, error: targetRuError } = await supabaseAdmin
        .from("restaurant_users")
        .select("user_id, username")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("user_id", targetUserId)
        .single();

      if (targetRuError || !targetRu) {
        return jsonResponse({ error: "المستخدم غير موجود." }, 404);
      }

      const targetAuthId = targetRu.user_id;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetAuthId,
        { password }
      );

      if (updateError) {
        return jsonResponse({ error: "فشل تغيير كلمة المرور." }, 500);
      }

      // Record audit log for password change (never logging the password itself)
      await supabaseAdmin.from("audit_logs").insert({
        restaurant_id: RESTAURANT_ID,
        user_id: ownerCheck.user.id,
        action: "UPDATE",
        entity_type: "restaurant_users",
        entity_id: targetAuthId,
        old_data: { username: targetRu.username, event: "تغيير كلمة المرور" },
        new_data: { username: targetRu.username, event: "تم تغيير كلمة المرور بنجاح" },
      });

      return jsonResponse({ success: true });
    }

    // ========================================================
    // TEMPORARY: BOOTSTRAP OWNER PASSWORD
    // ========================================================
    if (action === "bootstrap_owner_password") {
      const serverSecret = Deno.env.get("BOOTSTRAP_SECRET") ?? "";
      const clientSecret =
        typeof body.bootstrap_secret === "string" ? body.bootstrap_secret : "";
      const password = typeof body.password === "string" ? body.password : "";

      if (!serverSecret || !clientSecret || clientSecret !== serverSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      if (password.length < 8) {
        return jsonResponse(
          { error: "Password must be at least 8 characters" },
          400
        );
      }

      const OWNER_USER_ID = "6152bb1d-a6a4-4a83-b277-803145339c6d";

      // Verify owner exists in restaurant_users for Abu Nagy, is active, and is owner
      const { data: ownerRu, error: ownerRuError } = await supabaseAdmin
        .from("restaurant_users")
        .select("user_id, restaurant_id, role, is_active")
        .eq("restaurant_id", RESTAURANT_ID)
        .eq("user_id", OWNER_USER_ID)
        .maybeSingle();

      if (
        ownerRuError ||
        !ownerRu ||
        ownerRu.role !== "owner" ||
        !ownerRu.is_active
      ) {
        return jsonResponse(
          {
            error: "Owner record not found or inactive",
            debug: {
              hasOwner: !!ownerRu,
              queryError: ownerRuError?.message ?? null,
            },
          },
          404
        );
      }

      // Update Auth password via admin API
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(OWNER_USER_ID, {
          password,
        });

      if (updateError) {
        return jsonResponse({ error: "Failed to set owner password" }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
