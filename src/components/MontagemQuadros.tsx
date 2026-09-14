import { useEffect, useState } from 'react';
import { Plus, Save, Download, Trash2, PanelsTopLeft, Copy } from 'lucide-react';
import { cabeNoQuadro, CATALOGO_QUADRO, materiaisQuadro, primeiroEspaco, quadroValido, type Quadro, type ComponenteQuadro } from '../utils/quadros';
import { exportarQuadroPdf } from '../utils/quadroPdf';
import QuadroCanvas from './QuadroCanvas';
import './montagem-quadros.css';

function novoQuadro(): Quadro {
  return { id: crypto.randomUUID(), nome: 'Quadro de distribuição', cliente: '', trilhos: 2, modulosPorTrilho: 12, componentes: [] };
}

function carregar(chave: string): { quadros: Quadro[]; erro: string } {
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return { quadros: [], erro: '' };
    const dados: unknown = JSON.parse(raw);
    if (!Array.isArray(dados) || !dados.every(quadroValido)) throw new Error('Formato inválido');
    return { quadros: dados, erro: '' };
  } catch {
    return { quadros: [], erro: 'Não foi possível ler os quadros salvos. O conteúdo original foi preservado; exporte seu trabalho em PDF antes de sair.' };
  }
}

export default function MontagemQuadros({ usuarioId, aoAlterar }: { usuarioId: string; aoAlterar: (alterado: boolean) => void }) {
  const chave = `portal-quadros-v1:${usuarioId}`;
  const [inicial] = useState(() => carregar(chave));
  const [salvos, setSalvos] = useState(inicial.quadros);
  const [quadro, setQuadro] = useState<Quadro>(() => inicial.quadros[0] ?? novoQuadro());
  const [alterado, setAlterado] = useState(false);
  const [mensagem, setMensagem] = useState(inicial.erro);
  const [selecionado, setSelecionado] = useState('');
  const [exportando, setExportando] = useState(false);
  const item = quadro.componentes.find(c => c.id === selecionado);
  const ocupados = quadro.componentes.reduce((s, c) => s + c.modulos, 0);
  const capacidade = quadro.trilhos * quadro.modulosPorTrilho;

  useEffect(() => {
    if (!alterado) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [alterado]);

  function atualizar(proximo: Quadro) {
    setQuadro(proximo);
    setAlterado(true);
    aoAlterar(true);
    setMensagem('');
  }

  function mudarTamanho(trilhos: number, modulosPorTrilho: number) {
    const proximo = { ...quadro, trilhos, modulosPorTrilho };
    if (!quadro.componentes.every(c => cabeNoQuadro(proximo, c))) {
      setMensagem('Há componentes fora desse tamanho. Mova ou remova os componentes antes de reduzir o quadro.');
      return;
    }
    atualizar(proximo);
  }

  function adicionar(tipo: string, modulos: number) {
    const espaco = primeiroEspaco(quadro, modulos);
    if (!espaco) { setMensagem(`Não há ${modulos} módulos consecutivos livres. Reorganize os componentes ou aumente o quadro.`); return; }
    const componente = { id: crypto.randomUUID(), tipo, descricao: '', circuito: '', modulos, ...espaco };
    atualizar({ ...quadro, componentes: [...quadro.componentes, componente] });
    setSelecionado(componente.id);
  }

  function editar(patch: Partial<ComponenteQuadro>) {
    if (!item) return;
    const proximo = { ...item, ...patch };
    if (!cabeNoQuadro(quadro, proximo)) {
      setMensagem('Essa posição ou largura ocupa outro componente ou ultrapassa o trilho. Escolha espaço livre.');
      return;
    }
    atualizar({ ...quadro, componentes: quadro.componentes.map(c => c.id === item.id ? proximo : c) });
  }

  function mover(trilho: number, inicio: number) {
    editar({ trilho, inicio });
  }

  function salvar() {
    if (!quadro.nome.trim()) { setMensagem('Informe um nome para o quadro.'); return; }
    if (inicial.erro) { setMensagem(inicial.erro); return; }
    const lista = [...salvos.filter(q => q.id !== quadro.id), quadro];
    try {
      localStorage.setItem(chave, JSON.stringify(lista));
      setSalvos(lista);
      setAlterado(false);
      aoAlterar(false);
      setMensagem('Quadro salvo neste navegador.');
    } catch { setMensagem('Não foi possível salvar. Verifique o espaço ou permissões do navegador.'); }
  }

  function abrir(q: Quadro) {
    if (alterado && !window.confirm('Há alterações não salvas. Deseja descartá-las e abrir outro quadro?')) return;
    setQuadro(q);
    setSelecionado('');
    setAlterado(false);
    aoAlterar(false);
    setMensagem('');
  }

  async function exportar() {
    setExportando(true);
    try { await exportarQuadroPdf(quadro); setMensagem('PDF gerado com a montagem atual.'); }
    catch { setMensagem('Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setExportando(false); }
  }

  return <div className="product-page qdc-page">
    <header className="page-header">
      <div><span className="page-kicker">Ferramentas / montagem</span><h1>Montagem de quadros</h1><p>Organize componentes nos trilhos, identifique circuitos e prepare a lista de materiais.</p></div>
      <div className="page-actions">
        <button className="btn-secondary" onClick={() => abrir(novoQuadro())}><Plus size={16} /> Novo</button>
        <button className="btn-secondary" onClick={exportar} disabled={exportando}><Download size={16} /> {exportando ? 'Gerando…' : 'Exportar PDF'}</button>
        <button className="btn-primary" onClick={salvar}><Save size={16} /> Salvar quadro</button>
      </div>
    </header>
    <div className="qdc-storage"><span>{alterado ? 'Alterações não salvas' : 'Montagem local'}</span><span>Salvo somente neste navegador e nesta conta. PDF não substitui arquivo editável.</span></div>
    {mensagem && <p className="inline-alert" role="status">{mensagem}</p>}
    <section className="surface-card qdc-settings" aria-label="Dados do quadro">
      <label className="field-label">Quadros salvos<select className="input-base" value={salvos.some(q => q.id === quadro.id) ? quadro.id : ''} onChange={e => { const q = salvos.find(q => q.id === e.target.value); if (q) abrir(q); }}><option value="" disabled>Nova montagem</option>{salvos.map(q => <option key={q.id} value={q.id}>{q.nome} {q.cliente && `· ${q.cliente}`}</option>)}</select></label>
      <label className="field-label">Nome do quadro<input className="input-base" maxLength={80} value={quadro.nome} onChange={e => atualizar({ ...quadro, nome: e.target.value })} /></label>
      <label className="field-label">Cliente / obra<input className="input-base" maxLength={120} placeholder="Ex.: Residência — cliente" value={quadro.cliente} onChange={e => atualizar({ ...quadro, cliente: e.target.value })} /></label>
      <label className="field-label">Trilhos<select className="input-base" value={quadro.trilhos} onChange={e => mudarTamanho(Number(e.target.value), quadro.modulosPorTrilho)}>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'trilho' : 'trilhos'}</option>)}</select></label>
      <label className="field-label">Módulos por trilho<select className="input-base" value={quadro.modulosPorTrilho} onChange={e => mudarTamanho(quadro.trilhos, Number(e.target.value))}>{[4,6,8,12,16,18,24,36].map(n => <option key={n} value={n}>{n} módulos</option>)}</select></label>
      <div className="qdc-accessories"><span>Acessórios da caixa</span><label><input type="checkbox" checked={!!quadro.barramentoN} onChange={e => atualizar({ ...quadro, barramentoN: e.target.checked })} /> Barramento N</label><label><input type="checkbox" checked={!!quadro.barramentoPE} onChange={e => atualizar({ ...quadro, barramentoPE: e.target.checked })} /> Barramento PE</label><small>Posição ilustrativa fora dos trilhos. Capacidade e fixação a conferir.</small></div>
    </section>
    <div className="metric-strip" aria-label="Ocupação do quadro">
      <div className="metric"><span>Capacidade</span><strong>{capacidade}</strong><small>módulos no quadro</small></div>
      <div className="metric"><span>Ocupados</span><strong>{ocupados}</strong><small>{quadro.componentes.length} componentes</small></div>
      <div className="metric"><span>Livres</span><strong>{capacidade - ocupados}</strong><small>{Math.round(ocupados / capacidade * 100)}% de ocupação</small></div>
    </div>
    <div className="qdc-workspace">
      <aside className="surface-card qdc-catalog">
        <h2>Adicionar componente</h2><p>Larguras iniciais ilustrativas. Ajuste conforme o modelo do fabricante.</p>
        {CATALOGO_QUADRO.map(c => <button key={c.tipo} onClick={() => adicionar(c.tipo, c.modulos)}><Plus size={16} /><span>{c.tipo}</span><small>{c.modulos} M</small></button>)}
      </aside>
      <section className="qdc-board" aria-label="Montagem física do quadro">
        <div className="qdc-board-heading"><div><span>Vista frontal · trilhos DIN</span><h2>{quadro.nome || 'Quadro sem nome'}</h2></div><PanelsTopLeft size={24} /></div>
        <QuadroCanvas quadro={quadro} selecionado={selecionado} selecionar={setSelecionado} atualizar={atualizar} mover={mover} />
      </section>
    </div>
    <section className="surface-card qdc-inspector" aria-label="Editar componente">
      <div className="section-heading"><div><h2>{item ? item.tipo : 'Detalhes do componente'}</h2><p>{item ? 'Confira largura e especificações no fabricante.' : 'Selecione um componente no quadro para editar identificação, largura e posição.'}</p></div>{item && <button className="btn-secondary" onClick={() => { atualizar({ ...quadro, componentes: quadro.componentes.filter(c => c.id !== item.id) }); setSelecionado(''); }}><Trash2 size={16} /> Remover</button>}</div>
      {item && <div className="qdc-fields">
        <label className="field-label">Circuito / identificação<input className="input-base" value={item.circuito} maxLength={60} placeholder="Ex.: C1 — Iluminação" onChange={e => editar({ circuito: e.target.value })} /></label>
        <label className="field-label">Modelo / especificação<input className="input-base" value={item.descricao} maxLength={120} placeholder="Fabricante, referência, características" onChange={e => editar({ descricao: e.target.value })} /></label>
        <label className="field-label">Largura em módulos<select className="input-base" value={item.modulos} onChange={e => editar({ modulos: Number(e.target.value) })}>{Array.from({ length: quadro.modulosPorTrilho }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
        <label className="field-label">Trilho<select className="input-base" value={item.trilho} onChange={e => editar({ trilho: Number(e.target.value) })}>{Array.from({ length: quadro.trilhos }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
        <label className="field-label">Posição inicial<select className="input-base" value={item.inicio} onChange={e => editar({ inicio: Number(e.target.value) })}>{Array.from({ length: quadro.modulosPorTrilho }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
      </div>}
    </section>
    <section className="data-panel qdc-materials"><div className="section-heading"><div><h2>Lista de materiais</h2><p>Componentes agrupados por tipo, especificação e largura. Acessórios e ligações devem ser levantados separadamente.</p></div><button className="btn-secondary" onClick={() => { if (alterado && !window.confirm('A cópia usará a montagem atual. Continuar sem salvar o quadro original?')) return; atualizar({ ...quadro, id: crypto.randomUUID(), nome: `${quadro.nome.slice(0, 70)} — cópia` }); setMensagem('Cópia criada. Salve para mantê-la.'); }}><Copy size={16} /> Duplicar quadro</button></div>
      <div className="qdc-table-scroll"><table className="data-table"><thead><tr><th>Material</th><th>Especificação</th><th>Módulos / peça</th><th>Quantidade</th></tr></thead><tbody><tr><td>Quadro</td><td>{quadro.trilhos} trilhos × {quadro.modulosPorTrilho} módulos</td><td>—</td><td>1</td></tr>
        {quadro.barramentoN && <tr><td>Barramento N</td><td>Capacidade e fixação a definir</td><td>—</td><td>1</td></tr>}
        {quadro.barramentoPE && <tr><td>Barramento PE</td><td>Capacidade e fixação a definir</td><td>—</td><td>1</td></tr>}
        {materiaisQuadro(quadro).map((c, i) => <tr key={i}><td>{c.tipo}</td><td>{c.descricao || 'A definir'}</td><td>{c.modulos}</td><td>{c.quantidade}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
