# MR-5 Offline Catalog — initial vertical slice

MRaiders now supports a local SQLite-backed item/blueprint/quest library in the native Qt application. The catalog starts empty to avoid inventing or redistributing proprietary game datasets. Users may manually add records with a stable ID, type, name, source, and notes. Search filters names/notes and item kind; owned/needed counts persist to an app-data SQLite file.

Schema v1 stores catalog entries, recipe dependencies with foreign-key constraints, and independent owned and needed counts. A future migration layer, relationship editing UI, data-pack importer with licensing checks, and more advanced crafting planning are still required for full MR-5 acceptance. Recipe persistence currently has a tested data API, not a graphical editor. Missing source metadata is permitted for personal notes but must not be treated as authoritative game data.

The database resides in QStandardPaths::AppDataLocation/catalog.sqlite. The code does not access ARC Raiders, scrape another product, or communicate with remote services. No Qt SDK installation is needed on the user's machine when using GitHub-hosted Windows builds.

## Tests
- catalog_integration: in-memory-compatible temporary SQLite path, search/filter, upsert, foreign keys, recipe constraints, stored count persistence, invalid-input rejection.
- Existing Qt data and GUI integration tests now expect a fourth native tab.
- Full functional GUI acceptance remains NOT_RUN pending a real Windows session and verified CI.
