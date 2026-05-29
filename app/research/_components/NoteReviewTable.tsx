"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Info,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SPECIAL_CATEGORY_LABELS } from "@/lib/constants";
import {
  buildDeckNoteReviewRows,
  type NoteReviewRow,
  type SubmissionIndex,
} from "@/lib/research";
import type { DeckScanResult, FieldPiiMatch } from "@/lib/types";
import { cn } from "@/lib/utils";

const NOTE_TEXT_PREVIEW_LIMIT = 120;
const NOTES_PER_PAGE = 12;

interface NoteReviewTableProps {
  deckId: number;
  deckName: string;
  index: SubmissionIndex;
  excludedNoteIds: Set<number>;
  deckScan?: DeckScanResult;
  onSetNoteIncluded: (noteId: number, included: boolean) => void;
}

interface NoteFieldView {
  fieldIndex: number;
  label: string;
  text: string;
  ranges: Array<{ startIndex: number; endIndex: number }>;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: string) {
  return stripHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFuzzyToken(text: string, token: string) {
  if (!token) {
    return 0;
  }

  const directIndex = text.indexOf(token);
  if (directIndex >= 0) {
    return 1000 - Math.min(directIndex, 500);
  }

  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  let contiguous = 0;
  let bestContiguous = 0;
  let gapPenalty = 0;

  for (let textIndex = 0; textIndex < text.length; textIndex += 1) {
    if (text[textIndex] !== token[queryIndex]) {
      continue;
    }

    if (firstMatch === -1) {
      firstMatch = textIndex;
      contiguous = 1;
    } else {
      gapPenalty += Math.max(0, textIndex - lastMatch - 1);
      contiguous = textIndex === lastMatch + 1 ? contiguous + 1 : 1;
    }

    bestContiguous = Math.max(bestContiguous, contiguous);
    lastMatch = textIndex;
    queryIndex += 1;

    if (queryIndex === token.length) {
      return 200 - gapPenalty + bestContiguous * 12 - Math.max(0, firstMatch);
    }
  }

  return -1;
}

function scoreSearch(text: string, query: string) {
  const normalizedText = normalizeSearchText(text);
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);

  if (tokens.length === 0) {
    return 0;
  }

  let total = 0;

  for (const token of tokens) {
    const tokenScore = scoreFuzzyToken(normalizedText, token);
    if (tokenScore < 0) {
      return -1;
    }
    total += tokenScore;
  }

  return total;
}

function highlightText(
  text: string,
  ranges: Array<{ startIndex: number; endIndex: number }>,
) {
  if (ranges.length === 0 || !text) {
    return text;
  }

  const fragments: React.ReactNode[] = [];
  const orderedRanges = [...ranges].sort(
    (left, right) => left.startIndex - right.startIndex,
  );
  let currentIndex = 0;

  orderedRanges.forEach((range, index) => {
    if (range.startIndex > currentIndex) {
      fragments.push(text.slice(currentIndex, range.startIndex));
    }

    fragments.push(
      <mark
        key={`${range.startIndex}-${range.endIndex}-${index}`}
        className="rounded bg-orange-100 px-0.5 text-orange-900"
      >
        {text.slice(range.startIndex, range.endIndex)}
      </mark>,
    );
    currentIndex = range.endIndex;
  });

  if (currentIndex < text.length) {
    fragments.push(text.slice(currentIndex));
  }

  return fragments;
}

function truncateTextWithRanges(
  text: string,
  ranges: Array<{ startIndex: number; endIndex: number }>,
  limit: number,
) {
  if (text.length <= limit) {
    return { text, ranges };
  }

  return {
    text: `${text.slice(0, limit).trimEnd()}…`,
    ranges: ranges
      .filter((range) => range.startIndex < limit)
      .map((range) => ({
        startIndex: range.startIndex,
        endIndex: Math.min(range.endIndex, limit),
      }))
      .filter((range) => range.endIndex > range.startIndex),
  };
}

function getFieldRanges(fieldIndex: number, matches: FieldPiiMatch[]) {
  return matches
    .filter((match) => match.fieldIndex === fieldIndex)
    .map((match) => ({
      startIndex: match.startIndex,
      endIndex: match.endIndex,
    }));
}

