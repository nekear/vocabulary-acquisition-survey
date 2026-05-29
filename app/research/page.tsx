import { Suspense } from "react";
import { ResearchSubmissionWizard } from "@/app/research/_components/ResearchSubmissionWizard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Survey | Personalized vocabulary acquisition",
  description:
    "Help advance language learning research by contributing anonymized scheduling data from your Anki collection.",
};

export default function ResearchPage() {
  return (
    <Suspense fallback={null}>
      <ResearchSubmissionWizard />
    </Suspense>
  );
}
