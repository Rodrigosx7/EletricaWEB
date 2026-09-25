import { useState } from 'react';
import { Boxes, Cable, ChevronDown, CircuitBoard, Clock3, Plus, Search, ShieldCheck, SlidersHorizontal, Star, X, Zap } from 'lucide-react';
import { INSERTABLE_CATALOG } from '../electrical-components/catalog';
import ServiceEntranceArtwork from '../electrical-components/ServiceEntranceArtwork';
import GenericMCB from '../electrical-components/visuals/GenericMCB';
import GenericSPD from '../electrical-components/visuals/GenericSPD';
import GenericRCD from '../electrical-components/visuals/GenericRCD';
import type { CatalogItem, Supply } from '../types';
import './panels.css';

export type ComponentLibraryProps = { onAdd(type: string): void; onClose?(): void; storageKey?: string; supply: Supply };
type Collection = 'essentials' | 'favorites' | 'recent' | 'all';
type LibraryPreferences = { favorites: string[]; recent: string[] };

const ESSENTIALS = ['breaker-1p', 'breaker-2p', 'breaker-3p', 'rcd-2p', 'rcd-4p', 'spd', 'neutral-bus', 'earth-bus', 'comb-bus', 'power-entry', 'conduit-entry'];
const MCB_PREVIEW = { amperage: 63, curve: 'C' as const, breakingCapacityKa: 6, voltage: 400, tag: 'QF01' };
const SPD_PREVIEW = { voltage: 275, surgeCurrent: 20 };

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const categoryIcons = { Proteção: ShieldCheck, Distribuição: Cable, Infraestrutura: CircuitBoard, Automação: SlidersHorizontal, Outros: Boxes };
const phaseCount = (supply: Supply) => supply === 'tri' ? 3 : supply === 'bi' ? 2 : 1;
const catalogMeta = (item: CatalogItem, supply: Supply) => item.type === 'power-entry'
  ? `Mono/bi/tri · quadro atual: ${phaseCount(supply)}F`
  : item.type === 'comb-bus'
  ? `${item.modules} encaixes · ${({ 1: 'monofásico', 2: 'bifásico', 3: 'trifásico', 4: 'tetrapolar' } as Record<number, string>)[item.poles]}`
  : item.type === 'neutral-bus' || item.type === 'earth-bus'
    ? `${item.poles} bornes · 1 módulo`
    : item.mount === 'edge'
      ? `${item.poles} fios · borda do quadro`
      : `${item.modules} ${item.modules === 1 ? 'módulo' : 'módulos'}${item.poles > 0 ? ` · ${item.poles}P` : ''}`;

function loadPreferences(storageKey: string): LibraryPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<LibraryPreferences>;
    const known = new Set(INSERTABLE_CATALOG.map(item => item.type));
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(type => typeof type === 'string' && known.has(type)) : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter(type => typeof type === 'string' && known.has(type)).slice(0, 6) : [],
    };
  } catch { return { favorites: [], recent: [] }; }
}

