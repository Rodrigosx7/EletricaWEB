type Props = { width: number; height: number; reserveTerminalArea?: boolean };

/** Compact, manufacturer-neutral meter box. Board terminals and wires are drawn separately. */
export default function ServiceEntranceArtwork({ width: w, height: h, reserveTerminalArea = false }: Props) {
  // In the board, terminal screws occupy the lower half of this 48px edge device.
  const availableBottom = reserveTerminalArea ? h - 24 : h - 4;
  const cabinetWidth = Math.min(30, w * .46);
  const cabinetHeight = Math.min(34, availableBottom - 6);
  const cabinetX = (w - cabinetWidth) / 2 + 4;
  const cabinetY = reserveTerminalArea ? 4 : Math.max(6, (h - cabinetHeight) / 2);
  const mastX = cabinetX - 8;
  const meterX = cabinetX + cabinetWidth / 2;
  const meterY = cabinetY + cabinetHeight * .43;
  const meterRadius = Math.min(6.5, cabinetHeight * .25);

  return <g aria-hidden="true">
    <rect x="2" y="2" width={w - 4} height={h - 4} rx="5" fill="#f2f6f5" stroke="#8da0a4" />

    <path d={`M${mastX} ${cabinetY + cabinetHeight - 1} V${cabinetY + 2} H${mastX + 5}`} fill="none" stroke="#52666d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d={`M${mastX - 3} ${cabinetY + 3} H${mastX + 5}`} stroke="#52666d" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx={mastX + 5} cy={cabinetY + 2} r="1.7" fill="#f9fbf9" stroke="#73878c" strokeWidth=".8" />
    <path d={`M${mastX + 6} ${cabinetY + 2} Q${cabinetX} ${cabinetY - 1} ${cabinetX + 5} ${cabinetY + 1}`} fill="none" stroke="#344a53" strokeWidth="1.4" strokeLinecap="round" />

    <rect x={cabinetX + 1} y={cabinetY + 1} width={cabinetWidth} height={cabinetHeight} rx="2.5" fill="#324951" opacity=".13" />
    <rect x={cabinetX} y={cabinetY} width={cabinetWidth} height={cabinetHeight} rx="2.5" fill="#f9fbf9" stroke="#6f858c" strokeWidth="1.2" />
    <rect x={cabinetX + 2.5} y={cabinetY + 2.5} width={cabinetWidth - 5} height={cabinetHeight * .66} rx="1.5" fill="#dce7e8" stroke="#a2b3b7" strokeWidth=".6" />
    <circle cx={meterX} cy={meterY} r={meterRadius} fill="#f8faf8" stroke="#627a82" strokeWidth="1" />
    <path d={`M${meterX - meterRadius * .48} ${meterY + meterRadius * .2} H${meterX + meterRadius * .48}`} stroke="#516d76" strokeWidth="1.1" strokeLinecap="round" />
    <path d={`M${cabinetX + 3} ${cabinetY + cabinetHeight * .78} H${cabinetX + cabinetWidth - 3}`} stroke="#aabbbd" strokeWidth=".8" />
    <circle cx={cabinetX + cabinetWidth - 4.5} cy={cabinetY + cabinetHeight * .88} r="1" fill="#b66853" />
  </g>;
}
