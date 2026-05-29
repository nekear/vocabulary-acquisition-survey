"use client";

import { type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DeckReviewStats } from "@/lib/research";
import type { ParsedDeck } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DeckConfigDrawerProps {
  open: boolean;
  deck: ParsedDeck | null;
  languageLabel: string;
  schedulerLabel: string;
  reviewStats: DeckReviewStats | null;
  onOpenChange: (open: boolean) => void;
  noteReviewContent: ReactNode;
  tagsContent: ReactNode;
}

function DrawerBody({
  deck,
  languageLabel,
  schedulerLabel,
  reviewStats,
  onClose,
  closeLabel,
  noteReviewContent,
  tagsContent,
}: {
  deck: ParsedDeck;
  languageLabel: string;
  schedulerLabel: string;
  reviewStats: DeckReviewStats | null;
  onClose: () => void;
  closeLabel: ReactNode;
  noteReviewContent: ReactNode;
  tagsContent: ReactNode;
}) {
  return (
    <Tabs
      defaultValue="notes"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b bg-background px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Deck configuration
            </div>
            <h2 className="break-words text-xl font-semibold tracking-tight">
              {deck.name}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {reviewStats ? (
                <span>
                  {reviewStats.totalNotes.toLocaleString()} notes in this deck
                </span>
              ) : null}
              {reviewStats ? (
                <span>
                  {reviewStats.includedNotes} included,{" "}
                  {reviewStats.excludedNotes} excluded
                  {" · "}
                  {reviewStats.includedCards} included cards
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="max-w-full whitespace-normal">
                {languageLabel}
              </Badge>
              <Badge variant="outline" className="max-w-full whitespace-normal">
                {schedulerLabel}
              </Badge>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close configuration panel"
          >
            {closeLabel}
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b bg-background px-5 py-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notes">Note-by-note review</TabsTrigger>
          <TabsTrigger value="tags">Tags review</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="notes"
        className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {noteReviewContent}
      </TabsContent>
      <TabsContent
        value="tags"
        className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
      >
        {tagsContent}
      </TabsContent>
    </Tabs>
  );
}

export function DeckConfigDrawer({
  open,
  deck,
  languageLabel,
  schedulerLabel,
  reviewStats,
  onOpenChange,
  noteReviewContent,
  tagsContent,
}: DeckConfigDrawerProps) {
  if (!deck) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "t-modal is-open left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex flex-col gap-0 overflow-hidden rounded-none border-0 p-0",
          "sm:left-[50%] sm:top-[50%] sm:h-[min(88vh,54rem)] sm:max-h-[min(88vh,54rem)] sm:w-[min(100vw-2rem,64rem)] sm:max-w-[64rem] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{deck.name}</DialogTitle>
        </DialogHeader>
        <DrawerBody
          deck={deck}
          languageLabel={languageLabel}
          schedulerLabel={schedulerLabel}
          reviewStats={reviewStats}
          onClose={() => onOpenChange(false)}
          closeLabel={
            <>
              <ArrowLeft className="h-4 w-4 sm:hidden" />
              <X className="hidden h-4 w-4 sm:block" />
            </>
          }
          noteReviewContent={noteReviewContent}
          tagsContent={tagsContent}
        />
      </DialogContent>
    </Dialog>
  );
}
