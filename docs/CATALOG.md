# MR-5 Offline Catalog — initial vertical slice

MRaiders now supports a local SQLite-backed item/blueprint/quest library in the native Qt application. The catalog starts empty to avoid inventing or redistributing proprietary game datasets. Users may manually add records with a stable ID, type, name, source, and notes. Search filters names/notes and item kind; owned/needed counts persist to an app-data SQLite file.

Schema v1 stores catalog entries, recipe dependencies with foreign-key constraints, and independent owned and needed counts. A future migration layer, relationship editing UI, data-pack importer with licensing checks, and more advanced crafting planning are still required for full MR-5 acceptance. Recipe persistence currently has a tested data API, not a graphical editor. Missing source metadata is permitted for personal notes but must not be treated as authoritative game data.

The database resides in QStandardPaths::AppDataLocation/catalog.sqlite. The code does not access ARC Raiders, scrape another product, or communicate with remote services. No Qt SDK installation is needed on the user's machine when using GitHub-hosted Windows builds.

## Tests
- catalog_integration: in-memory-compatible temporary SQLite path, search/filter, upsert, foreign keys, recipe constraints, stored count persistence, invalid-input rejection.
- Existing Qt data and GUI integration tests now expect a fourth native tab.
- Full functional GUI acceptance remains NOT_RUN pending a real Windows session and verified CI.

## Crafting plan follow-up

The Item Library now has **Add Recipe Ingredient** and **Plan Crafting Shortages** actions. A selected result can be linked to ingredient IDs, with per-craft quantities. The planner recursively expands recipes, consumes already-owned quantities once, and lists unfulfilled leaf materials. Recipe cycles and expansion limits fail explicitly instead of showing misleading totals.

A plan is a manual what-if result; it does not decrement persisted owned counts and does not claim to know actual ARC Raiders crafting definitions. Users supply any recipe relationships. The planner is not yet a full batch-production scheduler or automatic data importer.
