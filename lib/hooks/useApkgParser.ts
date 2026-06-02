"use client";

import { useCallback, useState } from "react";
import initSqlJs from "sql.js";
import JSZip from "jszip";

import type {
  ParsedCard,
  ParsedCollection,
  ParsedDeck,
  ParsedModelField,
  ParsedModel,
  ParsedNote,
  ParsedReview,
} from "@/lib/types";

/**
 * **FYI:** This parser is a custom browser-side implementation built to
 * keep `.apkg` processing local and independent of Node.js-specific tooling.
 * I intentionally decided to not rely on server-oriented parsers such as `74Genesis/anki-apkg-parser`
 * because it's, well, a node.js-based parser that requires a server environment.
 */

let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

/**
 * Lazily loads the SQLite WASM runtime once and reuses it across parses so
 * every uploaded archive does not pay the initialization cost again.
 */
async function loadSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => "/vendor/sql-wasm.wasm",
    });
  }

  return sqlJsPromise;
}

/**
 * Reconstructs parent-child deck relationships from Anki's `name::child`
 * convention while preserving the original source order for stable UI output.
 */
function parseDeckHierarchy(
  decksJson: Record<string, { name: string; conf: number }>,
) {
  const orderedEntries = Object.entries(decksJson).map(
    ([deckId, deck], index) => ({
      deckId: Number(deckId),
      deck,
      index,
    }),
  );
  const sortedByDepth = [...orderedEntries].sort((left, right) => {
    const depthDifference =
      left.deck.name.split("::").length - right.deck.name.split("::").length;
    if (depthDifference !== 0) {
      return depthDifference;
    }

    return left.index - right.index;
  });
  const nameToDeckId = new Map<string, number>();

  for (const entry of sortedByDepth) {
    nameToDeckId.set(entry.deck.name, entry.deckId);
  }

  return orderedEntries.map(({ deckId, deck, index }) => {
    const segments = deck.name.split("::");
    const parentName =
      segments.length > 1 ? segments.slice(0, -1).join("::") : null;

    return {
      deck_id: deckId,
      name: deck.name,
      parent_id: parentName ? (nameToDeckId.get(parentName) ?? null) : null,
      direct_card_count: 0,
      fsrs_weights: [] as number[],
      desired_retention: 0.9,
      sort_index: index,
    };
  });
}

/**
 * Extracts FSRS-specific configuration values from a deck config record, while
 * tolerating the fact that Anki stores these fields under different keys across
 * versions.
 */
function parseFsrsValues(deck: ParsedDeck, dconf: Record<string, unknown>) {
  const fsrsParameterKeys = [
    ...Object.keys(dconf)
      .map((key) => {
        const match = /^fsrsParams(\d+)$/.exec(key);
        return match ? { key, version: Number(match[1]) } : null;
      })
      .filter(
        (entry): entry is { key: string; version: number } => entry !== null,
      )
      .sort((left, right) => right.version - left.version)
      .map((entry) => entry.key),
    "fsrsWeights",
  ];

  for (const key of fsrsParameterKeys) {
    const candidate = dconf[key];
    if (Array.isArray(candidate)) {
      const fsrsWeights = candidate.filter(
        (value): value is number => typeof value === "number",
      );
      if (fsrsWeights.length > 0) {
        deck.fsrs_weights = fsrsWeights;
        break;
      }
    }
  }

  if (typeof dconf.desiredRetention === "number") {
    deck.desired_retention = dconf.desiredRetention;
  }
}

/** Returns a nullable numeric value from an unknown config field. */
function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Extracts the collection-level scheduler version from `col.conf`, tolerating
 * absent or renamed keys across Anki releases.
 */
