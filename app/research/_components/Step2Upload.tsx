"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  type KeyboardEvent,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileArchive,
  Info,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { InlineSpinner } from "@/app/research/_components/InlineSpinner";
import { QuestionCard } from "@/app/research/_components/QuestionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useApkgParser } from "@/lib/hooks/useApkgParser";
import { useResearchSubmissionWizard } from "@/lib/hooks/useResearchSubmissionWizard";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import { buildSubmissionIndex } from "@/lib/research";
import type { ParsedFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface UploadEntry {
  id: string;
  filename: string;
  file: File | null;
  parsedFile: ParsedFile | null;
  error: string | null;
}

/**
 * Describes the result of validating a batch of selected files before they are
 * merged into the upload queue.
 */
interface AddFilesResult {
  nextEntries: UploadEntry[];
  validationErrors: string[];
}

/**
 * Rebuilds upload entries from parsed files that already live in submission
 * state so the local queue stays aligned with the persisted wizard draft.
 */
function createParsedEntries(parsedFiles: ParsedFile[]): UploadEntry[] {
  return parsedFiles.map((parsedFile) => ({
    id: parsedFile.id,
    filename: parsedFile.filename,
    file: null,
    parsedFile,
    error: null,
  }));
}

/**
 * Validates newly selected files and returns both the next queue state and any
 * user-facing validation messages that should be shown as toasts.
 */
function prepareFilesForUpload(
  currentEntries: UploadEntry[],
  files: Iterable<File> | null | undefined,
): AddFilesResult {
  if (!files) {
    return {
      nextEntries: currentEntries,
      validationErrors: [],
    };
  }

  let hasChanges = false;
  const nextEntries = [...currentEntries];
  const validationErrors: string[] = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".apkg")) {
      validationErrors.push(
        `Could not add ${file.name}: only .apkg files are accepted.`,
      );
      continue;
    }

    if (nextEntries.some((entry) => entry.filename === file.name)) {
      validationErrors.push(
        `${file.name} has already been added in this session.`,
      );
      continue;
    }

    nextEntries.push({
      id: crypto.randomUUID(),
      filename: file.name,
      file,
      parsedFile: null,
      error: null,
    });
    hasChanges = true;
  }

  return {
    nextEntries: hasChanges ? nextEntries : currentEntries,
    validationErrors,
  };
}

