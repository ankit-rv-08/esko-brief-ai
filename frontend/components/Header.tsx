'use client';

import { FilePlus2, Sparkles } from 'lucide-react';

interface HeaderProps {
  onAddFiles: () => void;
}

export function Header({ onAddFiles }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Sparkles size={14} />
        </div>
        <div>
          <strong>Brief AI</strong>
          <span>Esko</span>
        </div>
      </div>
      
      <div className="header-meta">
        <span className="status-line">
          <i className="status-dot active" />
          Ready when you are
        </span>
        <button onClick={onAddFiles} className="ghost-button">
          <FilePlus2 size={14} />
          Add files
        </button>
      </div>
    </header>
  );
}
