import type { Project } from '../types.ts';

export type HistoryEntry = { project: Project; label: string };
export type EditorHistory = { past: HistoryEntry[]; present: HistoryEntry; future: HistoryEntry[] };
export type HistoryAction = { type: 'commit'; project: Project; label: string } | { type: 'reset'; project: Project } | { type: 'undo' | 'redo' };
export function initialHistory(project: Project): EditorHistory {
  return { past: [], present: { project, label: 'Projeto aberto' }, future: [] };
}
export function historyReducer(state: EditorHistory, action: HistoryAction): EditorHistory {
  if (action.type === 'reset') return initialHistory(action.project);
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    return previous ? { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] } : state;
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    return next ? { past: [...state.past, state.present], present: next, future: state.future.slice(1) } : state;
  }
  if (action.type !== 'commit' || JSON.stringify(state.present.project) === JSON.stringify(action.project)) return state;
  return { past: [...state.past.slice(-79), state.present], present: { project: { ...action.project, updatedAt: new Date().toISOString() }, label: action.label }, future: [] };
}
