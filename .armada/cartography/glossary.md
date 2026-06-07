# Glossary — ARMADA-CRM-1 domain vocabulary

The repo uses a nautical / fleet-command metaphor. Map a feature request to the model.

| Term | Means | Model / route |
| :--- | :--- | :--- |
| **Port** | a company / account | `Port` model · `/ports` |
| **Captain** | a contact | `Captain` model |
| **Voyage** | a deal | `Voyage` model · `/voyages` |
| **Activity** | a log entry / task | `Activity` model |
| **The Bridge** | the dashboard | `/` (`src/app/page.tsx`) |
| **The Chart** | the deal map / pipeline | `/chart` |
| **The Helm** | the nav rail / command palette | `src/components/helm-nav.tsx` |
| **The Log** | the activity timeline | `/log` |
| **VoyageStage** | a deal's pipeline stage | enum: CHARTED, PROVISIONED, UNDERWAY, BOARDING, ANCHORED, WRECKED |

- **confidence:** High
- **source:** issue #1 · PR #9 · 2026-06-07
