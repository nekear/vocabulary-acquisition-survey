"use client";

import { Check } from "lucide-react";

import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { step: 1, label: "Profile" },
  { step: 2, label: "Upload" },
  { step: 3, label: "Configure" },
] as const;

export function SurveyProgressSegments() {
  const currentStep = useSubmissionStore((state) => state.draft.currentStep);
  const done = currentStep === 4;

  return (
    <section className="survey-card p-4" aria-label="Survey progress">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {SEGMENTS.map((segment) => {
          const complete = done || segment.step < currentStep;
          const active = !done && segment.step === currentStep;
          const stateLabel = complete
            ? "Complete"
            : active
              ? "Current"
              : "Not started";

          return (
            <div key={segment.step} className="min-w-0">
              <div
                className={cn(
                  "mb-2 flex min-h-6 items-center gap-1.5 text-xs font-medium sm:text-sm",
                  complete || active
                    ? "text-[var(--survey-header-strong)]"
                    : "text-muted-foreground",
                )}
              >
                {complete ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : null}
                <span className="truncate">{segment.label}</span>
                <span className="sr-only">{stateLabel}</span>
              </div>
              <div
                className={cn(
                  "h-2 overflow-hidden rounded-full bg-[var(--survey-progress-muted)]",
                  active &&
                    "border border-dashed border-[var(--survey-header)] bg-transparent",
                )}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "h-full rounded-full bg-[var(--survey-header)] transition-[width] duration-200 ease-out",
                    complete ? "w-full" : "w-0",
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
