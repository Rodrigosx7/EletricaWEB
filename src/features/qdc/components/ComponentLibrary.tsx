import { useState } from 'react';
import { Boxes, Cable, ChevronDown, CircuitBoard, Plus, Search, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react';
import { CATALOG } from '../electrical-components/catalog';
import type { CatalogItem } from '../types';
import './panels.css';

export type ComponentLibraryProps = { onAdd(type: string): void };

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const categoryIcons = { Proteção: ShieldCheck, Distribuição: Cable, Automação: SlidersHorizontal, Outros: Boxes };

/** Decorative catalogue illustration. Device dimensions are defined by the editor catalogue. */
function CatalogThumbnail({ item }: { item: CatalogItem }) {
  const key = normalize(`${item.type} ${item.name}`);
  const isSurge = key.includes('dps');
  const isBar = /barramento|borne|busbar|terminal/.test(key);
  const isComb = /pente|comb-bus/.test(key);
  const isTerminal = /borne|terminal/.test(key);
  const isRcd = /\bdr\b|\bidr\b|rcd/.test(key);
  const isLight = /sinaleiro|lampada|indicator/.test(key);
  const poles = Math.min(4, Math.max(1, item.poles));
  return <svg viewBox="0 0 64 64" className="ewq-catalog-thumb" aria-hidden="true" focusable="false">
    <rect x="2" y="29" width="60" height="8" rx="1" fill="#b6c0c8" />
    {isComb ? <>
      <rect x="5" y="36" width="54" height="13" rx="4" fill="#2e3940" />
      <rect x="8" y="38" width="48" height="6" rx="3" fill="#c59248" />
      {[12, 20, 28, 36, 44, 52].map(x => <g key={x}><path d={`M${x} 15V40`} stroke="#b77d34" strokeWidth="4" /><rect x={x - 3} y="12" width="6" height="8" rx="1" fill="#303a40" /></g>)}
    </> : isTerminal ? <>
      <path d="M20 11H44l4 10v25l-6 8H22l-6-8V21z" fill={key.includes('terra') || key.includes('protecao') ? '#4f9654' : key.includes('neutro') ? '#3a86ad' : '#d0a54f'} stroke="#65737a" />
      <path d="M32 15v35" stroke="#ebcf86" strokeWidth="5" /><rect x="20" y="26" width="24" height="12" rx="2" fill="#f5f7f4" /><path d="M10 49h44" stroke="#8d999d" strokeWidth="5" />
    </> : isBar ? <>
      <rect x="7" y="21" width="50" height="24" rx="3" fill={key.includes('terra') ? '#2d8b5b' : key.includes('neutro') ? '#2674aa' : '#ac8851'} />
      <rect x="10" y="27" width="44" height="12" rx="2" fill="#dcb86a" />
      {[16, 27, 38, 49].map(x => <g key={x}><circle cx={x} cy="33" r="3.5" fill="#f2e7c8" stroke="#8b7244" /><path d={`M${x - 2} 33h4`} stroke="#735a35" /></g>)}
    </> : <>
      <rect x="12" y="6" width="40" height="52" rx="3" fill="#e9edef" stroke="#a8b2ba" />
      {Array.from({ length: poles }, (_, index) => { const x = 12 + ((index + .5) * 40) / poles; return <g key={index}>
        <circle cx={x} cy="13" r="3.3" fill="#cad2d8" stroke="#96a4ad" /><path d={`M${x - 2} 13h4`} stroke="#62717b" />
        <circle cx={x} cy="51" r="3.3" fill="#cad2d8" stroke="#96a4ad" /><path d={`M${x - 2} 51h4`} stroke="#62717b" />
      </g>; })}
      <rect x="15" y="21" width="34" height="22" rx="1.5" fill={isSurge ? '#c83a32' : '#d6dce0'} />
      {isSurge ? <><rect x="20" y="30" width="24" height="6" rx="1" fill="#faf2e3" /><path d="M34 22l-5 7h5l-4 9" stroke="#f9d854" fill="none" strokeWidth="1.5" /></> : isLight ? <circle cx="32" cy="32" r="8" fill="#e5b927" stroke="#a08229" strokeWidth="2" /> : <><rect x="20" y="31" width={isRcd ? 18 : 24} height="10" rx="1.5" fill="#293945" /><path d="M23 34h12" stroke="#667680" />{isRcd && <rect x="40" y="25" width="6" height="6" rx="1" fill="#e2b926" />}</>}
    </>}
  </svg>;
}

export function ComponentLibrary({ onAdd }: ComponentLibraryProps) {
  const [query, setQuery] = useState('');
  const filtered = CATALOG.filter(item => normalize(`${item.name} ${item.category} ${item.description}`).includes(normalize(query)));
  const categories = [...new Set(CATALOG.map(item => item.category))];
  return <aside className="ewq-panel ewq-library" aria-label="Biblioteca de componentes">
    <header className="ewq-panel-heading"><div><CircuitBoard size={17} aria-hidden="true" /><h2>Componentes</h2></div><span className="ewq-count">{CATALOG.length}</span></header>
    <div className="ewq-library-search"><label htmlFor="ewq-component-search" className="ewq-visually-hidden">Buscar componente</label><Search size={15} aria-hidden="true" /><input id="ewq-component-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar componente…" autoComplete="off" /></div>
    <p className="ewq-panel-hint">Arraste para um trilho ou clique para adicionar.</p>
    <div className="ewq-catalog-groups">
      {categories.map(category => {
        const items = filtered.filter(item => item.category === category);
        if (!items.length) return null;
        const Icon = categoryIcons[category as keyof typeof categoryIcons] ?? Zap;
        return <details key={category} className="ewq-catalog-group" open>
          <summary><Icon size={14} aria-hidden="true" /><span>{category}</span><span className="ewq-group-count">{items.length}</span><ChevronDown size={13} aria-hidden="true" /></summary>
          <div className="ewq-catalog-items">{items.map(item => <button key={item.type} type="button" className="ewq-catalog-item" draggable onDragStart={event => { event.dataTransfer.setData('application/qdc-device', item.type); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => onAdd(item.type)} aria-label={`Adicionar ${item.name}`} title={item.description}>
            <CatalogThumbnail item={item} /><span className="ewq-catalog-copy"><strong>{item.name}</strong><span>{item.modules} {item.modules === 1 ? 'módulo' : 'módulos'}{item.poles > 0 ? ` · ${item.poles}P` : ''}</span></span><Plus size={14} className="ewq-catalog-add" aria-hidden="true" />
          </button>)}</div>
        </details>;
      })}
      {!filtered.length && <div className="ewq-panel-empty"><Search size={22} aria-hidden="true" /><strong>Nenhum componente</strong><p>Tente outro nome ou categoria.</p><button className="ewq-text-button" type="button" onClick={() => setQuery('')}>Limpar busca</button></div>}
    </div>
    <p className="ewq-library-footnote">Medidas e módulos são referenciais. Confira o modelo do fabricante.</p>
  </aside>;
}

export default ComponentLibrary;
