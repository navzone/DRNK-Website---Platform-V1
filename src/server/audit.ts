import { schema, type Executor } from "@/db/client";

export async function audit(
  exec: Executor,
  e: { actorUserId?: string | null; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> },
) {
  await exec.insert(schema.auditEvents).values({
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    metadata: e.metadata,
  });
}
