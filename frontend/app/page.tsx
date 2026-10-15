'use client';

import { useCallback, useReducer, useState } from 'react';
import { FileStack, RotateCcw } from 'lucide-react';
import { Header } from '@/components/Header';
import { SourcePanel } from '@/components/SourcePanel';
import { BriefPanel } from '@/components/BriefPanel';
import { EvidencePanel } from '@/components/EvidencePanel';
import { UploadZone } from '@/components/UploadZone';
import { ApiError, runPipeline } from '@/lib/api';
import type { Brief, Conflict, Fact, Gap, PipelineStatus, SourceElement } from '@/lib/types';

interface State {
  status: PipelineStatus;
  elements: SourceElement[];
  facts: Fact[];
  conflicts: Conflict[];
  gaps: Gap[];
  brief: Brief | null;
  selectedFactId: string | null;
  error: string | null;
}

const initialState: State = { status: 'idle', elements: [], facts: [], conflicts: [], gaps: [], brief: null, selectedFactId: null, error: null };
type Action = { type: 'STATUS'; status: PipelineStatus } | { type: 'SUCCESS'; payload: Omit<State, 'status' | 'selectedFactId' | 'error'> } | { type: 'ERROR'; message: string } | { type: 'SELECT'; id: string | null } | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'STATUS': return { ...state, status: action.status, error: null };
    case 'SUCCESS': return { ...state, ...action.payload, status: 'done', error: null };
    case 'ERROR': return { ...state, status: 'error', error: action.message };
    case 'SELECT': return { ...state, selectedFactId: action.id };
    case 'RESET': return initialState;
  }
}

const runningStatuses: PipelineStatus[] = ['uploading', 'extracting', 'analyzing', 'generating'];
const stageLabels: Record<PipelineStatus, string> = { idle: 'Ready when you are', uploading: 'Uploading sources', extracting: 'Extracting facts', analyzing: 'Checking conflicts', generating: 'Drafting brief', done: 'Brief ready', error: 'Needs attention' };

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const isRunning = runningStatuses.includes(state.status);
  const selectedFact = state.facts.find((fact) => fact.id === state.selectedFactId) ?? null;

  const addFiles = useCallback((files: File[]) => setPendingFiles((current) => [...current, ...files]), []);
  const removeFile = (index: number) => setPendingFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const generate = useCallback(async () => {
    if (!pendingFiles.length || isRunning) return;
    dispatch({ type: 'STATUS', status: 'uploading' });
    try {
      const response = await runPipeline(pendingFiles, (stage) => dispatch({ type: 'STATUS', status: stage }));
      dispatch({ type: 'SUCCESS', payload: response });
    } catch (error) {
      const message = error instanceof ApiError && error.detail ? error.detail : error instanceof Error ? error.message : 'The pipeline could not complete.';
      dispatch({ type: 'ERROR', message });
    }
  }, [isRunning, pendingFiles]);

  return <div className="app-shell"><Header onAddFiles={() => document.querySelector<HTMLInputElement>('#global-file-picker')?.click()} status={stageLabels[state.status]} /><input id="global-file-picker" hidden type="file" multiple accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /><div className="workspace"><aside className="left-rail">{state.brief ? <SourcePanel elements={state.elements} gaps={state.gaps} conflicts={state.conflicts} /> : <div className="intake-panel"><div className="intake-intro"><span className="eyebrow">New brief</span><h2>Bring the pack into focus.</h2><p>Upload artwork, content sheets, and specs. Jessy will connect the evidence.</p></div><UploadZone onFiles={addFiles} disabled={isRunning} />{pendingFiles.length > 0 && <div className="pending-files"><div className="section-heading"><span>Ready to review</span><b>{pendingFiles.length}</b></div>{pendingFiles.map((file, index) => <div className="pending-file" key={`${file.name}-${index}`}><FileStack size={14} /><span title={file.name}>{file.name}</span><button onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button></div>)}<button className="primary-button full-button" disabled={isRunning} onClick={generate}>{isRunning ? 'Working…' : 'Generate brief'}</button></div>}</div>}{state.error && <div className="error-box">{state.error}</div>}{state.brief && <button className="reset-button" onClick={() => { dispatch({ type: 'RESET' }); setPendingFiles([]); }}><RotateCcw size={13} /> Start another brief</button>}</aside>{state.brief ? <BriefPanel brief={state.brief} facts={state.facts} elements={state.elements} selectedFactId={state.selectedFactId} onSelectFact={(id) => dispatch({ type: 'SELECT', id })} /> : <main className="empty-main"><div className="empty-mark"><FileStack size={22} /></div><span className="eyebrow">Esko Brief AI</span><h1>A clearer brief starts with better evidence.</h1><p>Upload your packaging sources to turn scattered inputs into a precise, citeable design brief.</p><div className="stage-strip"><span className={state.status !== 'idle' ? 'current' : ''}>01 Upload</span><i /> <span className={state.status === 'extracting' ? 'current' : ''}>02 Extract</span><i /> <span className={state.status === 'analyzing' ? 'current' : ''}>03 Analyze</span><i /> <span className={state.status === 'generating' ? 'current' : ''}>04 Draft</span></div></main>}<EvidencePanel selectedFact={selectedFact} elements={state.elements} onClose={() => dispatch({ type: 'SELECT', id: null })} /></div><div className={`jessy-widget ${isRunning ? 'working' : ''}`}><i /><span>Jessy</span><small>· {stageLabels[state.status]}</small></div></div>;
}
