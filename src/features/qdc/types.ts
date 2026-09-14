export type Supply = 'mono' | 'bi' | 'tri';
export type ViewMode = 'realistic' | 'schematic' | 'installation' | 'labels';
export type Tool = 'select' | 'wire' | 'pan';
export type Conductor = 'phase' | 'neutral' | 'earth' | 'return';
export type Point = { x: number; y: number };
export type Terminal = { id: string; label: string; side: 'top' | 'bottom'; index: number; kind: 'L' | 'N' | 'PE' | 'control' };
export type Device = {
  id: string; type: string; label: string; rail: number; slot: number; modules: number;
  poles: number; amperage: number | null; curve: 'B' | 'C' | 'D'; gauge: number | null;
  sensitivity: number; voltage: number; surgeCurrent: number; description: string;
  circuitId: string | null; color: string; terminals: Terminal[];
};
export type Wire = {
  id: string; sourceComponent: string; sourceTerminal: string;
  targetComponent: string; targetTerminal: string;
  conductorType: Conductor; color: string; gauge: number | null; label: string; path: Point[];
};
export type Circuit = {
  id: string; number: number; name: string; phase: string; breakerId: string | null;
  cableGauge: number | null; load: number | null; loadUnit: 'W' | 'A'; voltage: number;
  powerFactor: number; drId: string | null; notes: string; color: string;
};
export type Material = { id: string; name: string; specification: string; quantity: number; unit: string };
export type Project = {
  version: 2; id: string; name: string; client: string; supply: Supply; voltage: number;
  rails: number; modulesPerRail: number; widthMm: number; heightMm: number;
  devices: Device[]; wires: Wire[]; circuits: Circuit[]; materials: Material[];
  createdAt: string; updatedAt: string;
};
export type CatalogItem = { type: string; name: string; category: string; modules: number; poles: number; description: string };
export type Selection = { devices: string[]; wire: string | null };
export type WireOptions = { conductorType: Conductor; color: string; gauge: number | null };
export type Warning = { id: string; message: string; deviceId?: string; wireId?: string };
export type Viewport = { x: number; y: number; zoom: number };
export const PRELIMINARY_NOTICE = 'Configuração visual preliminar. O dimensionamento, proteção, capacidade de condução, curto-circuito, DR, DPS, queda de tensão e demais critérios devem ser verificados por profissional habilitado conforme as normas aplicáveis.';
