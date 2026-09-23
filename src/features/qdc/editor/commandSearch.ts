export type EditorCommand = {
  id: string;
  label: string;
  group: string;
  description?: string;
  keywords?: string;
  shortcut?: string;
  featured?: boolean;
  disabled?: boolean;
  run: () => void;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function searchCommands(commands: EditorCommand[], query: string, limit = 12): EditorCommand[] {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return commands.filter(command => command.featured).slice(0, limit);
  return commands.map((command, index) => {
    const label = normalize(command.label);
    const terms = normalize(`${command.label} ${command.group} ${command.description ?? ''} ${command.keywords ?? ''}`);
    if (!words.every(word => terms.includes(word))) return null;
    const score = words.reduce((value, word) => value + (label.startsWith(word) ? 0 : label.split(/\s+/).some(part => part.startsWith(word)) ? 1 : 2), 0);
    return { command, score, index };
  }).filter((item): item is { command: EditorCommand; score: number; index: number } => item !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit).map(item => item.command);
}
