"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Link2,
  Link2Off,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { InlineSpinner } from "@/app/research/_components/InlineSpinner";
import { QuestionCard } from "@/app/research/_components/QuestionCard";
import { SearchMultiSelect } from "@/app/research/_components/SearchMultiSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CEFR_LABELS,
  CEFR_LEVELS,
  DOMAIN_INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  type LanguageCode,
  type ProficiencyLevel,
} from "@/lib/constants";
import { useResearchSubmissionWizard } from "@/lib/hooks/useResearchSubmissionWizard";
import { useSubmissionStore } from "@/lib/hooks/useSubmissionStore";
import type { UserProfile } from "@/lib/types";
import { previousTokenSchema, userProfileSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

const linkSchema = z.object({
  previous_token: previousTokenSchema,
});

type LinkFormValues = z.infer<typeof linkSchema>;

function formatLinkedToken(token: string) {
  if (token.length <= 14) {
    return token;
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export function Step1Profile() {
  const defaultValue = useSubmissionStore((state) => state.draft.userProfile);
  const previousToken = useSubmissionStore(
    (state) => state.draft.previousToken,
  );
  const setLinkedProfile = useSubmissionStore(
    (state) => state.setLinkedProfile,
  );
  const setUserProfile = useSubmissionStore((state) => state.setUserProfile);
  const { linkPreviousSubmission, navigateToStep } =
    useResearchSubmissionWizard();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const linked = previousToken.trim().length > 0;

  const {
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
  } = useForm<UserProfile>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: defaultValue,
    mode: "onChange",
  });

  const {
    formState: { errors: linkErrors, isValid: linkIsValid },
    handleSubmit: handleLinkSubmit,
    register: registerLinkField,
    reset: resetLinkForm,
    setError: setLinkError,
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      previous_token: previousToken,
    },
    mode: "onChange",
  });

  useEffect(() => {
    reset(defaultValue);
  }, [defaultValue, reset]);

  useEffect(() => {
    if (linkDialogOpen) {
      resetLinkForm({ previous_token: previousToken });
    }
  }, [linkDialogOpen, previousToken, resetLinkForm]);

  const profileValues = watch();
  const nativeLanguages = profileValues.native_languages ?? [];
  const targetLanguages = profileValues.target_languages ?? [];
  const domainInterests = profileValues.domain_interests ?? [];
  const canContinue = userProfileSchema.safeParse(profileValues).success;

  const handleTargetLanguageSelection = (nextValues: string[]) => {
    const nextTargetLanguages = nextValues.map((value) => {
      const existing = targetLanguages.find(
        (language) => language.lang === value,
      );
      return (
        existing ?? {
          lang: value as LanguageCode,
          proficiency: "Unsure" as ProficiencyLevel,
        }
      );
    });

    setValue("target_languages", nextTargetLanguages, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const removeTargetLanguage = (languageCode: LanguageCode) => {
    setValue(
      "target_languages",
      targetLanguages.filter((language) => language.lang !== languageCode),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
  };

  const submit = handleSubmit((values) => {
    setUserProfile(values);
    navigateToStep(2);
  });

  const submitLink = handleLinkSubmit(async ({ previous_token }) => {
    setLinkSubmitting(true);
    try {
      const linkedProfile = await linkPreviousSubmission(previous_token.trim());
      if (linkedProfile) {
        reset(linkedProfile);
        await trigger();
        toast.success(
          userProfileSchema.safeParse(linkedProfile).success
            ? "Previous profile loaded."
            : "Previous profile loaded. Review the missing fields.",
        );
      } else {
        toast.success("Submission linked. No previous profile was saved.");
      }
      setLinkDialogOpen(false);
    } catch (error) {
      setLinkError("previous_token", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "The linked submission could not be loaded.",
      });
    } finally {
      setLinkSubmitting(false);
    }
  });

  return (
    <>
      {/* ─────────── Linking a new upload to a previous submission token (optional) ─────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="t-modal is-open sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link previous submission</DialogTitle>
            <DialogDescription>
              Enter your withdrawal token to connect this upload to the same
              submitter record and load the latest saved language profile if one
              exists.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={submitLink}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="previous_token">Withdrawal token</Label>
              <Input
                id="previous_token"
                {...registerLinkField("previous_token")}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder="Paste your token"
                aria-invalid={Boolean(linkErrors.previous_token)}
              />
              {linkErrors.previous_token ? (
                <p className="text-sm text-destructive">
                  {linkErrors.previous_token.message}
                </p>
              ) : null}
            </div>

            {linkSubmitting ? (
              <div className="rounded-2xl border border-border/80 px-4 py-3 text-sm text-muted-foreground">
                <InlineSpinner label="Looking up previous submission..." />
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLinkDialogOpen(false)}
                disabled={linkSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={linkSubmitting || !linkIsValid}>
                <Link2 className="mr-2 h-4 w-4" />
                Link submission
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────── Collecting the language profile required for interpretation ─────────── */}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* ─────────── Showing whether this submission is linked to an earlier one ─────────── */}
        <QuestionCard
          className={cn(
            linked
              ? "border-(--survey-card-border-hover) bg-(--survey-accent-bg)"
              : "bg-muted/20",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background",
                  linked
                    ? "border-primary/30 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {linked ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {linked
                    ? "Linkage active"
                    : "Submitted previously? You can link your new submission by using the withdrawal token."}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {linked
                    ? `This submission will be connected to token ${formatLinkedToken(previousToken)}.`
                    : "Linking is optional and only needed if you are adding more decks later."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={linked ? "outline" : "default"}
                onClick={() => setLinkDialogOpen(true)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {linked ? "Change token" : "Link submission"}
              </Button>
              {linked ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setLinkedProfile("", null);
                    toast.success("Link disabled for this submission.");
                  }}
                >
                  <Link2Off className="mr-2 h-4 w-4" />
                  Disable link
                </Button>
              ) : null}
            </div>
          </div>
        </QuestionCard>

        {/* ─────────── Asking which languages the participant knows best already ─────────── */}
        <QuestionCard className="flex flex-col gap-3">
          <Label className={"text-base"}>
            1. Which languages do you speak natively or near-natively?
          </Label>
          <p className="text-sm text-muted-foreground">
            We use languages you know well because transfer from your first
            language and other strong languages affects how new vocabulary is
            learned.
          </p>
          <SearchMultiSelect
            options={LANGUAGE_OPTIONS.map((language) => ({
              value: language.code,
              label: language.name,
            }))}
            placeholder="Select one or more languages"
            searchPlaceholder="Search languages..."
            emptyLabel="No language matches."
            selectedValues={nativeLanguages}
            onChange={(nextValues) =>
              setValue(
                "native_languages",
                nextValues as UserProfile["native_languages"],
                {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                },
              )
            }
          />
          {errors.native_languages ? (
            <p className="text-sm text-destructive">
              {errors.native_languages.message}
            </p>
          ) : null}
        </QuestionCard>

        {/* ─────────── Capturing target languages and self-reported proficiency ─────────── */}
        <QuestionCard className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Label className={"text-base"}>
              2. Which languages are you currently studying with Anki?
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  CEFR levels provide a consistent cross-language self-report
                  scale. Use "Unsure / prefer not to say" if you do not know
                  your level.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">
            Your target languages and current level help us interpret which
            items are already familiar and which ones are likely to be genuinely
            new.
          </p>
          <SearchMultiSelect
            options={LANGUAGE_OPTIONS.map((language) => ({
              value: language.code,
              label: language.name,
            }))}
            placeholder="Select one or more target languages"
            searchPlaceholder="Search target languages..."
            emptyLabel="No language matches."
            selectedValues={targetLanguages.map((language) => language.lang)}
            onChange={handleTargetLanguageSelection}
            showSelectedBadges={false}
          />
          {errors.target_languages ? (
            <p className="text-sm text-destructive">
              {errors.target_languages.message}
            </p>
          ) : null}
          {targetLanguages.length > 0 ? (
            <div className="flex flex-col gap-3">
              {targetLanguages.map((targetLanguage) => {
                const label =
                  LANGUAGE_OPTIONS.find(
                    (option) => option.code === targetLanguage.lang,
                  )?.name ?? targetLanguage.lang;
                return (
                  <div
                    key={targetLanguage.lang}
                    className="grid gap-3 rounded-[8px] border border-border/80 p-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-center sm:gap-4"
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="w-full sm:justify-self-end">
                      <Select
                        value={targetLanguage.proficiency}
                        onValueChange={(value) =>
                          setValue(
                            "target_languages",
                            targetLanguages.map((language) =>
                              language.lang === targetLanguage.lang
                                ? {
                                    ...language,
                                    proficiency:
                                      value as typeof targetLanguage.proficiency,
                                  }
                                : language,
                            ),
                            {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        <SelectTrigger className="w-full sm:w-[16rem]">
                          <SelectValue placeholder="Select proficiency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CEFR_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {CEFR_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${label}`}
                        onClick={() =>
                          removeTargetLanguage(targetLanguage.lang)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </QuestionCard>

        {/* ─────────── Recording prior familiarity with subject-matter domains ─────────── */}
        <QuestionCard className="flex flex-col gap-3">
          <Label className={"text-base"}>
            3. What domains or topics are you familiar with? (Pick any that
            apply)
          </Label>
          <p className="text-sm text-muted-foreground">
            Prior exposure shifts what feels familiar. For example, a technical
            researcher may already recognise many computing terms while
            remaining less familiar with biological vocabulary.
          </p>
          <SearchMultiSelect
            options={DOMAIN_INTEREST_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            placeholder="Select one or more domains"
            searchPlaceholder="Search domains..."
            emptyLabel="No domain matches."
            selectedValues={domainInterests}
            onChange={(nextValues) =>
              setValue(
                "domain_interests",
                nextValues as UserProfile["domain_interests"],
                {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                },
              )
            }
          />
          {errors.domain_interests ? (
            <p className="text-sm text-destructive">
              {errors.domain_interests.message}
            </p>
          ) : null}
        </QuestionCard>

        {/* ─────────── Continuing to deck upload after profile validation passes ─────────── */}
        <div className="flex justify-end">
          <Button type="submit" disabled={!canContinue}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Continue
          </Button>
        </div>
      </form>
    </>
  );
}
