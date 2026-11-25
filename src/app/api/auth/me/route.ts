import { NextResponse } from "next/server";
import { getSessionContext, hasSwitchGrant } from "@/lib/auth";

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const canSwitchRoles =
    ["SUPER_ADMIN", "ADMIN"].includes(session.roleCode) || (await hasSwitchGrant());

  return NextResponse.json({ user: session, canSwitchRoles });
}
