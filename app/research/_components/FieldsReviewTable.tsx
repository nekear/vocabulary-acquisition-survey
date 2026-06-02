"use client";

import { useMemo } from "react";
import { AlertTriangle, Info, RotateCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildDeckModelFieldReviewRows,
  type SubmissionIndex,
} from "@/lib/research";
import type { ModelKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FieldsReviewTableProps {
  deckId: number;
  index: SubmissionIndex;
  excludedFieldsByModelKey: Record<ModelKey, Set<number>>;
  onSetModelFieldIncluded: (
    modelKey: ModelKey,
    fieldIndex: number,
    included: boolean,
  ) => void;
}

export function FieldsReviewTable({
  deckId,
  index,
  excludedFieldsByModelKey,
  onSetModelFieldIncluded,
}: FieldsReviewTableProps) {
  const rows = useMemo(
    () =>
      buildDeckModelFieldReviewRows(
        index,
        deckId,
        excludedFieldsByModelKey,
      ),
    [deckId, excludedFieldsByModelKey, index],
  );
  const totalFieldCount = rows.reduce(
    (total, row) => total + row.fields.length,
    0,
  );
  const removedFieldCount = rows.reduce(
    (total, row) =>
      total + row.fields.filter((field) => field.isExcluded).length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Field removal applies across this note type
        </div>
        Removing a field removes its values from every note using this note
        type across the whole submission, including notes shown in other decks.
        The field name and position are still included so the research can
        account for the cues that were present, but the field content is not
        uploaded.
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {totalFieldCount.toLocaleString()} field
          {totalFieldCount === 1 ? "" : "s"} found,{" "}
          {removedFieldCount.toLocaleString()} removed
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No note type fields are present on cards in this deck.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <section
              key={row.modelKey}
              className="rounded-2xl border border-border/80 bg-background"
            >
              <div className="border-b border-border/80 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold tracking-tight">
                      Note type {row.model.model_id}
                    </h3>
                    {row.duplicateModelIdCount > 1 ? (
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        From {row.model.source_filename}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {row.deckNoteCount.toLocaleString()} deck note
                      {row.deckNoteCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline">
                      {row.submissionNoteCount.toLocaleString()} total note
                      {row.submissionNoteCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border/80">
                {row.fields.map((field) => (
                  <div
                    key={`${row.modelKey}-${field.fieldIndex}`}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                      field.isExcluded && "bg-muted/30",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="break-words text-sm font-medium">
                          {field.fieldName}
                        </div>
                        {field.isExcluded ? (
                          <Badge
                            variant="outline"
                            className="border-dashed text-muted-foreground"
                          >
                            Values removed
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Field position {field.fieldIndex + 1}
                      </div>
                    </div>

                    {field.isExcluded ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onSetModelFieldIncluded(
                            row.modelKey,
                            field.fieldIndex,
                            true,
                          )
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore values
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() =>
                          onSetModelFieldIncluded(
                            row.modelKey,
                            field.fieldIndex,
                            false,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                        Remove values
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
