import { getSupabaseAF } from "@/lib/supabase-af";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.APPS_FAMILIA_SUPABASE_URL!,
    process.env.APPS_FAMILIA_SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Get the user role record to find auth_uid
  const { data: roleData } = await getSupabaseAF()
    .from("user_roles")
    .select("auth_uid, email")
    .eq("id", id)
    .single();

  // Delete from user_roles
  const { error } = await getSupabaseAF().from("user_roles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete from Auth if we have auth_uid
  if (roleData?.auth_uid) {
    const serviceClient = getServiceClient();
    await serviceClient.auth.admin.deleteUser(roleData.auth_uid);
  }

  return NextResponse.json({ success: true });
}
