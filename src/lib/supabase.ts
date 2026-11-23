import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null quando o .env.local não está configurado: o app funciona só no aparelho.
 *  detectSessionInUrl: o link "Sign in" do e-mail volta para o app com a sessão no endereço. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

/** Para onde o link do e-mail leva de volta (precisa estar em Authentication > URL Configuration). */
export const authRedirectUrl = (): string => `${location.origin}/`;

/** O link do e-mail vencido ou já usado volta com o erro no endereço. */
export function authErrorFromUrl(): string | null {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.get("error") && !p.get("error_code")) return null;
  return p.get("error_code") === "otp_expired"
    ? "O link do e-mail venceu ou já foi usado. Peça um novo em Configurações."
    : "Não foi possível entrar pelo link do e-mail. Peça um novo em Configurações.";
}
