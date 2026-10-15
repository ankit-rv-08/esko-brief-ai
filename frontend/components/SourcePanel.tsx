import { AlertTriangle, FileImage, FileText, Sheet } from 'lucide-react';
import type { Conflict, Gap, SourceElement } from '@/lib/types';

function iconFor(type: SourceElement['source_type']) {
  return type === 'xlsx' ? Sheet : type === 'image' ? FileImage : FileText;
}

export function SourcePanel({ elements, gaps, conflicts }: { elements: SourceElement[]; gaps: Gap[]; conflicts: Conflict[] }) {
  const grouped = new Map<string, SourceElement[]>();
  elements.forEach((element) => grouped.set(element.source_file, [...(grouped.get(element.source_file) ?? []), element]));
  return (
    <aside className="source-panel">
      <section className="panel-section">
        <div className="section-heading"><span>Sources</span><b>{grouped.size}</b></div>
        {grouped.size === 0 ? <p className="muted">No sources uploaded yet.</p> : <ul className="source-list">{Array.from(grouped.entries()).map(([name, items]) => { const Icon = iconFor(items[0].source_type); return <li key={name}><Icon size={15} /><div><strong title={name}>{name}</strong><small>{items.length} {items.length === 1 ? 'element' : 'elements'}</small></div></li>; })}</ul>}
      </section>
      <section className="panel-section">
        <div className="section-heading"><span>Open gaps</span><b>{gaps.length}</b></div>
        {gaps.length === 0 ? <p className="muted">All required fields covered.</p> : <ul className="issue-list">{gaps.map((gap) => <li key={gap.field}><AlertTriangle size={13} /><div><strong>{gap.field}</strong><span>{gap.description}</span></div></li>)}</ul>}
      </section>
      <section className="panel-section">
        <div className="section-heading"><span>Conflicts</span><b>{conflicts.length}</b></div>
        {conflicts.length === 0 ? <p className="muted">No conflicts detected.</p> : <ul className="conflict-list">{conflicts.map((conflict) => <li key={conflict.name}><strong>{conflict.name}</strong>{conflict.facts.map((fact) => <span key={fact.id}>{fact.value}</span>)}</li>)}</ul>}
      </section>
    </aside>
  );
}