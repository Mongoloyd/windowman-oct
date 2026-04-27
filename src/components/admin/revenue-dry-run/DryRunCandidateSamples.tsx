interface DryRunCandidateSamplesProps {
  sampleCandidateIds: string[];
}

export function DryRunCandidateSamples({ sampleCandidateIds }: DryRunCandidateSamplesProps) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">Sample Masked Candidate IDs</h3>
      <p className="mt-1 text-sm font-semibold text-slate-700">Masked IDs only. No homeowner name, email, phone, quote URL, token, or click ID is shown.</p>
      {sampleCandidateIds.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">No sample candidates returned for this dry-run.</div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {sampleCandidateIds.map((id) => (
            <span key={id} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-black text-slate-900">{id}</span>
          ))}
        </div>
      )}
    </section>
  );
}
