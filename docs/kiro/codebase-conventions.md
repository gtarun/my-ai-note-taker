# Codebase Conventions

## Architecture Pattern

The codebase follows a clean separation:

- `app/` — Expo Router screens. Thin wrappers that re-export from `src/screens/`.
- `src/screens/` — Screen components. Compose UI from `src/components/` and call into `src/features/` for presentation logic.
- `src/features/` — Pure presentation logic. Each feature has a `presentation.ts` (pure functions that compute view models from data) and a `presentation.test.ts`. No side effects.
- `src/services/` — Side-effectful logic. Database access, API calls, file I/O. Each service has a co-located `.test.ts` file.
- `src/components/` — Shared UI components. `ui/` subfolder for design system primitives.

## Naming Conventions

- Files: camelCase for `.ts`, PascalCase for `.tsx` components
- Feature folders: kebab-case (`extraction-layers` style, but currently just lowercase words)
- Test files: co-located as `*.test.ts` next to the source file
- Types: PascalCase, exported from `src/types.ts` (central type file)
- Services: named exports, async functions, no classes
- Database: snake_case column names, mapped to camelCase in TypeScript via `mapMeetingRow`

## State Management

- Zustand for client-side state (imported but usage is feature-specific)
- No global Redux store
- Settings are persisted via Secure Store / cloud sync, not in-memory state
- SQLite is the source of truth for meetings, models, and layers

## Design System

Defined in `src/theme.ts`:

- `palette` — semantic color tokens (paper, card, ink, accent, danger, etc.)
- `ambient` — background gradient blob colors
- `radii` — border radius scale (md: 12, lg: 18, xl: 24, card: 24, pill: 999)
- `typography` — font family mappings (Manrope for headings, Inter for body)
- `elevation` — shadow presets
- `resolveTypography(useCustomFonts)` — returns font families or weight fallbacks

Custom fonts: Inter (400, 500, 600) + Manrope (700, 800), loaded in root layout.

## Testing

- Framework: Vitest (node environment, globals enabled)
- Pattern: co-located test files (`*.test.ts` next to source)
- Run: `npm test` or `vitest run`
- Tests exist for: services, features/presentation, navigation, onboarding model, theme, startup
- No React component tests currently (presentation logic is tested as pure functions)
- Supabase Edge Functions have their own test files in `_shared/`

## Platform Handling

- `src/db.ts` does a platform split: `db.native.ts` for iOS/Android, `db.web.ts` for web
- `modules/mu-fathom-local-ai/` has platform-specific implementations (iOS real, Android boundary, web stub)
- Provider routing handles `local` as a special case (no API key, routes to native module)

## Error Handling

- Services throw errors that bubble up to screens
- Meeting processing catches errors and updates status to `failed` with `errorMessage`
- Bootstrap failures show an error screen in the root layout
- Missing native runtime shows a clear "requires custom build" message

## Form Handling

- react-hook-form + zod for form validation (used in settings, layers)
- `@hookform/resolvers` for zod integration

## Key Patterns

- IDs generated as `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
- Audio files copied into app storage on import (not referenced in-place)
- SHA-256 verification for downloaded model files
- Cloud-first with local fallback: settings/layers try cloud sync, fall back to local cache
- Legacy settings migration: multiple legacy format readers with progressive fallback
