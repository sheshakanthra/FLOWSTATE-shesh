"use client";

export interface TextPreviewData {
  text: string;
  /** `draft_message`'s To/Subject line -- absent for `explain_run`/
   *  `summarize_activity`'s plain prose. Optional so this one component
   *  covers every read-only text tool and `draft_message` alike, rather
   *  than a fourth preview kind for a difference this small. */
  meta?: Record<string, string>;
}

export function TextPreview({ text, meta }: TextPreviewData) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-ink-400 bg-ink-050 p-3">
      {meta ? (
        <dl className="flex flex-col gap-0.5 border-b border-ink-400 pb-2 text-meta">
          {Object.entries(meta).map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="text-fg-200">{key}:</dt>
              <dd className="text-fg-000">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="whitespace-pre-wrap text-body text-fg-000">{text}</p>
    </div>
  );
}
