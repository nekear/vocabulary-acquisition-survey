"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RESEARCH_STORAGE_KEY } from "@/lib/constants";
import {
  createEmptyDeckReviewConfig,
  emptyUserProfile,
  initializeDeckAssignments,
  initializeDeckReviewConfigs,
  initializeExcludedFieldsByModelKey,
  initializeExcludedNoteIds,
  normalizeUserProfile,
} from "@/lib/research";
import type {
  DeckAssignmentRecord,
  DeckReviewConfigRecord,
  ModelKey,
  ParsedFile,
  StepNumber,
  SubmissionConfirmation,
  SubmissionDraft,
  UserProfile,
} from "@/lib/types";

const SUBMISSION_STORE_VERSION = 7;

interface PersistedDraft {
  sessionId: string;
  previousToken: string;
  profilePrefilledFromLink: boolean;
  exportRequirementsAcknowledged: boolean;
  userProfile: UserProfile;
}

type PersistedDraftInput = Partial<Omit<PersistedDraft, "userProfile">> & {
  userProfile?: Partial<UserProfile> | null;
};

interface LegacyPersistedDraft extends PersistedDraftInput {
  currentStep?: unknown;
  parsedFiles?: unknown;
  deckAssignments?: unknown;
  deckLanguageAssignments?: unknown;
  deckReviewConfigs?: unknown;
  deckConfigs?: unknown;
  excludedNoteIds?: unknown;
  consent?: unknown;
  pendingConfirmation?: unknown;
}

interface SubmissionStoreState {
  draft: SubmissionDraft;
  confirmation: SubmissionConfirmation | null;
  setCurrentStep: (step: StepNumber) => void;
  setLinkedProfile: (token: string, profile: UserProfile | null) => void;
  setExportRequirementsAcknowledged: (acknowledged: boolean) => void;
  setUserProfile: (profile: UserProfile) => void;
  setParsedFiles: (parsedFiles: ParsedFile[]) => void;
  removeParsedFile: (fileId: string) => void;
  clearParsedFiles: () => void;
  setDeckAssignments: (assignments: DeckAssignmentRecord) => void;
  setNoteIncluded: (noteId: number, included: boolean) => void;
  setModelFieldIncluded: (
    modelKey: ModelKey,
    fieldIndex: number,
    included: boolean,
  ) => void;
  setDeckTagRetained: (deckId: number, tag: string, retained: boolean) => void;
  setConsent: (partial: Partial<SubmissionDraft["consent"]>) => void;
  setPendingConfirmation: (
    value: SubmissionDraft["pendingConfirmation"],
  ) => void;
  clearPendingConfirmation: () => void;
  completeSubmission: (confirmation: SubmissionConfirmation) => void;
  resetDraft: () => void;
  clearConfirmation: () => void;
}

function createDraft(): SubmissionDraft {
  return {
    sessionId: crypto.randomUUID(),
    currentStep: 1,
    previousToken: "",
    profilePrefilledFromLink: false,
    exportRequirementsAcknowledged: false,
    userProfile: emptyUserProfile(),
    parsedFiles: [],
    deckAssignments: {},
    deckReviewConfigs: {},
    excludedNoteIds: new Set<number>(),
    excludedFieldsByModelKey: {},
    consent: {
      publish_revlogs: false,
      publish_userinfo: false,
    },
    pendingConfirmation: null,
  };
}

function serializeDraft(draft: SubmissionDraft): PersistedDraft {
  return {
    sessionId: draft.sessionId,
    previousToken: draft.previousToken,
    profilePrefilledFromLink: draft.profilePrefilledFromLink,
    exportRequirementsAcknowledged: draft.exportRequirementsAcknowledged,
    userProfile: draft.userProfile,
  };
}

function deserializeDraft(
  value: PersistedDraftInput | undefined,
): SubmissionDraft {
  const draft = createDraft();

  if (!value) {
    return draft;
  }

  return {
    ...draft,
    sessionId:
      typeof value.sessionId === "string" && value.sessionId.length > 0
        ? value.sessionId
        : draft.sessionId,
    previousToken:
      typeof value.previousToken === "string" ? value.previousToken : "",
    profilePrefilledFromLink: value.profilePrefilledFromLink ?? false,
    exportRequirementsAcknowledged:
      value.exportRequirementsAcknowledged ?? false,
    userProfile: normalizeUserProfile(value.userProfile),
  };
}

function migrateLegacyDraft(
  value: LegacyPersistedDraft | PersistedDraft | undefined,
): PersistedDraft {
  return serializeDraft(deserializeDraft(value));
}

