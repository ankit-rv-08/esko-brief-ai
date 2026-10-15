'use client';

import { Loader2, Mic, MicOff } from 'lucide-react';

export type AgentState = 'idle' | 'listening' | 'thinking';

export function Agent({
  state,
  message,
  transcript,
  onToggleMic,
}: {
  state: AgentState;
  message: string;
  transcript?: string;
  onToggleMic: () => void;
}) {
  const dotClass = state === 'idle' ? 'agent-dot idle' : state === 'listening' ? 'agent-dot listening' : 'agent-dot thinking';
  return (
    <div className="agent-wrap">
      <div className="agent-widget">
        <span className={dotClass} />
        <span className="agent-name">Jessy</span>
        <span className="agent-message">· {message}</span>
        <button
          className={`agent-mic ${state === 'listening' ? 'recording' : ''}`}
          onClick={onToggleMic}
          aria-label={state === 'listening' ? 'Stop listening' : 'Talk to Jessy'}
          title={state === 'idle' ? 'Talk to Jessy' : undefined}
        >
          {state === 'thinking' ? <Loader2 size={13} className="spin" /> : state === 'listening' ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
      </div>
      {transcript && <div className="agent-transcript">{transcript}</div>}
    </div>
  );
}
