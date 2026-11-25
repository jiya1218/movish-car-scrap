import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";

    const notifications = await prisma.notification.findMany({
      where:
        filter === "unread"
          ? { isRead: false }
          : filter === "read"
          ? { isRead: true }
          : {},
      orderBy: { createdAt: "desc" },
    });

    const unreadCount = await prisma.notification.count({ where: { isRead: false } });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (body.markAllRead) {
      await prisma.notification.updateMany({ data: { isRead: true } });
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      const updated = await prisma.notification.update({
        where: { id: String(body.id) },
        data: { isRead: Boolean(body.isRead) },
      });
      return NextResponse.json({ notification: updated });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
