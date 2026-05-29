"use client";

import { Info, RotateCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TagsTableProps {
  tags: string[];
  retainedTags: Set<string>;
  onToggleTag: (tag: string, retained: boolean) => void;
}

export function TagsTable({ tags, retainedTags, onToggleTag }: TagsTableProps) {
  const retainedCount = tags.filter((tag) => retainedTags.has(tag)).length;
  const removedCount = tags.length - retainedCount;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/80 bg-muted/35 p-4 text-sm text-muted-foreground">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Info className="h-4 w-4 text-primary" />
          Tag filtering is applied per deck review context
        </div>
        Removing a tag here excludes that tag from notes attached to this deck
        in the exported JSON. It does not delete the note or remove the card
        from the submission.
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {retainedCount} retained, {removedCount} removed
        </span>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No tags are present on notes in this deck.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const retained = retainedTags.has(tag);
            return (
              <Badge
                key={tag}
                variant={retained ? "secondary" : "outline"}
                className={cn(
                  "max-w-full gap-2 rounded-full px-3 py-1 text-sm font-normal whitespace-normal break-all",
                  !retained && "border-dashed text-muted-foreground",
                )}
              >
                <span>{tag}</span>
                {retained ? (
                  <button
                    type="button"
                    className="rounded-full text-muted-foreground transition hover:text-foreground"
                    aria-label={`Remove ${tag}`}
                    onClick={() => onToggleTag(tag, false)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => onToggleTag(tag, true)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Restore
                  </Button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
