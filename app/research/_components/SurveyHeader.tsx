"use client";

import { Check, ExternalLink } from "lucide-react";

import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import { INFO_URL, isExternalInfoUrl } from "@/lib/info";
import type { StepNumber } from "@/lib/types";

const infoUrl = INFO_URL;
const infoUrlIsExternal = isExternalInfoUrl(infoUrl);

function getStepLabel(currentStep: StepNumber) {
  return currentStep === 4 ? "Done" : `Step ${currentStep}/3`;
}

export function SurveyHeader() {
  const currentStep = useSubmissionStore((state) => state.draft.currentStep);
  const done = currentStep === 4;

  return (
    <header className="flex flex-col gap-4">
      <div className="survey-banner flex h-28 items-start justify-between gap-3 rounded-[8px] p-5 shadow-sm sm:h-36 sm:p-6">
        <div className="relative z-10 inline-flex min-h-9 items-center rounded-full bg-white/90 px-3 text-sm font-semibold text-[var(--survey-header-strong)] shadow-sm">
          Survey
        </div>
        <div
          className="relative z-10 inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white/90 px-3 text-sm font-semibold text-[var(--survey-header-strong)] shadow-sm"
          aria-label={`Survey status: ${getStepLabel(currentStep)}`}
        >
          {done ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
          {getStepLabel(currentStep)}
        </div>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[var(--survey-card-border)] bg-background shadow-sm">
        <div className="h-2 bg-[var(--survey-header)]" aria-hidden="true" />
        <div className="p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
              Personalized vocabulary complexity research
            </h1>
            <p className="max-w-2xl text-sm leading-6 sm:text-base font-normal">
              Share anonymized <span className="font-semibold">Anki</span>{" "}
              review logs and note content to help study personalized vocabulary
              complexity. You can review deck content before anything is
              uploaded.
            </p>
            <a
              href={infoUrl}
              target={infoUrlIsExternal ? "_blank" : undefined}
              rel={infoUrlIsExternal ? "noreferrer noopener" : undefined}
              className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-[var(--survey-header-strong)] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span>Research overview and data-handling details</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
