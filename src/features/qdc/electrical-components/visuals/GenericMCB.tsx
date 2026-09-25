import { useId } from 'react';
import type { Device, DeviceVisualModel } from '../../types';

type MCBDevice = Pick<Device, 'amperage' | 'curve' | 'breakingCapacityKa' | 'voltage' | 'tag'>;

/** Manufacturer-neutral DIN artwork. The board canvas owns the terminal hit targets. */
export default function GenericMCB({ device, poles, width, height, finish }: { device: MCBDevice; poles: 1 | 2 | 3; width: number; height: number; finish: DeviceVisualModel }) {
  const prefix = useId().replace(/:/g, '');
  const shell = `${prefix}-shell`, metal = `${prefix}-metal`, lever = `${prefix}-lever`;
  const w = 42 * poles;
  const dark = finish === 'graphite';
  const front = dark ? '#343e43' : '#f4f5f2';
  const ink = dark ? '#f3f6f4' : '#1d2b30';
  const subdued = dark ? '#b7c3c4' : '#5b6b70';
  const accent = finish === 'two-tone' ? '#2481a7' : dark ? '#e29242' : '#24765d';
  const current = device.amperage == null ? `${device.curve}—` : `${device.curve}${device.amperage}`;
  const capacity = device.breakingCapacityKa == null ? '— kA' : `${device.breakingCapacityKa} kA`;
  const voltage = device.voltage > 0 ? `${device.voltage} V~` : '— V~';
  const screw = (x: number, y: number) => <g key={`${x}-${y}`}>
    <circle cx={x} cy={y} r="7.7" fill={`url(#${metal})`} stroke="#68777b" strokeWidth=".7" />
    <circle cx={x} cy={y} r="5.6" fill="none" stroke="#eef0ec" strokeOpacity=".8" strokeWidth=".6" />
    <path d={`M${x - 3.6} ${y - 3.6}L${x + 3.6} ${y + 3.6}M${x + 3.6} ${y - 3.6}L${x - 3.6} ${y + 3.6}`} stroke="#3e4a4d" strokeWidth="1.8" strokeLinecap="round" />
  </g>;
  return <svg x="0" y="0" width={width} height={height} viewBox={`0 0 ${w} 126`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={shell} x1="0" y1="0" x2="1" y2=".3"><stop stopColor={dark ? '#718087' : '#fff'} /><stop offset=".22" stopColor={front} /><stop offset=".77" stopColor={dark ? '#273136' : '#e1e6e2'} /><stop offset="1" stopColor={dark ? '#111b20' : '#aebbb8'} /></linearGradient>
      <radialGradient id={metal} cx="35%" cy="27%"><stop stopColor="#fffef4" /><stop offset=".36" stopColor="#d8dedb" /><stop offset=".72" stopColor="#87969a" /><stop offset="1" stopColor="#4b595e" /></radialGradient>
      <linearGradient id={lever} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#526069" /><stop offset=".26" stopColor="#172027" /><stop offset=".65" stopColor="#10171d" /><stop offset="1" stopColor="#434c50" /></linearGradient>
    </defs>
    <rect x="2.5" y="3" width={w - 3} height="122" rx="4" fill="#202f34" opacity=".18" />
    <path d={`M4 1H${w - 4}Q${w - 1} 1 ${w - 1} 5V121Q${w - 1} 125 ${w - 5} 125H4Q1 125 1 121V5Q1 1 4 1Z`} fill={`url(#${shell})`} stroke={dark ? '#142026' : '#99a7a8'} strokeWidth="1.1" />
    <path d={`M4 4H${w - 4}M3 121H${w - 3}`} stroke={dark ? '#859195' : '#fff'} strokeOpacity=".8" />
    {Array.from({ length: poles - 1 }, (_, i) => <path key={i} d={`M${42 * (i + 1)} 3V123`} stroke={dark ? '#16242b' : '#aeb8b9'} strokeWidth="1.2" />)}
    {Array.from({ length: poles }, (_, i) => {
      const x = 21 + i * 42;
      return <g key={x}>
        <rect x={x - 15.5} y="3" width="31" height="25" rx="2.5" fill={dark ? '#313e43' : '#e8ebe8'} stroke={dark ? '#111c22' : '#b1bdbb'} strokeWidth=".65" />
        <rect x={x - 15.5} y="100" width="31" height="23" rx="2.5" fill={dark ? '#313e43' : '#e8ebe8'} stroke={dark ? '#111c22' : '#b1bdbb'} strokeWidth=".65" />
        {screw(x, 15)}{screw(x, 112)}
      </g>;
    })}
    <path d={`M3 30H${w - 3}V99H3Z`} fill={front} stroke={dark ? '#101b20' : '#aeb9b8'} strokeWidth=".9" />
    <path d={`M4 31H${w - 4}`} stroke={dark ? '#88969a' : '#fff'} strokeWidth="1.8" />
    <text x="7" y="39" fill={ink} fontSize="6.6" fontWeight="800">MCB</text>
    {poles === 1 && <text x={w - 5} y="39" textAnchor="end" fill={subdued} fontSize="5.2" fontWeight="800">1P</text>}
    <path d="M7 42H38" stroke={accent} strokeWidth="3" />
    {device.tag?.trim() ? <g><rect x="7" y="45.5" width="31" height="7" rx="1" fill={dark ? '#18262d' : '#fff'} stroke={accent} strokeWidth=".65" /><text x="22.5" y="50.5" textAnchor="middle" fill={ink} fontSize="5" fontWeight="700">{device.tag.slice(0, 8)}</text></g> : <rect x="7" y="47" width="11" height="3.4" rx="1.5" fill="#4ba371" stroke="#28754f" strokeWidth=".5" />}
    <text x="7" y="62" fill={ink} fontSize={poles === 1 ? 11.5 : 12.2} fontWeight="800">{current}</text>
    <text x="7" y="70.5" fill={ink} fontSize="6.2" fontWeight="700">{capacity}</text>
    <text x="7" y="78" fill={subdued} fontSize="5.5">{voltage}</text>
    <rect x="7" y="81" width="15" height="6.5" rx="1" fill="none" stroke={subdued} strokeWidth=".6" />
    <text x="14.5" y="86" textAnchor="middle" fill={ink} fontSize="5.5" fontWeight="700">{poles}P</text>
    {poles > 1 && <g>
      {Array.from({ length: poles }, (_, i) => {
        const x = poles === 2 ? 48 + i * 19 : 51 + i * 25;
        return <g key={i}>
          <text x={x} y="39" textAnchor="middle" fill={subdued} fontSize="5.3">{2 * i + 1}</text>
          <path d={`M${x} 42V51L${x + 6} 61L${x} 71V77`} fill="none" stroke={ink} strokeWidth="1" />
          <text x={x} y="82" textAnchor="middle" fill={subdued} fontSize="5.3">{2 * i + 2}</text>
        </g>;
      })}
      <path d={`M${poles === 2 ? 54 : 57} 54H${poles === 2 ? 73 : 107}`} stroke={ink} strokeWidth=".7" strokeDasharray="2 2" />
    </g>}
    <rect x="5" y="87.5" width={w - 10} height="19" rx="2" fill={dark ? '#10191e' : '#cbd2d0'} stroke={dark ? '#839094' : '#9ba8a9'} strokeWidth=".8" />
    {Array.from({ length: poles }, (_, i) => <g key={i}><rect x={7 + i * 42} y="90" width="28" height="14" rx="1.4" fill={`url(#${lever})`} /><path d={`M${9 + i * 42} 92H${33 + i * 42}M${9 + i * 42} 102H${33 + i * 42}`} stroke="#7b8b90" strokeWidth=".65" /></g>)}
    {poles > 1 && <><path d={`M4 99Q${w / 2} 92 ${w - 4} 99V107Q${w / 2} 103 4 107Z`} fill={`url(#${lever})`} stroke="#17242a" strokeWidth=".8" /><path d={`M${w / 2 - 13} 100H${w / 2 + 13}M${w / 2 - 13} 102H${w / 2 + 13}M${w / 2 - 13} 104H${w / 2 + 13}`} stroke="#889398" strokeOpacity=".45" strokeWidth=".6" /></>}
  </svg>;
}
