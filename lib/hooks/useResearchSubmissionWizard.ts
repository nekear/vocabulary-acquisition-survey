"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import { normalizeUserProfile } from "@/lib/research";
import type {
  StepNumber,
  SubmissionConfirmation,
  UserProfile,
} from "@/lib/types";

export function useResearchSubmissionWizard() {
  const pathname = usePathname();
  const router = useRouter();
  const clearConfirmation = useSubmissionStore(
    (state) => state.clearConfirmation,
  );
  const clearPendingConfirmation = useSubmissionStore(
    (state) => state.clearPendingConfirmation,
  );
  const completeSubmission = useSubmissionStore(
    (state) => state.completeSubmission,
  );
  const resetDraft = useSubmissionStore((state) => state.resetDraft);
  const setLinkedProfile = useSubmissionStore(
    (state) => state.setLinkedProfile,
  );

  const navigateToStep = useCallback(
    (step: StepNumber) => {
      router.push(`${pathname}?step=${step}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pathname, router],
  );

  const linkPreviousSubmission = useCallback(
    async (token: string) => {
      const response = await fetch("/api/submissions/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ previous_token: token }),
      });

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          code?: string;
        };
        if (data.code === "previous_token_not_found") {
          throw new Error(
            "We could not find a submission linked to that token.",
          );
        }
        throw new Error(
          data.error || "The linked submission could not be loaded.",
        );
      }

      const data = (await response.json()) as {
        user_profile: UserProfile | null;
      };
      const linkedProfile = data.user_profile
        ? normalizeUserProfile(data.user_profile)
        : null;
      setLinkedProfile(token, linkedProfile);
      return linkedProfile;
    },
    [setLinkedProfile],
  );

  const startNewSubmission = useCallback(() => {
    clearConfirmation();
    resetDraft();
    router.push(`${pathname}?step=1`, { scroll: false });
  }, [clearConfirmation, pathname, resetDraft, router]);

  const finishSubmission = useCallback(
    (confirmation: SubmissionConfirmation) => {
      clearPendingConfirmation();
      completeSubmission(confirmation);
      router.replace(pathname, { scroll: false });
    },
    [clearPendingConfirmation, completeSubmission, pathname, router],
  );

  return {
    finishSubmission,
    linkPreviousSubmission,
    navigateToStep,
    startNewSubmission,
  };
}
