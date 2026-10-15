'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

export function UploadZone({ onFiles, disabled = false }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = '.pdf,.xlsx,.docx,.png,.jpg,.jpeg';
  const pick = (files: FileList | null) => { if (files?.length) onFiles(Array.from(files)); };

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) pick(event.dataTransfer.files); }}
    >
      <UploadCloud size={21} />
      <strong>Drop sources here</strong>
      <span>or click to browse</span>
      <small>PDF · XLSX · DOCX · PNG · JPG</small>
      <input ref={inputRef} hidden type="file" multiple accept={accept} onChange={(event) => { pick(event.target.files); event.target.value = ''; }} />
    </div>
  );
}