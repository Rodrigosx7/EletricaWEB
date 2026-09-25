import { useId } from 'react';
import type { Device, DpsVisual } from '../../types';

/** Illustrative one-module surge protector; ratings follow the selected editor preset. */
export default function GenericSPD({ device, width, height, finish }: { device: Pick<Device, 'voltage' | 'surgeCurrent'>; width: number; height: number; finish: DpsVisual }) {
  const prefix = useId().replace(/:/g, '');
  const body = `${prefix}-body`, metal = `${prefix}-metal`, window = `${prefix}-window`;
  const red = finish === 'red';
  const face = red ? '#f0523d' : '#e7eae7';
  const faceDark = red ? '#c73529' : '#a8b2b1';
  const ink = red ? '#fff7ee' : '#254352';
  const screw = (y: number) => <g>
    <circle cx="20" cy={y} r="9.4" fill={red ? '#ba2d27' : '#c2ccca'} stroke={red ? '#9d2824' : '#849391'} strokeWidth=".8" />
    <circle cx="20" cy={y} r="7" fill={`url(#${metal})`} stroke="#586b72" strokeWidth=".7" />
    <path d={`M16 ${y - 4}L24 ${y + 4}M24 ${y - 4}L16 ${y + 4}`} stroke="#3c4e55" strokeWidth="2" strokeLinecap="round" />
  </g>;
  return <svg x="0" y="0" width={width} height={height} viewBox="0 0 40 126" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={body} x1="0" y1="0" x2="1" y2=".25"><stop stopColor={red ? '#fa8065' : '#fff'} /><stop offset=".17" stopColor={face} /><stop offset=".78" stopColor={red ? '#e94733' : '#d7deda'} /><stop offset="1" stopColor={faceDark} /></linearGradient>
      <radialGradient id={metal} cx="35%" cy="28%"><stop stopColor="#fbfcf7" /><stop offset=".35" stopColor="#d7e0dd" /><stop offset=".73" stopColor="#86999d" /><stop offset="1" stopColor="#46585e" /></radialGradient>
      <linearGradient id={window} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#142b19" /><stop offset=".48" stopColor="#3d7d31" /><stop offset="1" stopColor="#1b351b" /></linearGradient>
    </defs>
    <path d="M4 2H36Q39 2 39 6V120Q39 124 35 124H4Q1 124 1 120V6Q1 2 4 2Z" fill={`url(#${body})`} stroke={red ? '#ab3029' : '#879999'} strokeWidth="1.1" />
    <path d="M4 4H36M4 122H36" stroke={red ? '#ffab94' : '#fff'} strokeOpacity=".75" />
    <path d="M3 28H37M3 98H37" stroke={red ? '#b92e29' : '#aeb8b7'} strokeWidth=".7" />
    {screw(15)}{screw(111)}
    <rect x="4" y="32" width="32" height="62" rx="1.3" fill={red ? '#fff9f5' : '#f9fbf9'} stroke={red ? '#d85b48' : '#aab8b8'} strokeWidth=".7" />
    <rect x="4" y="32" width="32" height="12" fill={face} />
    <text x="20" y="40.4" textAnchor="middle" fill={ink} fontSize="6.6" fontWeight="900">DPS</text>
    <text x="20" y="53" textAnchor="middle" fill="#286485" fontSize="5.8" fontWeight="800">{device.voltage > 0 ? `${device.voltage} V` : '— V'}</text>
    <text x="20" y="63" textAnchor="middle" fill="#286485" fontSize="6.4" fontWeight="900">{device.surgeCurrent > 0 ? `${device.surgeCurrent} kA` : '— kA'}</text>
    <path d="M20 67l-5 8h4l-2 7 8-10h-4l2-5Z" fill="#edaa32" stroke="#c47e24" strokeWidth=".5" />
    <rect x="7" y="83" width="26" height="12" rx="1.2" fill={face} stroke={faceDark} strokeWidth=".8" />
    <rect x="9" y="85" width="22" height="8" rx=".8" fill={`url(#${window})`} stroke="#2b3b2b" strokeWidth=".5" />
    <path d="M11 86H28" stroke="#9cca72" strokeWidth=".6" strokeOpacity=".6" />
  </svg>;
}
