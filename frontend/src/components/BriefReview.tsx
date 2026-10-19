import { useState } from "react";

export type Section = {
  title: string;
  content: string;
  needs_human_review?: boolean;
  fact_ids?: string[];
  confidence?: "high" | "medium" | "low";
};

export type SourceElement = {
  id: string;
  source_file: string;
  page?: number;
  row?: number;
  sheet?: string;
  content: string;
  source_type?: "pdf" | "xlsx" | "docx";
};

export type Fact = {
  id: string;
  name: string;
  value: string;
  sources: string[];
};

export function useBriefReview(sections: Section[]) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [finalized, setFinalized] = useState(false);

  const textFor = (s: Section) => edits[s.title] ?? s.content;
  const isEdited = (s: Section) => s.title in edits && edits[s.title] !== s.content;

  const setEdit = (title: string, text: string) =>
    setEdits((prev) => ({ ...prev, [title]: text }));

  const resetEdit = (title: string) =>
    setEdits((prev) => {
      const { [title]: _removed, ...rest } = prev;
      return rest;
    });

  const markReviewed = (title: string) =>
    setReviewed((prev) => ({ ...prev, [title]: true }));

  const pending = sections.filter((s) => s.needs_human_review && !reviewed[s.title]);

  return {
    textFor,
    isEdited,
    setEdit,
    resetEdit,
    markReviewed,
    reviewed,
    pending,
    finalized,
    canFinalize: pending.length === 0 && !finalized,
    finalize: () => setFinalized(true),
    reopen: () => setFinalized(false),
  };
}

export type BriefReview = ReturnType<typeof useBriefReview>;

export function SectionCard({ section, review, onCitationClick, elements }: { section: Section; review: BriefReview; onCitationClick?: (id: string) => void; elements?: SourceElement[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const edited = review.isEdited(section);

  const confidence = section.confidence === "high" ? 94 : section.confidence === "medium" ? 82 : 70;

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-lg font-bold text-gray-800">{section.title}</h4>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${confidence >= 90 ? "bg-green-50 text-green-700" : confidence >= 80 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}`}>
            {confidence}% Confidence
          </span>
        </div>
        <div className="flex items-center gap-3">
          {edited && (
            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              Edited by you
            </span>
          )}
          {!review.finalized && !editing && (
            <button
              className="text-sm font-semibold text-indigo-600 hover:underline"
              onClick={() => {
                setDraft(review.textFor(section));
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            className="min-h-[150px] w-full rounded border border-gray-300 p-3 text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-2 flex gap-4 text-sm">
            <button
              className="font-semibold text-indigo-600"
              onClick={() => {
                review.setEdit(section.title, draft);
                setEditing(false);
              }}
            >
              Save
            </button>
            <button className="text-gray-500" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {edited && (
              <button
                className="text-gray-500"
                onClick={() => {
                  review.resetEdit(section.title);
                  setEditing(false);
                }}
              >
                Reset to AI version
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="leading-relaxed text-gray-700">
          <p className="whitespace-pre-wrap">{review.textFor(section)}</p>
          {section.fact_ids && section.fact_ids.length > 0 && onCitationClick && elements && (
            <div className="mt-3 flex flex-wrap gap-1">
              {Array.from(new Set(section.fact_ids)).map((id, i) => {
                const element = elements.find((e) => e.id === id);
                let label = "Unknown source";
                if (element) {
                  const fileName = element.source_file.split('/').pop() || element.source_file;
                  if (element.source_type === "pdf" && element.page !== undefined && element.page !== null) {
                    label = `${fileName} (page ${element.page})`;
                  } else if (element.source_type === "xlsx" && element.sheet && element.row !== undefined && element.row !== null) {
                    label = `${fileName} (${element.sheet}, row ${element.row})`;
                  } else if (element.page !== undefined && element.page !== null) {
                    label = `${fileName} p.${element.page}`;
                  } else if (element.row !== undefined && element.row !== null) {
                    label = `${fileName} row ${element.row}`;
                  } else {
                    label = fileName;
                  }
                }
                return (
                  <button
                    key={i}
                    onClick={() => onCitationClick(id)}
                    className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                  >
                    📄 {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {section.needs_human_review &&
        (review.reviewed[section.title] ? (
          <span className="mt-3 inline-block text-xs font-bold text-green-700">Reviewed</span>
        ) : (
          <button
            className="mt-3 rounded bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
            onClick={() => review.markReviewed(section.title)}
          >
            Needs human review - mark as reviewed
          </button>
        ))}
    </div>
  );
}

export function FinalizeBar({ review, sections, onDownloadMarkdown }: { review: BriefReview; sections: Section[]; onDownloadMarkdown?: () => void }) {
  return (
    <div className="mt-8 rounded-lg border bg-gray-50 p-6 text-center">
      {review.finalized ? (
        <>
          <p className="mb-2 font-semibold text-green-700">Brief finalized and approved.</p>
          <div className="flex justify-center gap-4">
            {onDownloadMarkdown && (
              <button
                onClick={onDownloadMarkdown}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Download brief (.md)
              </button>
            )}
            <button className="text-sm text-gray-500 underline" onClick={review.reopen}>
              Reopen for editing
            </button>
          </div>
        </>
      ) : (
        <>
          {review.pending.length > 0 && (
            <p className="mb-3 text-sm text-red-600">
              Review {review.pending.length} flagged section(s) first:{" "}
              {review.pending.map((s) => s.title).join(", ")}
            </p>
          )}
          <button
            disabled={!review.canFinalize}
            onClick={review.finalize}
            className="rounded-lg bg-green-600 px-8 py-3 font-bold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Finalize and approve brief
          </button>
        </>
      )}
    </div>
  );
}
