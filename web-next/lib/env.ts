/**
 * 公開可能な環境変数アクセサ（NEXT_PUBLIC_* のみ = クライアントに露出してよい anon-safe 値）。
 * 秘密（SUPABASE_SERVICE_ROLE_KEY / STRIPE_SECRET_KEY 等）はここに置かない（server-only モジュールで扱う）。
 *
 * ビルド時に未設定でも空文字にフォールバックし、`supabaseConfigured()` で休眠判定する
 * （＝Supabase プロジェクト未接続でもビルド・表示は壊れない。認証は接続後に有効化）。
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase の URL / anon key が両方揃っているか（未接続なら false = 認証は休眠）。 */
export function supabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
