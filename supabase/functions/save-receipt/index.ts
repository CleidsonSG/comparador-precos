// Grava uma nota do usuário logado. Mercados e produtos só são escritos pelo servidor (RLS),
// por isso a gravação passa por aqui: confere o usuário, valida a nota e chama save_receipt.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateReceipt } from "./validate.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Entre na sua conta." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Sessão inválida. Entre de novo." }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  if (JSON.stringify(body).length > 300_000) return json({ error: "Nota grande demais." }, 413);

  const v = validateReceipt((body as { note?: unknown })?.note);
  if (!v.ok) return json({ error: "Nota recusada.", details: v.errors }, 422);

  const { data, error } = await admin.rpc("save_receipt", { p_user: userData.user.id, p: v.value });
  if (error) {
    // Sem detalhes internos para o app; o registro fica no log da função (sem dados pessoais).
    console.error("save_receipt", error.code, error.message);
    return json({ error: "Não foi possível guardar a nota agora." }, 500);
  }
  return json({ receiptId: data });
});
