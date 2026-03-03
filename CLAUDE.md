# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint
```

No test framework is configured. Verify changes by running `npm run dev` and checking for TypeScript/lint errors with `npm run build`.

## Architecture Overview

**Browser-only Next.js 14 app** — no server, no API routes. The user provides their own Gemini API key, which is stored in `sessionStorage` and sent directly to Google's Gemini API from the browser via `@google/genai` SDK.

### State Management (Two Parallel State Machines)

There are **two independent state machines** that must be understood together:

1. **`phase` (game logic)** — defined as `GamePhase` enum in [lib/types.ts](lib/types.ts), managed by Zustand in [lib/store.ts](lib/store.ts):
   ```
   IDLE → DISCUSSION → VOTING → RESOLUTION → GAME_OVER
                  ↑                  │
                  └──────────────────┘  (2+ survivors → next round)
   ```

2. **`screenPhase` (UI visibility)** — local state in [app/game/page.tsx](app/game/page.tsx):
   ```
   'member-selection' → 'game' ⇄ 'log' → 'game-over'
   ```

Additionally, **`UIState`** (defined in [lib/types.ts](lib/types.ts), stored in [lib/store.ts](lib/store.ts)) is a fine-grained discriminated union (~30 states) that tracks tap-wait, typing, API-fetching, and animation sub-states within each phase. Helpers in [lib/uiState.ts](lib/uiState.ts) (`isTapWait`, `isTyping`, etc.) are used extensively in the game page to drive UI transitions.

### LLM Integration

All Gemini calls are in [lib/byokClient.ts](lib/byokClient.ts). Model constants are at the top of that file:
- Primary: `gemini-3-flash-preview`
- Fallback: `gemini-2.5-flash`

The fallback chain is: primary → fallback model → hardcoded text (`'……'`). Game continuity is prioritized over API errors. If a model is deprecated, update the constants at the top of `lib/byokClient.ts`.

Prompts are built in [lib/prompts.ts](lib/prompts.ts). LLM output format for discussion turns:
```
[expression]内心テキスト|||[expression]発言テキスト
```
Parsed by [lib/turnResponseParser.ts](lib/turnResponseParser.ts) with character limits (`MAX_DISCUSSION_THOUGHT_CHARS=400`, `MAX_DISCUSSION_SPEECH_CHARS=800`).

### Character System

All character personalities are defined in [lib/constants.ts](lib/constants.ts) (`AGENT_PERSONALITIES`). Each character has:
- `characterId` — used as image filename prefix
- `stats` — `survivalInstinct`, `cooperativeness`, `cunningness` (0–100)
- `unlockTier` — `undefined` = always available; number = unlocked when player earns a trophy of that rarity

Hidden character unlock state is persisted in `localStorage` key `deathgame_max_rarity` via [lib/hiddenCharacter.ts](lib/hiddenCharacter.ts).

Character images follow the naming convention: `public/agents/{characterId}_{expression}_{mouth}.jpg`
- Expressions: `default`, `painful`, `happy`, `fainted`
- Mouth: `0` (closed), `1` (open)
- Size: 640×640px, JPG Q60

See [docs/adding-characters.md](docs/adding-characters.md) for the full guide on adding characters (requires 4 code changes + 11 image assets).

### Configuration Singletons

[lib/config/](lib/config/) exports singleton manager instances:
- `gameConfig` — runtime game settings (turnsPerRound, tieBreaker, debugMode, mockMode)
- `uiConfig` — UI timing settings (typewriter speed, animation durations)
- `audioConfig` — audio settings

These are accessed via `gameConfig.getValue('key')` or `gameConfig.update({...})`.

### Key File Map

| Concern | File |
|---------|------|
| All game state + actions | [lib/store.ts](lib/store.ts) |
| Type definitions | [lib/types.ts](lib/types.ts) |
| Gemini API calls | [lib/byokClient.ts](lib/byokClient.ts) |
| BYOK discussion flow (per-turn) | [lib/byokGameFlow.ts](lib/byokGameFlow.ts) |
| LLM prompt builders + schemas | [lib/prompts.ts](lib/prompts.ts) |
| UIState helpers | [lib/uiState.ts](lib/uiState.ts) |
| Character personalities | [lib/constants.ts](lib/constants.ts) |
| Trophy evaluation | [lib/trophies.ts](lib/trophies.ts) |
| Hidden character unlock | [lib/hiddenCharacter.ts](lib/hiddenCharacter.ts) |
| Game page (orchestrator) | [app/game/page.tsx](app/game/page.tsx) |

### Visual Style

Retro cyberpunk / dystopian (PC-88/MSX aesthetic):
- Black background + Phosphor Green (`#33ff00`) + Alert Red (`#ff0055`)
- Font: DotGothic16 (Google Fonts)
- Effects: CRT overlay, typewriter animation, retro beep, lip-sync animation

Agent colors are fixed per slot (`agent-0` through `agent-4`), not per character — defined in `AGENT_COLORS` in [lib/types.ts](lib/types.ts).
