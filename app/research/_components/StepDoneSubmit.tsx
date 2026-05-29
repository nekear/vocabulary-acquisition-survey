"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { InlineSpinner } from "@/app/research/_components/InlineSpinner";
import { QuestionCard } from "@/app/research/_components/QuestionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SCHEMA_VERSION } from "@/lib/constants";
import { useResearchSubmissionWizard } from "@/lib/hooks/useResearchSubmissionWizard";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import { INFO_URL, isExternalInfoUrl } from "@/lib/info";
import { buildSubmissionPayload } from "@/lib/buildSubmissionPayload";
import {
  buildDownloadFilename,
  buildSubmissionIndex,
  computeSubmissionStats,
  createPayloadPreview,
} from "@/lib/research";
import { downloadTextFile, gzipString } from "@/lib/gzip";
import type {
  ApiErrorResponse,
  PendingConfirmation,
  SubmissionConfirmation,
} from "@/lib/types";

type SubmissionStatus = "idle" | "initializing" | "uploading" | "confirming";

interface ParsedApiError {
  code?: ApiErrorResponse["code"];
  expectedSizeBytes?: number;
  maxSizeBytes?: number;
  message: string;
  status: number;
}

interface SubmissionFormError {
  details?: string[];
  message: string;
}

class SubmissionRequestError extends Error {
  code?: ApiErrorResponse["code"];
  expectedSizeBytes?: number;
  maxSizeBytes?: number;
  status: number;
  suppressToast: boolean;

  constructor(
    error: ParsedApiError,
    options: { suppressToast?: boolean } = {},
  ) {
    super(error.message);
    this.name = "SubmissionRequestError";
    this.code = error.code;
    this.expectedSizeBytes = error.expectedSizeBytes;
    this.maxSizeBytes = error.maxSizeBytes;
    this.status = error.status;
    this.suppressToast = options.suppressToast ?? false;
  }
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

async function parseApiError(
  response: Response,
  fallback: string,
): Promise<ParsedApiError> {
  try {
    const data = (await response.json()) as Partial<ApiErrorResponse>;
    return {
      code: data.code,
      expectedSizeBytes: optionalNumber(data.expected_size_bytes),
      maxSizeBytes: optionalNumber(data.max_size_bytes),
      message: data.error || fallback,
      status: response.status,
    };
  } catch {
    return {
      message: fallback,
      status: response.status,
    };
  }
}

function formatByteSize(bytes: number) {
  const units = ["bytes", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }

  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  });

  return `${formatter.format(value)} ${units[unitIndex]}`;
}

function buildPayloadTooLargeFormError(
  error: SubmissionRequestError,
): SubmissionFormError {
  const compressedSize =
    typeof error.expectedSizeBytes === "number"
      ? formatByteSize(error.expectedSizeBytes)
      : "the compressed submission";
  const limit =
    typeof error.maxSizeBytes === "number"
      ? formatByteSize(error.maxSizeBytes)
      : "the configured upload limit";
  const sizeDetail =
    typeof error.maxSizeBytes === "number"
      ? `Compressed submission size: ${compressedSize}. Configured compressed upload limit: ${limit}.`
      : `Storage rejected the compressed upload. Compressed submission size: ${compressedSize}. It exceeds ${limit}.`;

  return {
    message: "This submission is too large to upload.",
    details: [
      sizeDetail,
      "The limit applies to the gzipped upload, not the uncompressed JSON preview.",
      "Try submitting fewer .apkg files at once, or contact the researcher if this is your full collection.",
    ],
  };
}

const infoUrl = INFO_URL;
const infoUrlDataHandling = infoUrl + "#data-handling";
const infoUrlIsExternal = isExternalInfoUrl(infoUrl);

