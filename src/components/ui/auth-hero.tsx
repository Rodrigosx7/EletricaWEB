import type { ReactElement } from "react";

export default function AuthHero(): ReactElement {
  return (
    <section className="auth-story" aria-label="Portal Elétrico">
      <div>
        <div className="auth-brand">
          <img className="auth-brand-logo" src="/logo.png" alt="" width="34" height="34" />
          <span>Portal Elétrico<small>Gestão para empresas elétricas</small></span>
        </div>
        <div className="auth-story-copy">
          <span className="auth-kicker">OPERAÇÃO SOB CONTROLE</span>
          <h2>Seu trabalho elétrico, do orçamento ao recebimento.</h2>
          <p>Organize clientes, serviços, materiais e resultados em uma rotina simples para o campo e o escritório.</p>
        </div>
        <div className="auth-flow" aria-label="Fluxo principal do sistema">
          <div><span>01</span><strong>Orçar</strong><small>Propostas profissionais</small></div>
          <div><span>02</span><strong>Executar</strong><small>Ordens e materiais</small></div>
          <div><span>03</span><strong>Receber</strong><small>Financeiro e análise</small></div>
        </div>
      </div>
      <p className="auth-story-footer">Uma área de trabalho feita para a rotina de quem executa.</p>
    </section>
  );
}
