import { getDb as getDbConnection } from '../../Shared/src/database/connection';
import {
  familyRelationships,
  familyPendingRequests,
  guildModuleConfigs,
} from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';

export const getDb = getDbConnection;

export interface FamilyRecord {
  id: number;
  guildId: string;
  userId: string;
  partnerId: string | null;
  parentId: string | null;
  marriedAt: Date | null;
  adoptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingRequestRecord {
  id: number;
  guildId: string;
  fromUserId: string;
  toUserId: string;
  type: string;
  messageId: string | null;
  channelId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export async function ensureRelationship(guildId: string, userId: string): Promise<FamilyRecord> {
  const db = await getDbConnection();
  const existing = await db
    .select()
    .from(familyRelationships)
    .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0] as FamilyRecord;
  }

  const result = await db
    .insert(familyRelationships)
    .values({
      guildId,
      userId,
      partnerId: null,
      parentId: null,
      marriedAt: null,
      adoptedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] as FamilyRecord;
}

export async function getRelationship(guildId: string, userId: string): Promise<FamilyRecord | null> {
  const db = await getDbConnection();
  const result = await db
    .select()
    .from(familyRelationships)
    .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, userId)))
    .limit(1);

  return result.length > 0 ? (result[0] as FamilyRecord) : null;
}

export async function getPartner(guildId: string, userId: string): Promise<string | null> {
  const relation = await getRelationship(guildId, userId);
  return relation?.partnerId || null;
}

export async function getChildren(guildId: string, userId: string): Promise<string[]> {
  const db = await getDbConnection();
  const result = await db
    .select({ userId: familyRelationships.userId })
    .from(familyRelationships)
    .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.parentId, userId)));

  return result.map((r) => r.userId);
}

export async function getParent(guildId: string, userId: string): Promise<string | null> {
  const relation = await getRelationship(guildId, userId);
  return relation?.parentId || null;
}

export async function getSiblings(guildId: string, userId: string): Promise<string[]> {
  const relation = await getRelationship(guildId, userId);
  if (!relation || !relation.parentId) return [];

  const db = await getDbConnection();
  const result = await db
    .select({ userId: familyRelationships.userId })
    .from(familyRelationships)
    .where(
      and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.parentId, relation.parentId))
    );

  return result.map((r) => r.userId).filter((id) => id !== userId);
}

export async function marry(guildId: string, userId: string, partnerId: string): Promise<void> {
  const db = await getDbConnection();
  const now = new Date();

  await Promise.all([
    db
      .update(familyRelationships)
      .set({
        partnerId,
        marriedAt: now,
        updatedAt: now,
      })
      .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, userId))),
    db
      .update(familyRelationships)
      .set({
        partnerId: userId,
        marriedAt: now,
        updatedAt: now,
      })
      .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, partnerId))),
  ]);
}

export async function divorce(guildId: string, userId: string): Promise<void> {
  const db = await getDbConnection();
  const relation = await getRelationship(guildId, userId);
  const now = new Date();

  if (!relation || !relation.partnerId) return;

  await Promise.all([
    db
      .update(familyRelationships)
      .set({
        partnerId: null,
        marriedAt: null,
        updatedAt: now,
      })
      .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, userId))),
    db
      .update(familyRelationships)
      .set({
        partnerId: null,
        marriedAt: null,
        updatedAt: now,
      })
      .where(
        and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, relation.partnerId))
      ),
  ]);
}

export async function adopt(guildId: string, parentId: string, childId: string): Promise<void> {
  const db = await getDbConnection();
  const now = new Date();

  await db
    .update(familyRelationships)
    .set({
      parentId,
      adoptedAt: now,
      updatedAt: now,
    })
    .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, childId)));
}

export async function disown(guildId: string, parentId: string, childId: string): Promise<void> {
  const db = await getDbConnection();
  const now = new Date();

  await db
    .update(familyRelationships)
    .set({
      parentId: null,
      adoptedAt: null,
      updatedAt: now,
    })
    .where(and(eq(familyRelationships.guildId, guildId), eq(familyRelationships.userId, childId)));
}