export function Step2Upload() {
  const parsedFiles = useSubmissionStore((state) => state.draft.parsedFiles);
  const setParsedFiles = useSubmissionStore((state) => state.setParsedFiles);
  const { navigateToStep } = useResearchSubmissionWizard();
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<UploadEntry[]>(() =>
    createParsedEntries(parsedFiles),
  );
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { parse, parsing } = useApkgParser();

  const failedEntries = entries.filter((entry) => Boolean(entry.error));
  const readyToParseEntries = entries.filter(
    (entry) => entry.file && !entry.parsedFile && !entry.error,
  );

  useEffect(() => {
    setEntries((currentEntries) => {
      const pendingEntries = currentEntries.filter(
        (entry) => !entry.parsedFile,
      );
      return [...createParsedEntries(parsedFiles), ...pendingEntries];
    });
  }, [parsedFiles]);

  const index = useMemo(() => buildSubmissionIndex(parsedFiles), [parsedFiles]);
  const directDeckCount = index.directDecks.length;
  const noteCount = index.notes.length;
  const reviewCount = index.reviews.length;

  const addFiles = (files: Iterable<File> | null | undefined) => {
    const { nextEntries, validationErrors } = prepareFilesForUpload(
      entries,
      files,
    );

    for (const message of validationErrors) {
      toast.error(message);
    }

    if (nextEntries !== entries) {
      setEntries(nextEntries);
    }
  };

  /** Detects whether the current drag event is carrying files we can accept. */
  const hasDraggedFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.items).some((item) => item.kind === "file");

  /** Marks the upload card as active when a file drag first enters it. */
  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  /** Keeps the browser in copy-drop mode instead of opening the dragged file. */
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  /**
   * Tracks nested dragleave events so the highlight only disappears after the
   * pointer fully leaves the upload card.
   */
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  /** Queues dropped files through the same validation path as manual picking. */
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    addFiles(event.dataTransfer.files);
  };

  /** Adds files chosen through the hidden browser file picker. */
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  /** Lets keyboard users open the hidden file picker from the drop target. */
  const handleUploadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    fileInputRef.current?.click();
  };

  const removeEntry = (entryId: string) => {
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return;
    }

    setEntries((currentEntries) =>
      currentEntries.filter((candidate) => candidate.id !== entryId),
    );

    if (entry.parsedFile) {
      setParsedFiles(
        parsedFiles.filter(
          (parsedFile) => parsedFile.id !== entry.parsedFile?.id,
        ),
      );
    }
  };

  const parseEntry = async (entry: UploadEntry) => {
    if (!entry.file) {
      return entry;
    }

    setCurrentFileName(entry.filename);
    try {
      const data = await parse(entry.file);
      const parsedFile: ParsedFile = {
        id: entry.id,
        filename: entry.filename,
        data,
      };

      return {
        ...entry,
        parsedFile,
        error: null,
      };
    } catch (error) {
      return {
        ...entry,
        error:
          error instanceof Error
            ? error.message
            : "The deck could not be parsed.",
      };
    } finally {
      setCurrentFileName(null);
    }
  };

  const handleContinue = async () => {
    if (readyToParseEntries.length === 0) {
      if (failedEntries.length > 0) {
        toast.error("Remove or retry the failed decks before continuing.");
        return;
      }

      if (parsedFiles.length === 0) {
        toast.error("Add at least one .apkg file before continuing.");
        return;
      }

      navigateToStep(3);
      return;
    }

    const nextEntries: UploadEntry[] = [];
    for (const entry of entries) {
      if (entry.file && !entry.parsedFile && !entry.error) {
        nextEntries.push(await parseEntry(entry));
      } else {
        nextEntries.push(entry);
      }
    }

    setEntries(nextEntries);
    const nextParsedFiles = nextEntries
      .map((entry) => entry.parsedFile)
      .filter((entry): entry is ParsedFile => Boolean(entry));
    setParsedFiles(nextParsedFiles);

    const nextFailedEntries = nextEntries.filter((entry) => entry.error);
    if (nextParsedFiles.length === 0) {
      toast.error(
        "No decks could be parsed. Remove the failed files and try again.",
      );
      return;
    }

    if (nextFailedEntries.length > 0) {
      toast.error(
        "Some decks could not be parsed. Remove or retry them before continuing.",
      );
      return;
    }

    navigateToStep(3);
  };

  const hasEntries = entries.length > 0;
  const continueDisabled =
    !hasEntries ||
    parsing ||
    (failedEntries.length > 0 && readyToParseEntries.length === 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ─────────── Anki export guide ─────────── */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="!max-w-3xl">
          <DialogHeader>
            <DialogTitle>Before you upload</DialogTitle>
            <DialogDescription>
              Please make sure your export matches the submission requirements
              before continuing to the deck upload step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-3 text-sm leading-7">
                <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
                    1
                  </div>
                  <p>Open the deck browser for the deck you want to share.</p>
                </div>

                <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                    2
                  </div>
                  <p>
                    On mobile, press and hold the deck. On desktop, click the
                    cog next to the deck. Then choose <Kbd>Export</Kbd>.
                  </p>
                </div>

                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
                    3
                  </div>
                  <div className="space-y-2">
                    <p>
                      Export as <Kbd>.apkg</Kbd>. The following options must all
                      be checked:
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>
                        <span className="font-medium text-foreground">
                          Include scheduling information
                        </span>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Include deck presets
                        </span>
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Support older Anki versions
                        </span>
                      </li>
                    </ul>
                    <p>Media is not needed for this study.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                <Image
                  src="/anki_export.png"
                  alt="Anki export screenshot"
                  width={400}
                  height={180}
                  className="mx-auto h-auto w-full max-w-[26rem] rounded-2xl"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => setGuideOpen(false)}>
                Close guide
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─────────── Upload section ─────────── */}
      <QuestionCard className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Upload Anki decks
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Add one or more <Kbd>.apkg</Kbd> files. Parsing happens only after
              you choose to continue, and no deck content leaves the browser at
              this step.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setGuideOpen(true)}
          >
            <Info className="mr-2 h-4 w-4" />
            Open export guide
          </Button>
        </div>

        <div
          role="button"
          tabIndex={0}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition outline-none hover:border-primary/40 hover:bg-primary/5 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDragActive && "border-primary bg-primary/5",
          )}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={handleUploadKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload
            className={cn(
              "mb-4 h-7 w-7 text-muted-foreground transition-colors",
              isDragActive && "text-primary",
            )}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Drag and drop or choose <Kbd>.apkg</Kbd> files
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Multiple files are allowed.
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".apkg"
          multiple
          className="sr-only"
          onChange={handleInputChange}
        />
      </QuestionCard>

      {/* ─────────── Overview of queued, parsed, and failed deck entries ─────────── */}
      {hasEntries ? (
        <QuestionCard className="flex flex-col gap-3">
          <h2 className="text-base font-medium">Selected files</h2>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex flex-col gap-3 rounded-[8px] border px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                entry.parsedFile && "border-primary/20 bg-primary/5",
                entry.error && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full border border-border bg-background p-2">
                  {entry.parsedFile ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <FileArchive className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{entry.filename}</p>
                  {entry.parsedFile ? (
                    <p className="text-sm text-muted-foreground">
                      Parsed successfully.
                    </p>
                  ) : entry.error ? (
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{entry.error}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ready to parse on continue.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {entry.file && entry.error ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const nextEntry = await parseEntry({
                        ...entry,
                        error: null,
                      });
                      const nextEntries = entries.map((currentEntry) =>
                        currentEntry.id === entry.id ? nextEntry : currentEntry,
                      );
                      setEntries(nextEntries);
                      setParsedFiles(
                        nextEntries
                          .map((currentEntry) => currentEntry.parsedFile)
                          .filter((parsedFile): parsedFile is ParsedFile =>
                            Boolean(parsedFile),
                          ),
                      );
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </QuestionCard>
      ) : null}

      {/* ─────────── Overview of blocking validation issues ─────────── */}
      {failedEntries.length > 0 ? (
        <QuestionCard className="border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Resolve failed decks before continuing. Remove them or upload a
          corrected file.
        </QuestionCard>
      ) : null}

      {/* ─────────── Summarizing the decks that are ready for later steps ─────────── */}
      {parsedFiles.length > 0 ? (
        <QuestionCard className="bg-muted/20 text-sm text-muted-foreground">
          You uploaded {directDeckCount.toLocaleString()} decks with{" "}
          {noteCount.toLocaleString()} notes and {reviewCount.toLocaleString()}{" "}
          reviews.
        </QuestionCard>
      ) : null}

      {/* ─────────── Showing parsing progress while deck processing runs ─────────── */}
      {parsing && currentFileName ? (
        <QuestionCard className="text-sm text-muted-foreground">
          <InlineSpinner label={`Parsing ${currentFileName}...`} />
        </QuestionCard>
      ) : null}

      {/* ─────────── Navigation ─────────── */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigateToStep(1)}
          disabled={parsing}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={continueDisabled}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Continue
        </Button>
      </div>
    </div>
  );
}
