import React from "react";
import {
  PRIVACY_RETENTION_ROWS,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_LAST_REVIEWED,
} from "@/content/privacyPolicyMetadata";

function formatPrivacyPolicyDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
import {
  privacyIntroParagraphs,
  privacyPolicySections,
  privacyRetentionFollowUpParagraphs,
} from "@/content/privacyPolicyContent";

type Props = {
  /**
   * When true, omit the outer <section> landmark (used inside the Privacy.tsx
   * wrapper and the prerender shell). The constrained max-width wrapper with
   * horizontal/vertical padding is always applied so SPA and prerendered
   * output share one readable layout.
   */
  contentOnly?: boolean;
};

export function PrivacyPolicyBody({ contentOnly = false }: Props) {
  const inner = (
    <>
      <div className="mb-10">
        <h1
          id="privacy-policy-title"
          className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl"
        >
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Effective Date: {formatPrivacyPolicyDate(PRIVACY_POLICY_EFFECTIVE_DATE)}{" "}
          · Last Reviewed:{" "}
          {formatPrivacyPolicyDate(PRIVACY_POLICY_LAST_REVIEWED)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <article className="prose prose-slate max-w-none text-base leading-7 text-slate-700 prose-headings:text-slate-950 prose-strong:text-slate-950 prose-a:text-slate-900">
          {privacyIntroParagraphs.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}

          {privacyPolicySections.map((section) => {
            if (section.id === "retention-intro") {
              return (
                <div key={section.id}>
                  <h2 className="mt-8 text-xl font-semibold text-slate-950">
                    {section.title}
                  </h2>
                  {section.paragraphs?.map((p) => (
                    <p key={p.slice(0, 40)}>{p}</p>
                  ))}
                  <div className="not-prose my-6 overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm text-slate-700">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-4 font-semibold text-slate-950">
                            Data Category
                          </th>
                          <th className="py-2 font-semibold text-slate-950">
                            Retention Standard
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {PRIVACY_RETENTION_ROWS.map((row) => (
                          <tr
                            key={row.category}
                            className="border-b border-slate-100 align-top"
                          >
                            <td className="py-2 pr-4 font-medium text-slate-900">
                              {row.category}
                            </td>
                            <td className="py-2">{row.standard}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {privacyRetentionFollowUpParagraphs.map((p) => (
                    <p key={p.slice(0, 40)}>{p}</p>
                  ))}
                </div>
              );
            }

            return (
              <div key={section.id}>
                <h2 className="mt-8 text-xl font-semibold text-slate-950">
                  {section.title}
                </h2>
                {section.paragraphs?.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-6">
                    {section.bullets.map((b) => (
                      <li key={b.slice(0, 40)}>{b}</li>
                    ))}
                  </ul>
                )}
                {section.subsections?.map((sub) => (
                  <div key={sub.subtitle || sub.paragraphs?.[0]?.slice(0, 30)}>
                    {sub.subtitle ? (
                      <h3 className="mt-6 text-lg font-semibold text-slate-950">
                        {sub.subtitle}
                      </h3>
                    ) : null}
                    {sub.paragraphs?.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                    {sub.bullets && (
                      <ul className="list-disc space-y-1 pl-6">
                        {sub.bullets.map((b) => (
                          <li key={b.slice(0, 40)}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </article>
      </div>
    </>
  );

  const constrained = (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">{inner}</div>
  );

  if (contentOnly) {
    return constrained;
  }

  return (
    <section aria-labelledby="privacy-policy-title">{constrained}</section>
  );
}
