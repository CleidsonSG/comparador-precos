import { Component, type ReactNode } from "react";

/** Erro inesperado numa tela: mostra como seguir em vez de deixar a página em branco. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // mudou de tela: tenta de novo
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card" role="alert">
        <h2>Algo deu errado nesta tela</h2>
        <p className="sub">Suas notas continuam guardadas no aparelho. Recarregue para tentar de novo.</p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Recarregar</button>
          <a className="btn" href="#inicio" onClick={() => this.setState({ failed: false })}>Ir para o Início</a>
        </div>
      </section>
    );
  }
}
