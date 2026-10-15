'use client';

import { FilePlus2, Sparkles } from 'lucide-react';

interface HeaderProps {
  onAddFiles: () => void;
  status: string;
}

export function Header({ onAddFiles, status }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark"><Sparkles size={14} /></div>
        <div><strong>Brief AI</strong><span>Esko</span></div>
      </div>
      <div className="header-meta">
        <span className="status-line"><i className={status !== 'idle' ? 'status-dot active' : 'status-dot'} />{status === 'idle' ? 'Workspace ready' : status}</span>
        <button className="ghost-button" onClick={onAddFiles}><FilePlus2 size={15} /> Add files</button>
      </div>
    </header>
  );
}