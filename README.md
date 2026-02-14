# Kapanak - Spaced Repetition Flashcards

A simple, offline-first flashcard app for language learning. Works on desktop and mobile browsers, installable as a PWA.

## Features

- **Spaced Repetition (SM-2)** - Cards you know appear less often, cards you struggle with appear more
- **Offline Support** - Works without internet after first load
- **Polish Language Support** - Full support for Polish diacritics (ą ć ę ł ń ó ś ż ź)
- **Dark Mode** - Auto-detects system preference or manual toggle
- **Local Storage** - All data stays on your device, no account needed
- **Import/Export** - Backup and restore your cards as JSON

## Getting Started

### Use Online
Visit: `https://rafailsharifov.github.io/kapanak/`

### Install on iPhone
1. Open the URL in Safari
2. Tap Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Install on Android
1. Open the URL in Chrome
2. Tap the menu (3 dots)
3. Tap "Add to Home screen"

## How to Use

### Import Cards
1. Tap **Import Cards**
2. Enter cards in format: `front,back` (one per line)
3. Example:
   ```
   kot,cat
   pies,dog
   Jak się masz?,How are you?
   ```
4. Tap **Import Cards**

### Study Modes

| Mode | Description |
|------|-------------|
| **Study Due** | Review cards scheduled for today. Affects SRS timing. |
| **Practice All** | Practice any cards without affecting schedule. |

### Review Buttons

| Button | Effect |
|--------|--------|
| **Again** | Card reappears in ~1 minute |
| **Good** | Card scheduled for 1-6+ days |
| **Easy** | Card scheduled for longer interval |

### Manage Cards
- Tap **Manage Cards** to view all cards
- Tap pencil icon to edit a card
- Tap trash icon to delete a card

### Keyboard Shortcuts (Desktop)

| Key | Action |
|-----|--------|
| Space / Enter | Reveal card |
| 1 or A | Again |
| 2 or G | Good |
| 3 or E | Easy |
| Ctrl+Z | Undo last review |

## Data & Privacy

- All data stored locally in your browser (IndexedDB)
- No account required
- No data sent to any server
- Export backups anytime from Settings

## License

MIT License - feel free to use, modify, and share.
