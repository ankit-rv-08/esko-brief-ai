export type SourceType = 'pdf' | 'docx' | 'xlsx' | 'image' | 'text';
export type Confidence = 'high' | 'medium' | 'low';
export type Severity = 'info' | 'warning' | 'error';

export interface SourceElement {
  id: string;
  source_file: string;
  source_type: SourceType;
  page: number | null;
  sheet: string | null;
  row: number | null;
  content: string;
  image_path: string | null;
}

export interface Fact {
  id: string;
  name: string;
  value: string;
  sources: string[];
  confidence: number;
  reasoning: string | null;
  category: string | null;
}

export interface Conflict {
  name: string;
  facts: Fact[];
  severity: Severity;
  note: string | null;
}

export interface Gap {
  field: string;
  description: string;
  category: string;
  severity: Severity;
}

export interface BriefSection {
  title: string;
  content: string;
  fact_ids: string[];
  confidence: Confidence;
  confidence_reason: string | null;
  // NEW: Formal uncertainty scoring — review axis
  needs_human_review: boolean;
  review_reason: string | null;
}

export interface Brief {
  id: string;
  title: string;
  sections: BriefSection[];
  uncertainty: string[];
  open_questions: string[];
  // NEW: Agentic self-critique findings
  critique: Array<{ section: string; issue: string; severity: string }>;
  generated_at: string;
  source_elements: SourceElement[];
  facts: Fact[];
  conflicts: Conflict[];
  gaps: Gap[];
}

export interface PipelineResponse {
  elements: SourceElement[];
  facts: Fact[];
  conflicts: Conflict[];
  gaps: Gap[];
  brief: Brief;
  warnings: string[];
}

export type PipelineStatus =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'error';