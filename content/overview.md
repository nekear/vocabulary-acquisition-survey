> For any queries, please contact [nekear.me@gmail.com](mailto:nekear.me@gmail.com).

## About the research

---

### Brief

The research is conducted as part of a Master's in AI thesis at the University of Galway, Ireland.

It involves training an AI model that predicts how hard a specific word is for a learner, given the morphological and distributional features of lexical items (e.g., McDonald co-occurrence probability, COCA rank & range, etc.) and user-specific information such as their review performance on similar items, first language relatedness, current proficiency, etc.

Both the dataset collected within this survey and the findings of this research will be made public (privacy protections described below apply) to foster further studies in this domain.

### Novelty

There's prior work on word-difficulty modeling: Duolingo has published a couple of important datasets in this area (HLR in 2016, SLAM in 2018), but both capture learning within Duolingo's **own** curriculum: platform-chosen words, platform-formatted exercises, platform scheduling. The publicly missing part is data on what learners **themselves** chose to study, in any language, scheduled by a memory-faithful algorithm like FSRS, with the full card content intact. As for existing log datasets like [open-spaced-repetition](https://huggingface.co/open-spaced-repetition) (which FSRS was built on), they strip the content out for privacy, while other public vocabulary research datasets don't include memory data. Neither side of what's needed currently exists publicly.

This survey is building the first dataset that has both. Once released publicly, it removes a real bottleneck for anyone working on personalized vocabulary learning.

Beyond the dataset, the research contributes a model that predicts word difficulty by combining two things usually studied separately: the linguistic properties of a word (its morphology and how it's distributed across real usage) and an individual's own memory patterns from their review history. Most prior work treats word difficulty as a fixed, population-level property, while this approach makes it personalized.

### Why this can matter to you as a learner

The most immediate benefit is that your ten-minute contribution will help build a dataset that will become a permanent public resource for the entire language-learning research community.

Longer term, this same research makes a new generation of learning tools possible:

- **deck recommenders** that know which words you're actually ready for;
- **vocabulary sequencers** tuned to your prior knowledge;
- **smarter spaced repetition schedulers** built on personal memory patterns instead of population averages.

And because the dataset will be public, **anyone** will be able to build them, not just one company.

## About the survey

---

### Who can participate

To make the research outcomes meaningful, the dataset must meet specific requirements.

A learner is welcome to participate if:

- They are at least 16 years old;
- They use Anki for language learning;
- They have reviewed at least some cards in their decks more than 5 times (this is when review patterns start to reflect actual memory rather than early-stage half-random answers). However, submissions below that threshold still help.

### What is collected

This survey collects:

- Card contents - to estimate population-level complexity and find lexical neighbors;
- Anki review logs - to find memory patterns across neighbors and train a model that predicts how many reviews a learner would realistically need to master a given word (the prediction target may change as the research progresses);
- Languages a learner is proficient in (C1+) - L1 and other known languages transfer knowledge into new ones;
- The learner's interests or domain - this affects the prior exposure, which shifts the potential "familiarity" with certain words (e.g., an AI researcher would be more familiar with technical terms than biological ones);
- Consent to include your submitted data in the final public dataset. There's very little research in this area precisely because no large public datasets exist on how personalization changes lexical complexity. A public dataset reflecting how memory responds to different vocabulary types would really strongly push the field forward.

## General awareness (how your raw data is structured)

---

You're submitting an `.apkg` file - a ZIP archive containing an SQLite database and associated media files. The database (named `collection.anki21b`, `collection.anki21`, or `collection.anki2` depending on the Anki version) holds all card data, review history, scheduling parameters, and configuration. This section describes every table and field exposed by that database to prepare you for the section about data-handling.

### File structure

Each file exported from Anki contains the following data.

| File                 | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `collection.anki21b` | Main SQLite database (modern format)                           |
| `meta`               | Protobuf-encoded format version metadata                       |
| `media`              | JSON mapping of numbered filenames to original media filenames |
| `0`, `1`, `2`, …     | Actual media files (images, audio, etc.)                       |

Below is an overview of what is stored in the `collection.anki21b` SQLite database.

### Table: `col`

A single-row table holding collection-level configuration. All deck presets, note types, and global settings are stored here as JSON blobs.

| Field    | Type      | Description                                                                                                                                         |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | integer   | Always `1` - only one row exists                                                                                                                    |
| `crt`    | integer   | Collection creation timestamp (Unix seconds)                                                                                                        |
| `mod`    | integer   | Last modification timestamp (Unix milliseconds)                                                                                                     |
| `scm`    | integer   | Schema modification timestamp                                                                                                                       |
| `ver`    | integer   | Schema version number                                                                                                                               |
| `usn`    | integer   | Update sequence number, used for AnkiWeb sync                                                                                                       |
| `ls`     | integer   | Last sync timestamp                                                                                                                                 |
| `conf`   | JSON text | Global configuration: scheduler version, timezone offset, sort field, sort order, new card insertion order, etc.                                    |
| `models` | JSON text | All note types (models): field definitions, card templates, CSS styling                                                                             |
| `decks`  | JSON text | All deck definitions: names, parent/child hierarchy, per-deck limits                                                                                |
| `dconf`  | JSON text | Deck configuration presets - **contains FSRS weights** (`fsrsWeights`, `desiredRetention`, `ignoreRevlogsBeforeDate`) and legacy SM-2 ease settings |
| `tags`   | JSON text | Registry of all tags used across the collection                                                                                                     |

### Key `dconf` sub-fields (FSRS-relevant)

| Sub-field                 | Description                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `fsrsWeights`             | Array of 17-19 floats representing the optimised FSRS model parameters             |
| `desiredRetention`        | Target retention rate, e.g. `0.9` for 90%                                          |
| `ignoreRevlogsBeforeDate` | ISO date string - review logs before this date are excluded from FSRS optimisation |
| `newPerDay`               | Maximum new cards per day                                                          |
| `maxIvl`                  | Maximum interval in days                                                           |

### Table: `notes`

One row per note. A note is the source of content; one note can generate multiple cards via its template.

| Field   | Type    | Description                                                                                                                                        |
| ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | integer | Note creation timestamp (Unix milliseconds); serves as primary key                                                                                 |
| `guid`  | text    | Globally unique 10-character identifier, used to prevent duplicates on import                                                                      |
| `mid`   | integer | Foreign key → note type ID in `col.models`                                                                                                         |
| `mod`   | integer | Last modification timestamp (Unix seconds)                                                                                                         |
| `usn`   | integer | Update sequence number for sync                                                                                                                    |
| `tags`  | text    | Space-separated list of tags (e.g. `biology anatomy`)                                                                                              |
| `flds`  | text    | All field values concatenated, separated by the `\x1f` (ASCII unit separator) character - field order matches the model definition in `col.models` |
| `sfld`  | text    | Value of the sort field (used for browser sorting)                                                                                                 |
| `csum`  | integer | Numeric checksum of the first field, used for duplicate detection                                                                                  |
| `flags` | integer | Reserved flags                                                                                                                                     |
| `data`  | text    | Extra data blob, used by add-ons                                                                                                                   |

### Table: `cards`

One row per card. Multiple cards can share the same parent note (e.g. forward and reverse cards).

| Field    | Type    | Description                                                                                                                                          |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | integer | Card creation timestamp (Unix milliseconds); primary key                                                                                             |
| `nid`    | integer | Foreign key → parent note `id`                                                                                                                       |
| `did`    | integer | Foreign key → deck `id` in `col.decks`                                                                                                               |
| `ord`    | integer | Template index (0-based) within the note type - identifies which card template generated this card                                                   |
| `mod`    | integer | Last modification timestamp (Unix seconds)                                                                                                           |
| `usn`    | integer | Update sequence number for sync                                                                                                                      |
| `type`   | integer | Card state: `0` = new, `1` = learning, `2` = review, `3` = relearning                                                                                |
| `queue`  | integer | Scheduling queue: `-3` = sched buried, `-2` = user buried, `-1` = suspended, `0` = new, `1` = learning, `2` = review, `3` = day-learn, `4` = preview |
| `due`    | integer | Due date; meaning varies: for new cards = position, for review = days since collection creation, for learning = Unix timestamp                       |
| `ivl`    | integer | Current interval in days (negative value = seconds, used during learning steps)                                                                      |
| `factor` | integer | Ease factor × 1000 (e.g. `2500` = 250% ease); used in legacy SM-2 scheduler                                                                          |
| `reps`   | integer | Total number of reviews                                                                                                                              |
| `lapses` | integer | Number of times the card was answered "Again" after graduation                                                                                       |
| `left`   | integer | Remaining learning steps (encoded: `left % 1000` = reps left today)                                                                                  |
| `odue`   | integer | Original due date, used when card is in a filtered deck                                                                                              |
| `odid`   | integer | Original deck ID, used when card is in a filtered deck                                                                                               |
| `flags`  | integer | User-set colour flag (0–7)                                                                                                                           |
| `data`   | text    | JSON blob for extra scheduler data — **FSRS stores stability `s` and difficulty `d` here**, e.g. `{"s":15.3,"d":6.8}`                                |

### Table: `revlog`

One row per individual review event. This is the primary source of data for FSRS optimisation.

| Field     | Type    | Description                                                                            |
| --------- | ------- | -------------------------------------------------------------------------------------- |
| `id`      | integer | Review timestamp (Unix milliseconds); primary key                                      |
| `cid`     | integer | Foreign key → card `id`                                                                |
| `usn`     | integer | Update sequence number for sync                                                        |
| `ease`    | integer | Answer button pressed: `1` = Again, `2` = Hard, `3` = Good, `4` = Easy                 |
| `ivl`     | integer | Interval after this review (days; negative = seconds)                                  |
| `lastIvl` | integer | Interval before this review (days; negative = seconds)                                 |
| `factor`  | integer | Ease factor after this review × 1000                                                   |
| `time`    | integer | Time taken to answer (milliseconds, capped at 60,000)                                  |
| `type`    | integer | Review type: `0` = learning, `1` = review, `2` = relearn, `3` = filtered, `4` = manual |

### Table: `graves`

Tracks deleted objects (cards, notes, decks) for sync reconciliation. This table is **not collected** - see the exclusions section below.

| Field  | Type    | Description                                     |
| ------ | ------- | ----------------------------------------------- |
| `usn`  | integer | Update sequence number at time of deletion      |
| `oid`  | integer | Original ID of the deleted object               |
| `type` | integer | Object type: `0` = card, `1` = note, `2` = deck |

## Data handling

---

This section specifies which fields are collected, excluded, or transformed before inclusion in the research dataset for the purposes stated in the "What is collected" section.

Fields fall into three buckets: collected as-is, collected with transformation, or excluded entirely. Reasoning is grouped by category rather than enumerated per field, since most exclusions share a single rationale.

### Excluded entirely

The following fields carry no research signal and/or can act as a quasi-identifier (sync timestamps cluster by user device), ultimately making it possible to track patterns unrelated to language learning. Therefore, these fields are removed before your submission and this data is never collected.

**Sync metadata** - only meaningful for AnkiWeb reconciliation.

- `col.usn`, `col.ls`, `col.mod`, `col.dconf.ignoreRevlogsBeforeDate`, `col.dconf.newPerDay`, `col.dconf.maxIvl`
- `notes.usn`, `notes.mod`
- `cards.usn`, `cards.mod`, `cards.left`, `cards.odue`, `cards.odid`
- `revlog.usn`
- The entire `graves` table

**Internal deduplication identifiers** - used by Anki's import/sync logic.

- `notes.guid` (10-character globally unique identifier)
- `notes.csum` (checksum of the first field)

**User personal annotations** - color flags are user-private categorical signals (e.g. "card I'm anxious about"), and the add-on data blob has unknown structure and may contain anything an installed add-on chose to write.

- `cards.flags`, `notes.flags` (user-set colour flags)
- `notes.data` (arbitrary add-on data blob)

**Redundant data**

- `col.tags` (global tag registry - already captured per-note via `notes.tags` after filtering). See below on further tag processing.

**Note-type styling and templates** - CSS and card templates can encode user customisation patterns and occasionally contain identifying comments.

- `col.models` is reduced to **field definitions only** (field names, ordering); CSS, card templates, and template names are dropped before submission.

### Collected with transformation

**Timestamps - with per-user random offset.**
Every timestamp in a single user's submission is offset by the same random constant. This mechanism preserves all inter-event intervals - the only temporal signal SRS uses - while destroying alignment with real wall-clock time.

- Applies to: `revlog.id`, `col.crt`, `notes.id`, `cards.id`
- The offset is not stored.

> Applied post submission, but before the final dataset is released.

**Identifiers - synthetic per-user counters.** Real Anki IDs (note, card, deck, model, review) are replaced with synthetic counters during processing.

- Applies to: `notes.id`, `cards.id`, `cards.nid`, `cards.did`, `revlog.cid`, `notes.mid`
- The mapping from real to synthetic IDs is not retained.

> Applied post submission, but before the final dataset is released.

**Tags.** Tags may be either linguistically useful (`noun`, `irregular_verb`, `feminine`) or idiosyncratic (`for_friday_test`, names). The survey provides a way to remove tags that you don't want to include in the final dataset.

- Applies to: `notes.tags`

**Deck names - replaced with neutral identifiers.** User-set deck names (which can leak topic, purpose, or personal context - e.g. "German for Anna's wedding") are replaced with neutral identifiers. Hierarchy is preserved; semantic content is not.

- Applies to: `col.decks` → `name`

**Card content - passes through your review before submission.** Before any data leaves your machine, you see a note-by-note preview of `notes.flds` content with an include/exclude toggle for each note. In Anki, one note can generate one or more cards, so excluding a note removes every card generated from that note from the submission <u>entirely</u>, along with their review history and scheduling state. This is in-the-loop consent, not post-hoc redaction. Your excluded data is NOT included in the submission in any form.

- Applies to: `notes.flds`, `notes.sfld`

### Collected as-is

- **Scheduling state**: `cards.type`, `cards.queue`, `cards.due`, `cards.ivl`, `cards.factor`, `cards.reps`, `cards.lapses`, `cards.ord`
- **FSRS per-card memory state**: `cards.data` (stability `s`, difficulty `d`)
- **Review events**: `revlog.ease`, `revlog.ivl`, `revlog.lastIvl`, `revlog.factor`, `revlog.time`, `revlog.type`
- **FSRS configuration per deck**: `col.dconf` → `fsrsWeights`, `desiredRetention`
- **Note-type structure**: `col.models` → field definitions only (names, ordering)
- **Collection-level scheduler version**: `col.conf` → scheduler version
- **Schema version**: `col.ver`

> You can inspect the resulting submission file by downloading the `.json` before clicking the "Submit" button.

## Additional strategies

### 1. Automated PII pattern scanner

The pre-submission UI runs a local pattern scanner over card content and flags potential PII for attention:

- Email addresses;
- Phone numbers (multiple formats and country conventions);
- Long digit sequences (potential ID numbers, card numbers, dates of birth);
- URLs;
- Common given-name and surname lists for the languages being studied.

Flagged notes surface in the review UI with the trigger highlighted. You can decide whether to include or exclude each note.

### 2. Special-category content check

Card content is additionally scanned locally for terms in health, religious, and political categories. When matches are found above a small threshold, you're shown an additional explicit notice before submission.

### 3. Withdrawal mechanism

Withdrawal requests immediately mark linked submissions as withdrawn and exclude them from research processing and public release. Withdrawn payloads are permanently deleted from live storage during scheduled maintenance, normally within 7 days. Post-release withdrawal, scheduled for October 2026, is not supported.

### 4. Limited public release
To further reduce any residual risk of re-identification, the public dataset will include submissions for a given target language only if at least three participants for that language are represented in the collected data. This threshold is intended to help ensure that the anonymization measures described above remain sufficient, even in cases where a learner has publicly shared parts of their learning history elsewhere.