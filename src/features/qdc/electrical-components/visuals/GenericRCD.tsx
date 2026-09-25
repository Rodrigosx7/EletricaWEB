import { useId } from 'react';
import type { Device, DeviceVisualModel } from '../../types';

type RCDDevice = Pick<Device, 'amperage' | 'sensitivity' | 'voltage' | 'tag'>;

/** Generic IDR artwork inspired by DIN devices; no manufacturer marking. */
export default function GenericRCD({ device, poles, width, height, finish }: { device: RCDDevice; poles: 2 | 4; width: number; height: number; finish: DeviceVisualModel }) {
  const prefix = useId().replace(/:/g, '');
  const shell = `${prefix}-shell`, metal = `${prefix}-metal`, lever = `${prefix}-lever`;
  const w = 42 * poles;
  const dark = finish === 'graphite';
  const face = dark ? '#364248' : '#f0f2ef';
  const ink = dark ? '#f5f5f1' : '#253139';
  const muted = dark ? '#c1cacc' : '#526269';
  const poleLabels = poles === 2 ? ['L', 'N'] : ['L1', 'L2', 'L3', 'N'];
  return <svg x="0" y="0" width={width} height={height} viewBox={`0 0 ${w} 126`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={shell} x1="0" y1="0" x2="1" y2=".25"><stop stopColor={dark ? '#75828a' : '#ffffff'} /><stop offset=".3" stopColor={face} /><stop offset=".8" stopColor={dark ? '#26343a' : '#dce3df'} /><stop offset="1" stopColor={dark ? '#16242a' : '#b8c3bf'} /></linearGradient>
      <radialGradient id={metal} cx="35%" cy="28%"><stop stopColor="#f9fbf7" /><stop offset=".4" stopColor="#cbd4d2" /><stop offset=".78" stopColor="#788b91" /><stop offset="1" stopColor="#405258" /></radialGradient>
      <linearGradient id={lever} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d34e47" /><stop offset=".38" stopColor="#a51f27" /><stop offset="1" stopColor="#671b24" /></linearGradient>
    </defs>
    <path d={`M4 2H${w - 4}Q${w - 1} 2 ${w - 1} 5V121Q${w - 1} 125 ${w - 5} 125H4Q1 125 1 121V5Q1 2 4 2Z`} fill={`url(#${shell})`} stroke={dark ? '#142329' : '#a2b0ae'} strokeWidth="1.2" />
    <path d={`M4 5H${w - 4}M4 121H${w - 4}`} stroke={dark ? '#839397' : '#fff'} strokeOpacity=".75" />
    {Array.from({ length: poles }, (_, i) => { const x = 21 + i * 42; return <g key={i}>
      {i > 0 && <path d={`M${i * 42} 3V123`} stroke={dark ? '#18262b' : '#afbab8'} strokeWidth="1" />}
      <rect x={x - 16} y="3" width="32" height="24" rx="2" fill={i === poles - 1 ? dark ? '#2b5266' : '#d9e8ed' : dark ? '#3d4a50' : '#e1e7e3'} stroke={dark ? '#18272c' : '#aebcba'} strokeWidth=".7" />
      <rect x={x - 16} y="101" width="32" height="22" rx="2" fill={i === poles - 1 ? dark ? '#2b5266' : '#d9e8ed' : dark ? '#3d4a50' : '#e1e7e3'} stroke={dark ? '#18272c' : '#aebcba'} strokeWidth=".7" />
      {[15, 112].map(y => <g key={y}><circle cx={x} cy={y} r="8.2" fill={`url(#${metal})`} stroke="#65777c" strokeWidth=".7" /><path d={`M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`} stroke="#384a50" strokeWidth="1.8" strokeLinecap="round" /></g>)}
    </g>; })}
    <rect x="3" y="28" width={w - 6} height="72" fill={face} stroke={dark ? '#18262d' : '#b5c0bd'} strokeWidth=".8" />
    <path d={`M5 30H${w - 5}`} stroke={dark ? '#829297' : '#fff'} strokeWidth="1.6" />
    {poleLabels.map((label, i) => <g key={label}>
      <text x={21 + i * 42} y="35" textAnchor="middle" fill={i === poles - 1 ? dark ? '#b5e1f1' : '#226f97' : muted} fontSize="5" fontWeight="900">{label}</text>
      <text x={21 + i * 42} y="99" textAnchor="middle" fill={i === poles - 1 ? dark ? '#b5e1f1' : '#226f97' : muted} fontSize="5" fontWeight="900">{label}</text>
    </g>)}
    {Array.from({ length: poles - 1 }, (_, i) => <path key={i} d={`M${42 * (i + 1)} 37V73M${42 * (i + 1)} 99V101`} stroke={dark ? '#26383d' : '#c4cdca'} strokeWidth=".8" />)}
    <text x="8" y="44" fill={ink} fontSize="8" fontWeight="900">IDR</text>
    <text x={w - 8} y="44" textAnchor="end" fill={muted} fontSize="6" fontWeight="700">{poles}P</text>
    <path d={`M8 47H${w - 8}`} stroke="#bb3436" strokeWidth="2.5" />
    <text x="8" y="57" fill={ink} fontSize="8.5" fontWeight="800">{device.amperage == null ? '— A' : `${device.amperage} A`}</text>
    <text x="8" y="65" fill={muted} fontSize="6.6" fontWeight="700">{device.sensitivity > 0 ? `${device.sensitivity} mA` : 'ΔI a definir'}</text>
    <text x="8" y="72" fill={muted} fontSize="5.5">{device.voltage > 0 ? `${device.voltage} V~` : 'Tensão a definir'}</text>
    <rect x={w - 37} y="52" width="28" height="17" rx="2" fill="#a8202d" stroke="#711c25" strokeWidth=".8" />
    <path d={`M${w - 35} 54H${w - 11}`} stroke="#e77778" strokeWidth="1.4" />
    <text x={w - 23} y="64" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800">TEST</text>
    <rect x="8" y="76" width={w - 16} height="20" rx="3" fill={dark ? '#111d22' : '#bfcac7'} stroke={dark ? '#77898c' : '#87999b'} />
    <path d={`M12 79H${w - 12}L${w - 8} 97H8Z`} fill={`url(#${lever})`} stroke="#661b25" strokeWidth="1" />
    <path d={`M14 82H${w - 14}M11 94H${w - 11}`} stroke="#e76e70" strokeWidth="1.2" />
    {Array.from({ length: poles - 1 }, (_, i) => <path key={i} d={`M${42 * (i + 1)} 80V94`} stroke="#781c24" strokeOpacity=".6" />)}
    <text x={w / 2} y="91" textAnchor="middle" fill="#fff2f0" fontSize="8" fontWeight="800">I / O</text>
  </svg>;
}
