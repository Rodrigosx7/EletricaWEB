import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { searchCommands, type EditorCommand } from './commandSearch';

export default function CommandPalette({ commands, onClose }: { commands: EditorCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = useMemo(() => searchCommands(commands, query), [commands, query]);
  const enabled = matches.filter(command => !command.disabled);
  const activeCommand = enabled[Math.min(active, enabled.length - 1)];

  useEffect(() => { document.getElementById(`${listId}-${activeCommand?.id}`)?.scrollIntoView({ block: 'nearest' }); }, [activeCommand?.id, listId]);

  function execute(command: EditorCommand) {
    if (command.disabled) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (enabled.length) setActive(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length);
    } else if (event.key === 'Enter' && activeCommand) {
      event.preventDefault();
      execute(activeCommand);
    }
  }

  return <Modal title="Buscar no montador" description="Encontre ações e componentes sem sair da montagem." onClose={onClose} initialFocusRef={input}>
    <div className="ewq-command-palette">
      <label className="ewq-command-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Buscar ação ou componente</span><input ref={input} type="search" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeCommand ? `${listId}-${activeCommand.id}` : undefined} placeholder="Buscar ação ou componente…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} /></label>
      <div className="ewq-command-list" id={listId} role="listbox" aria-label="Resultados da busca">
        {matches.length ? matches.map(command => <button key={command.id} id={`${listId}-${command.id}`} role="option" aria-selected={activeCommand?.id === command.id} className="ewq-command-option" disabled={command.disabled} onMouseEnter={() => { const position = enabled.findIndex(item => item.id === command.id); if (position >= 0) setActive(position); }} onClick={() => execute(command)}><span className="ewq-command-main"><small>{command.group}</small><strong>{command.label}</strong>{command.description && <span>{command.description}</span>}</span>{command.shortcut ? <kbd>{command.shortcut}</kbd> : <ArrowRight size={16} aria-hidden="true" />}</button>) : <p className="ewq-command-empty">Nenhum resultado. Tente o nome de uma ferramenta ou componente.</p>}
      </div>
      <p className="ewq-command-hint">↑ ↓ para navegar · Enter para executar · Esc para fechar</p>
    </div>
  </Modal>;
}
