import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const session = await getSessionContext();
  if (session) {
    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "LOGOUT",
      entityType: "User",
      entityId: session.userId,
      summary: `${session.name} signed out.`,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
