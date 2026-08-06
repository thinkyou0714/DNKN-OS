import { billingEnabled } from "@/lib/flags";

/**
 * web 側の entitlement 解決（サーバ真実源・休眠）。
 *
 * 課金 flag OFF（既定）では **常に free に短絡**し、Supabase / entitlements を一切触らない。
 * flag ON 後は、userId から @denken/core の `EntitlementStore`（PR #57）を authed/service client 経由で
 * 引く実装へ差し替える（T16 full）。ここは gate の seam を確定するための最小 dormant 実装。
 *
 * 型は PR #57 の `lib/store` と揃える（workspace 化 T02 で import に統合予定）。
 */
export type Tier = "free" | "pro";
export type ProFeature = "unlimitedPractice" | "adaptiveSelection" | "deepExplanations" | "cloudSync";

export async function resolveTier(_userId: string | null): Promise<Tier> {
  if (!billingEnabled()) return "free";
  // TODO(T16 full): EntitlementStore.get(userId) を引き、status=active|trialing を pro とする（要 Supabase 接続）。
  return "free";
}

/** tier が Pro 機能を許可するか（free は全不許可）。UI の gate 表示に使う（境界の真実源はサーバ）。 */
export function tierAllows(tier: Tier, _feature: ProFeature): boolean {
  return tier === "pro";
}
