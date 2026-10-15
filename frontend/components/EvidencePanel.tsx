'use client';

import { Copy, FileText, X } from 'lucide-react';
import type { Fact, SourceElement } from '@/lib/types';

function refFor(element: SourceElement) {
  if (element.source_type === 'pdf' && element.page) return `${element.source_file} · page ${element.page}`;
  if (element.source_type === 'xlsx' && element.sheet && element.row) return `${element.source_file} · ${element.sheet} · row ${element.row}`;
  return element.source_file;
}

function highlight(content: string, value: string) {
  const snippet = content.slice(0, 560);
  const index = snippet.toLowerCase().indexOf(value.toLowerCase().slice(0, 40));
  if (index < 0) return <span>{snippet}{content.length > 560 ? '…' : ''}</span>;
  const start = Math.max(0, index - 80);
  const end = Math.min(snippet.length, index + Math.max(value.length, 24));
  return <><span className="context-text">{snippet.slice(start, index)}</span><mark>{snippet.slice(index, end)}</mark><span className="context-text">{snippet.slice(end, Math.min(snippet.length, end + 220))}</span></>;
}

export function EvidencePanel({ selectedFact, elements, onClose }: { selectedFact: Fact | null; elements: SourceElement[]; onClose: () => void }) {
  const sources = selectedFact ? selectedFact.sources.map((id) => elements.find((element) => element.id === id)).filter(Boolean) as SourceElement[] : [];
  return (
    <aside className={`evidence-panel ${selectedFact ? 'open' : ''}`}>
      <div className="evidence-header"><div><span className="eyebrow">Evidence</span><strong>{selectedFact ? selectedFact.name : 'Source inspection'}</strong></div>{selectedFact && <button className="icon-button" onClick={onClose} aria-label="Close evidence"><X size={16} /></button>}</div>
      {!selectedFact ? <div className="empty-evidence"><FileText size={20} /><p>Select a citation in the brief to inspect the exact supporting source.</p></div> : <div className="evidence-scroll"><div className="fact-callout"><span className="eyebrow">Extracted value</span><strong>{selectedFact.value}</strong>{selectedFact.reasoning && <p>{selectedFact.reasoning}</p>}</div><div className="source-evidence">{sources.map((element) => <article key={element.id}><div className="source-meta"><span><FileText size={13} /> {refFor(element)}</span><button onClick={() => navigator.clipboard?.writeText(refFor(element))}><Copy size={12} /> Copy citation</button></div><p>{highlight(element.content, selectedFact.value)}</p></article>)}</div></div>}
    </aside>
  );
}