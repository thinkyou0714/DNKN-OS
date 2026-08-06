import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * サーバ（RSC / Route Handler / Server Action）用の Supabase クライアント。
 * Next 16 の `cookies()` は async のため `await` する。session は cookie 経由で解決する。
 *
 * 注: Server Component からは cookie を set できない（read-only）。session の refresh/書き戻しは
 *     middleware/proxy 側で行うのが正道（T06 follow-up）。ここでは getUser など読み取り主体で使う。
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からの呼び出しでは set 不可。middleware/proxy 側で refresh する（T06）。
        }
      },
    },
  });
}
