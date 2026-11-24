import { useState } from "react";
import { applyUpdate, dismissInstall, install, installDismissed, usePwa } from "../lib/pwa.ts";
import { useOnline } from "../lib/online.ts";

/** Passo a passo do iPhone (a Apple não deixa o site mostrar o botão de instalar). */
export function IosSteps() {
  return (
    <ol className="steps-ios">
      <li>Abra este endereço no <b>Safari</b>.</li>
      <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
      <li>Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li>
    </ol>
  );
}

/**
 * Primeira visita: convite para instalar como app. Um toque em "Instalar" abre a confirmação
 * do Chrome, que cria o app no celular (WebAPK). Some para sempre em "Agora não" ou depois de instalar.
 */
export function InstallSheet() {
  const pwa = usePwa();
  const [closed, setClosed] = useState(installDismissed);
  const show = !closed && !pwa.standalone && !pwa.installed && (pwa.canInstall || pwa.ios);
  if (!show) return null;

  const later = () => { dismissInstall(); setClosed(true); };
  const go = async () => {
    const r = await install();
    if (r !== "unavailable") { dismissInstall(); setClosed(true); }
  };

  return (
    <div className="sheet-wrap" role="presentation">
      <section className="sheet" role="dialog" aria-modal="false" aria-labelledby="inst-t">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={56} height={56} />
        <div>
          <h2 id="inst-t">Instalar o Gôndola como app</h2>
          {pwa.ios ? (
            <>
              <p className="sub">Abre em tela cheia, pela Tela de Início, e funciona sem internet.</p>
              <IosSteps />
            </>
          ) : (
            <p className="sub">Fica na sua lista de apps, abre em tela cheia e funciona sem internet, até no mercado com sinal fraco.</p>
          )}
          <div className="row">
            {!pwa.ios && <button className="btn tag" onClick={() => void go()}>Instalar</button>}
            <button className="btn" onClick={later}>{pwa.ios ? "Entendi" : "Agora não"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Item de Configurações: instalar quando ainda não estiver instalado. */
export function InstallSetting() {
  const pwa = usePwa();
  if (pwa.standalone) return <p className="note" style={{ margin: 0 }}>O Gôndola já está instalado e aberto como app.</p>;
  if (pwa.installed) return <p className="note" style={{ margin: 0 }}>Instalado. Abra pelo ícone Gôndola na lista de apps.</p>;
  if (pwa.ios) return <IosSteps />;
  if (pwa.canInstall) return <button className="btn tag" onClick={() => void install()}>Instalar app</button>;
  return (
    <p className="note" style={{ margin: 0 }}>
      Abra pelo Chrome e toque no menu ⋮ &gt; <b>Instalar app</b>. Se a opção não aparecer, o app já pode estar instalado: procure Gôndola na lista de apps.
    </p>
  );
}

/** Faixas do topo: sem internet e versão nova. */
export function StatusBars({ pending = 0 }: { pending?: number }) {
  const online = useOnline();
  const pwa = usePwa();
  return (
    <>
      {!online && (
        <p className="msg warn" role="status">
          <span aria-hidden="true">⚠</span>
          <span>Sem internet. Mostrando o que está guardado no aparelho{pending ? `; ${pending} ${pending === 1 ? "alteração será enviada" : "alterações serão enviadas"} depois` : "; o que você fizer é enviado depois"}.</span>
        </p>
      )}
      {pwa.needRefresh && (
        <div className="msg info update" role="status">
          <span>Nova versão do Gôndola disponível.</span>
          <button className="btn sm primary" onClick={() => void applyUpdate()}>Atualizar</button>
        </div>
      )}
    </>
  );
}
