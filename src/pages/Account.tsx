import { useEffect, useState, type FormEvent } from "react";
import { formatDateTime } from "../lib/format.ts";
import { authRedirectUrl, supabase } from "../lib/supabase.ts";
import { afterSignIn, getStatus, signOut, subscribe, syncNow, type SyncStatus } from "../lib/sync.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authMessage(e: { status?: number; message?: string } | null): string {
  if (!e) return "Algo deu errado. Tente de novo.";
  if (e.status === 429) return "Muitos pedidos de código. Espere alguns minutos e tente de novo.";
  if (/expired|invalid/i.test(e.message ?? "")) return "Código errado ou vencido. Confira o e-mail ou peça um novo código.";
  if (!navigator.onLine || /fetch/i.test(e.message ?? "")) return "Sem internet. Conecte-se para entrar na conta.";
  return "Não foi possível entrar agora. Tente de novo.";
}

function StatusLine({ s }: { s: SyncStatus }) {
  if (s.state === "syncing") return <p className="msg info" role="status">Sincronizando…</p>;
  if (s.state === "offline")
    return <p className="msg warn" role="status">Sem internet. {s.pending ? `${s.pending} ${s.pending === 1 ? "alteração será enviada" : "alterações serão enviadas"} quando a conexão voltar.` : "Seus dados continuam no aparelho."}</p>;
  if (s.state === "error") return <p className="msg bad" role="alert">Não foi possível sincronizar. Tente de novo em instantes.</p>;
  if (s.pending) return <p className="msg warn" role="status">{s.pending} {s.pending === 1 ? "alteração esperando" : "alterações esperando"} envio.</p>;
  return <p className="msg good" role="status">✓ Tudo guardado na sua conta{s.lastAt ? `, ${formatDateTime(s.lastAt)}` : ""}.</p>;
}

/** Cartão "Conta" das Configurações: entrar por código no e-mail, estado da sincronização e sair. */
export default function Account({ toast }: { toast: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null | undefined>(undefined);
  const [s, setS] = useState<SyncStatus>(getStatus);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => subscribe(setS), []);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase)
    return (
      <section className="card" aria-labelledby="acc">
        <h2 id="acc">Conta</h2>
        <p className="sub">Indisponível nesta instalação: o app está funcionando só no aparelho. Para guardar na nuvem, configure o arquivo <code>.env.local</code>.</p>
      </section>
    );
  const sb = supabase;

  if (user === undefined)
    return (
      <section className="card" aria-busy="true" aria-label="Carregando conta">
        <div className="skel" style={{ height: 18, width: "40%" }} />
        <div className="skel" style={{ height: 46, marginTop: 14 }} />
      </section>
    );

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!EMAIL.test(em)) { setErr("Digite um e-mail válido, como nome@exemplo.com."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: authRedirectUrl() } });
    setBusy(false);
    if (error) { setErr(authMessage(error)); return; }
    setEmail(em); setStep("code"); setCode("");
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) { setErr("O código tem 6 números."); return; }
    setBusy(true); setErr("");
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.user) { setBusy(false); setErr(authMessage(error)); return; }
    await afterSignIn(data.user.id);
    setBusy(false);
    toast("Conta conectada");
  };

  const leave = async (keep: boolean) => {
    setBusy(true);
    await signOut(keep);
    setBusy(false); setLeaving(false);
    toast(keep ? "Você saiu. Os dados continuam neste aparelho." : "Você saiu e os dados foram apagados deste aparelho.");
  };

  if (!user)
    return (
      <section className="card" aria-labelledby="acc">
        <h2 id="acc">Conta</h2>
        <p className="sub">Guarde notas, vínculos e carrinho na nuvem e use em qualquer aparelho. Sem senha: enviamos um e-mail para você entrar. Sem conta, tudo fica só neste aparelho.</p>
        {step === "email" ? (
          <form onSubmit={sendCode} noValidate>
            <div className="field">
              <label htmlFor="em">E-mail</label>
              <input id="em" type="email" inputMode="email" autoComplete="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} aria-describedby={err ? "accErr" : undefined} />
            </div>
            {err && <p id="accErr" className="msg bad" role="alert">{err}</p>}
            <button className="btn primary" disabled={busy}>{busy ? "Enviando…" : "Enviar e-mail de acesso"}</button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <p className="msg info" role="status">Enviamos um e-mail para {email}. Toque no link "Sign in" do e-mail neste aparelho, ou digite aqui o código, se o e-mail trouxer um. Vale por alguns minutos; confira também o spam.</p>
            <div className="field">
              <label htmlFor="code">Código do e-mail (se houver)</label>
              <input id="code" className="num" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!err} aria-describedby={err ? "accErr" : undefined} />
            </div>
            {err && <p id="accErr" className="msg bad" role="alert">{err}</p>}
            <div className="row">
              <button className="btn primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => { setStep("email"); setErr(""); }}>Trocar e-mail</button>
            </div>
          </form>
        )}
      </section>
    );

  return (
    <section className="card" aria-labelledby="acc">
      <h2 id="acc">Conta</h2>
      <div className="set">
        <div><b>Conectado</b><div className="note">{user.email}</div></div>
        <button className="btn sm" disabled={s.state === "syncing"} onClick={() => void syncNow()}>Sincronizar agora</button>
      </div>
      <StatusLine s={s} />
      {s.rejected.length > 0 && (
        <div className="msg bad" role="alert">
          <div>
            {s.rejected.length === 1 ? "1 nota não foi aceita pela conta e ficou só neste aparelho:" : `${s.rejected.length} notas não foram aceitas pela conta e ficaram só neste aparelho:`}
            <ul>{s.rejected.map((r) => <li key={r.accessKey}>final {r.accessKey.slice(-6)}: {r.reason}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="set">
        <div><b>Sair da conta</b><div className="note">Em aparelho compartilhado, apague os dados ao sair.</div></div>
        {!leaving && <button className="btn sm danger" onClick={() => setLeaving(true)}>Sair</button>}
      </div>
      {leaving && (
        <div className="row" role="group" aria-label="Como sair">
          <button className="btn sm" disabled={busy} onClick={() => void leave(true)}>Sair e manter no aparelho</button>
          <button className="btn sm danger" disabled={busy} onClick={() => void leave(false)}>Sair e apagar do aparelho</button>
          <button className="btn sm" disabled={busy} onClick={() => setLeaving(false)}>Cancelar</button>
        </div>
      )}
    </section>
  );
}
