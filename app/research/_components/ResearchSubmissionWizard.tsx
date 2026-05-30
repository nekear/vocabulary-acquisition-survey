"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConfirmationPanel } from "@/app/research/_components/ConfirmationPanel";
import { Step1Profile } from "@/app/research/_components/Step1Profile";
import { Step2Upload } from "@/app/research/_components/Step2Upload";
import { Step3DeckConfiguration } from "@/app/research/_components/Step3DeckConfiguration";
import { StepDoneSubmit } from "@/app/research/_components/StepDoneSubmit";
import { SurveyHeader } from "@/app/research/_components/SurveyHeader";
import { SurveyProgressSegments } from "@/app/research/_components/SurveyProgressSegments";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import type { StepNumber } from "@/lib/types";

function parseStep(value: string | null): StepNumber | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    return null;
  }

  return parsed as StepNumber;
}

export function ResearchSubmissionWizard() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = useSubmissionStore((state) => state.draft.currentStep);
  const confirmation = useSubmissionStore((state) => state.confirmation);
  const setCurrentStep = useSubmissionStore((state) => state.setCurrentStep);
  const hasHandledInitialUrlRef = useRef(false);

  const queryStep = parseStep(searchParams.get("step"));

  useEffect(() => {
    if (confirmation) {
      return;
    }

    if (!hasHandledInitialUrlRef.current) {
      hasHandledInitialUrlRef.current = true;
      if (queryStep !== currentStep) {
        router.replace(`${pathname}?step=${currentStep}`, {
          scroll: false,
        });
      }
      return;
    }

    if (!queryStep) {
      router.replace(`${pathname}?step=${currentStep}`, {
        scroll: false,
      });
      return;
    }

    if (queryStep !== currentStep) {
      setCurrentStep(queryStep);
    }
  }, [confirmation, currentStep, pathname, queryStep, router, setCurrentStep]);

  if (confirmation) {
    return (
      <div className="min-h-dvh bg-(--survey-page) px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-184">
          <ConfirmationPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-(--survey-page) px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-184 flex-col gap-4">
        <SurveyHeader />
        <SurveyProgressSegments />
        {currentStep === 1 ? <Step1Profile /> : null}
        {currentStep === 2 ? <Step2Upload /> : null}
        {currentStep === 3 ? <Step3DeckConfiguration /> : null}
        {currentStep === 4 ? <StepDoneSubmit /> : null}
      </div>
    </div>
  );
}
