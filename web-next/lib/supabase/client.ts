import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * ブラウザ（Client Component）用の Supabase クライアント。
 * 呼び出しはイベントハンドラ内から（render 時には呼ばない）＝未接続時のビルド/SSR を壊さない。
 * token は @supabase/ssr が cookie に保存（localStorage ではない・PKCE）。
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
