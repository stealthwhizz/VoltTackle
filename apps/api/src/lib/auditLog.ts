import { prisma, Prisma } from "@volt-tackle/database";

export interface RecordAuditLogInput {
  actorId?: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(input: RecordAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