export function StepDoneSubmit() {
  const parsedFiles = useSubmissionStore((state) => state.draft.parsedFiles);
  const previousToken = useSubmissionStore(
    (state) => state.draft.previousToken,
  );
  const userProfile = useSubmissionStore((state) => state.draft.userProfile);
  const deckAssignments = useSubmissionStore(
    (state) => state.draft.deckAssignments,
  );
  const deckReviewConfigs = useSubmissionStore(
    (state) => state.draft.deckReviewConfigs,
  );
  const excludedNoteIds = useSubmissionStore(
    (state) => state.draft.excludedNoteIds,
  );
  const consent = useSubmissionStore((state) => state.draft.consent);
  const pendingConfirmation = useSubmissionStore(
    (state) => state.draft.pendingConfirmation,
  );
  const setConsent = useSubmissionStore((state) => state.setConsent);
  const setPendingConfirmation = useSubmissionStore(
    (state) => state.setPendingConfirmation,
  );
  const { finishSubmission, navigateToStep } = useResearchSubmissionWizard();
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [formError, setFormError] = useState<SubmissionFormError | null>(null);
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const index = useMemo(() => buildSubmissionIndex(parsedFiles), [parsedFiles]);
  const stats = useMemo(
    () => computeSubmissionStats(index, excludedNoteIds),
    [excludedNoteIds, index],
  );
  const isBusy = status !== "idle";

  const buildCurrentPayload = () =>
    buildSubmissionPayload({
      previousToken,
      userProfile,
      publishRevlogs: consent.publish_revlogs,
      publishUserinfo: consent.publish_userinfo,
      parsedFiles,
      deckAssignments,
      deckReviewConfigs,
      excludedNoteIds,
    });

  const buildPayloadJson = () =>
    pendingConfirmation?.payloadJson ??
    createPayloadPreview(buildCurrentPayload(), true);

  const confirmSubmission = async (pending: PendingConfirmation) => {
    setStatus("confirming");
    const response = await fetch(
      `/api/submissions/${pending.submissionId}/confirm`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new SubmissionRequestError(
        await parseApiError(
          response,
          "The upload succeeded, but the submission could not be confirmed.",
        ),
      );
    }

    const confirmation: SubmissionConfirmation = {
      submissionId: pending.submissionId,
      withdrawalToken: pending.withdrawalToken,
      payloadJson: pending.payloadJson,
      submittedAtIso: new Date().toISOString(),
    };

    toast.success("Submission confirmed.");
    finishSubmission(confirmation);
    setStatus("idle");
  };

  const handleSubmit = async () => {
    setFormError(null);
    let createdPendingConfirmation: PendingConfirmation | null = null;
    let uploadStarted = false;

    try {
      if (pendingConfirmation) {
        await confirmSubmission(pendingConfirmation);
        return;
      }

      const payload = buildCurrentPayload();
      const payloadJson = createPayloadPreview(payload, true);
      const uploadPayloadJson = JSON.stringify(payload);
      setStatus("initializing");
      const gzippedPayload = await gzipString(uploadPayloadJson);

      const initResponse = await fetch("/api/submissions/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schema_version: SCHEMA_VERSION,
          previous_token: previousToken || null,
          consent: {
            publish_revlogs: consent.publish_revlogs,
            publish_userinfo: consent.publish_userinfo,
          },
          user_profile: userProfile,
          expected_size_bytes: gzippedPayload.size,
        }),
      });

      if (!initResponse.ok) {
        const apiError = await parseApiError(
          initResponse,
          "The submission could not be initialized.",
        );
        throw new SubmissionRequestError(apiError, {
          suppressToast: apiError.code === "payload_too_large",
        });
      }

      const initData = (await initResponse.json()) as {
        submission_id: string;
        upload_url: string;
        withdrawal_token?: string;
      };

      const effectiveToken = initData.withdrawal_token ?? previousToken;

      uploadStarted = true;
      setStatus("uploading");
      const uploadResponse = await fetch(initData.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        body: gzippedPayload,
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 413) {
          throw new SubmissionRequestError(
            {
              code: "payload_too_large",
              expectedSizeBytes: gzippedPayload.size,
              message:
                "Storage rejected the compressed upload because it is too large.",
              status: uploadResponse.status,
            },
            { suppressToast: true },
          );
        }

        throw new Error(
          `The payload upload failed with status ${uploadResponse.status}.`,
        );
      }
      uploadStarted = false;

      const pending: PendingConfirmation = {
        submissionId: initData.submission_id,
        withdrawalToken: effectiveToken || null,
        payloadJson,
      };
      createdPendingConfirmation = pending;
      setPendingConfirmation(pending);
      await confirmSubmission(pending);
      setPendingConfirmation(null);
    } catch (error) {
      const formErrorValue =
        error instanceof SubmissionRequestError &&
        error.code === "payload_too_large"
          ? buildPayloadTooLargeFormError(error)
          : {
              message:
                error instanceof Error
                  ? error.message
                  : "The submission could not be completed.",
            };
      setFormError(formErrorValue);
      if (pendingConfirmation || createdPendingConfirmation) {
        toast.error(
          "Upload completed, but confirmation failed. Retry confirmation.",
        );
      } else if (uploadStarted) {
        setPendingConfirmation(null);
        if (!(error instanceof SubmissionRequestError && error.suppressToast)) {
          toast.error(`Upload failed: ${formErrorValue.message}`);
        }
      } else if (
        !(error instanceof SubmissionRequestError && error.suppressToast)
      ) {
        toast.error(formErrorValue.message);
      }
      setStatus("idle");
    }
  };

  const declaredLanguages = userProfile.target_languages
    .map((language) => `${language.lang} (${language.proficiency})`)
    .join(", ");
  const schedulerSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deck of index.directDecks) {
      const scheduler =
        deckAssignments[String(deck.deck_id)]?.scheduler ?? "Missing";
      counts.set(scheduler, (counts.get(scheduler) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([scheduler, count]) => `${scheduler}: ${count}`)
      .join(", ");
  }, [deckAssignments, index.directDecks]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─────────── A banner of the final review, consent, and submission step ─────────── */}
      <QuestionCard className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Review, consent, and submit
        </h2>
        <p className="max-w-2xl text-sm leading-6">
          Review the final note-level summary, confirm consent, and optionally
          download the exact JSON payload before submission.
        </p>
      </QuestionCard>

      {/* ─────────── Summarizing what will be included in the final submission payload ─────────── */}
      <QuestionCard className="space-y-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Submission summary</h2>
        </div>

        <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Decks" value={stats.deckCount.toLocaleString()} />
          <SummaryItem
            label="Notes"
            value={`${stats.includedNotes.toLocaleString()} / ${stats.totalNotes}`}
          />
          <SummaryItem
            label="Cards"
            value={`${stats.includedCards.toLocaleString()} / ${stats.totalCards}`}
          />
          <SummaryItem
            label="Reviews"
            value={stats.includedReviews.toLocaleString()}
          />
        </div>

        <div className="mt-4 grid gap-4 text-sm text-muted-foreground lg:grid-cols-2">
          <SummaryItem
            label="Declared languages"
            value={declaredLanguages || "No target languages declared."}
          />
          <SummaryItem
            label="Deck schedulers"
            value={schedulerSummary || "No decks."}
          />
        </div>

        <div className="mt-4 grid gap-4 text-sm text-muted-foreground lg:grid-cols-2 border-t border-border/80" />

        <div>
          {/*TODO: This button forces the browser to download the payload, which includes the user's consent. However, consent is accepted only below, so perhaps (?) this button should be moved beneath the consent section, though it's not that important. */}
          <SummaryItem
            label="Final submission"
            value={
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadTextFile(
                    buildDownloadFilename("anki-submission-review", "json"),
                    buildPayloadJson(),
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download for review (.json)
              </Button>
            }
          />
        </div>
      </QuestionCard>

      {/* ─────────── Capturing required and optional consent before submission ─────────── */}
      <QuestionCard className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="publish_revlogs"
            checked={consent.publish_revlogs}
            onCheckedChange={(checked) =>
              setConsent({ publish_revlogs: checked === true })
            }
          />
          <Label
            htmlFor="publish_revlogs"
            className="block leading-6 font-regular space-x-2 -mt-1"
          >
            <span>
              I consent to my anonymised review logs, note content, and derived
              card data being included in the publicly released research
              dataset, as described in the{" "}
              <a
                href={infoUrlDataHandling}
                target={infoUrlIsExternal ? "_blank" : undefined}
                rel={infoUrlIsExternal ? "noreferrer noopener" : undefined}
                className="underline underline-offset-4"
              >
                data-handling section of the overview page
              </a>
              . I understand this consent is final at the time of public
              release.
            </span>
            <Badge
              variant="outline"
              className="mr-2 align-middle text-[10px] text-muted-foreground uppercase tracking-wide h-[1.2rem]"
            >
              Required
            </Badge>
          </Label>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="is_adult_confirmed"
            checked={isAdultConfirmed}
            onCheckedChange={(checked) => setIsAdultConfirmed(checked === true)}
          />
          <Label
            htmlFor="is_adult_confirmed"
            className="block leading-6 font-regular space-x-2 -mt-1"
          >
            <span>I confirm that I am at least 16 years old.</span>
            <Badge
              variant="outline"
              className="mr-2 align-middle text-[10px] text-muted-foreground uppercase tracking-wide h-[1.2rem]"
            >
              Required
            </Badge>
          </Label>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="publish_userinfo"
            checked={consent.publish_userinfo}
            onCheckedChange={(checked) =>
              setConsent({ publish_userinfo: checked === true })
            }
          />
          <Label
            htmlFor="publish_userinfo"
            className="block leading-6 font-regular -mt-1"
          >
            I consent to my language profile (native languages, target languages
            with proficiency, domain interests) being associated with my
            submission in the publicly released dataset. If I do not consent, my
            review data will be released without these fields attached.
          </Label>
        </div>
      </QuestionCard>

      {/* ─────────── Preserving resumable confirmation state after a successful upload ─────────── */}
      {pendingConfirmation ? (
        <QuestionCard className="flex items-start gap-3 border-primary/20 bg-primary/5 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            The payload upload completed, but the final confirmation call still
            needs to succeed. Retry confirmation before leaving this page.
          </div>
        </QuestionCard>
      ) : null}

      {/* ─────────── An explanation of why submission is blocked when required consent is missing ─────────── */}
      {!consent.publish_revlogs ? (
        <QuestionCard className="flex items-start gap-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Without consent for the review log data, there is nothing to submit.
        </QuestionCard>
      ) : null}

      {/* ─────────── Asking for the age confirmation required before participation ─────────── */}
      {!isAdultConfirmed ? (
        <QuestionCard className="flex items-start gap-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Please confirm that you are 16 or older before submitting.
        </QuestionCard>
      ) : null}

      {/* ─────────── Showing live progress while the submission request is in flight ─────────── */}
      {isBusy ? (
        <QuestionCard className="text-sm text-muted-foreground">
          <InlineSpinner
            label={
              status === "initializing"
                ? "Preparing submission..."
                : status === "uploading"
                  ? "Uploading submission..."
                  : "Confirming submission..."
            }
          />
        </QuestionCard>
      ) : null}

      {/* ─────────── Surfacing structured submission errors and recovery guidance ─────────── */}
      {formError ? (
        <QuestionCard className="space-y-2 border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <div className="font-medium">{formError.message}</div>
          {formError.details?.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {formError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </QuestionCard>
      ) : null}

      {/* ─────────── Returning to deck review or sending the final submission (navigation) ─────────── */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigateToStep(3)}
          disabled={isBusy || Boolean(pendingConfirmation)}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy || !consent.publish_revlogs || !isAdultConfirmed}
        >
          {pendingConfirmation ? (
            <RotateCcw className="mr-2 h-4 w-4" />
          ) : (
            <SendHorizontal className="mr-2 h-4 w-4" />
          )}
          {pendingConfirmation ? "Retry confirmation" : "Submit"}
        </Button>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number | ReactNode | null;
}) {
  return (
    <div className="flex-col items-center space-y-2">
      <div className="font-medium text-foreground">{label}</div>
      <div>{value ?? "N/A"}</div>
    </div>
  );
}
