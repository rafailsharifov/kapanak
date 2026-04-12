# 🦋 Kapanak Architecture

High-level technical design for developers.

## Overview

Kapanak is a **local-first Progressive Web App (PWA)** built with vanilla JavaScript. No frameworks, no backend - all logic runs in the browser. "Kapanak" means butterfly.

The app combines **SM-2 spaced repetition** with a **spatial memory notebook** — a fixed-position grid view that leverages positional/visuospatial memory for stronger recall.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │    UI Layer   │  │  App Logic    │  │   Storage   │ │
│  │  (HTML/CSS)   │◄─┤  (modules)    │◄─┤ (IndexedDB) │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
│                            │                            │
│                     ┌──────┴──────┐                     │
│                     │   SM-2      │                     │
│                     │ Algorithm   │                     │
│                     └─────────────┘                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Service Worker (sw.js)                 ││
│  │              Offline Caching Layer                  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
kapanak/
├── index.html          # Single HTML file with all screens
├── manifest.json       # PWA manifest (icons, theme, name)
├── sw.js               # Service Worker for offline support
├── css/
│   └── style.css       # All styles, CSS variables, dark mode
├── js/
│   ├── version.js      # Single source of truth for version
│   ├── db.js           # IndexedDB operations via Dexie.js
│   ├── sm2.js          # SM-2 spaced repetition algorithm
│   ├── import.js       # Text parser + import screen UI
│   ├── ui.js           # Shared UI state & utilities
│   ├── stats.js        # Home screen stats & streak
│   ├── study.js        # Study/practice session logic
│   ├── manage.js       # Card management screen
│   ├── settings.js     # Preferences & data management
│   ├── notebook.js     # Spatial notebook view
│   └── app.js          # Entry point, module init
└── icons/              # PWA icons (72px - 512px)
```

## Modular Architecture

The app uses a **module pattern** with `window.*` globals. Each module is an IIFE that exposes a public API.

| Module | Global | Responsibility |
|--------|--------|---------------|
| `ui.js` | `window.UI` | Shared state (screen, theme, swap), `showScreen()`, `showToast()`, `escapeHtml()` |
| `stats.js` | `window.StatsModule` | Home dashboard, pipeline bar, streak, today count |
| `study.js` | `window.StudyModule` | Due/practice/page-primed sessions, swipe, keyboard, undo |
| `manage.js` | `window.ManageModule` | Card list, search, sort, edit modal |
| `settings.js` | `window.SettingsModule` | Dark mode, swap, notifications, export/import/delete |
| `notebook.js` | `window.NotebookModule` | Spatial grid view, filters, flip/translation toggles, page dots |
| `import.js` | `window.ImportParser` + `window.ImportModule` | Text parser + import screen with duplicate detection |
| `app.js` | — | Entry point: init all modules, wire home buttons |

**Module load order** (defined in `index.html` script tags):
`version → db → sm2 → import → ui → stats → study → manage → settings → notebook → app`

## Data Model

### Card Schema (v2)

```javascript
{
  id: string,           // UUID v4
  front: string,        // Question/prompt
  back: string,         // Answer
  anchor: string,       // Memory mnemonic / visual image note (optional)
  interval: number,     // Days until next review
  easeFactor: number,   // SM-2 difficulty (default: 2.5)
  repetitions: number,  // Consecutive correct answers
  dueDate: string,      // ISO date for next review
  lastReviewed: string, // ISO date of last review
  createdAt: string     // ISO date of creation
}
```

### Storage

- **IndexedDB** via [Dexie.js](https://dexie.org/)
- Database: `KapanakDB`
- Table: `cards` (indexed by `id`, `dueDate`, `createdAt`)
- Schema v2 adds `anchor` field with auto-migration

## Key Features Architecture

### Notebook View (Spatial Memory)

Designed around **visuospatial memory** — cards are assigned permanent positions based on creation order.

- Fixed 3×4 grid (12 cards per page), newest page first
- Cards never change position — spatial anchor is stable
- Auto-sized text: font scales inversely with word length, centered in cell
- Multi-value text (e.g. `friend / familiar`) splits on separators and renders line-by-line
- **Filters**: All / Due — due cards get a glowing border, non-matching cells dim
- **Controls**: "With Translation" toggle + "Flip All" toggle (independent of each other)
- Individual cell tap flips that cell (XOR with global flip state)
- **Page dots** with due-card indicators; current page highlighted in white
- **Page-primed study**: browse a page first (spatial pre-load), then quiz those cards

### Card Flip Animation
- Pure CSS 3D transform (`rotateY(180deg)`)
- GPU-accelerated, no JavaScript overhead
- `backface-visibility: hidden` for clean flip

### Swipe Gestures
- Touch events: `touchstart`, `touchmove`, `touchend`
- Threshold-based detection (80px minimum)
- Visual feedback during swipe with CSS transforms

### Stats Dashboard
- **Streak**: Stored in localStorage, checked against dates
- **Leitner Pipeline**: Visual breakdown of cards by phase (New → Learning → Graduated → Mastered)
- **Today's count**: Reset daily via date comparison

### Study Session
- Position hint (`Pg X · #Y`) shown during page-primed study
- Memory anchor hint shown on card front (if set)
- Undo last review action

