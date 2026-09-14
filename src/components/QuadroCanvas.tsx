import { useState } from 'react';
import { CORES_FIO, borneValido, mesmoBorne, nomeBorne, numeroBornes, type BorneQuadro, type Quadro } from '../utils/quadros';
import { PASSO_MODULO, PASSO_TRILHO, pontoBorne, pontosFio, tamanhoDesenho } from '../utils/quadroDesenho';

type Props = { quadro: Quadro; selecionado: string; selecionar: (id: string) => void; atualizar: (q: Quadro) => void; mover: (trilho: number, inicio: number) => void };

export default function QuadroCanvas({ quadro: q, selecionado, selecionar, atualizar, mover }: Props) {
  const [modo, setModo] = useState(false);
  const [origem, setOrigem] = useState<BorneQuadro | null>(null);
  const [cor, setCor] = useState(CORES_FIO[0].valor);
  const [nome, setNome] = useState('');
  const [aviso, setAviso] = useState('');
  const inicio = origem && borneValido(q, origem) ? origem : null;
  const tamanho = tamanhoDesenho(q);
  const fios = q.fios ?? [];

  function conectar(b: BorneQuadro) {
    if (!modo) return;
    if (!inicio) { setOrigem(b); setAviso('Origem selecionada. Clique no borne de destino.'); return; }
    if (mesmoBorne(inicio, b)) { setAviso('Escolha outro borne para concluir a ligação.'); return; }
    if (fios.some(f => (mesmoBorne(f.origem, inicio) && mesmoBorne(f.destino, b)) || (mesmoBorne(f.destino, inicio) && mesmoBorne(f.origem, b)))) {
      setAviso('Esses bornes já têm uma ligação desenhada.'); return;
    }
    atualizar({ ...q, fios: [...fios, { id: crypto.randomUUID(), origem: inicio, destino: b, cor, identificacao: nome.trim() }] });
    setOrigem(null);
    setAviso('Fio adicionado. Selecione a origem do próximo fio ou saia do modo de ligação.');
  }

  function borne(b: BorneQuadro) {
    const [x, y] = pontoBorne(q, b);
    const ativo = !!inicio && mesmoBorne(inicio, b);
    return <g key={`${b.componente}-${b.lado}-${b.numero}`} role={modo ? 'button' : undefined} tabIndex={modo ? 0 : undefined} aria-label={nomeBorne(q, b)} onClick={() => conectar(b)} onKeyDown={e => { if (modo && ['Enter', ' '].includes(e.key)) { e.preventDefault(); conectar(b); } }} className={modo ? 'qdc-terminal interactive' : 'qdc-terminal'}>
      <title>{nomeBorne(q, b)}</title><circle cx={x} cy={y} r={modo ? 13 : 6} fill={ativo ? '#e9b949' : '#f5f7f8'} stroke={ativo ? '#94620c' : '#4a6778'} strokeWidth={2} />
      <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="#263c48" pointerEvents="none">{b.numero + 1}</text>
    </g>;
  }

  return <>
    <div className="qdc-wire-toolbar">
      <button className="btn-secondary" aria-pressed={modo} onClick={() => { setModo(!modo); setOrigem(null); setAviso(''); }}>{modo ? 'Concluir passagem de fios' : 'Passar fios'}</button>
      {modo && <>
        <label>Cor do fio<select value={cor} onChange={e => setCor(e.target.value)}>{CORES_FIO.map(c => <option key={c.valor} value={c.valor}>{c.nome}</option>)}</select></label>
        <label>Identificação<input value={nome} maxLength={60} placeholder="Ex.: ligação A" onChange={e => setNome(e.target.value)} /></label>
        {inicio && <button className="btn-secondary" onClick={() => { setOrigem(null); setAviso('Selecione outro borne de origem.'); }}>Cancelar fio</button>}
      </>}
    </div>
    <p className="qdc-board-hint" role="status">{aviso || (modo ? 'Clique no borne de origem e depois no borne de destino. Os números são referências gráficas, não a marcação do fabricante.' : 'Selecione um componente para editar. Clique num espaço livre para mover o selecionado.')}</p>
    {inicio && <p className="qdc-board-hint">Origem: {nomeBorne(q, inicio)}</p>}
    <div className="qdc-rails-scroll" tabIndex={0} aria-label="Quadro com bornes e fios; rolagem horizontal disponível">
      <svg width={tamanho.largura} height={tamanho.altura} className="qdc-wiring-canvas" aria-label="Disposição dos componentes e ligações manuais">
        {Array.from({ length: q.trilhos }, (_, trilho) => <g key={trilho}>
          <text x={40} y={55 + trilho * PASSO_TRILHO} fill="#263c48" fontSize={12}>Trilho {trilho + 1}</text>
          <rect x={35} y={130 + trilho * PASSO_TRILHO} width={q.modulosPorTrilho * PASSO_MODULO + 10} height={18} fill="#92a1a8" />
          {Array.from({ length: q.modulosPorTrilho }, (_, pos) => {
            const ocupado = q.componentes.some(c => c.trilho === trilho && pos >= c.inicio && pos < c.inicio + c.modulos);
            return ocupado ? null : <g key={pos} role={!modo ? 'button' : undefined} tabIndex={!modo ? 0 : undefined} aria-label={`Mover para trilho ${trilho + 1}, posição ${pos + 1}`} onClick={() => { if (!modo) mover(trilho, pos); }} onKeyDown={e => { if (!modo && ['Enter', ' '].includes(e.key)) { e.preventDefault(); mover(trilho, pos); } }} className="qdc-canvas-slot"><rect x={40 + pos * PASSO_MODULO} y={70 + trilho * PASSO_TRILHO} width={PASSO_MODULO} height={140} fill="transparent" stroke="#899ba4" strokeDasharray="3 3" /><text x={66 + pos * PASSO_MODULO} y={105 + trilho * PASSO_TRILHO} textAnchor="middle" fill="#455c66" fontSize={10}>{pos + 1}</text></g>;
          })}
        </g>)}
        {q.componentes.map((c, i) => {
          const x = 40 + c.inicio * PASSO_MODULO, y = 70 + c.trilho * PASSO_TRILHO, w = c.modulos * PASSO_MODULO;
          const dps = c.tipo === 'DPS';
          return <g key={c.id} role="button" tabIndex={0} aria-label={`Selecionar componente ${i + 1}: ${c.tipo}`} onClick={() => selecionar(c.id)} onKeyDown={e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); selecionar(c.id); } }}>
            <title>{c.tipo} · {c.circuito || 'Sem identificação'}</title><rect x={x + 2} y={y} width={w - 4} height={140} rx={3} fill={dps ? '#b33434' : '#f5f6f4'} stroke={selecionado === c.id ? '#c59b24' : '#8f9ea5'} strokeWidth={selecionado === c.id ? 3 : 1} />
            <text x={x + w / 2} y={y + 25} textAnchor="middle" fontSize={10} fill={dps ? 'white' : '#34434a'}>{String(i + 1).padStart(2, '0')}</text>
            <rect x={x + w / 2 - 10} y={y + 38} width={20} height={dps ? 16 : 30} rx={2} fill={dps ? '#2d9965' : '#263c48'} />
            <text x={x + w / 2} y={y + 88} textAnchor="middle" fontSize={9} fill={dps ? 'white' : '#263c48'}>{c.tipo.length > w / 5 ? `${c.tipo.slice(0, Math.floor(w / 5) - 1)}…` : c.tipo}</text>
            <text x={x + w / 2} y={y + 108} textAnchor="middle" fontSize={9} fill={dps ? 'white' : '#263c48'}>{(c.circuito || 'Identificar').slice(0, Math.floor(w / 5))}</text>
          </g>;
        })}
        {[['@N', q.barramentoN], ['@PE', q.barramentoPE]].map(([id, mostrar]) => mostrar && <g key={String(id)}><rect x={48} y={(id === '@N' ? 25 : tamanho.altura - 25) - 10} width={250} height={20} fill="#d2b567" stroke="#8d722b" /><text x={12} y={(id === '@N' ? 25 : tamanho.altura - 25) + 4} fontSize={12} fill="#263c48">{String(id).slice(1)}</text></g>)}
        {fios.map((f, i) => <g key={f.id}><title>{f.identificacao || `Fio ${i + 1}`}</title><polyline points={pontosFio(q, f, i).map(p => p.join(',')).join(' ')} fill="none" stroke="#8d9ba4" strokeWidth={6} strokeLinejoin="round" /><polyline points={pontosFio(q, f, i).map(p => p.join(',')).join(' ')} fill="none" stroke={f.cor} strokeWidth={3.5} strokeLinejoin="round" pointerEvents="none" /></g>)}
        {q.componentes.flatMap(c => Array.from({ length: numeroBornes(c) }, (_, numero) => (['superior', 'inferior'] as const).map(lado => borne({ componente: c.id, lado, numero }))))}
        {q.barramentoN && Array.from({ length: 10 }, (_, numero) => borne({ componente: '@N', lado: 'superior', numero }))}
        {q.barramentoPE && Array.from({ length: 10 }, (_, numero) => borne({ componente: '@PE', lado: 'superior', numero }))}
      </svg>
    </div>
    <p className="qdc-board-hint">Ligações manuais não validadas eletricamente. Cores não atribuem função. Cruzamentos não são emendas. Trajetos não fornecem metragem.</p>
    {fios.length > 0 && <div className="qdc-wire-list"><h3>Ligações desenhadas ({fios.length})</h3>{fios.map((f, i) => <div key={f.id} className="qdc-wire-row"><span style={{ borderLeft: `5px solid ${f.cor}`, paddingLeft: 8 }}><strong>{f.identificacao || `Fio ${i + 1}`}</strong><small>{nomeBorne(q, f.origem)} — {nomeBorne(q, f.destino)}</small></span><button className="btn-secondary" aria-label={`Remover ${f.identificacao || `fio ${i + 1}`}`} onClick={() => atualizar({ ...q, fios: fios.filter(x => x.id !== f.id) })}>Remover fio</button></div>)}</div>}
  </>;
}
