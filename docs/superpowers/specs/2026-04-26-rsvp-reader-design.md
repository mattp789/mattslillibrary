# RSVP Speed Reader — Design Spec
**Date:** 2026-04-26

## Overview

A local-network web app for RSVP (Rapid Serial Visual Presentation) speed reading. Upload PDFs from a PC, extract text server-side, and read word-by-word at adjustable speed from any device on the local network (including mobile).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Express.js (Node.js) |
| PDF extraction | pdfjs-dist (server-side) |
| Storage | Local filesystem (PC) |
| Theme | Dark mode only |

---

## Architecture

Express serves the React frontend as static files and exposes a REST API. The server runs on the PC and is reachable by mobile devices on the same local network via `http://<pc-ip>:3001`.

```
Mobile browser
     |
     | HTTP (local network)
     v
Express server (PC)
  ├── Serves React SPA (static)
  ├── REST API (/api/books/*)
  ├── /uploads/        ← raw PDF files
  └── /cache/          ← extracted word arrays (.json)
```

PDF extraction happens at upload time. The result is cached as a `.json` file alongside the PDF so subsequent reads skip re-extraction entirely.

---

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/books` | Upload PDF, extract text, cache word array |
| `GET` | `/api/books` | List all stored books (id, title, word count) |
| `GET` | `/api/books/:id/words` | Return cached word array for a book |
| `DELETE` | `/api/books/:id` | Remove PDF and cache |

---

## Text Extraction Pipeline

1. Receive uploaded PDF via multipart form
2. Extract raw text using `pdfjs-dist` (server-side)
3. Run `cleanText(rawText)` post-processing:
   - Rejoin hyphenated line breaks (`read-\ning` → `reading`)
   - Strip standalone page numbers (lines that are only digits)
   - Filter obvious header/footer artifacts by line-length heuristics
4. Split into word array
5. Run `enrichText(words)` — **no-op today**, wired and ready for an AI enrichment pass later
6. Cache word array as `<id>.json`

---

## Screens

### Library Screen
- Grid/list of uploaded books showing title and word count
- Upload button — opens file picker, accepts PDF only
- Books with failed/empty extraction show a warning badge with an explanation
- Delete button per book

### Reader Screen
- Full-screen RSVP display (dark background)
- Fixed-position word display with ORP highlighting (see below)
- Progress bar below the word showing position through the book
- Control bar at the bottom (always visible)

### Control Bar (Reader Screen)
- Play / Pause button
- WPM slider — range 50–1000, default 300
- Font size toggle — Small / Medium / Large
- Position scrubber — click/drag to jump to any word in the book

---

## ORP Word Display

The Optimal Recognition Point (ORP) letter is fixed at the same screen position for every word. The word is split into three zones:

```
[ before characters ] [ ORP letter ] [ after characters ]
   right-aligned         fixed X        left-aligned
```

- ORP index: `Math.floor(word.length * 0.35)` (roughly 2nd–3rd character)
- ORP letter rendered in a highlight color (e.g., amber/orange)
- Before/after characters rendered at reduced opacity
- A thin vertical guide line above and below the ORP letter acts as a focal crosshair
- Single-character words: the character itself is the ORP letter

---

## Reader State

Managed by `useReducer` inside `ReaderScreen`:

| Field | Type | Default |
|---|---|---|
| `words` | `string[]` | `[]` |
| `index` | `number` | `0` |
| `wpm` | `number` | `300` |
| `playing` | `boolean` | `false` |
| `fontSize` | `'sm' \| 'md' \| 'lg'` | `'md'` |

Playback is driven by a `useEffect` + `setInterval` that increments `index` by 1 every `Math.round(60000 / wpm)` ms when `playing` is true. Reaches end → `playing` set to false, `index` stays at last word.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Upload is not a valid PDF | Toast notification on library screen, file not saved |
| Extraction produces empty text (e.g., scanned image PDF) | Book saved with warning badge; opens message explaining the issue |
| Network error fetching word array | Error state on reader screen with Retry button |
| End of book | Playback stops, "Finished" indicator shown |

---

## Out of Scope (for now)

- Hosting / public deployment
- AI-powered text enrichment (hook exists, not implemented)
- Better extraction for scanned / multi-column PDFs
- User accounts or multiple users
- Bookmarking / reading position persistence across sessions
- Chapter-aware navigation
