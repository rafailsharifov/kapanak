# 🦋 Kapanak Architecture

High-level technical design for developers.

## Overview

Kapanak is a **local-first Progressive Web App (PWA)** built with vanilla JavaScript. No frameworks, no backend - all logic runs in the browser. "Kapanak" means butterfly.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │    UI Layer   │  │  App Logic    │  │   Storage   │ │
│  │  (HTML/CSS)   │◄─┤   (app.js)    │◄─┤ (IndexedDB) │ │
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
│   ├── import.js       # Text parser for card import
│   └── app.js          # Main application logic & UI
└── icons/              # PWA icons (72px - 512px)
```

## Data Model

### Card Schema

```javascript
{
  id: string,           // UUID v4
  front: string,        // Question/prompt
  back: string,         // Answer
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

## Key Features Architecture

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
- **Mastery %**: Cards with 3+ repetitions / total cards
- **Today's count**: Reset daily via date comparison

### Sound Effects
- Web Audio API (no external files)
- Oscillator-based tones for different actions
- User-toggleable via Settings

### Confetti Animation
- Dynamically created DOM elements
- CSS keyframe animation for falling effect
- Auto-cleanup after 4 seconds

### Push Notifications
- Uses Notification API with permission request
- Checks daily at 9 AM if user hasn't studied
- Stored preference in localStorage

### Duplicate Detection
- Case-insensitive comparison of front text
- Uses Set for O(1) lookup performance
- Prompts user before skipping duplicates

## Core Modules

### 1. db.js - Database Layer

```javascript
window.CardDB = {
  createCard(front, back)    // Create new card with SM-2 defaults
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
}
```

**Quality Ratings:**
- 0 = Again (complete failure)
- 3 = Good (correct with effort)
- 5 = Easy (perfect recall)

**Algorithm Summary:**
```
if quality < 3:
    reset repetitions, interval = 0
else:
    if repetitions == 0: interval = 1 day
    elif repetitions == 1: interval = 6 days
    else: interval = interval × easeFactor

easeFactor += 0.1 - (5 - quality) × (0.08 + (5 - quality) × 0.02)
easeFactor = max(1.3, easeFactor)
```

### 3. import.js - Card Parser

Simple text format parser:

```javascript
window.ImportParser = {
  parseImportText(text)    // Parse "front,back" lines
  countValidCards(text)    // Preview count
  importFromText(text)     // Full pipeline to card objects
}
```

**Format Rules:**
- One card per line
- First comma separates front/back
- Empty lines ignored
- UTF-8 (Polish safe)

### 4. app.js - Application Controller

Main module handling:
- Screen navigation
- Event listeners
- Study session state
- UI updates
- Settings management

**State Variables:**
```javascript
let currentScreen = 'home'
let studyQueue = []
let currentCardIndex = 0
let reviewedCount = 0
let lastAction = null        // For undo
let isPracticeMode = false
let isDarkMode = false
let isSwapped = false        // Swap front↔back
let soundEnabled = false
let notificationsEnabled = false

// Swipe gesture state
let touchStartX = 0
let touchStartY = 0
let isSwiping = false
```

## PWA Architecture

### Service Worker (sw.js)

**Caching Strategy:** Cache-first with network fallback

```javascript
// Install: Cache all assets
self.addEventListener('install', ...)

// Activate: Clean old caches
self.addEventListener('activate', ...)

// Fetch: Serve from cache, fallback to network
self.addEventListener('fetch', ...)
```

**Cached Assets:**
- HTML, CSS, JS files
- Icons
- Dexie.js CDN

**Version Management:**
- `version.js` defines `APP_VERSION`
- Service worker uses: `CACHE_NAME = 'kapanak-v${APP_VERSION}'`
- Changing version triggers cache refresh

### manifest.json

```json
{
  "name": "Kapanak - Spaced Repetition Flashcards",
  "short_name": "Kapanak",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#1a1a2e",
  "background_color": "#1a1a2e"
}
```

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
| Settings | `settings-screen` | Preferences, data |

### CSS Architecture

- **CSS Variables** for theming
- **Dark mode** via `[data-theme="dark"]` attribute
- **Mobile-first** responsive design
- **Safe area insets** for iOS notch

```css
:root {
  --bg-primary: #f8f9fa;
  --accent: #4361ee;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary: #0f0f1a;
  /* ... */
}
```

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

### Practice Flow
```
getAllCards() → shuffleArray() → showCard() → handleReview()
                                                    ↓
                                         (no database update)
```

## Extending the App

### Adding a New Screen

1. Add HTML section in `index.html`:
   ```html
   <section id="new-screen" class="screen">...</section>
   ```

2. Register in `app.js`:
   ```javascript
   const screens = { ..., new: document.getElementById('new-screen') }
   ```

3. Navigate with:
   ```javascript
   showScreen('new')
   ```

### Adding a Database Field

1. Update schema in `db.js` (increment version):
   ```javascript
   db.version(2).stores({ cards: 'id, dueDate, newField' })
   ```

2. Update `createCard()` with default value

3. Handle migration if needed

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [Dexie.js](https://dexie.org/) | 3.2.4 | IndexedDB wrapper |

Loaded via CDN, cached by service worker.

## Browser Support

- Chrome/Edge 80+
- Safari 14+
- Firefox 75+

Requires:
- IndexedDB
- Service Workers
- CSS Variables
- ES6+