/** Decorative catalogue illustration. Device dimensions are defined by the editor catalogue. */
function CatalogThumbnail({ item, supply }: { item: CatalogItem; supply: Supply }) {
  if (item.type.startsWith('breaker-') && item.poles >= 1 && item.poles <= 3) {
    const poles = item.poles as 1 | 2 | 3;
    return <GenericMCB device={{ ...MCB_PREVIEW, voltage: poles === 1 ? 127 : poles === 3 ? 380 : 220 }} poles={poles} width={poles * 20} height={60} finish="classic" />;
  }
  if (item.type === 'spd') return <GenericSPD device={SPD_PREVIEW} width={34} height={108} finish="red" />;
  if (item.type === 'rcd-2p' || item.type === 'rcd-4p') return <GenericRCD device={{ amperage: 63, sensitivity: 30, voltage: item.poles === 2 ? 220 : 380, tag: '' }} poles={item.poles as 2 | 4} width={item.poles === 2 ? 72 : 100} height={108} finish="classic" />;
  if (item.type === 'power-entry') return <svg viewBox="0 0 64 64" className="ewq-catalog-thumb" aria-hidden="true" focusable="false"><ServiceEntranceArtwork width={64} height={64} phases={phaseCount(supply)} /></svg>;
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

export function ComponentLibrary({ onAdd, onClose, supply, storageKey = 'qdc-component-library' }: ComponentLibraryProps) {
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<Collection>('essentials');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() => loadPreferences(storageKey));
  const searching = !!query.trim();
  const filtered = INSERTABLE_CATALOG.filter(item => searching
    ? normalize(`${item.name} ${item.category} ${item.description}`).includes(normalize(query.trim()))
    : collection === 'essentials' ? ESSENTIALS.includes(item.type)
      : collection === 'favorites' ? preferences.favorites.includes(item.type)
        : collection === 'recent' ? preferences.recent.includes(item.type)
          : categoryFilter === 'Todas' || item.category === categoryFilter)
    .sort((a, b) => collection === 'recent' && !searching ? preferences.recent.indexOf(a.type) - preferences.recent.indexOf(b.type) : 0);
  const categories = [...new Set(INSERTABLE_CATALOG.map(item => item.category))];
  function savePreferences(next: LibraryPreferences) {
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* preferences remain available for this session */ }
  }
  function rememberRecent(type: string) {
    savePreferences({ ...preferences, recent: [type, ...preferences.recent.filter(item => item !== type)].slice(0, 6) });
  }
  function addItem(type: string) {
    rememberRecent(type);
    onAdd(type);
  }
  function toggleFavorite(type: string) {
    const favorites = preferences.favorites.includes(type) ? preferences.favorites.filter(item => item !== type) : [...preferences.favorites, type];
    savePreferences({ ...preferences, favorites });
  }
  function catalogButton(item: CatalogItem) {
    const favorite = preferences.favorites.includes(item.type);
    const featured = item.type === 'spd' || item.type === 'rcd-2p' || item.type === 'rcd-4p';
    const isMcb = item.type.startsWith('breaker-') && item.poles <= 3;
    return <div key={item.type} className={`ewq-catalog-item${featured ? ' ewq-catalog-feature' : ''}`} draggable onDragStart={event => { event.dataTransfer.setData('application/qdc-device', item.type); event.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={event => { if (event.dataTransfer.dropEffect === 'copy') rememberRecent(item.type); }} title={item.description}>
      <button type="button" className="ewq-catalog-main" onClick={() => addItem(item.type)} aria-label={`Adicionar ${item.name}`}><span className={`ewq-catalog-art${isMcb ? ' is-mcb' : ''}${item.type === 'rcd-4p' ? ' is-rcd-4p' : ''}`}><CatalogThumbnail item={item} supply={supply} /></span><span className="ewq-catalog-copy"><strong>{item.name}</strong><span>{catalogMeta(item, supply)}</span>{featured && <span className="ewq-catalog-feature-label">Visual vetorial detalhado</span>}</span><span className="ewq-catalog-add"><Plus size={15} aria-hidden="true" /></span></button>
      <button type="button" className="ewq-catalog-favorite" aria-label={favorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`} aria-pressed={favorite} onClick={() => toggleFavorite(item.type)}><Star size={15} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} /></button>
      {featured && <><button type="button" className="ewq-catalog-preview-toggle" aria-expanded={showPreview === item.type} aria-controls={showPreview === item.type ? `ewq-preview-${item.type}` : undefined} onClick={() => setShowPreview(value => value === item.type ? null : item.type)}>{showPreview === item.type ? 'Ocultar prévia' : 'Ver prévia ampliada'}</button>{showPreview === item.type && <div id={`ewq-preview-${item.type}`} className="ewq-catalog-preview" role="group" aria-label={`Prévia de ${item.name}`}>
        {item.type === 'spd' ? <GenericSPD device={SPD_PREVIEW} width={60} height={189} finish="red" /> : <GenericRCD device={{ amperage: 63, sensitivity: 30, voltage: item.poles === 2 ? 220 : 380, tag: '' }} poles={item.poles as 2 | 4} width={item.poles === 2 ? 126 : 252} height={189} finish="classic" />}
        <p>{item.type === 'spd' ? 'Exemplo ilustrativo: 275 V · 20 kA. Valores e acabamento seguem o projeto; o visor verde não indica estado real.' : `IDR ${item.poles === 2 ? 'bipolar (L e N)' : 'tetrapolar (L1, L2, L3 e N)'}: ${item.poles * 2} bornes conectáveis. Corrente, sensibilidade e tensão seguem as propriedades; o botão de teste é apenas gráfico.`}</p>
      </div>}</>}
    </div>;
  }
  return <aside className="ewq-panel ewq-library" aria-label="Biblioteca de componentes">
    <header className="ewq-panel-heading"><div><CircuitBoard size={17} aria-hidden="true" /><h2>Componentes</h2></div><span className="ewq-count">{INSERTABLE_CATALOG.length}</span>{onClose && <button className="ewq-icon ewq-panel-close" type="button" aria-label="Fechar biblioteca" onClick={onClose}><X size={16} aria-hidden="true" /></button>}</header>
    <div className="ewq-library-search"><label htmlFor="ewq-component-search" className="ewq-visually-hidden">Buscar componente</label><Search size={15} aria-hidden="true" /><input id="ewq-component-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar componente…" autoComplete="off" /></div>
    <div className="ewq-collection-switch" aria-label="Coleção de componentes">{([['essentials', 'Essenciais'], ['favorites', 'Favoritos'], ['recent', 'Recentes'], ['all', 'Catálogo']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={collection === id} onClick={() => { setCollection(id); setQuery(''); }}>{id === 'favorites' && <Star size={13} aria-hidden="true" />}{id === 'recent' && <Clock3 size={13} aria-hidden="true" />}{label}{id === 'favorites' && preferences.favorites.length > 0 && <span>{preferences.favorites.length}</span>}</button>)}</div>
    {collection === 'all' && !searching && <label className="ewq-category-filter"><span className="ewq-visually-hidden">Categoria de componentes</span><select aria-label="Categoria de componentes" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="Todas">Todas as categorias ({INSERTABLE_CATALOG.length})</option>{categories.map(category => <option key={category} value={category}>{category} ({INSERTABLE_CATALOG.filter(item => item.category === category).length})</option>)}</select></label>}
    <p className="ewq-panel-hint ewq-library-instruction" aria-live="polite">{searching ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'} no catálogo` : collection === 'favorites' ? `${filtered.length} ${filtered.length === 1 ? 'favorito' : 'favoritos'}` : collection === 'recent' ? 'Últimos componentes adicionados' : 'Clique para adicionar ou arraste para o quadro.'}</p>
    <div className="ewq-catalog-groups">
      {collection !== 'all' || searching ? <div className="ewq-catalog-items">{filtered.map(catalogButton)}</div> : categories.map(category => {
        const items = filtered.filter(item => item.category === category);
        if (!items.length) return null;
        const Icon = categoryIcons[category as keyof typeof categoryIcons] ?? Zap;
        return <details key={category} className="ewq-catalog-group" open>
          <summary><Icon size={14} aria-hidden="true" /><span>{category}</span><span className="ewq-group-count">{items.length}</span><ChevronDown size={13} aria-hidden="true" /></summary>
          <div className="ewq-catalog-items">{items.map(catalogButton)}</div>
        </details>;
      })}
      {!filtered.length && <div className="ewq-panel-empty">{collection === 'favorites' && !searching ? <Star size={22} aria-hidden="true" /> : collection === 'recent' && !searching ? <Clock3 size={22} aria-hidden="true" /> : <Search size={22} aria-hidden="true" />}<strong>{collection === 'favorites' && !searching ? 'Nenhum favorito ainda' : collection === 'recent' && !searching ? 'Nenhum componente recente' : 'Nenhum componente'}</strong><p>{collection === 'favorites' && !searching ? 'Use a estrela para guardar os componentes mais usados.' : collection === 'recent' && !searching ? 'Os componentes adicionados aparecerão aqui.' : 'Tente outro nome ou categoria.'}</p>{searching && <button className="ewq-text-button" type="button" onClick={() => setQuery('')}>Limpar busca</button>}</div>}
    </div>
    <p className="ewq-library-footnote">Medidas e módulos são referenciais. Confira o modelo do fabricante.</p>
  </aside>;
}

export default ComponentLibrary;
