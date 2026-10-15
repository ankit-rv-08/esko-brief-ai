import type { PipelineResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message: string, public status: number, public detail?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function runPipeline(
  files: File[],
  onProgress?: (stage: 'uploading' | 'extracting' | 'analyzing' | 'generating') => void,
): Promise<PipelineResponse> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  onProgress?.('uploading');

  const progressTimer = window.setInterval(() => {
    onProgress?.('extracting');
    window.setTimeout(() => onProgress?.('analyzing'), 800);
    window.setTimeout(() => onProgress?.('generating'), 1600);
  }, 700);

  try {
    const response = await fetch(`${API_URL}/pipeline`, { method: 'POST', body: form });
    if (!response.ok) {
      let detail: string | undefined;
      try {
        detail = (await response.json())?.detail;
      } catch {
        detail = undefined;
      }
      throw new ApiError(`Pipeline failed (${response.status})`, response.status, detail);
    }
    return (await response.json()) as PipelineResponse;
  } finally {
    window.clearInterval(progressTimer);
  }
}