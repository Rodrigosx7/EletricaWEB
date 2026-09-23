import { memo } from 'react';
import type { Device, ViewMode } from '../types';
import ServiceEntranceArtwork from './ServiceEntranceArtwork';

type Props = { device: Device; width: number; height: number; mode: ViewMode };
const INK = '#273238';

/** Manufacturer-neutral DIN device artwork. Terminals are drawn by the canvas. */
function DeviceDrawing({ device: d, width: w, height: h, mode }: Props) {
  const rcd = d.type.startsWith('rcd') || d.type.startsWith('rcbo');
  const breaker = d.type.includes('breaker');
  const switching = breaker || rcd || d.type.startsWith('switch-disconnector');
  const bus = d.type.endsWith('-bus');
  const terminal = d.type.includes('terminal');
  const compact = w < 65;
  const visualModel = d.visualModel ?? 'classic';
  const visual = visualModel === 'graphite' ? {
    shell: ['#667176', '#343d41', '#1e282d', '#11191d'], border: '#10191d', highlight: '#899397', side: '#0c1418',
    well: '#151e22', wellBorder: '#080e11', screw: '#aeb7b8', face: '#293337', faceBorder: '#111b1f', ink: '#f3f5f3', muted: '#b9c3c4', accent: '#d88a31',
  } : visualModel === 'two-tone' ? {
    shell: ['#ffffff', '#f1f3ef', '#d8ddda', '#aeb8b7'], border: '#7d898b', highlight: '#ffffff', side: '#3d494e',
    well: '#252f33', wellBorder: '#111b1f', screw: '#bdc5c5', face: '#e6e9e4', faceBorder: '#aeb8b6', ink: '#26343a', muted: '#65757b', accent: '#287ea2',
  } : {
    shell: ['#ffffff', '#f3f5f1', '#e0e5e1', '#bcc5c3'], border: '#9fa9aa', highlight: '#ffffff', side: '#aeb7b5',
    well: '#d6dcda', wellBorder: '#b1bcba', screw: '#b6c0bf', face: '#eaede8', faceBorder: '#c2c9c8', ink: INK, muted: '#69767a', accent: '#3b8b63',
  };
  const amp = d.amperage === null ? '— A' : `${d.amperage} A`;
  const caption = d.type === 'rcbo-2p' ? 'RCBO' : d.type === 'motor-breaker-3p' ? 'MOTOR' : d.type.startsWith('switch-disconnector') ? 'SECC.' : breaker ? `${d.curve}${d.amperage ?? '—'}` : rcd ? 'DR' : ({ spd: 'DPS', 'fuse-holder': 'FUSÍVEL', 'comb-bus': 'PENTE', 'neutral-bus': 'NEUTRO', 'earth-bus': 'TERRA', terminal: 'BORNE', 'through-terminal': 'PASS.', 'terminal-n': 'N', 'terminal-pe': 'PE', 'distribution-block': 'DIST.', contactor: 'CONTATOR', relay: 'RELÉ', timer: 'TIMER', 'level-relay': 'NÍVEL', 'power-supply': 'FONTE', 'smart-relay': 'SMART', 'impulse-relay': 'IMPULSO', 'overload-relay': 'SOBREC.', 'phase-monitor': 'FASES', 'din-socket': 'TOMADA', bell: 'CAMPAINHA', indicator: 'SINAL', meter: 'MEDIDOR', voltmeter: 'VOLTÍMETRO', ammeter: 'AMPERÍMETRO' }[d.type] ?? d.type);
  if (d.type === 'comb-bus') {
    const bottom = (d.combSide ?? 'bottom') === 'bottom', barY = bottom ? h - 7 : 1;
    return <g>
      <rect x="1" y={barY} width={w - 2} height="6" rx="3" fill="#d3a14d" stroke="#7b5927" />
      <path d={`M5 ${barY + 1.8} H${w - 5}`} stroke="#f3d18c" strokeWidth="1.4" />
      {Array.from({ length: d.modules }, (_, index) => { const x = (index + .5) * w / d.modules, tip = bottom ? Math.max(1, barY - 7) : Math.min(h - 1, barY + 13); return <path key={index} d={bottom ? `M${x} ${tip} V${barY}` : `M${x} ${barY + 6} V${tip}`} stroke="#a97331" strokeWidth="2.6" strokeLinecap="round" />; })}
    </g>;
  }
  if (d.type === 'neutral-bus' || d.type === 'earth-bus') {
    const earth = d.type === 'earth-bus', horizontal = w > h, count = Math.min(d.poles, 12);
    return <g>
      <rect x="2" y="1" width={w - 4} height={h - 2} rx="5" fill="#d8dfdb" stroke="#9daaaa" />
      <rect x="6" y="6" width={w - 12} height={h - 12} rx="3" fill={earth ? '#3d8b52' : '#2f82af'} />
      <path d={horizontal ? `M11 ${h / 2} H${w - 11}` : `M${w / 2} 11 V${h - 11}`} stroke="#d7b76b" strokeWidth="5" />
      {Array.from({ length: count }, (_, index) => horizontal
        ? <circle key={index} cx={10 + (index + .5) * (w - 20) / count} cy={h / 2} r="2.3" fill="#efe2b8" stroke="#675c42" />
        : <circle key={index} cx={w / 2} cy={10 + (index + .5) * (h - 20) / count} r="2.3" fill="#efe2b8" stroke="#675c42" />)}
    </g>;
  }
  if (d.type === 'power-entry') return <ServiceEntranceArtwork width={w} height={h} reserveTerminalArea />;
  if (d.type === 'conduit-entry') {
    const tag = d.label.match(/C\d+(?:\s*[–-]\s*C?\d+)?/i)?.[0]?.replace(/\s/g, '') ?? 'SAÍDA';
    const radius = Math.min(18, Math.min(w, h) / 2 - 5);
    return <g>
      <rect x="2" y="2" width={w - 4} height={h - 4} rx="7" fill="#e7ece9" stroke="#7d8d91" />
      <circle cx={w / 2} cy={h / 2 - 3} r={radius + 3} fill="#c9d1cf" stroke="#73848a" strokeWidth="1.5" />
      <circle cx={w / 2} cy={h / 2 - 3} r={radius} fill="#485b62" stroke="#263941" strokeWidth="2" />
      <circle cx={w / 2 - 7} cy={h / 2 - 5} r="3.2" fill="#252a2d" stroke="#0d1214" />
      <circle cx={w / 2} cy={h / 2 - 7} r="3.2" fill="#2686bd" stroke="#175b7f" />
      <circle cx={w / 2 + 7} cy={h / 2 - 5} r="3.2" fill="#3b9254" stroke="#ecd83c" strokeWidth="1.2" />
      {mode === 'labels' && <>
        <rect x={Math.max(5, w / 2 - 24)} y={h - 15} width={Math.min(48, w - 10)} height="11" rx="3" fill="#f8faf8" stroke="#a7b2b1" />
        <text x={w / 2} y={h - 7} textAnchor="middle" fill="#34474e" fontSize={tag.length > 7 ? 6.2 : 7.2} fontWeight="800">{tag}</text>
      </>}
    </g>;
  }
  if (mode === 'schematic') return <g fill="none" stroke={INK} strokeWidth="1.6">
    <rect x="2" y="7" width={w - 4} height={h - 14} rx="2" fill="#fff" stroke="#a4b1b9" />
    <text x={w / 2} y="31" textAnchor="middle" fill={INK} stroke="none" fontSize="10" fontWeight="700">{caption}</text>
    {Array.from({ length: Math.min(d.poles || 1, 4) }, (_, index) => {
      const x = (index + 0.5) * w / Math.min(d.poles || 1, 4);
      return <g key={index}><path d={`M${x} 3 V49 M${x} 81 V${h - 3}`} /><circle cx={x} cy="48" r="2.3" fill="#fff" /><circle cx={x} cy="82" r="2.3" fill="#fff" />{bus || terminal ? <path d={`M${x} 49 V82`} /> : d.type === 'spd' ? <><path d={`M${x - 8} 50 H${x + 8} V80 H${x - 8} Z M${x - 11} 76 L${x + 11} 55`} /><path d={`M${x + 4} 55 H${x + 11} V62`} /></> : <path d={`M${x} 81 L${x + 9} 54`} />}</g>;
    })}
    {rcd && <path d={`M8 66 H${w - 8}`} strokeDasharray="3 3" />}
    <text x={w / 2} y={h - 20} textAnchor="middle" fill={INK} stroke="none" fontSize="9">{bus || terminal ? `${d.modules} M` : amp}</text>
  </g>;
  if (mode === 'labels') return <g>
    <rect x="2" y="6" width={w - 4} height={h - 12} rx="4" fill="#fff" stroke="#acb5b8" />
    <rect x="2" y="6" width={w - 4} height="8" rx="3" fill={d.color || '#e3be19'} />
    <text x={w / 2} y="48" textAnchor="middle" fill={INK} fontSize={compact ? 11 : 14} fontWeight="700">{caption}</text>
    {!breaker && <text x={w / 2} y="82" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">{amp}</text>}
  </g>;
  if (mode === 'installation') return <g>
    <rect x="2" y="3" width={w - 4} height={h - 6} rx="4" fill="#fafbfc" fillOpacity="0.76" stroke="#b2bdc3" strokeDasharray="4 3" />
    <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fill="#74838c" fontSize="11" fontWeight="700">{caption}</text>
    {!breaker && <text x={w / 2} y={h / 2 + 14} textAnchor="middle" fill="#74838c" fontSize="10">{amp}</text>}
  </g>;
  if (bus) {
    const earth = d.type === 'earth-bus';
    const comb = d.type === 'comb-bus';
    const color = earth ? '#4f8844' : '#337da6';
    if (comb) return <g>
      <rect x="2" y="41" width={w - 4} height="61" rx="5" fill="#222d33" opacity=".14" />
      <rect x="3" y="39" width={w - 6} height="54" rx="4" fill="#f0f1ed" stroke="#aeb8ba" />
      <rect x="7" y="66" width={w - 14} height="13" rx="4" fill="#d6a85b" stroke="#8a6731" />
      <rect x="8" y="67" width={w - 16} height="3" rx="1.5" fill="#f4d590" opacity=".8" />
      {Array.from({ length: Math.max(2, d.poles) }, (_, i) => {
        const x = 12 + i * (w - 24) / Math.max(d.poles - 1, 1);
        return <g key={i}><path d={`M${x} 30 V70`} stroke="#b9853e" strokeWidth="5" /><path d={`M${x - 2} 31 h4`} stroke="#f1d08d" strokeWidth="1.2" /><rect x={x - 5} y="24" width="10" height="10" rx="2" fill="#303b40" stroke="#18262c" /></g>;
      })}
      <rect x="5" y="81" width={w - 10} height="12" rx="2" fill="#303b40" /><text x={w / 2} y="89" textAnchor="middle" fill="#f5f7f4" fontSize="7" fontWeight="800">PENTE · {d.poles} POLOS</text>
      <text x={w / 2} y="112" textAnchor="middle" fill="#56666d" fontSize="7">cobre isolado · medida a conferir</text>
    </g>;
    return <g>
      <rect x="1" y="23" width={w - 2} height="80" rx="5" fill="#263139" opacity=".13" />
      <rect x="3" y="21" width={w - 6} height="75" rx="4" fill="#d9dfdb" stroke="#9eaaaa" />
      <rect x="6" y="31" width={w - 12} height="27" rx="3" fill="#d9bd73" stroke="#89733d" />
      <path d={`M9 35 H${w - 9}`} stroke="#f7e4ad" strokeWidth="3" opacity=".8" />
      <rect x="6" y="63" width={w - 12} height="25" rx="2" fill={color} />
      <text x={w / 2} y="78" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800">{caption}</text>
      <path d={`M10 91 H${w - 10}`} stroke={earth ? '#f2d631' : '#b8d7e8'} strokeWidth="4" />
      <rect x="5" y="26" width={w - 10} height="38" rx="3" fill="#fff" fillOpacity=".12" stroke="#fff" strokeOpacity=".45" />
    </g>;
  }
  const shellGradient = `qdc-shell-${d.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const leverGradient = `qdc-lever-${d.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const screwGradient = `qdc-screw-${d.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const poleCount = Math.max(1, d.poles || 1);
  return <g>
    <defs>
      <linearGradient id={shellGradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={visual.shell[0]} /><stop offset=".24" stopColor={visual.shell[1]} /><stop offset=".64" stopColor={visual.shell[2]} /><stop offset="1" stopColor={visual.shell[3]} /></linearGradient>
      <linearGradient id={leverGradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#59676b" /><stop offset=".38" stopColor="#26373d" /><stop offset="1" stopColor="#111f24" /></linearGradient>
      <radialGradient id={screwGradient} cx="36%" cy="30%" r="70%"><stop offset="0" stopColor="#eef1ef" /><stop offset=".42" stopColor={visual.screw} /><stop offset="1" stopColor="#657277" /></radialGradient>
    </defs>
    <rect x="3" y="4" width={w - 3} height={h - 2} rx="5" fill="#13252c" fillOpacity={visualModel === 'graphite' ? 0.32 : 0.2} />
    <path d={`M5 1 H${w - 5} Q${w - 2} 1 ${w - 2} 5 V${h - 5} Q${w - 2} ${h - 1} ${w - 6} ${h - 1} H5 Q1 ${h - 1} 1 ${h - 6} V5 Q1 1 5 1`} fill={terminal ? '#d4dce0' : `url(#${shellGradient})`} stroke={terminal ? '#9fa9aa' : visual.border} />
    <path d={`M5 5 H${w - 5} V${h - 7}`} fill="none" stroke={terminal ? '#fff' : visual.highlight} strokeWidth="2.2" strokeOpacity={visualModel === 'graphite' ? .42 : .9} />
    <path d={`M${w - 5} 8 V${h - 9}`} stroke={terminal ? '#aeb7b5' : visual.side} strokeWidth="2" opacity=".7" />
    {!terminal && visualModel === 'two-tone' && <path d={`M${Math.max(12, w * .64)} 3 H${w - 3} V${h - 3} H${Math.max(12, w * .64)}`} fill="#344046" fillOpacity=".96" stroke="#202c31" strokeWidth=".6" />}
    {!terminal && Array.from({ length: poleCount }, (_, i) => {
      const poleWidth = w / poleCount, cx = poleWidth * (i + .5);
      return <g key={`terminal-wells-${i}`}>
        {i > 0 && <path d={`M${poleWidth * i} 4 V${h - 4}`} stroke={visual.side} strokeOpacity=".75" />}
        <rect x={poleWidth * i + 5} y="5" width={poleWidth - 10} height="23" rx="3" fill={visual.well} stroke={visual.wellBorder} />
        <circle cx={cx} cy="17" r={Math.min(8, poleWidth / 5)} fill={`url(#${screwGradient})`} stroke="#687579" />
        <path d={`M${cx - 4} 17 H${cx + 4}`} stroke="#536268" strokeWidth="1.25" />
        <rect x={poleWidth * i + 5} y={h - 28} width={poleWidth - 10} height="23" rx="3" fill={visual.well} stroke={visual.wellBorder} />
        <circle cx={cx} cy={h - 17} r={Math.min(8, poleWidth / 5)} fill={`url(#${screwGradient})`} stroke="#687579" />
        <path d={`M${cx - 4} ${h - 17} H${cx + 4}`} stroke="#536268" strokeWidth="1.25" />
      </g>;
    })}
    <rect x="5" y="28" width={w - 10} height={h - 56} rx="2" fill={terminal ? '#7d9098' : visual.face} stroke={terminal ? '#c2c9c8' : visual.faceBorder} />
    {!terminal && <><rect x="8" y="31" width={Math.max(8, w - 16)} height="3" rx="1.5" fill={visual.highlight} opacity={visualModel === 'graphite' ? .28 : .8} /><path d={`M8 ${h - 32} H${w - 8}`} stroke={visual.side} opacity=".65" /><rect x="8" y="36" width="3" height="18" rx="1.5" fill={visual.accent} /></>}
    {switching ? <>
      {Array.from({ length: Math.max(d.poles, 1) }, (_, i) => {
        const pw = w / Math.max(d.poles, 1), px = pw * i;
        return <g key={i}>
          <rect x={px + 7} y="59" width={pw - 14} height="36" rx="3" fill={visualModel === 'graphite' ? '#111a1e' : '#aab4b2'} stroke={visualModel === 'graphite' ? '#657176' : '#899698'} />
          <rect x={px + 9} y="64" width={pw - 18} height="24" rx="2" fill={`url(#${leverGradient})`} stroke="#12252b" />
          <path d={`M${px + 10} 66 H${px + pw - 10}`} stroke="#77858a" strokeWidth="1.4" />
          <path d={`M${px + 11} 86 H${px + pw - 11}`} stroke="#07161b" strokeWidth="1.5" />
          <text x={px + pw / 2} y="77" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="700">I</text>
          <rect x={px + pw / 2 - 6} y="90" width="12" height="3.5" rx="1.4" fill={visual.accent} stroke={visualModel === 'graphite' ? '#8f541e' : '#2d6d4d'} strokeWidth=".5" />
        </g>;
      })}
      <text x="14" y="41" fill={visual.ink} fontSize={compact ? 7.7 : 9.4} fontWeight="800">{d.type === 'rcbo-2p' ? 'RCBO' : rcd ? 'IDR' : caption}</text>
      {rcd && <text x="14" y="51" fill={visual.muted} fontSize="6.8">{`${amp} / ${d.sensitivity > 0 ? `${d.sensitivity} mA` : '— mA'}`}</text>}
      {rcd && <g><rect x={w - 27} y="32" width="18" height="14" rx="3" fill="#6c8790" stroke="#3e5d66" /><path d={`M${w - 25} 34 H${w - 11}`} stroke="#9eb1b7" /><text x={w - 18} y="41" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="700">TEST</text></g>}
      {d.poles > 1 && <path d={`M12 82 H${w - 12}`} stroke="#182a32" strokeWidth="5" />}
      <text x={w / 2} y="103" textAnchor="middle" fill={visual.muted} fontSize="6.5" fontWeight="650">{rcd ? 'Δ' : '6000'}  ~</text>
    </> : d.type === 'spd' ? <>
      <rect x="6" y="28" width={w - 12} height="67" rx="2" fill="#d4dacb" stroke="#a3ac98" />
      <text x={w / 2} y="41" textAnchor="middle" fill={INK} fontSize="10" fontWeight="800">DPS</text>
      <path d={`M${w / 2 + 4} 47 l-8 11 h7 l-7 11 13-14 h-7 Z`} fill="#465743" />
      <text x={w / 2} y="78" textAnchor="middle" fill="#465743" fontSize="7">{d.voltage > 0 ? `${d.voltage} V` : '— V'}</text>
      <text x={w / 2} y="88" textAnchor="middle" fill="#465743" fontSize="7">{d.surgeCurrent > 0 ? `${d.surgeCurrent} kA` : '— kA'}</text>
      <rect x={w / 2 - 8} y="99" width="16" height="8" rx="1" fill="#388f5e" stroke="#23713f" />
    </> : d.type === 'fuse-holder' ? <>
      <rect x="7" y="29" width={w - 14} height="69" rx="4" fill="#d9ddda" stroke="#929d9d" />
      <path d={`M11 38 H${w - 11} L${w - 8} 82 H8 Z`} fill="#f4f5f1" stroke="#aeb6b4" />
      <rect x={w / 2 - 6} y="44" width="12" height="34" rx="6" fill="#d4b96f" stroke="#8a733d" /><path d={`M${w / 2} 47 V75`} stroke="#f8e8b5" strokeWidth="3" />
      <text x={w / 2} y="91" textAnchor="middle" fill={INK} fontSize="6.5" fontWeight="800">FUSÍVEL</text>
    </> : terminal ? <>
      <path d={`M7 30 H${w - 7} L${w - 4} 43 V82 L${w - 9} 94 H9 L4 82 V43 Z`} fill={d.type === 'terminal-pe' ? '#5a9650' : d.type === 'terminal-n' || d.type === 'through-terminal' ? '#3d84a0' : '#d2a84d'} stroke="#607178" />
      <path d={`M${w / 2} 28 V96`} stroke="#b88d3f" strokeWidth="7" /><path d={`M${w / 2} 30 V94`} stroke="#f0d48e" strokeWidth="3" />
      <rect x="7" y="50" width={w - 14} height="25" rx="3" fill="#f6f7f3" stroke="#a9b4b5" />
      <path d={`M10 56 H${w - 10} M10 70 H${w - 10}`} stroke="#d7dedc" />
      <text x={w / 2} y="66" textAnchor="middle" fill={INK} fontSize="7" fontWeight="800">{d.type === 'terminal-pe' ? 'PE' : d.type === 'terminal-n' ? 'N' : d.type === 'through-terminal' ? 'PASS.' : 'X1'}</text>
      <path d={`M8 101 H${w - 8}`} stroke="#43545c" strokeWidth="5" /><path d={`M12 99 V104 M${w - 12} 99 V104`} stroke="#1e3038" />
    </> : d.type === 'distribution-block' ? <>
      <rect x="7" y="32" width={w - 14} height="64" rx="3" fill="#5e8290" fillOpacity="0.66" stroke="#506d78" />
      {Array.from({ length: 3 }, (_, i) => <g key={i}><rect x="12" y={38 + i * 16} width={w - 24} height="11" rx="2" fill="#d6c181" /><circle cx="21" cy={43 + i * 16} r="3" fill="#6c674d" /><circle cx={w - 21} cy={43 + i * 16} r="3" fill="#6c674d" /></g>)}
      <text x={w / 2} y="107" textAnchor="middle" fill={INK} fontSize="8">DISTRIBUIÇÃO</text>
    </> : d.type === 'din-socket' ? <>
      <circle cx={w / 2} cy="62" r={Math.min(w / 2 - 8, 27)} fill="#fafbf8" stroke="#b0baba" strokeWidth="3" />
      <circle cx={w / 2 - 9} cy="60" r="3" fill="#3f4b52" /><circle cx={w / 2 + 9} cy="60" r="3" fill="#3f4b52" /><circle cx={w / 2} cy="71" r="3" fill="#3f4b52" />
      <text x={w / 2} y="100" textAnchor="middle" fill={INK} fontSize="8">{amp} / {d.voltage > 0 ? `${d.voltage} V` : '— V'}</text>
    </> : d.type === 'indicator' ? <>
      <circle cx={w / 2} cy="60" r="13" fill="#3a8061" stroke="#9fbdb0" strokeWidth="4" /><circle cx={w / 2 - 3} cy="56" r="4" fill="#a8d4ba" opacity="0.65" />
      <text x={w / 2} y="89" textAnchor="middle" fill={INK} fontSize="8">{d.voltage > 0 ? `${d.voltage} V` : '— V'}</text>
    </> : d.type === 'bell' ? <>
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x="10" y={39 + i * 7} width={w - 20} height="3" rx="1" fill="#859499" />)}
      <text x={w / 2} y="98" textAnchor="middle" fill={INK} fontSize="7">CAMPAINHA</text>
    </> : <>
      <text x={w / 2} y="38" textAnchor="middle" fill={INK} fontSize={compact ? 7 : 8} fontWeight="700">{caption}</text>
      {d.type === 'timer' || d.type === 'level-relay' || d.type === 'phase-monitor' ? <>
        <circle cx={w / 2} cy="65" r="15" fill="#f9faf8" stroke="#7e8d90" /><path d={`M${w / 2} 65 l7 -8`} stroke="#304c59" strokeWidth="3" />
        <text x={w / 2} y="93" textAnchor="middle" fill="#52656d" fontSize="8">{d.type === 'timer' ? '0—60 s' : d.type === 'phase-monitor' ? 'R · S · T' : 'MIN / MAX'}</text>
      </> : d.type === 'power-supply' ? <>
        {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M11 ${46 + i * 6} H${w - 11}`} stroke="#8d9a9c" strokeWidth="2" />)}
        <text x={w / 2} y="92" textAnchor="middle" fill={INK} fontSize="11" fontWeight="700">24 V DC</text>
      </> : d.type === 'meter' || d.type === 'voltmeter' || d.type === 'ammeter' || d.type === 'smart-relay' ? <>
        <rect x="9" y="46" width={w - 18} height="28" rx="2" fill="#d4dfd0" stroke="#728778" />
        <text x={w / 2} y="64" textAnchor="middle" fill="#344b3d" fontFamily="monospace" fontSize="11">{d.type === 'meter' ? '0000.0' : d.type === 'voltmeter' ? '--- V' : d.type === 'ammeter' ? '--- A' : 'RUN'}</text>
        <text x={w / 2} y="87" textAnchor="middle" fill={INK} fontSize="7">{d.type === 'meter' ? 'kWh' : d.type === 'voltmeter' ? 'AC VOLT' : d.type === 'ammeter' ? 'AC AMP' : 'I1 I2 I3 I4'}</text>
        <circle cx={w / 2} cy="97" r="4" fill="#547663" />
      </> : <>
        <rect x="10" y="47" width={w - 20} height="35" rx="3" fill={d.type === 'relay' ? '#91aebb' : '#43565e'} fillOpacity={d.type === 'relay' ? 0.6 : 1} stroke="#5f737a" />
        <rect x={w / 2 - 8} y="56" width="16" height="15" rx="2" fill="#283b45" />
        <text x={w / 2} y="97" textAnchor="middle" fill={INK} fontSize="8">{amp} · {d.voltage > 0 ? `${d.voltage} V` : '— V'}</text>
      </>}
    </>}
    <path d={`M6 ${h - 8} H${w - 6}`} stroke="#cbd1cc" />
  </g>;
}

export default memo(DeviceDrawing);