export async function createPendingRequest(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  type: string,
  messageId: string,
  channelId: string,
  expiresAt: Date
): Promise<PendingRequestRecord> {
  const db = await getDbConnection();
  const result = await db
    .insert(familyPendingRequests)
    .values({
      guildId,
      fromUserId,
      toUserId,
      type,
      messageId,
      channelId,
      expiresAt,
      createdAt: new Date(),
    })
    .returning();

  return result[0] as PendingRequestRecord;
}

export async function getPendingRequest(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  type: string
): Promise<PendingRequestRecord | null> {
  const db = await getDbConnection();
  const result = await db
    .select()
    .from(familyPendingRequests)
    .where(
      and(
        eq(familyPendingRequests.guildId, guildId),
        eq(familyPendingRequests.fromUserId, fromUserId),
        eq(familyPendingRequests.toUserId, toUserId),
        eq(familyPendingRequests.type, type)
      )
    )
    .limit(1);

  return result.length > 0 ? (result[0] as PendingRequestRecord) : null;
}

export async function deletePendingRequest(id: number): Promise<void> {
  const db = await getDbConnection();
  await db.delete(familyPendingRequests).where(eq(familyPendingRequests.id, id));
}

export async function deleteExpiredRequests(guildId: string): Promise<void> {
  const db = await getDbConnection();
  await db
    .delete(familyPendingRequests)
    .where(and(eq(familyPendingRequests.guildId, guildId), eq(familyPendingRequests.expiresAt, new Date())));
}

export async function buildFamilyTree(guildId: string, userId: string): Promise<string> {
  const parent = await getParent(guildId, userId);
  const partner = await getPartner(guildId, userId);
  const children = await getChildren(guildId, userId);
  const siblings = await getSiblings(guildId, userId);

  let tree = '';

  if (parent) {
    tree += `         👨 <@${parent}>\n`;
    tree += `              |\n`;

    const parentChildren = await getChildren(guildId, parent);
    const sibCount = parentChildren.length;

    if (sibCount > 1) {
      tree += `    ┌─────────┴─────────┐\n`;
      tree += `    │                    │\n`;
      tree += parentChildren
        .map((child) => (child === userId ? `💍 <@${userId}>` : `👶 <@${child}>`))
        .join('  |  ');
      tree += '\n';
    }
  } else {
    if (partner) {
      tree += `💍 <@${userId}> ──── <@${partner}>\n`;
    } else {
      tree += `👤 <@${userId}>\n`;
    }
  }

  if (children.length > 0) {
    tree += `    |\n`;
    tree += `  ┌─`;
    for (let i = 0; i < children.length - 1; i++) {
      tree += `┴─`;
    }
    tree += `┐\n`;

    for (let i = 0; i < children.length; i++) {
      tree += `  ${i === children.length - 1 ? '└' : '├'}  👶 <@${children[i]}>\n`;
    }
  }

  if (siblings.length > 0) {
    tree += `\nSiblings: ${siblings.map((s) => `<@${s}>`).join(', ')}\n`;
  }

  return tree || '(No family relations)';
}

export async function getFamilyConfig(
  guildId: string
): Promise<{
  enabled: boolean;
  maxChildren: number;
  proposalExpiry: number;
  adoptionExpiry: number;
  allowSelfAdopt: boolean;
  embedColor: string;
}> {
  const db = await getDbConnection();
  const result = await db
    .select()
    .from(guildModuleConfigs)
    .where(and(eq(guildModuleConfigs.guildId, guildId), eq(guildModuleConfigs.module, 'family')))
    .limit(1);

  if (result.length === 0) {
    return {
      enabled: true,
      maxChildren: 10,
      proposalExpiry: 86400,
      adoptionExpiry: 86400,
      allowSelfAdopt: false,
      embedColor: '#E91E63',
    };
  }

  const config = result[0].config as Record<string, unknown>;
  return {
    enabled: (config.enabled as boolean) ?? true,
    maxChildren: (config.maxChildren as number) ?? 10,
    proposalExpiry: (config.proposalExpiry as number) ?? 86400,
    adoptionExpiry: (config.adoptionExpiry as number) ?? 86400,
    allowSelfAdopt: (config.allowSelfAdopt as boolean) ?? false,
    embedColor: (config.embedColor as string) ?? '#E91E63',
  };
}
