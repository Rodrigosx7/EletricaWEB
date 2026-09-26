import { FISHBONE_ROW, FISHBONE_SPINE_X, FISHBONE_TOP, fishboneSlotsFor } from './model';
import type { Project, ViewMode } from '../types';

const PHASE_COLORS = { R: '#9a5b39', S: '#bb7950', T: '#d49b67' } as const;

export default function FishboneArtwork({ project, mode, highlightSlotId, highlightValid }: { project: Project; mode: ViewMode; highlightSlotId?: string | null; highlightValid?: boolean }) {
  if (!project.fishbone) return null;
  const slots = project.fishbone.slots;
  const rows = slots.length / 2;
  const occupied = new Set(project.devices.flatMap(device => fishboneSlotsFor(project, device).map(slot => slot.id)));
  const phases = project.supply === 'tri' ? ['R', 'S', 'T'] as const : project.supply === 'bi' ? ['R', 'S'] as const : ['R'] as const;
  const technical = mode === 'schematic' || mode === 'labels';
  const top = FISHBONE_TOP - 12, bottom = FISHBONE_TOP + rows * FISHBONE_ROW - 5;
  const barX = (phase: string) => FISHBONE_SPINE_X + (phases.indexOf(phase as never) - (phases.length - 1) / 2) * 16;
  return <g className="qdc-fishbone-artwork" pointerEvents="none" aria-hidden="true">
    <text x="430" y="282" fill="#38505b" textAnchor="middle" fontSize="11" fontWeight="750" letterSpacing="1.3">BARRAMENTO ESPINHA · {slots.length} POSIÇÕES</text>
    <rect x="382" y={top - 9} width="96" height={bottom - top + 18} rx="8" fill={technical ? '#f4f7f8' : '#d9e0dc'} stroke="#9daaa9" />
    {phases.map(phase => <g key={phase}>
      <rect x={barX(phase) - 4} y={top} width="8" height={bottom - top} rx="2" fill={technical ? '#b6a190' : PHASE_COLORS[phase]} stroke="#765b49" strokeWidth=".8" />
      <text x={barX(phase)} y={top - 15} textAnchor="middle" fill="#526472" fontSize="9" fontWeight="700">{phase}</text>
    </g>)}
    {slots.map(slot => {
      const y = FISHBONE_TOP + slot.position * FISHBONE_ROW + 36;
      const innerX = slot.side === 'left' ? 382 : 478;
      const outerX = slot.side === 'left' ? 301 : 559;
      const selected = slot.id === highlightSlotId;
      const unavailable = !slot.enabled || occupied.has(slot.id);
      return <g key={slot.id} opacity={slot.enabled ? 1 : .35}>
        <path d={`M${barX(slot.phase)} ${y} H${innerX} H${outerX}`} fill="none" stroke={slot.enabled ? technical ? '#9b7b65' : PHASE_COLORS[slot.phase] : '#9ba5a8'} strokeWidth="6" strokeLinecap="round" />
        <circle cx={barX(slot.phase)} cy={y} r="5" fill={technical ? '#bdac9d' : PHASE_COLORS[slot.phase]} stroke="#6e625b" />
        <rect x={slot.side === 'left' ? 166 : 556} y={y - 35} width="138" height="71" rx="6" fill={selected ? highlightValid ? '#d8efe5' : '#f8deda' : unavailable ? 'transparent' : '#f1f5f2'} fillOpacity={selected ? .9 : .42} stroke={selected ? highlightValid ? '#3c9b70' : '#c85a50' : unavailable ? '#b6c0bf' : '#a6b9af'} strokeDasharray={unavailable && !selected ? '3 5' : undefined} strokeWidth={selected ? 2.5 : 1} />
        <text x={slot.side === 'left' ? 160 : 701} y={y + 3} textAnchor={slot.side === 'left' ? 'end' : 'start'} fill="#597077" fontSize="9" fontWeight="700">{slot.position + 1} · {slot.phase}</text>
      </g>;
    })}
    <rect x="390" y={top - 5} width="80" height={bottom - top + 10} rx="5" fill={technical ? '#ffffffc9' : '#e9eeebc9'} stroke="#a9b7b3" />
    <path d={`M396 ${top + 2} V${bottom - 2} M464 ${top + 2} V${bottom - 2}`} stroke="#fff" strokeOpacity=".8" strokeWidth="2" />
    <text x="430" y={bottom + 26} textAnchor="middle" fill="#697b7d" fontSize="9">Espinha isolada · encaixe = alimentação</text>
  </g>;
}
