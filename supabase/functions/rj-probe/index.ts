// Teste TEMPORÁRIO: a SEFAZ-RJ bloqueia o IP do Supabase?
// Só faz GET nas páginas públicas de consulta. Não recebe parâmetros, não envia chave nem dado de usuário
// e não devolve o corpo das páginas. Depois do teste, substituir por uma versão vazia.
const TARGETS: Record<string, string> = {
  www4: "https://www4.fazenda.rj.gov.br/consultaDFe/paginas/consultaChaveAcesso.faces",
  consultadfe: "https://consultadfe.fazenda.rj.gov.br/consultaDFe/paginas/consultaChaveAcesso.faces",
};

Deno.serve(async () => {
  const out: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(TARGETS)) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: "text/html" } });
      const body = await r.text();
      out[name] = {
        status: r.status,
        ms: Date.now() - t0,
        bytes: body.length,
        finalUrl: r.url,
        temFormularioDeChave: /Chave de Acesso/i.test(body),
        paginaDeBloqueio: /acesso (bloqueado|negado)|bloqueia acessos/i.test(body),
        mencionaCaptcha: /captcha/i.test(body),
      };
    } catch (e) {
      out[name] = { erro: String(e), ms: Date.now() - t0 };
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json" } });
});
