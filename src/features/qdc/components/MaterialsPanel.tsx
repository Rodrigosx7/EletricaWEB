import { Plus, Trash2, Download } from 'lucide-react';
import { materialList } from '../circuits/analysis';
import type { Project, Material } from '../types';
export default function MaterialsPanel({ project, onChange, onExport }: { project: Project; onChange(items: Material[]): void; onExport(): void }) {
  const generated = materialList({ ...project, materials: [] });
  const update = (id: string, patch: Partial<Material>) => onChange(project.materials.map(m => m.id === id ? { ...m, ...patch } : m));
  return <section className="ewq-bottom-panel" aria-label="Lista de materiais">
    <header><div><h3>Lista de materiais</h3><p>Dispositivos do desenho + itens complementares editáveis. Metragem de cabos a levantar em campo.</p></div><button className="ewq-button" onClick={onExport}><Download size={15} /> CSV</button></header>
    <div className="ewq-table-wrap"><table><thead><tr><th>Material</th><th>Especificação</th><th>Quantidade</th><th>Unidade</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
      {generated.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.specification}</td><td>{m.quantity}</td><td>{m.unit}</td><td><small>Do desenho</small></td></tr>)}
      {project.materials.map(m => <tr key={m.id}><td><input aria-label="Nome do material" value={m.name} onChange={e => update(m.id, { name: e.target.value })} /></td><td><input aria-label="Especificação do material" value={m.specification} onChange={e => update(m.id, { specification: e.target.value })} /></td><td><input aria-label="Quantidade do material" type="number" min={0} step="any" value={m.quantity} onChange={e => update(m.id, { quantity: Math.max(0, Number(e.target.value)) })} /></td><td><select aria-label="Unidade do material" value={m.unit} onChange={e => update(m.id, { unit: e.target.value })}><option>un</option><option>m</option><option>kit</option></select></td><td><button aria-label="Excluir material complementar" className="ewq-icon" onClick={() => onChange(project.materials.filter(i => i.id !== m.id))}><Trash2 size={15} /></button></td></tr>)}
    </tbody></table></div>
    <button className="ewq-button" onClick={() => onChange([...project.materials, { id: crypto.randomUUID(), name: 'Material complementar', specification: '', quantity: 1, unit: 'un' }])}><Plus size={15} /> Adicionar material</button>
  </section>;
}
