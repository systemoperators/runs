# changelog

## 0.1.0 (2026-02-21)

- initial release
- RunTracker class with full lifecycle management
- 3-level model: Run > Step > Call
- RunStore interface for bring-your-own persistence
- batch progress tracking (itemsTotal/Processed/Succeeded/Failed)
- retry tracking at step and call levels
- execute* convenience wrappers with automatic error handling
- helper functions: status checks, duration formatting, output increments