function parseCollectionSchedulerVersion(conf: Record<string, unknown>) {
  for (const key of ["schedVer", "schedulerVersion"]) {
    const value = optionalNumber(conf[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function parseModelFields(
  fields: Array<{ name?: unknown; ord?: unknown }> | undefined,
): ParsedModelField[] {
  return (fields ?? [])
    .map((field, fallbackIndex) => ({
      index:
        typeof field.ord === "number" && Number.isInteger(field.ord)
          ? field.ord
          : fallbackIndex,
      name:
        typeof field.name === "string" && field.name.length > 0
          ? field.name
          : `Field ${fallbackIndex + 1}`,
    }))
    .sort((left, right) => left.index - right.index);
}

/**
 * Parses an uploaded `.apkg` archive entirely in the browser and returns the
 * normalized collection data used by the rest of the submission flow.
 */
export function useApkgParser() {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (file: File): Promise<ParsedCollection> => {
    setParsing(true);
    setError(null);

    try {
      // Loading the SQLite WASM runtime and ZIP archive.
      const SQL = await loadSqlJs();
      const archiveBytes = await file.arrayBuffer();
      const archive = await JSZip.loadAsync(archiveBytes);

      // Looking for the collection database under the filenames Anki has used across supported schema generations.
      const collectionFile =
        archive.file("collection.anki21b") ??
        archive.file("collection.anki21") ??
        archive.file("collection.anki2");

      if (!collectionFile) {
        throw new Error(
          "No Anki collection database was found in this archive.",
        );
      }

      // Opening the embedded SQLite database to read the collection metadata
      // and the row-level entities that will later drive privacy review (I'm referring to Step 3 of the survey).
      const database = new SQL.Database(
        await collectionFile.async("uint8array"),
      );

      // Reading the single collection metadata row first because it tells the
      // parser how decks, models, and deck configs are encoded.
      const collectionQuery = database.exec(
        "select crt, ver, conf, models, decks, dconf from col limit 1",
      );
      if (
        collectionQuery.length === 0 ||
        collectionQuery[0].values.length === 0
      ) {
        throw new Error("The Anki collection metadata could not be read.");
      }

      const [crt, schemaVersion, confJson, modelsJson, decksJson, dconfJson] =
        collectionQuery[0].values[0] as [
          number,
          number,
          string,
          string,
          string,
          string,
        ];

      const confData = JSON.parse(confJson || "{}") as Record<string, unknown>;
      const modelsData = JSON.parse(modelsJson || "{}") as Record<
        string,
        { flds?: Array<{ name?: unknown; ord?: unknown }> }
      >;
      const decksData = JSON.parse(decksJson || "{}") as Record<
        string,
        { name: string; conf: number }
      >;
      const dconfData = JSON.parse(dconfJson || "{}") as Record<
        string,
        Record<string, unknown>
      >;

      // Turning model metadata into a lightweight shape early so later code can
      // reason about notes and fields without carrying raw Anki JSON around.
      const models: ParsedModel[] = Object.entries(modelsData).map(
        ([modelId, model]) => {
          const fields = parseModelFields(model.flds);

          return {
            model_id: Number(modelId),
            fields,
            field_names: fields.map((field) => field.name),
          };
        },
      );

      // Rebuilding deck hierarchy and configuration next so cards and notes can
      // be contextualized by deck before review statistics are computed.
      const decks = parseDeckHierarchy(decksData);
      for (const deck of decks) {
        const deckConfigId = String(
          decksData[String(deck.deck_id)]?.conf ?? "",
        );
        const dconf = dconfData[deckConfigId];
        if (dconf) {
          parseFsrsValues(deck, dconf);
        }
      }

      // Expanding note rows into split fields and normalized tag arrays because
      // note-level review and exclusion decisions happen on these exact values.
      const noteRows = database.exec("select id, mid, flds, tags from notes");
      const notes: ParsedNote[] =
        noteRows.length === 0
          ? []
          : noteRows[0].values.map((value) => {
              const [noteId, modelId, fields, tags] = value as [
                number,
                number,
                string,
                string,
              ];

              return {
                note_id: noteId,
                model_id: modelId,
                fields: (fields ?? "").split("\x1f"),
                tags: (tags ?? "").trim().split(/\s+/).filter(Boolean),
                created_at_ms: noteId,
              };
            });

      // Reading card rows after notes to connect every card back to its parent
      // note and to surface scheduler-related fields used in analysis.
      const cardRows = database.exec(`
        select id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, data
        from cards
      `);
      const cards: ParsedCard[] =
        cardRows.length === 0
          ? []
          : cardRows[0].values.map((value) => {
              const [
                cardId,
                noteId,
                deckId,
                templateOrd,
                state,
                queue,
                due,
                interval,
                factor,
                reps,
                lapses,
                rawData,
              ] = value as [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                string,
              ];

              // P.S. Nice tower... Thanks, prettier.

              let fsrsStability: number | null = null;
              let fsrsDifficulty: number | null = null;
              if (rawData) {
                // Decoding FSRS card fields opportunistically because some decks
                // store them in the `data` blob while older decks do not.
                try {
                  const parsedData = JSON.parse(rawData) as {
                    d?: number;
                    s?: number;
                  };
                  fsrsDifficulty = parsedData.d ?? null;
                  fsrsStability = parsedData.s ?? null;
                } catch {
                  fsrsDifficulty = null;
                  fsrsStability = null;
                }
              }

              return {
                card_id: cardId,
                note_id: noteId,
                deck_id: deckId,
                template_ord: templateOrd,
                state,
                queue,
                interval,
                factor,
                reps_total: reps,
                lapses_total: lapses,
                fsrs_stability: fsrsStability,
                fsrs_difficulty: fsrsDifficulty,
                due,
                created_at_ms: cardId,
              };
            });

      // Counting direct cards per deck to distinguish decks that merely exist
      // in the hierarchy from decks that actually contribute card data.
      const directCardCounts = new Map<number, number>();
      for (const card of cards) {
        directCardCounts.set(
          card.deck_id,
          (directCardCounts.get(card.deck_id) ?? 0) + 1,
        );
      }

      for (const deck of decks) {
        deck.direct_card_count = directCardCounts.get(deck.deck_id) ?? 0;
      }

      // Reading revlog rows last because reviews only become meaningful once the
      // parser already knows which cards and notes they belong to.
      const reviewRows = database.exec(`
        select id, cid, ease, ivl, lastIvl, factor, time, type
        from revlog
      `);
      const reviews: ParsedReview[] =
        reviewRows.length === 0
          ? []
          : reviewRows[0].values.map((value) => {
              const [
                reviewId,
                cardId,
                rating,
                intervalAfter,
                intervalBefore,
                factorAfter,
                timeTaken,
                reviewType,
              ] = value as [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
              ];

              return {
                review_id: reviewId,
                card_id: cardId,
                timestamp_ms: reviewId,
                rating,
                interval_before: intervalBefore,
                interval_after: intervalAfter,
                factor_after: factorAfter,
                time_taken_ms: timeTaken,
                review_type: reviewType,
              };
            });

      // Closing the SQLite database promptly to release browser memory before
      // handing the normalized collection back to React state.
      database.close();

      return {
        collection_created_at_ms: crt * 1000,
        schema_version: optionalNumber(schemaVersion),
        scheduler_version: parseCollectionSchedulerVersion(confData),
        decks,
        models,
        notes,
        cards,
        reviews,
      };
    } catch (caughtError) {
      // Converting every parser failure into a clean user-facing message so we can keep
      // the upload step understandable even when the archive is malformed.
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "The deck could not be parsed.";
      setError(nextError);
      throw new Error(nextError);
    } finally {
      // Resetting the parsing flag in all cases (so the UI never gets stuck in a
      // loading state after success or failure).
      setParsing(false);
    }
  }, []);

  return { parse, parsing, error };
}
