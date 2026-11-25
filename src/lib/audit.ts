import { prisma } from "./prisma";

/**
 * Records an immutable audit trail entry for mutations across modules.
 */
export async function logAudit(input: {
  actorUserId?: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

/**
 * Creates an operational notification record for relevant stakeholders.
 */
export async function createNotification(input: {
  title: string;
  description: string;
  category: string;
  relatedModule?: string;
  relatedRecordId?: string;
  targetRoleCode?: string;
}) {
  try {
    const count = await prisma.notification.count();
    const notificationCode = `NTF-${String(count + 1).padStart(4, "0")}`;
    await prisma.notification.create({
      data: {
        notificationCode,
        title: input.title,
        description: input.description,
        category: input.category,
        relatedModule: input.relatedModule ?? null,
        relatedRecordId: input.relatedRecordId ?? null,
        targetRoleCode: input.targetRoleCode ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
