import type { Device, ViewMode } from '../types';

export type ConduitConductor = { id: string; color: string; kind: 'L' | 'N' | 'PE' | 'control'; circuit: string };

/** Visual only: conductor tips meet the editor's terminal points at the conduit mouth. */
export default function ConduitEntry({ device, width, height, mode, conductors, activeTerminalId }: { device: Device; width: number; height: number; mode: ViewMode; conductors: ConduitConductor[]; activeTerminalId?: string }) {
  const supply = device.type === 'power-entry';
  const side = device.edgeSide ?? 'bottom';
  const horizontal = side === 'bottom' || side === 'top';
  const w = horizontal ? width : height, h = horizontal ? height : width;
  // The artwork is rotated on these edges, reversing the visual terminal order.
  const visualConductors = side === 'top' || side === 'right' ? [...conductors].reverse() : conductors;
  const count = Math.max(1, conductors.length);
  const mouthWidth = Math.min(w - 8, Math.max(40, Math.min(74, count * 7 + 20)));
  const shaftWidth = mouthWidth - 5;
  const gray = mode === 'schematic';
  const names = [...new Set(conductors.map(item => item.circuit.trim()).filter(Boolean))];
  const label = supply ? 'ENTRADA' : names.length ? names.join(' · ') : device.label;
  const labelWidth = Math.min(w - 6, Math.max(34, label.length * 4.2 + 10));
  const maxLabelLength = Math.max(4, Math.floor((labelWidth - 7) / 4.1));
  const visibleLabel = label.length > maxLabelLength ? `${label.slice(0, maxLabelLength - 1)}…` : label;
  const shaftLeft = (w - shaftWidth) / 2;
  const body = <g>
    <title>{supply ? 'Entrada de energia da rede' : names.length ? names.join(' · ') : device.label}</title>
    <rect x={shaftLeft} y="18" width={shaftWidth} height={h - 10} rx="4" fill={gray ? '#f8fafb' : '#f3be22'} stroke={gray ? '#72868c' : '#9b7116'} strokeWidth="1.2" />
    {!gray && <>
      <path d={`M${shaftLeft + 3} 24 V${h + 5}`} stroke="#ffe679" strokeWidth="3" opacity=".85" />
      {Array.from({ length: Math.ceil((h - 13) / 6) }, (_, index) => {
        const y = 24 + index * 6;
        return <g key={y}><path d={`M${shaftLeft + 1} ${y} Q${w / 2} ${y + 3} ${shaftLeft + shaftWidth - 1} ${y}`} fill="none" stroke="#a77a15" strokeWidth="2.3" opacity=".8" /><path d={`M${shaftLeft + 2} ${y - 1.5} Q${w / 2} ${y + 1} ${shaftLeft + shaftWidth - 2} ${y - 1.5}`} fill="none" stroke="#ffe477" strokeWidth="1.2" /></g>;
      })}
    </>}
    {supply && <g>
      <rect x={shaftLeft + 4} y="27" width={shaftWidth - 8} height="8" rx="2" fill={gray ? '#6a7c83' : '#173c55'} stroke={gray ? '#52646b' : '#b48c21'} strokeWidth=".7" />
      <path d={`M${w / 2 + 1} 28 L${w / 2 - 2} 31 H${w / 2} L${w / 2 - 1} 34 L${w / 2 + 3} 30 H${w / 2 + 1}Z`} fill={gray ? '#f7faf8' : '#ffd752'} />
    </g>}
    <ellipse cx={w / 2} cy="20" rx={mouthWidth / 2} ry="7" fill={gray ? '#f8fafb' : '#ffd64b'} stroke={gray ? '#61767e' : '#946c14'} strokeWidth="1.5" />
    <ellipse cx={w / 2} cy="20" rx={mouthWidth / 2 - 4} ry="4.3" fill={gray ? '#fff' : '#4c4324'} stroke={gray ? '#718489' : '#bb8a1b'} strokeWidth=".8" />
    {visualConductors.map((item, index) => {
      const tipX = w * (index + .5) / count;
      const mouthX = w / 2 + (index - (count - 1) / 2) * Math.min(5.5, (mouthWidth - 15) / count);
      const stroke = gray ? '#445962' : item.color;
      const path = `M${mouthX} 20 C${mouthX} 8 ${tipX} 18 ${tipX} 0`;
      return <g key={item.id} opacity={activeTerminalId && activeTerminalId !== item.id ? .42 : 1}>
        <path d={path} fill="none" stroke="#f8fbfa" strokeWidth="5.1" strokeLinecap="round" />
        <path d={path} fill="none" stroke={stroke} strokeWidth={activeTerminalId === item.id ? 4.5 : 3.2} strokeLinecap="round" />
        {item.kind === 'PE' && !gray && <path d={path} fill="none" stroke="#efdb43" strokeWidth="1" strokeDasharray="4 4" strokeLinecap="round" />}
      </g>;
    })}
    <g transform={supply && side === 'top' ? `rotate(180 ${w / 2} ${h - 7.5})` : undefined}>
      <rect x={(w - labelWidth) / 2} y={h - 13} width={labelWidth} height="11" rx="2.5" fill={supply && !gray ? '#173c55' : gray ? '#f7faf8' : '#fff9df'} stroke={supply && !gray ? '#d7ab28' : gray ? '#a1b0b1' : '#a58022'} />
      <text x={w / 2} y={h - 5} textAnchor="middle" fill={supply && !gray ? '#fff5d2' : '#314751'} fontSize="7" fontWeight="800">{visibleLabel}</text>
    </g>
  </g>;
  if (horizontal && side === 'top') return <g transform={`rotate(180 ${w / 2} ${h / 2})`}>{body}</g>;
  if (horizontal) return body;
  return <g transform={side === 'left' ? `translate(${width} 0) rotate(90)` : `translate(0 ${height}) rotate(-90)`}>{body}</g>;
}
