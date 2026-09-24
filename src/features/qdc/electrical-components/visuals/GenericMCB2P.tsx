import { useId } from 'react';
import type { Device, DeviceVisualModel } from '../../types';

/** Front-facing, editable vector artwork. The canvas owns the actual terminal hit targets. */
export default function GenericMCB2P({ device, width, height, finish }: { device: Pick<Device, 'amperage' | 'curve' | 'breakingCapacityKa' | 'voltage' | 'tag'>; width: number; height: number; finish: DeviceVisualModel }) {
  const prefix = useId().replace(/:/g, '');
  const shell = `${prefix}-shell`, metal = `${prefix}-metal`, lever = `${prefix}-lever`;
  const dark = finish === 'graphite';
  const front = dark ? '#343e43' : '#f4f5f2';
  const ink = dark ? '#f3f6f4' : '#1d2b30';
  const subdued = dark ? '#b7c3c4' : '#5b6b70';
  const accent = finish === 'two-tone' ? '#2481a7' : dark ? '#e29242' : '#24765d';
  const current = device.amperage == null ? 'C—' : `${device.curve}${device.amperage}`;
  const capacity = device.breakingCapacityKa == null ? '— kA' : `${device.breakingCapacityKa} kA`;
  const voltage = device.voltage > 0 ? `${device.voltage} V~` : '— V~';
  const screw = (x: number, y: number) => <g key={`${x}-${y}`}>
    <circle cx={x} cy={y} r="7.7" fill={`url(#${metal})`} stroke="#68777b" strokeWidth=".7" />
    <circle cx={x} cy={y} r="5.6" fill="none" stroke="#eef0ec" strokeOpacity=".8" strokeWidth=".6" />
    <path d={`M${x - 3.6} ${y - 3.6}L${x + 3.6} ${y + 3.6}M${x + 3.6} ${y - 3.6}L${x - 3.6} ${y + 3.6}`} stroke="#3e4a4d" strokeWidth="1.8" strokeLinecap="round" />
  </g>;
  return <svg x="0" y="0" width={width} height={height} viewBox="0 0 84 126" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={shell} x1="0" y1="0" x2="1" y2=".3"><stop stopColor={dark ? '#718087' : '#fff'} /><stop offset=".22" stopColor={front} /><stop offset=".77" stopColor={dark ? '#273136' : '#e1e6e2'} /><stop offset="1" stopColor={dark ? '#111b20' : '#aebbb8'} /></linearGradient>
      <radialGradient id={metal} cx="35%" cy="27%"><stop stopColor="#fffef4" /><stop offset=".36" stopColor="#d8dedb" /><stop offset=".72" stopColor="#87969a" /><stop offset="1" stopColor="#4b595e" /></radialGradient>
      <linearGradient id={lever} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#526069" /><stop offset=".26" stopColor="#172027" /><stop offset=".65" stopColor="#10171d" /><stop offset="1" stopColor="#434c50" /></linearGradient>
    </defs>
    <rect x="2.5" y="3" width="81" height="122" rx="4" fill="#202f34" opacity=".18" />
    <path d="M4 1H80Q83 1 83 5V121Q83 125 79 125H4Q1 125 1 121V5Q1 1 4 1Z" fill={`url(#${shell})`} stroke={dark ? '#142026' : '#99a7a8'} strokeWidth="1.1" />
    <path d="M4 4H80M3 121H81" stroke={dark ? '#859195' : '#fff'} strokeOpacity=".8" />
    <path d="M42 3V123" stroke={dark ? '#16242b' : '#aeb8b9'} strokeWidth="1.2" />
    {[21, 63].map(x => <g key={x}>
      <rect x={x - 15.5} y="3" width="31" height="25" rx="2.5" fill={dark ? '#313e43' : '#e8ebe8'} stroke={dark ? '#111c22' : '#b1bdbb'} strokeWidth=".65" />
      <rect x={x - 15.5} y="100" width="31" height="23" rx="2.5" fill={dark ? '#313e43' : '#e8ebe8'} stroke={dark ? '#111c22' : '#b1bdbb'} strokeWidth=".65" />
      {screw(x, 15)}{screw(x, 112)}
    </g>)}
    <path d="M3 30H81V99H3Z" fill={front} stroke={dark ? '#101b20' : '#aeb9b8'} strokeWidth=".9" />
    <path d="M4 31H80" stroke={dark ? '#88969a' : '#fff'} strokeWidth="1.8" />
    <text x="7" y="39" fill={ink} fontSize="6.6" fontWeight="800">MCB</text>
    <path d="M7 42H38" stroke={accent} strokeWidth="3" />
    <rect x="7" y="47" width="11" height="3.4" rx="1.5" fill="#4ba371" stroke="#28754f" strokeWidth=".5" />
    <text x="7" y="62" fill={ink} fontSize="12.2" fontWeight="800">{current}</text>
    <text x="7" y="70.5" fill={ink} fontSize="6.2" fontWeight="700">{capacity}</text>
    <text x="7" y="78" fill={subdued} fontSize="5.5">{voltage}</text>
    <rect x="7" y="81" width="13" height="6.5" rx="1" fill="none" stroke={subdued} strokeWidth=".6" />
    <text x="13.5" y="86" textAnchor="middle" fill={ink} fontSize="5.5" fontWeight="700">2P</text>
    <text x="44" y="39" fill={subdued} fontSize="5.3">1    3</text>
    <path d="M48 42V51L54 61M67 42V51L73 61M48 71V77M67 71V77M54 61L48 71M73 61L67 71M54 54H73" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="none" />
    <path d="M55 53H72" stroke={ink} strokeWidth=".6" strokeDasharray="2 2" />
    <text x="44" y="76" fill={subdued} fontSize="5.3">2    4</text>
    <rect x="5" y="87.5" width="74" height="19" rx="2" fill={dark ? '#10191e' : '#cbd2d0'} stroke={dark ? '#839094' : '#9ba8a9'} strokeWidth=".8" />
    {[10, 43].map(x => <g key={x}><rect x={x} y="90" width="31" height="14" rx="1.4" fill={`url(#${lever})`} /><path d={`M${x + 2} 92H${x + 29}M${x + 2} 102H${x + 29}`} stroke="#7b8b90" strokeWidth=".65" /></g>)}
    <path d="M4 99Q42 92 80 99V107Q42 103 4 107Z" fill={`url(#${lever})`} stroke="#17242a" strokeWidth=".8" />
    <path d="M29 100H55M29 102H55M29 104H55" stroke="#889398" strokeOpacity=".45" strokeWidth=".6" />
    {!!device.tag?.trim() && <g><rect x="46" y="78.5" width="34" height="8" rx="1.5" fill={dark ? '#18262d' : '#fff'} stroke={accent} strokeWidth=".65" /><text x="63" y="84.3" textAnchor="middle" fill={ink} fontSize="5.8" fontWeight="700">{device.tag.slice(0, 9)}</text></g>}
  </svg>;
}
