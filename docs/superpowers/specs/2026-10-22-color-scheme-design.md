# Color Scheme Feature Design

## Intent

Users can personalize their experience with pastel color schemes (red, green, blue, black, white, orange, purple, brown, plus the current "vanilla" slate). A global preference applies to all trips; a per-trip override reskins a specific journey. Per-trip schemes also apply to public visitors via the share link.

## Why

Personalization increases emotional attachment to a journey app. Per-trip color gives each journey a distinct visual identity, making shared trips feel curated rather than generic.

## Goals

- 10 color schemes (vanilla, red, green, blue, black, white, orange, purple, brown, teal), each with light and dark variants, using desaturated pastel tones
- Global user preference (stored on user profile), applied instantly in account settings (preview)
- Per-trip override (stored on journey), auto-saved on pick in journey settings (preview)
- Per-trip scheme applies to public visitors (who have no preferences of their own)
- Trip scheme takes precedence over user's global preference for all viewers (owner, collaborators, public)
- Full migration of hardcoded Tailwind colors to CSS variables across all components
- Login page is always vanilla (unauthenticated users have no color scheme)
- No flash of wrong theme: color scheme is set from API response after login, cached in localStorage for returning sessions

## Non-goals

- Custom color pickers (users pick from a fixed palette)
- Per-post coloring
- Animations on theme transition
- Changing the logo or font per scheme

## Decisions

| Question | Decision |
|----------|----------|
| Account settings: instant or save button? | Instant — user previews the scheme immediately, persisted to server on pick |
| Journey settings: save button or auto-save? | Auto-save on pick — instant preview, persisted to server immediately |
| Hardcoded Tailwind colors: defer or migrate? | Full migration now — all `text-blue-600`, `bg-gray-50`, `hover:ring-blue-500`, etc. replaced with CSS variables |
| First-visit flash: acceptable? | Not needed — login page is always vanilla, scheme applied after login from API response |
| Collaborators: trip scheme or their own? | Trip scheme — the owner is the master of the journey's appearance |
| Public page with no trip scheme: vanilla or visitor preference? | Vanilla — public visitors have no preferences |

## Color Schemes

Each scheme defines all CSS variables from `globals.css` in both light and dark variants. Colors are desaturated, soft, and non-aggressive (pastel).

| Scheme | Light feel | Dark feel |
|--------|-----------|-----------|
| vanilla | Current slate/blue (unchanged) | Current dark (unchanged) |
| red | Warm rose-tinted backgrounds, soft red accents | Deep warm charcoal, muted rose |
| green | Sage-tinted backgrounds, soft green accents | Deep forest charcoal, muted green |
| blue | Sky-tinted backgrounds, soft blue accents | Deep navy, muted sky |
| black | Cool gray-white, high contrast | True near-black, minimal color |
| white | Pure white, warm gray accents | Warm dark gray, soft contrast |
| orange | Peach-tinted backgrounds, soft coral accents | Deep warm brown-charcoal, muted amber |
| purple | Lavender-tinted backgrounds, soft purple accents | Deep plum, muted lavender |
| brown | Sand-tinted backgrounds, soft taupe accents | Deep espresso, warm muted brown |
| teal | Soft cyan-tinted backgrounds, muted teal accents | Deep teal-charcoal, soft cyan |

## CSS Architecture

### Class strategy

CSS classes `theme-vanilla`, `theme-red`, `theme-green`, etc. are applied to the `<html>` element. The existing `.dark` class from `next-themes` continues to control light/dark independently.

### Specificity solution

The existing bare `:root` block stays as the default (vanilla light). The existing bare `.dark` block stays as the vanilla dark default. Non-vanilla schemes use `.theme-red`, `.theme-red.dark`, etc. with higher specificity (2 classes > 1 class), so they correctly override the defaults.

Every non-vanilla scheme MUST define all ~25 CSS variables in both light and dark variants to prevent vanilla values leaking through.

### Hardcoded color migration

All hardcoded Tailwind color classes in components are replaced with CSS variable-based classes:

| Hardcoded | Replaced with |
|-----------|---------------|
| `text-blue-600` | `text-primary` |
| `hover:ring-blue-500` | `hover:ring-ring` |
| `bg-gray-50 dark:bg-gray-900` | `bg-background` |
| `text-gray-600 dark:text-gray-400` | `text-muted-foreground` |
| `bg-gray-900` (fab-button) | `bg-primary` |
| `shadow-neon-blue` | Keep as-is (decorative shadow, acceptable in all schemes) |
| `text-blue-500` / `bg-blue-500` | `text-primary` / `bg-primary` |

A full audit of all components will be done during implementation.

## Data Model

### Database changes

