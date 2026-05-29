import { z } from "zod";

import {
  CEFR_LEVELS,
  DOMAIN_INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEMA_VERSION,
  SCHEDULER_OPTIONS,
  TOKEN_MAX_LENGTH,
  TOKEN_MIN_LENGTH,
  WITHDRAWAL_TOKEN_PATTERN,
} from "@/lib/constants";

const languageCodes = LANGUAGE_OPTIONS.map((language) => language.code) as [
  (typeof LANGUAGE_OPTIONS)[number]["code"],
  ...(typeof LANGUAGE_OPTIONS)[number]["code"][],
];
const domainInterests = DOMAIN_INTEREST_OPTIONS.map(
  (option) => option.value,
) as [
  (typeof DOMAIN_INTEREST_OPTIONS)[number]["value"],
  ...(typeof DOMAIN_INTEREST_OPTIONS)[number]["value"][],
];

export const languageCodeSchema = z.enum(languageCodes);
export const proficiencySchema = z.enum(CEFR_LEVELS);
export const domainInterestSchema = z.enum(domainInterests);
export const schedulerSchema = z.enum(SCHEDULER_OPTIONS);

export const previousTokenSchema = z
  .string()
  .trim()
  .min(
    TOKEN_MIN_LENGTH,
    `Token must be ${TOKEN_MIN_LENGTH}-${TOKEN_MAX_LENGTH} characters.`,
  )
  .max(
    TOKEN_MAX_LENGTH,
    `Token must be ${TOKEN_MIN_LENGTH}-${TOKEN_MAX_LENGTH} characters.`,
  )
  .regex(
    WITHDRAWAL_TOKEN_PATTERN,
    "Token must contain only letters, numbers, underscores, or hyphens.",
  );

export const optionalPreviousTokenSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || WITHDRAWAL_TOKEN_PATTERN.test(value),
    "Token must contain only letters, numbers, underscores, or hyphens.",
  )
  .refine(
    (value) =>
      value.length === 0 ||
      (value.length >= TOKEN_MIN_LENGTH && value.length <= TOKEN_MAX_LENGTH),
    `Token must be ${TOKEN_MIN_LENGTH}-${TOKEN_MAX_LENGTH} characters.`,
  );

export const userProfileSchema = z.object({
  native_languages: z
    .array(languageCodeSchema)
    .min(1, "Select at least one native language."),
  target_languages: z
    .array(
      z.object({
        lang: languageCodeSchema,
        proficiency: proficiencySchema,
      }),
    )
    .min(1, "Select at least one target language."),
  domain_interests: z
    .array(domainInterestSchema)
    .min(1, "Select at least one domain or topic."),
});

export const initSubmissionSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  previous_token: previousTokenSchema.nullable(),
  consent: z.object({
    publish_revlogs: z.literal(true),
    publish_userinfo: z.boolean(),
  }),
  user_profile: userProfileSchema,
  expected_size_bytes: z.number().int().nonnegative(),
});

export const linkSubmissionSchema = z.object({
  previous_token: previousTokenSchema,
});

export const withdrawSubmissionSchema = z.object({
  token: previousTokenSchema,
});
