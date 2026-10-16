'use client';

import { X } from 'lucide-react';
import type { Conflict } from '@/lib/types';

interface ConflictViewerProps {
  conflict: Conflict | null;
  onClose: () => void;
}

export function ConflictViewer({ conflict, onClose }: ConflictViewerProps) {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Conflict: ${conflict.name}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{conflict.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close conflict viewer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {conflict.facts.map((fact, idx) => (
              <div key={fact.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Source {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{fact.value}</span>
                </div>
                <p className="text-sm text-gray-500">
                  {fact.reasoning || 'No additional reasoning provided.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
