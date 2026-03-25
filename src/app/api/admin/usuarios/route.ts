import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient(
    process.env.APPS_FAMILIA_SUPABASE_URL!,
    process.env.APPS_FAMILIA_SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const { data, error } = await getSupabaseAF()
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, email, password, role } = body;

  if (!nombre || !email || !password || !role) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const serviceClient = getServiceClient();

  // Create auth user
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Insert role record
  const { error: roleError } = await getSupabaseAF()
    .from("user_roles")
    .insert([{ email: email.toLowerCase(), role, nombre, auth_uid: authData.user?.id }]);

  if (roleError) {
    // Rollback auth user if role insert fails
    if (authData.user?.id) {
      await serviceClient.auth.admin.deleteUser(authData.user.id);
    }
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
