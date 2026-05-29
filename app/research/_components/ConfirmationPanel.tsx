"use client";

import Link from "next/link";
import { AlertTriangle, Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildDownloadFilename } from "@/lib/research";
import { downloadTextFile } from "@/lib/gzip";
import { useResearchSubmissionWizard } from "@/lib/hooks/useResearchSubmissionWizard";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";

export function ConfirmationPanel() {
  const confirmation = useSubmissionStore((state) => state.confirmation);
  const { startNewSubmission } = useResearchSubmissionWizard();

  if (!confirmation) {
    return null;
  }

  const copyToken = async () => {
    if (!confirmation.withdrawalToken) {
      return;
    }

    await navigator.clipboard.writeText(confirmation.withdrawalToken);
    toast.success("Token copied to clipboard.");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className={"flex flex-row gap-2 items-center"}>
          <div className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-primary/20 bg-primary/5 h-[30px] w-[30px] text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Submission received
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Keep the withdrawal token below. It is the only way to withdraw this
          submission or link future submissions to the same submitter record.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <div className="mb-3 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Save this token now</p>
            <p className="text-sm text-muted-foreground">
              We do not store the plaintext token in a recoverable form. If you
              lose it, this submission cannot be withdrawn.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 rounded-xl border bg-background px-4 py-3 font-mono text-base sm:text-lg">
            {confirmation.withdrawalToken ??
              "Use your previously saved withdrawal token."}
          </code>
          <Button
            type="button"
            variant="outline"
            onClick={copyToken}
            disabled={!confirmation.withdrawalToken}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy token
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadTextFile(
              buildDownloadFilename("anki-submission-record", "json"),
              confirmation.payloadJson,
            )
          }
        >
          Download for your records (.json)
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/research/withdraw">Withdraw submitted data</Link>
        </Button>
        <Button type="button" onClick={startNewSubmission}>
          <Plus className="mr-2 h-4 w-4" />
          Start a new submission
        </Button>
      </div>
    </div>
  );
}
