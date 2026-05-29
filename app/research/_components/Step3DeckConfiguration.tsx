"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Languages,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

import { DeckConfigDrawer } from "@/app/research/_components/DeckConfigDrawer";
import { NoteReviewTable } from "@/app/research/_components/NoteReviewTable";
import { QuestionCard } from "@/app/research/_components/QuestionCard";
import { TagsTable } from "@/app/research/_components/TagsTable";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LANGUAGE_OPTIONS,
  SCHEDULER_OPTIONS,
  SKIP_LANGUAGE_VALUE,
  type LanguageCode,
  type SchedulerKind,
} from "@/lib/constants";
import { useResearchSubmissionWizard } from "@/lib/hooks/useResearchSubmissionWizard";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import {
  buildDeckTags,
  buildSubmissionIndex,
  computeDeckReviewStats,
} from "@/lib/research";
import type { DeckAssignment, DeckAssignmentRecord } from "@/lib/types";
import { usePiiScanner } from "@/lib/hooks/usePiiScanner";
import { cn } from "@/lib/utils";

const UNSPECIFIED_LANGUAGE_LABEL = "Unspecified";

function createDefaultAssignment(): DeckAssignment {
  return {
    target_language: null,
    scheduler: null,
  };
}

export function Step3DeckConfiguration() {
  const parsedFiles = useSubmissionStore((state) => state.draft.parsedFiles);
  const userProfile = useSubmissionStore((state) => state.draft.userProfile);
  const defaultAssignments = useSubmissionStore(
    (state) => state.draft.deckAssignments,
  );
  const deckReviewConfigs = useSubmissionStore(
    (state) => state.draft.deckReviewConfigs,
  );
  const excludedNoteIds = useSubmissionStore(
    (state) => state.draft.excludedNoteIds,
  );
  const setDeckAssignments = useSubmissionStore(
    (state) => state.setDeckAssignments,
  );
  const setNoteIncluded = useSubmissionStore((state) => state.setNoteIncluded);
  const setDeckTagRetained = useSubmissionStore(
    (state) => state.setDeckTagRetained,
  );
  const { navigateToStep } = useResearchSubmissionWizard();
  const [assignments, setAssignments] =
    useState<DeckAssignmentRecord>(defaultAssignments);
  const [bulkLanguage, setBulkLanguage] = useState<LanguageCode | "">("");
  const [bulkScheduler, setBulkScheduler] = useState<SchedulerKind | "">("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);
  const index = useMemo(() => buildSubmissionIndex(parsedFiles), [parsedFiles]);
  const { scans } = usePiiScanner(parsedFiles);
  const activeDeck = activeDeckId
    ? (index.deckMap.get(activeDeckId) ?? null)
    : null;
  const activeReviewStats = activeDeck
    ? computeDeckReviewStats(index, excludedNoteIds, activeDeck.deck_id)
    : null;

  const targetLanguageOptions = userProfile.target_languages.map((language) => {
    const option = LANGUAGE_OPTIONS.find((item) => item.code === language.lang);
    return {
      value: language.lang,
      label: option?.name ?? language.lang,
    };
  });

  const targetLanguageLabels = new Map(
    targetLanguageOptions.map((language) => [language.value, language.label]),
  );

  useEffect(() => {
    setAssignments(defaultAssignments);
    setBulkLanguage("");
    setBulkScheduler("");
  }, [defaultAssignments]);

  const setDeckLanguage = (deckId: number, value: LanguageCode | null) => {
    setAssignments((currentAssignments) => {
      const key = String(deckId);
      const currentAssignment =
        currentAssignments[key] ?? createDefaultAssignment();

      return {
        ...currentAssignments,
        [key]: {
          ...currentAssignment,
          target_language: value,
        },
      };
    });
  };

  const setDeckScheduler = (deckId: number, value: SchedulerKind) => {
    setAssignments((currentAssignments) => {
      const key = String(deckId);
      const currentAssignment =
        currentAssignments[key] ?? createDefaultAssignment();

      return {
        ...currentAssignments,
        [key]: {
          ...currentAssignment,
          scheduler: value,
        },
      };
    });
  };

  const applyLanguageToAllDecks = () => {
    if (!bulkLanguage) {
      return;
    }

    setAssignments(
      index.directDecks.reduce<DeckAssignmentRecord>(
        (nextAssignments, deck) => {
          const key = String(deck.deck_id);
          const currentAssignment =
            nextAssignments[key] ?? createDefaultAssignment();
          nextAssignments[key] = {
            ...currentAssignment,
            target_language: bulkLanguage,
          };
          return nextAssignments;
        },
        { ...assignments },
      ),
    );
  };

  const applySchedulerToAllDecks = () => {
    if (!bulkScheduler) {
      return;
    }

    setAssignments(
      index.directDecks.reduce<DeckAssignmentRecord>(
        (nextAssignments, deck) => {
          const key = String(deck.deck_id);
          const currentAssignment =
            nextAssignments[key] ?? createDefaultAssignment();
          nextAssignments[key] = {
            ...currentAssignment,
            scheduler: bulkScheduler,
          };
          return nextAssignments;
        },
        { ...assignments },
      ),
    );
  };

  const missingSchedulerCount = index.directDecks.filter(
    (deck) => !assignments[String(deck.deck_id)]?.scheduler,
  ).length;

  const activeLanguageLabel = activeDeck
    ? (() => {
        const assignment =
          assignments[String(activeDeck.deck_id)]?.target_language;
        if (!assignment) {
          return UNSPECIFIED_LANGUAGE_LABEL;
        }

        return targetLanguageLabels.get(assignment) ?? assignment;
      })()
    : UNSPECIFIED_LANGUAGE_LABEL;
  const activeSchedulerLabel = activeDeck
    ? (assignments[String(activeDeck.deck_id)]?.scheduler ??
      "No scheduler selected")
    : "No scheduler selected";

  return (
    <div className="flex flex-col gap-4">
      {/* ─────────── Explaining what must be configured before privacy review ─────────── */}
      <QuestionCard className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Configure decks
        </h2>
        <p className="max-w-2xl text-sm leading-6">
          Set a language and scheduler for each deck, then open privacy settings
          for decks you want to review in detail.
        </p>
        <p className="max-w-2xl text-sm leading-6">
          If you have not changed the Anki scheduler, use SM2 (default). FSRS is
          only needed for decks that use the newer FSRS scheduler. You can read
          more about the difference between the two{" "}
          <a
            href="https://www.reddit.com/r/Anki/comments/10ajq3t/what_are_the_main_differences_between_sm2_and_fsrs/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-medium text-(--survey-header-strong) underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            here
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          .
        </p>
      </QuestionCard>

      {/* ─────────── Warning against uploading sensitive or confidential card content ─────────── */}
      <div className="flex items-start gap-3 rounded-[12px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 shadow-sm">
        <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Please do not include confidential, medical, financial, or other
          sensitive personal information in submitted cards.
        </p>
      </div>

      {/* ─────────── Listing uploaded decks and offering bulk assignment shortcuts (can it be called "shortcuts"?) ─────────── */}
      <QuestionCard className="p-0">
        <Collapsible
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          className="flex flex-col"
        >
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Deck list
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                These are the decks found in your upload. Set the language and
                scheduler on each row before continuing.
              </p>
            </div>
            {index.directDecks.length > 0 ? (
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="shrink-0">
                  Optional shortcuts
                  <ChevronDown
                    className={cn(
                      "ml-2 h-4 w-4 transition-transform duration-200",
                      shortcutsOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </CollapsibleTrigger>
            ) : null}
          </div>

          {index.directDecks.length > 0 ? (
            <CollapsibleContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="rounded-xl border border-dashed border-(--survey-card-border) bg-(--survey-accent-bg) p-4">
                <div className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                  <CircleHelp className="mt-1 h-4 w-4 shrink-0 text-(--survey-header-strong)" />
                  <p>
                    Optional: apply one language or scheduler to every deck
                    below. You can still adjust individual rows afterward.
                  </p>
                </div>

                <div className="mt-4 grid gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="apply-language-to-all">Language</Label>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Select
                        value={bulkLanguage}
                        onValueChange={(value) =>
                          setBulkLanguage(value as LanguageCode)
                        }
                      >
                        <SelectTrigger
                          id="apply-language-to-all"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetLanguageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyLanguageToAllDecks}
                        disabled={!bulkLanguage}
                      >
                        <Languages className="mr-2 h-4 w-4" />
                        Apply to all
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="apply-scheduler-to-all">Scheduler</Label>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Select
                        value={bulkScheduler || undefined}
                        onValueChange={(value) =>
                          setBulkScheduler(value as SchedulerKind)
                        }
                      >
                        <SelectTrigger
                          id="apply-scheduler-to-all"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select scheduler" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULER_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applySchedulerToAllDecks}
                        disabled={!bulkScheduler}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Apply to all
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          ) : null}
        </Collapsible>

        {/* ─────────── Showing either the empty state or one configuration row per deck ─────────── */}
        {index.directDecks.length === 0 ? (
          <div className="border-t border-border/80 px-5 py-6 text-sm text-muted-foreground sm:px-6">
            No direct-card decks were found in the uploaded files.
          </div>
        ) : (
          <ul className="divide-y divide-border/80 border-t border-border/80">
            {index.directDecks.map((deck, deckIndex) => {
              const reviewStats = computeDeckReviewStats(
                index,
                excludedNoteIds,
                deck.deck_id,
              );
              const assignment = assignments[String(deck.deck_id)];

              return (
                <li
                  key={deck.deck_id}
                  className="flex flex-col gap-4 px-5 py-5 sm:px-6"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--survey-card-border) bg-(--survey-accent-bg) text-sm font-semibold text-(--survey-header-strong)"
                      aria-hidden="true"
                    >
                      {deckIndex + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="wrap-break-words text-base font-semibold leading-6 tracking-tight">
                        {deck.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {reviewStats.includedNotes.toLocaleString()} /{" "}
                        {reviewStats.totalNotes.toLocaleString()} notes
                        included, {reviewStats.includedCards.toLocaleString()}{" "}
                        cards
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`deck-language-${deck.deck_id}`}>
                        Deck language
                      </Label>
                      <Select
                        value={
                          assignment?.target_language ?? SKIP_LANGUAGE_VALUE
                        }
                        onValueChange={(value) =>
                          setDeckLanguage(
                            deck.deck_id,
                            value === SKIP_LANGUAGE_VALUE
                              ? null
                              : (value as LanguageCode),
                          )
                        }
                      >
                        <SelectTrigger
                          id={`deck-language-${deck.deck_id}`}
                          className="w-full"
                        >
                          <SelectValue
                            placeholder={UNSPECIFIED_LANGUAGE_LABEL}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP_LANGUAGE_VALUE}>
                            {UNSPECIFIED_LANGUAGE_LABEL}
                          </SelectItem>
                          {targetLanguageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`deck-scheduler-${deck.deck_id}`}>
                        Scheduler
                      </Label>
                      <Select
                        value={assignment?.scheduler ?? undefined}
                        onValueChange={(value) =>
                          setDeckScheduler(deck.deck_id, value as SchedulerKind)
                        }
                      >
                        <SelectTrigger
                          id={`deck-scheduler-${deck.deck_id}`}
                          className="w-full"
                        >
                          <SelectValue placeholder="Scheduler" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHEDULER_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex border-t border-border/80 pt-3 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setActiveDeckId(deck.deck_id)}
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Configure privacy
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QuestionCard>

      {/* ─────────── Blocking progress until every deck has an explicit scheduler ─────────── */}
      {missingSchedulerCount > 0 ? (
        <QuestionCard className="flex items-start gap-3 border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Select a scheduler for {missingSchedulerCount.toLocaleString()} deck
            {missingSchedulerCount === 1 ? "" : "s"} before continuing.
          </div>
        </QuestionCard>
      ) : null}

      {/* ─────────── Opening note and tag privacy controls for the active deck ─────────── */}
      <DeckConfigDrawer
        open={Boolean(activeDeck)}
        deck={activeDeck}
        languageLabel={activeLanguageLabel}
        schedulerLabel={activeSchedulerLabel}
        reviewStats={activeReviewStats}
        onOpenChange={(open) => {
          if (!open) {
            setActiveDeckId(null);
          }
        }}
        noteReviewContent={
          activeDeck ? (
            <NoteReviewTable
              deckId={activeDeck.deck_id}
              deckName={activeDeck.name}
              index={index}
              excludedNoteIds={excludedNoteIds}
              deckScan={scans[activeDeck.deck_id]}
              onSetNoteIncluded={setNoteIncluded}
            />
          ) : null
        }
        tagsContent={
          activeDeck ? (
            <TagsTable
              tags={buildDeckTags(index, activeDeck.deck_id)}
              retainedTags={
                deckReviewConfigs[String(activeDeck.deck_id)]?.retainedTags ??
                new Set()
              }
              onToggleTag={(tag, retained) =>
                setDeckTagRetained(activeDeck.deck_id, tag, retained)
              }
            />
          ) : null
        }
      />

      {/* ─────────── Saving deck assignments and moving to final submission review (basically, typical navigation) ─────────── */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigateToStep(2)}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={() => {
            setDeckAssignments(assignments);
            navigateToStep(4);
          }}
          disabled={missingSchedulerCount > 0}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Continue
        </Button>
      </div>
    </div>
  );
}