### Push Notifications
- Uses Notification API with permission request
- Checks daily at 9 AM if user hasn't studied

### Duplicate Detection
- Case-insensitive comparison of front text
- Uses Set for O(1) lookup performance

## Core Modules

### 1. db.js - Database Layer

```javascript
window.CardDB = {
  createCard(front, back)    // Create new card with SM-2 defaults + empty anchor
  addCards(cards)            // Bulk insert
  getAllCards()              // Get all cards
  getDueCards()              // Get cards where dueDate <= now
  getDueCount()              // Count due cards
  getTotalCount()            // Count all cards
  getCard(id)                // Get single card
  updateCard(id, updates)    // Update card fields
  deleteCard(id)             // Delete single card
  deleteAllCards()           // Clear all data
  exportData()               // Export as JSON string
  importData(json)           // Import from JSON string
}
```

### 2. sm2.js - Spaced Repetition

Implements the [SM-2 algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2):

```javascript
window.SM2 = {
  calculateNextReview(card, quality)  // Returns updated card
  getIntervalHint(card, quality)      // Human-readable interval
  sortCardsForReview(cards)           // Sort for study session
  LEARNING_COUNT                      // Sub-day learning step count (1)
  MASTERY_THRESHOLD                   // Reps needed for mastery (5)
}
```

### 3. import.js - Card Parser + Import Screen

```javascript
window.ImportParser = {
  parseImportText(text)    // Parse "front,back" lines
  countValidCards(text)    // Preview count
  importFromText(text)     // Full pipeline to card objects
}
window.ImportModule = { init() }  // Import screen UI with duplicate detection
```

### 4. notebook.js - Spatial Notebook

```javascript
window.NotebookModule = {
  init()                   // Wire up DOM and events
  open()                   // Load cards, reset state, show screen
}
```

## PWA Architecture

### Service Worker (sw.js)

**Caching Strategy:** Cache-first with network fallback

**Cached Assets:**
- HTML, CSS, all JS modules
- Icons
- Dexie.js CDN

**Version Management:**
- `version.js` defines `APP_VERSION`
- Service worker uses: `CACHE_NAME = 'kapanak-v${APP_VERSION}'`
- Changing version triggers cache refresh

## UI Architecture

### Screen-Based Navigation

Single-page app with multiple "screens" (sections):

| Screen | ID | Purpose |
|--------|----|---------|
| Home | `home-screen` | Stats, main actions |
| Study | `study-screen` | Flashcard review |
| Complete | `complete-screen` | Session summary |
| Import | `import-screen` | Add new cards |
| Manage | `manage-screen` | View/edit/delete cards |
| Notebook | `notebook-screen` | Spatial grid view |
| Settings | `settings-screen` | Preferences, data |

Navigation: `UI.showScreen('name')` — uses `getElementById(name + '-screen')`.

### CSS Architecture

- **CSS Variables** for theming
- **Dark mode** via `[data-theme="dark"]` attribute
- **Mobile-first** responsive design
- **Safe area insets** for iOS notch

## Data Flow

### Import Flow
```
User Input → parseImportText() → createCard() → addCards() → IndexedDB
```

### Study Flow
```
getDueCards() → sortCardsForReview() → showCard() → handleReview()
     ↓                                                    ↓
  IndexedDB                              calculateNextReview() → updateCard()
```

### Page-Primed Study Flow
```
NotebookModule.open() → browse page (spatial encoding) → "Study this page"
     ↓                                                        ↓
  getAllCards()                              startPageStudy(pageCards, positionMap)
  sorted by createdAt desc                       ↓
                                          StudyModule study flow with position hints
```

## Extending the App

### Adding a New Screen

1. Add HTML section in `index.html`:
   ```html
   <section id="new-screen" class="screen">...</section>
   ```

2. `UI.showScreen('new')` works automatically (ID-based lookup).

### Adding a New Module

1. Create `js/newmodule.js` with IIFE pattern exposing `window.NewModule = { init }`.
2. Add `<script>` tag in `index.html` (before `app.js`).
3. Call `NewModule.init()` from `app.js` init function.
4. Add to service worker cache list in `sw.js`.

### Adding a Database Field

1. Add new version in `db.js` with upgrade handler.
2. Update `createCard()` with default value.

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [Dexie.js](https://dexie.org/) | 3.2.4 | IndexedDB wrapper |

Loaded via CDN, cached by service worker.

## Browser Support

- Chrome/Edge 80+
- Safari 14+
- Firefox 75+

Requires: IndexedDB, Service Workers, CSS Variables, ES6+