export const useSubmissionStore = create<SubmissionStoreState>()(
  persist(
    (set) => ({
      draft: createDraft(),
      confirmation: null,
      setCurrentStep: (step) =>
        set((state) => ({
          draft: {
            ...state.draft,
            currentStep: step,
          },
        })),
      setLinkedProfile: (token, profile) =>
        set((state) => ({
          draft: {
            ...state.draft,
            previousToken: token,
            profilePrefilledFromLink: Boolean(profile),
            userProfile: profile
              ? normalizeUserProfile(profile)
              : state.draft.userProfile,
          },
        })),
      setExportRequirementsAcknowledged: (acknowledged) =>
        set((state) => ({
          draft: {
            ...state.draft,
            exportRequirementsAcknowledged: acknowledged,
          },
        })),
      setUserProfile: (profile) =>
        set((state) => ({
          draft: {
            ...state.draft,
            userProfile: profile,
          },
        })),
      setParsedFiles: (parsedFiles) =>
        set((state) => ({
          draft: {
            ...state.draft,
            parsedFiles,
            deckAssignments: initializeDeckAssignments(
              parsedFiles,
              state.draft.deckAssignments,
            ),
            deckReviewConfigs: initializeDeckReviewConfigs(
              parsedFiles,
              state.draft.deckReviewConfigs,
            ),
            excludedNoteIds: initializeExcludedNoteIds(
              parsedFiles,
              state.draft.excludedNoteIds,
            ),
            excludedFieldsByModelKey: initializeExcludedFieldsByModelKey(
              parsedFiles,
              state.draft.excludedFieldsByModelKey,
            ),
          },
        })),
      removeParsedFile: (fileId) =>
        set((state) => {
          const parsedFiles = state.draft.parsedFiles.filter(
            (file) => file.id !== fileId,
          );
          return {
            draft: {
              ...state.draft,
              parsedFiles,
              deckAssignments: initializeDeckAssignments(
                parsedFiles,
                state.draft.deckAssignments,
              ),
              deckReviewConfigs: initializeDeckReviewConfigs(
                parsedFiles,
                state.draft.deckReviewConfigs,
              ),
              excludedNoteIds: initializeExcludedNoteIds(
                parsedFiles,
                state.draft.excludedNoteIds,
              ),
              excludedFieldsByModelKey: initializeExcludedFieldsByModelKey(
                parsedFiles,
                state.draft.excludedFieldsByModelKey,
              ),
            },
          };
        }),
      clearParsedFiles: () =>
        set((state) => ({
          draft: {
            ...state.draft,
            parsedFiles: [],
            deckAssignments: {},
            deckReviewConfigs: {},
            excludedNoteIds: new Set<number>(),
            excludedFieldsByModelKey: {},
          },
        })),
      setDeckAssignments: (assignments) =>
        set((state) => ({
          draft: {
            ...state.draft,
            deckAssignments: assignments,
          },
        })),
      setNoteIncluded: (noteId, included) =>
        set((state) => {
          const excludedNoteIds = new Set(state.draft.excludedNoteIds);

          if (included) {
            excludedNoteIds.delete(noteId);
          } else {
            excludedNoteIds.add(noteId);
          }

          return {
            draft: {
              ...state.draft,
              excludedNoteIds,
            },
          };
        }),
      setModelFieldIncluded: (modelKey, fieldIndex, included) =>
        set((state) => {
          const excludedFieldIndexes = new Set(
            state.draft.excludedFieldsByModelKey[modelKey] ?? [],
          );

          if (included) {
            excludedFieldIndexes.delete(fieldIndex);
          } else {
            excludedFieldIndexes.add(fieldIndex);
          }

          const excludedFieldsByModelKey = {
            ...state.draft.excludedFieldsByModelKey,
          };

          if (excludedFieldIndexes.size === 0) {
            delete excludedFieldsByModelKey[modelKey];
          } else {
            excludedFieldsByModelKey[modelKey] = excludedFieldIndexes;
          }

          return {
            draft: {
              ...state.draft,
              excludedFieldsByModelKey,
            },
          };
        }),
      setDeckTagRetained: (deckId, tag, retained) =>
        set((state) => {
          const config =
            state.draft.deckReviewConfigs[String(deckId)] ??
            createEmptyDeckReviewConfig();
          const nextConfig = {
            retainedTags: new Set(config.retainedTags),
          };

          if (retained) {
            nextConfig.retainedTags.add(tag);
          } else {
            nextConfig.retainedTags.delete(tag);
          }

          return {
            draft: {
              ...state.draft,
              deckReviewConfigs: {
                ...state.draft.deckReviewConfigs,
                [String(deckId)]: nextConfig,
              },
            },
          };
        }),
      setConsent: (partial) =>
        set((state) => ({
          draft: {
            ...state.draft,
            consent: {
              ...state.draft.consent,
              ...partial,
            },
          },
        })),
      setPendingConfirmation: (value) =>
        set((state) => ({
          draft: {
            ...state.draft,
            pendingConfirmation: value,
          },
        })),
      clearPendingConfirmation: () =>
        set((state) => ({
          draft: {
            ...state.draft,
            pendingConfirmation: null,
          },
        })),
      completeSubmission: (confirmation) =>
        set(() => ({
          draft: createDraft(),
          confirmation,
        })),
      resetDraft: () =>
        set((state) => ({
          draft: createDraft(),
          confirmation: state.confirmation,
        })),
      clearConfirmation: () => set({ confirmation: null }),
    }),
    {
      name: RESEARCH_STORAGE_KEY,
      version: SUBMISSION_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        draft: serializeDraft(state.draft),
      }),
      migrate: (persistedState) => {
        const typedPersisted = persistedState as
          | { draft?: PersistedDraft | LegacyPersistedDraft }
          | undefined;
        return {
          draft: migrateLegacyDraft(typedPersisted?.draft),
        };
      },
      merge: (persistedState, currentState) => {
        const typedPersisted = persistedState as
          | { draft?: PersistedDraft }
          | undefined;
        return {
          ...currentState,
          draft: deserializeDraft(typedPersisted?.draft),
        };
      },
    },
  ),
);
