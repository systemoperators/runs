# changelog

## 0.2.0 (2026-02-21)

- add optional step links: many-to-many links between steps and entities
- new types: StepLink, StepLinkType, StepLinkStore, CreateStepLinkParams
- RunTracker accepts optional `linkStore` in config
- `linkStep(stepId, params)` returns link ID or null if no linkStore
- `getStepLinks(stepId)` returns links or [] if no linkStore
- existing RunStore implementations are unaffected (non-breaking)

## 0.1.0 (2026-02-21)

- initial release
- RunTracker class with full lifecycle management
- 3-level model: Run > Step > Call
- RunStore interface for bring-your-own persistence
- batch progress tracking (itemsTotal/Processed/Succeeded/Failed)
- retry tracking at step and call levels
- execute* convenience wrappers with automatic error handling
- helper functions: status checks, duration formatting, output increments
