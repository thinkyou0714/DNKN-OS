import type { User } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * 現在のログインユーザーを返す（未ログイン / 未接続なら null）。
 * サーバ側では必ず `getUser()` を使う（`getSession()` は cookie を spoof 可能なため禁止）。
 * Supabase 未接続（休眠）時は Supabase を呼ばずに null を返す。
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
