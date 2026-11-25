import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: ReactNode;
  /** ícone ou selo acima do título (opcional) */
  badge?: ReactNode;
  /** cor do selo */
  tone?: "good" | "bad" | "info";
  children?: ReactNode;
  /** botões; o primeiro com autoFocus recebe o foco */
  actions: ReactNode;
  /** Esc ou toque fora da caixa */
  onClose: () => void;
  /** false: só fecha pelos botões (ignora toque fora, Esc e o "voltar" do Android) */
  dismissible?: boolean;
}

/** Caixa suspensa (diálogo modal nativo): foco preso nela, Esc fecha, fundo escurecido. */
export default function Modal({ open, title, badge, tone = "good", children, actions, onClose, dismissible = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={`${id}-t`}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose(); }}
      onClick={(e) => { if (dismissible && e.target === ref.current) onClose(); }}
      onClose={() => {
        // o navegador pode fechar a caixa sozinho (ex.: "voltar" repetido no Android): reabre ou avisa quem controla
        if (!openRef.current) return;
        if (dismissible) onClose();
        else ref.current?.showModal();
      }}
    >
      {open && (
        <div className="modal-box">
          {badge && <div className={`modal-badge ${tone}`} aria-hidden="true">{badge}</div>}
          <h2 id={`${id}-t`}>{title}</h2>
          {children}
          <div className="modal-actions">{actions}</div>
        </div>
      )}
    </dialog>
  );
}