function ratingLabel(rating: number) {
  switch (rating) {
    case 1:
      return "Again";
    case 2:
      return "Hard";
    case 3:
      return "Good";
    case 4:
      return "Easy";
    default:
      return `Rating ${rating}`;
  }
}

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 1) {
    return [1];
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const orderedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const items: Array<number | string> = [];

  orderedPages.forEach((page, index) => {
    const previousPage = orderedPages[index - 1];
    if (previousPage && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}-${page}`);
    }
    items.push(page);
  });

  return items;
}

function buildSearchCorpus(row: NoteReviewRow) {
  return [
    row.note.note_id,
    ...row.note.fields.map((field) => stripHtml(field)),
    ...row.allCards.map((card) => card.card_id),
  ].join(" ");
}

function buildNoteFieldViews(row: NoteReviewRow): NoteFieldView[] {
  return row.note.fields.map((field, fieldIndex) => ({
    fieldIndex,
    label:
      row.model?.field_names[fieldIndex] ??
      (fieldIndex === 0
        ? "Front"
        : fieldIndex === 1
          ? "Back"
          : `Field ${fieldIndex + 1}`),
    text: stripHtml(field),
    ranges: getFieldRanges(fieldIndex, row.fieldMatches),
  }));
}

function findScrollableParent(element: HTMLElement | null) {
  let currentElement = element?.parentElement ?? null;

  while (currentElement) {
    const overflowY = window.getComputedStyle(currentElement).overflowY;
    const canScroll =
      overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

    if (
      canScroll &&
      currentElement.scrollHeight > currentElement.clientHeight
    ) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}

function BatchActionControl({
  onChange,
  disabled,
}: {
  onChange: (included: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-background shadow-xs">
      <button
        type="button"
        className="h-[30px] px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        onClick={() => onChange(true)}
        disabled={disabled}
      >
        Include
      </button>
      <span className="px-0.5 text-sm text-muted-foreground">/</span>
      <button
        type="button"
        className="h-[30px] px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        onClick={() => onChange(false)}
        disabled={disabled}
      >
        Exclude
      </button>
    </div>
  );
}

function SelectionToggleControl({
  included,
  onChange,
  className,
}: {
  included: boolean;
  onChange: (included: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-background shadow-xs",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={included}
        className={cn(
          "h-[30px] px-3 text-sm font-medium transition",
          included
            ? "bg-green-100 text-green-800 hover:bg-green-100"
            : "text-muted-foreground hover:bg-muted",
        )}
        onClick={() => onChange(true)}
      >
        Include
      </button>
      <span className="px-0.5 text-sm text-muted-foreground">/</span>
      <button
        type="button"
        aria-pressed={!included}
        className={cn(
          "h-[30px] px-3 text-sm font-medium transition",
          !included
            ? "bg-red-100 text-red-800 hover:bg-red-100"
            : "text-muted-foreground hover:bg-muted",
        )}
        onClick={() => onChange(false)}
      >
        Exclude
      </button>
    </div>
  );
}

export function NoteReviewTable({
  deckId,
  deckName,
  index,
  excludedNoteIds,
  deckScan,
  onSetNoteIncluded,
}: NoteReviewTableProps) {
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const tableAreaRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => buildDeckNoteReviewRows(index, deckId, excludedNoteIds, deckScan),
    [deckId, deckScan, excludedNoteIds, index],
  );
  const flaggedNoteCount = rows.filter((row) => row.isFlagged).length;

  const baseRows = useMemo(
    () => (showFlaggedOnly ? rows.filter((row) => row.isFlagged) : rows),
    [rows, showFlaggedOnly],
  );

  const filteredRows = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      return baseRows;
    }

    return baseRows
      .map((row) => {
        const score = scoreSearch(buildSearchCorpus(row), trimmedQuery);
        return score >= 0 ? { row, score } : null;
      })
      .filter(
        (entry): entry is { row: NoteReviewRow; score: number } =>
          entry !== null,
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (left.row.isFlagged !== right.row.isFlagged) {
          return left.row.isFlagged ? -1 : 1;
        }

        return left.row.note.note_id - right.row.note.note_id;
      })
      .map((entry) => entry.row);
  }, [baseRows, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / NOTES_PER_PAGE),
  );
  const pageStartIndex = (currentPage - 1) * NOTES_PER_PAGE;
  const paginatedRows = filteredRows.slice(
    pageStartIndex,
    pageStartIndex + NOTES_PER_PAGE,
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [deckId, searchQuery, showFlaggedOnly]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const scrollTableAreaToTop = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    findScrollableParent(tableAreaRef.current)?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  const goToPage = (nextPage: number) => {
    if (nextPage === currentPage) {
      return;
    }

    setCurrentPage(nextPage);
    requestAnimationFrame(scrollTableAreaToTop);
  };

  const applyFlaggedAction = (included: boolean) => {
    for (const row of rows) {
      if (row.isFlagged) {
        onSetNoteIncluded(row.note.note_id, included);
      }
    }
  };

  const renderSummaryBadges = (row: NoteReviewRow) => (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {row.isFlagged ? (
        <Badge
          variant="outline"
          className="gap-1 border-orange-300 bg-orange-50 text-orange-800"
        >
          <AlertTriangle className="h-3 w-3" />
          Warning
        </Badge>
      ) : null}
      {row.specialCategories.map((category) => (
        <Badge
          key={`${row.note.note_id}-${category}`}
          variant="outline"
          className="border-orange-300 bg-orange-50 text-orange-800"
        >
          {SPECIAL_CATEGORY_LABELS[category]}
        </Badge>
      ))}
      {row.isExcluded ? (
        <Badge
          variant="outline"
          className="border-border text-muted-foreground"
        >
          Excluded
        </Badge>
      ) : null}
    </div>
  );

  const renderExpandedContent = (row: NoteReviewRow) => {
    const noteFields = buildNoteFieldViews(row);
    const frontField = noteFields[0] ?? {
      fieldIndex: 0,
      label: "Front",
      text: "",
      ranges: [],
    };
    const backField = noteFields[1] ?? {
      fieldIndex: 1,
      label: "Back",
      text: "",
      ranges: [],
    };
    const additionalFields = noteFields.slice(2);
    const hasCrossDeckCards = row.allCards.some(
      (card) => card.deck_id !== deckId,
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{deckName}</Badge>
          <Badge variant="outline">Note ID: {row.note.note_id}</Badge>
          <Badge variant="outline">
            {row.allCards.length} generated card
            {row.allCards.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">
            {row.totalReviewCount} review{row.totalReviewCount === 1 ? "" : "s"}
          </Badge>
          {row.specialCategories.map((category) => (
            <Badge
              key={`${row.note.note_id}-detail-${category}`}
              variant="outline"
              className="border-orange-300 bg-orange-50 text-orange-800"
            >
              Sensitive: {SPECIAL_CATEGORY_LABELS[category]}
            </Badge>
          ))}
        </div>

        {row.isExcluded ? (
          <div className="rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            This note is excluded. Excluding it also excludes every card
            generated from it and all related review logs.
          </div>
        ) : null}

        {hasCrossDeckCards ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            This note also generates cards in other decks. Excluding it here
            will remove those cards and their review logs too.
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,0.95fr)]">
          <div className="rounded-xl border bg-background px-3 py-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {frontField.label}
            </div>
            <div className="whitespace-normal break-words text-sm leading-6 text-foreground">
              {highlightText(frontField.text, frontField.ranges)}
            </div>
          </div>

          <div className="rounded-xl border bg-background px-3 py-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {backField.label}
            </div>
            <div className="whitespace-normal break-words text-sm leading-6 text-foreground">
              {highlightText(backField.text, backField.ranges)}
            </div>
          </div>

          <div className="rounded-xl border bg-background px-3 py-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Summary
            </div>
            {row.totalReviewCount === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <EyeOff className="h-4 w-4" />
                No reviews were found for this note.
              </div>
            ) : (
              <dl className="grid gap-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Latest activity</dt>
                  <dd className="text-right">
                    {row.latestReview
                      ? `${ratingLabel(row.latestReview.rating)} • ${new Date(
                          row.latestReview.timestamp_ms,
                        ).toLocaleString()}`
                      : "Unknown"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Total reviews</dt>
                  <dd>{row.totalReviewCount}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Cards in this deck</dt>
                  <dd>{row.deckCards.length}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">
                    Cards across all decks
                  </dt>
                  <dd>{row.allCards.length}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>

        {additionalFields.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {additionalFields.map((field) => (
              <div
                key={`${row.note.note_id}-field-${field.fieldIndex}`}
                className="rounded-xl border bg-background px-3 py-3"
              >
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {field.label}
                </div>
                <div className="whitespace-normal break-words text-sm leading-6 text-foreground">
                  {highlightText(field.text, field.ranges)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const showingFrom = filteredRows.length === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(
    pageStartIndex + NOTES_PER_PAGE,
    filteredRows.length,
  );

  return (
    <div ref={tableAreaRef} className="space-y-4">
      <div className="rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p>
              In Anki, cards are generated from notes. If you usually think in
              cards, treat each note here as the shared content behind one or
              more cards.
            </p>
            <p className="text-sm text-muted-foreground">
              Excluding any note removes all cards generated from it and all
              related review logs, even if some of those cards appear in another
              deck.
            </p>
          </div>
        </div>
      </div>

      {flaggedNoteCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {flaggedNoteCount} warning note{flaggedNoteCount === 1 ? "" : "s"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-orange-700 hover:bg-orange-100 hover:text-orange-800"
              onClick={() => setWarningDialogOpen(true)}
              aria-label="How warnings work"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BatchActionControl
              onChange={(included) => applyFlaggedAction(included)}
              disabled={flaggedNoteCount === 0}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={showFlaggedOnly}
              onClick={() => setShowFlaggedOnly((current) => !current)}
              className={cn(
                "transition-colors",
                showFlaggedOnly &&
                  "border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-100 hover:text-orange-800",
              )}
            >
              {showFlaggedOnly ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              <span>Show warnings only</span>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by note ID, note text, or generated card ID"
            className="pl-9 pr-10"
            aria-label="Search notes by id, note text, or generated card id"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Fuzzy search runs across note IDs, note text, and generated card
            IDs.
          </span>
          <span>
            {filteredRows.length} matching note
            {filteredRows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {searchQuery.trim()
            ? "No notes match the current search."
            : "No notes match the current review filter."}
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {paginatedRows.map((row) => {
              const front = stripHtml(row.note.fields[0] ?? "");
              const back = stripHtml(row.note.fields[1] ?? "");
              const frontPreview = truncateTextWithRanges(
                front,
                getFieldRanges(0, row.fieldMatches),
                NOTE_TEXT_PREVIEW_LIMIT,
              );
              const backPreview = truncateTextWithRanges(
                back,
                getFieldRanges(1, row.fieldMatches),
                NOTE_TEXT_PREVIEW_LIMIT,
              );
              const isExpanded = expandedNoteId === row.note.note_id;

              return (
                <div
                  key={row.note.note_id}
                  className={cn(
                    "rounded-2xl border border-border/80 bg-background p-4",
                    row.isExcluded && "opacity-70",
                    row.isFlagged && "border-orange-200 bg-orange-50/60",
                    isExpanded && "ring-1 ring-primary/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {renderSummaryBadges(row)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() =>
                        setExpandedNoteId((current) =>
                          current === row.note.note_id
                            ? null
                            : row.note.note_id,
                        )
                      }
                      aria-label={`Toggle details for note ${row.note.note_id}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Front
                      </div>
                      <div className="text-sm leading-6 text-foreground">
                        {highlightText(frontPreview.text, frontPreview.ranges)}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Back
                      </div>
                      <div className="text-sm leading-6 text-muted-foreground">
                        {highlightText(backPreview.text, backPreview.ranges)}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {row.deckCards.length} card
                      {row.deckCards.length === 1 ? "" : "s"} in this deck
                      {row.allCards.length !== row.deckCards.length
                        ? ` • ${row.allCards.length} total generated cards`
                        : ""}
                      {row.totalReviewCount > 0
                        ? ` • ${row.totalReviewCount} review${row.totalReviewCount === 1 ? "" : "s"}`
                        : ""}
                    </div>

                    <div className="flex justify-end">
                      <SelectionToggleControl
                        included={!row.isExcluded}
                        onChange={(included) =>
                          onSetNoteIncluded(row.note.note_id, included)
                        }
                      />
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-4 border-t border-primary/15 pt-4">
                      {renderExpandedContent(row)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border/80 md:block">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[3.5rem]" />
                <col className="w-[36%]" />
                <col className="w-[36%]" />
                <col className="w-[11rem]" />
              </colgroup>
              <TableHeader className="bg-muted/20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2">
                    <span className="sr-only">Expand</span>
                  </TableHead>
                  <TableHead className="whitespace-normal px-4">
                    Front
                  </TableHead>
                  <TableHead className="whitespace-normal px-4">Back</TableHead>
                  <TableHead className="px-4 text-center whitespace-normal">
                    Review
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.flatMap((row) => {
                  const front = stripHtml(row.note.fields[0] ?? "");
                  const back = stripHtml(row.note.fields[1] ?? "");
                  const frontPreview = truncateTextWithRanges(
                    front,
                    getFieldRanges(0, row.fieldMatches),
                    NOTE_TEXT_PREVIEW_LIMIT,
                  );
                  const backPreview = truncateTextWithRanges(
                    back,
                    getFieldRanges(1, row.fieldMatches),
                    NOTE_TEXT_PREVIEW_LIMIT,
                  );
                  const isExpanded = expandedNoteId === row.note.note_id;

                  return [
                    <TableRow
                      key={`${row.note.note_id}-summary`}
                      className={cn(
                        "align-top",
                        row.isExcluded && "opacity-60",
                        row.isFlagged && "bg-orange-50/70",
                        isExpanded && "bg-primary/[0.04] border-primary/20",
                      )}
                    >
                      <TableCell
                        className={cn(
                          "px-2 py-3 align-top",
                          isExpanded &&
                            "border-l border-t border-primary/20 bg-primary/[0.025]",
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 h-7 w-7 shrink-0"
                          onClick={() =>
                            setExpandedNoteId((current) =>
                              current === row.note.note_id
                                ? null
                                : row.note.note_id,
                            )
                          }
                          aria-label={`Toggle details for note ${row.note.note_id}`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>

                      <TableCell
                        className={cn(
                          "whitespace-normal break-words px-4 py-3 align-top",
                          isExpanded &&
                            "border-t border-primary/20 bg-primary/[0.025]",
                        )}
                      >
                        {renderSummaryBadges(row)}
                        <div className="text-sm leading-6 text-foreground">
                          {highlightText(
                            frontPreview.text,
                            frontPreview.ranges,
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {row.deckCards.length} card
                          {row.deckCards.length === 1 ? "" : "s"} in this deck
                          {row.allCards.length !== row.deckCards.length
                            ? ` • ${row.allCards.length} total generated cards`
                            : ""}
                          {row.totalReviewCount > 0
                            ? ` • ${row.totalReviewCount} review${row.totalReviewCount === 1 ? "" : "s"}`
                            : ""}
                        </div>
                      </TableCell>

                      <TableCell
                        className={cn(
                          "whitespace-normal break-words px-4 py-3 align-top",
                          isExpanded &&
                            "border-t border-primary/20 bg-primary/[0.025]",
                        )}
                      >
                        <div className="text-sm leading-6 text-muted-foreground">
                          {highlightText(backPreview.text, backPreview.ranges)}
                        </div>
                      </TableCell>

                      <TableCell
                        className={cn(
                          "px-4 py-3 text-center align-top whitespace-normal",
                          isExpanded &&
                            "border-r border-t border-primary/20 bg-primary/[0.025]",
                        )}
                      >
                        <div className="flex justify-center pt-1">
                          <SelectionToggleControl
                            included={!row.isExcluded}
                            onChange={(included) =>
                              onSetNoteIncluded(row.note.note_id, included)
                            }
                            className="scale-90 origin-center"
                          />
                        </div>
                      </TableCell>
                    </TableRow>,
                    isExpanded ? (
                      <TableRow
                        key={`${row.note.note_id}-details`}
                        className="bg-primary/[0.025] hover:bg-primary/[0.025]"
                      >
                        <TableCell
                          colSpan={4}
                          className="whitespace-normal border-x border-b border-primary/20 px-4 py-4"
                        >
                          {renderExpandedContent(row)}
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ];
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {showingFrom}-{showingTo} of {filteredRows.length} note
              {filteredRows.length === 1 ? "" : "s"}
            </div>

            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={currentPage === 1}
                    className={cn(
                      currentPage === 1 && "pointer-events-none opacity-50",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage > 1) {
                        goToPage(currentPage - 1);
                      }
                    }}
                  />
                </PaginationItem>

                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === currentPage}
                        onClick={(event) => {
                          event.preventDefault();
                          goToPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={currentPage === totalPages}
                    className={cn(
                      currentPage === totalPages &&
                        "pointer-events-none opacity-50",
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage < totalPages) {
                        goToPage(currentPage + 1);
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}

      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How warnings work</DialogTitle>
            <DialogDescription>
              Warnings come from an automatic scan before upload. It looks for
              emails, phone numbers, long digit strings, URLs, names, and
              sensitive health, political, or religious terms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Warnings are only prompts for review. They do not exclude anything
              automatically.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
