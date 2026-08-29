import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { DEMO_COMPANY_ID, ensureDatabase } from '@/db/bootstrap';
import { getDb } from '@/db/index';
import { companies, memberships, subscriptions } from '@/db/schema';

export const FREE_PROJECT_QUOTA = 15;
export const FREE_MONTHLY_MESSAGE_QUOTA = 400;
export const MEMORY_TRIAL_HOURS = 72;

export type Plan = 'free' | 'premium';

export type Entitlements = {
  plan: Plan;
  /** Layers L2 to L4: the company's own history enters the prompt. */
  memory: boolean;
  /** True while the 72h report window opened at the conversion moment is live. */
  memoryTrial: boolean;
  memoryTrialEndsAt: string | null;
  projectQuota: number;
  monthlyMessageQuota: number;
};

/**
 * The only object allowed to reach the data layer. Every repository call takes
 * one, and `companyId` is derived from the authenticated user on the server. It
 * is never read from a request body, a query string or a header.
 */
export type TenantScope = {
  companyId: string;
  companyName: string;
  userId: string;
  email: string;
  role: string;
  entitlements: Entitlements;
};

export class TenantResolutionError extends Error {}

function slugFromEmail(email: string) {
  const domain = email.split('@')[1] ?? 'construtora';
  const slug = domain
    .split('.')[0]
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
  return slug || 'construtora';
}

function freeEntitlements(): Entitlements {
  return {
    plan: 'free',
    memory: false,
    memoryTrial: false,
    memoryTrialEndsAt: null,
    projectQuota: FREE_PROJECT_QUOTA,
    monthlyMessageQuota: FREE_MONTHLY_MESSAGE_QUOTA,
  };
}

function readEntitlements(row: {
  plan: string;
  status: string;
  projectQuota: number;
  monthlyMessageQuota: number;
  memoryTrialEndsAt: string | null;
}): Entitlements {
  const active = row.status === 'active' || row.status === 'trialing';
  const plan: Plan = active && row.plan === 'premium' ? 'premium' : 'free';
  const trialLive =
    row.memoryTrialEndsAt !== null &&
    Date.parse(row.memoryTrialEndsAt) > Date.now();

  return {
    plan,
    memory: plan === 'premium' || trialLive,
    memoryTrial: plan !== 'premium' && trialLive,
    memoryTrialEndsAt: row.memoryTrialEndsAt,
    projectQuota: row.projectQuota,
    monthlyMessageQuota: row.monthlyMessageQuota,
  };
}

/**
 * Resolves the company for an authenticated user, provisioning one on first
 * sign-in so the dashboard has a tenant to scope to.
 */
export async function resolveTenantScope(
  user: ChatGPTUser,
): Promise<TenantScope> {
  await ensureDatabase();
  const db = getDb();

  const existing = await db
    .select({
      companyId: memberships.companyId,
      role: memberships.role,
      companyName: companies.name,
      plan: subscriptions.plan,
      status: subscriptions.status,
      projectQuota: subscriptions.projectQuota,
      monthlyMessageQuota: subscriptions.monthlyMessageQuota,
      memoryTrialEndsAt: subscriptions.memoryTrialEndsAt,
    })
    .from(memberships)
    .innerJoin(companies, eq(memberships.companyId, companies.id))
    .leftJoin(subscriptions, eq(subscriptions.companyId, memberships.companyId))
    .where(eq(memberships.userId, user.userId))
    .limit(1);

  const row = existing[0];
  if (row) {
    return {
      companyId: row.companyId,
      companyName: row.companyName,
      userId: user.userId,
      email: user.email,
      role: row.role,
      entitlements:
        row.plan === null
          ? freeEntitlements()
          : readEntitlements({
              plan: row.plan,
              status: row.status ?? 'active',
              projectQuota: row.projectQuota ?? FREE_PROJECT_QUOTA,
              monthlyMessageQuota:
                row.monthlyMessageQuota ?? FREE_MONTHLY_MESSAGE_QUOTA,
              memoryTrialEndsAt: row.memoryTrialEndsAt,
            }),
    };
  }

  return provisionCompany(user);
}

async function provisionCompany(user: ChatGPTUser): Promise<TenantScope> {
  const db = getDb();
  const now = new Date().toISOString();

  const adopted = await adoptDemoCompany(user, now);
  if (adopted) return adopted;

  const companyId = `co_${crypto.randomUUID()}`;
  const companyName = user.fullName
    ? `Construtora de ${user.fullName}`
    : 'Minha construtora';
  const slug = `${slugFromEmail(user.email)}-${companyId.slice(3, 11)}`;

  await db.insert(companies).values({
    id: companyId,
    name: companyName,
    slug,
    createdAt: now,
  });

  await db.insert(memberships).values({
    id: crypto.randomUUID(),
    companyId,
    userId: user.userId,
    email: user.email,
    role: 'owner',
    createdAt: now,
  });

  await db.insert(subscriptions).values({
    companyId,
    plan: 'free',
    status: 'active',
    projectQuota: FREE_PROJECT_QUOTA,
    monthlyMessageQuota: FREE_MONTHLY_MESSAGE_QUOTA,
    memoryTrialEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    companyId,
    companyName,
    userId: user.userId,
    email: user.email,
    role: 'owner',
    entitlements: freeEntitlements(),
  };
}

/**
 * Attaches the first user to the seeded demo company so local development opens
 * with data instead of an empty dashboard. Only ever fires while the demo
 * tenant has no members, and `CIVITEK_DEMO_TENANT=off` disables it entirely,
 * which is what a production deployment should set.
 */
async function adoptDemoCompany(
  user: ChatGPTUser,
  now: string,
): Promise<TenantScope | null> {
  if (env.CIVITEK_DEMO_TENANT === 'off') return null;

  const db = getDb();
  const demo = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, DEMO_COMPANY_ID))
    .limit(1);

  if (!demo[0]) return null;

  const claimed = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.companyId, DEMO_COMPANY_ID))
    .limit(1);

  if (claimed[0]) return null;

  await db.insert(memberships).values({
    id: crypto.randomUUID(),
    companyId: DEMO_COMPANY_ID,
    userId: user.userId,
    email: user.email,
    role: 'owner',
    createdAt: now,
  });

  return {
    companyId: DEMO_COMPANY_ID,
    companyName: demo[0].name,
    userId: user.userId,
    email: user.email,
    role: 'owner',
    entitlements: freeEntitlements(),
  };
}

/** Returns null when there is no authenticated user. */
export async function getTenantScope(): Promise<TenantScope | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  return resolveTenantScope(user);
}

/** Throws when there is no authenticated user. For API routes. */
export async function requireTenantScope(): Promise<TenantScope> {
  const scope = await getTenantScope();
  if (!scope) throw new TenantResolutionError('Não autorizado.');
  return scope;
}

/**
 * Opens the time-boxed window in which the memory report is readable on the
 * free plan. Idempotent: an already opened window is never extended.
 */
export async function startMemoryTrial(scope: TenantScope): Promise<string> {
  const db = getDb();
  if (scope.entitlements.memoryTrialEndsAt) {
    return scope.entitlements.memoryTrialEndsAt;
  }

  const endsAt = new Date(
    Date.now() + MEMORY_TRIAL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  await db
    .update(subscriptions)
    .set({ memoryTrialEndsAt: endsAt, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(subscriptions.companyId, scope.companyId),
        eq(subscriptions.plan, 'free'),
      ),
    );

  return endsAt;
}