**users table**: add `color_scheme VARCHAR(20) DEFAULT 'vanilla'`
- Migration via `DO $$ BEGIN ALTER TABLE ... ADD COLUMN ... EXCEPTION WHEN duplicate_column ...`

**journeys table**: add `color_scheme VARCHAR(20) DEFAULT NULL`
- `NULL` = use viewer's global preference
- A value = this journey has a specific scheme
- Same migration pattern

### API changes

**Types** (backend `User`, `ApiUser`, `Journey` + frontend `User`, `Journey`): add `color_scheme` field.

**`mapDbUserToApiUser`**: include `color_scheme`.

**All user SELECT queries** (~6 queries across `userRoutes.ts`, `protectedUserRoutes.ts`): add `color_scheme` to column lists and `RETURNING` clauses.

**All journey SELECT queries** (~10 queries across `journeyRoutes.ts`): add `color_scheme` to column lists and `RETURNING` clauses.

**`PUT /users/profile`**: add `color_scheme` to schema body and SQL UPDATE.

**`PUT /journeys/:id`**: add `color_scheme` to schema body and SQL UPDATE (with COALESCE to preserve existing value if not provided).

**`POST /public-journeys/:publicLinkId`**: add `color_scheme` to the SELECT column list.

### Validation

`color_scheme` accepted values: `vanilla`, `red`, `green`, `blue`, `black`, `white`, `orange`, `purple`, `brown`, `teal`. For journeys, also `null` (use viewer's preference).

## Frontend

### Theme application

A `ColorSchemeProvider` context wraps the authenticated app and the public journey page. It applies the color scheme class to `document.documentElement`:

1. If the current journey has a non-null `color_scheme` → apply `theme-{scheme}`
2. Otherwise → apply the user's global `theme-{user.color_scheme}`
3. Default → no class (falls back to `:root` / `.dark` = vanilla)

The class is applied/removed via `useEffect` watching the journey and user state.

### Context placement

```
<AuthProvider>
  <JourneyProvider>
    <ColorSchemeProvider>  ← new
      <App />
    </ColorSchemeProvider>
  </JourneyProvider>
</AuthProvider>
```

For the public journey page, the `ColorSchemeProvider` (or a lighter version of it) wraps the `PublicPageLayout` and reads the scheme from the journey data returned by the API.

### Login page

The login page is always vanilla. Since `ColorSchemeProvider` only applies a class when there's a user or journey with a scheme, the login page naturally has no scheme class → falls back to `:root` / `.dark`.

### UI entry points

**ManageAccountDialog** (global preference):
- New "Color scheme" select dropdown below the existing language and theme controls
- Shows a color swatch (small colored circle) next to each option
- On change: applies instantly (updates the class for preview) + persists to server via `PUT /users/profile`
- No need to wait for "Save Changes" button

**ManageJourneyDialog** (per-trip override):
- New "Color scheme" section with a select dropdown
- Options: "Use my preference" (null), plus the 9 schemes
- On change: applies instantly (preview) + auto-saves via `PUT /journeys/:id`

**PublicJourneyPage**:
- Reads `color_scheme` from the journey data returned by `POST /public-journeys/:publicLinkId`
- Applies it to the page via the same class mechanism

### localStorage caching

After login or profile fetch, cache `color_scheme` in `localStorage` as `colorScheme`. On app load (after token validation), apply the cached scheme immediately, then correct if the API returns a different value. Since the login page is always vanilla, there's no FOUC concern — the scheme only matters once authenticated, and by then we have the API response.

### Translation keys

Add `colorScheme` section to all 4 locale files (en, fr, es, de):
- `colorScheme.label`: "Color scheme"
- `colorScheme.useMyPreference`: "Use my preference"
- `colorScheme.vanilla`, `.red`, `.green`, `.blue`, `.black`, `.white`, `.orange`, `.purple`, `.brown`, `.teal` — translated color names

## Precedence

```
Journey-specific color_scheme (if set, non-null)
  └─ User's global color_scheme
       └─ "vanilla" (default, no class applied)
```

For public visitors: journey's `color_scheme` → vanilla default.

## Scope summary

- ~15 SQL queries updated (column lists + RETURNING clauses)
- 5 TypeScript interfaces updated (backend User, ApiUser, Journey; frontend User, Journey)
- 2 Fastify route schemas updated (PUT profile, PUT journey)
- 1 new CSS block in globals.css (~400 lines of CSS variables for 8 schemes × 2 variants)
- 1 new React context (ColorSchemeProvider)
- ~30+ component files audited for hardcoded color migration
- 4 locale files updated with colorScheme translations
- 2 UI dialogs updated (ManageAccountDialog, ManageJourneyDialog)
