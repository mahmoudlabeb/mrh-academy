import { useId, type ReactNode } from "react";

type Fact = {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "attention" | "success";
};

export function FocusDecisionStrip({
  eyebrow,
  title,
  description,
  facts,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  facts: Fact[];
  action?: ReactNode;
}) {
  const titleId = useId();

  return (
    <section className="focus-decision-strip" aria-labelledby={titleId}>
      <span className="focus-decision-signal" aria-hidden="true" />
      <div className="focus-decision-copy">
        <p className="focus-decision-eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
        <p className="focus-decision-consequence">{description}</p>
      </div>
      <dl className="focus-decision-facts">
        {facts.map((fact, index) => (
          <div key={fact.label} data-tone={fact.tone ?? "neutral"}>
            <dt>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {fact.label}
            </dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {action && <div className="focus-decision-action">{action}</div>}
    </section>
  );
}
