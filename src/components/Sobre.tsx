export default function Sobre() {
  return (
    <div className="product-page max-w-4xl">
      <header className="page-header">
        <div>
          <h1>Sobre o Portal Elétrico</h1>
          <p>Gestão para profissionais e empresas da área elétrica.</p>
        </div>
      </header>

      <section className="grid gap-8 border-y border-[var(--color-border)] py-8 sm:grid-cols-2 sm:gap-12" aria-labelledby="sobre-projeto">
        <div>
          <h2 id="sobre-projeto" className="text-xl font-bold text-[var(--color-ink)]">O projeto</h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-[var(--color-muted)]">
            O Portal Elétrico reúne orçamentos, ordens de serviço, materiais,
            análise da operação e montagem de quadros em uma única área de trabalho.
          </p>
        </div>
        <div className="sm:border-l sm:border-[var(--color-border)] sm:pl-12">
          <h2 className="text-xl font-bold text-[var(--color-ink)]">Quem criou</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Criado e desenvolvido por <strong className="font-semibold text-[var(--color-ink)]">Rodrigo Justo</strong>.
          </p>
        </div>
      </section>
      <a href="/privacidade.html" className="inline-flex min-h-11 items-center mt-6 text-sm font-semibold text-[var(--color-accent)] underline underline-offset-4">Aviso de privacidade</a>
      <p className="mt-6 text-xs text-[var(--color-muted)]">© {new Date().getFullYear()} Portal Elétrico</p>
    </div>
  );
}
