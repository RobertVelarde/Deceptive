# Deceptive

A serverless, deterministic social deduction game platform. Host or join **Insider**, **Chameleon**, **Spyfall**, or **Wavelength** with no backend — the entire game state lives in a shareable URL or QR code.

**Live site:** [deceptive.robertvelardejr.com](https://deceptive.robertvelardejr.com)

---

## How it works

Deceptive uses a seeded PRNG to generate identical game states on every player's device from the same URL. There is no server, no database, and no account required. The host shares a link (or QR code) and every player's phone runs the same deterministic logic locally.

---

## Games

| Game | Players | Description |
|---|---|---|
| **Insider** | 4–8 | The Master knows the secret word; one hidden Insider guides the group toward it. Find the Insider before time runs out. |
| **Chameleon** | 3–8 | Everyone knows the secret word except the Chameleon. Give a one-word clue without making the word too obvious, then vote to expose the imposter. |
| **Spyfall** | 4–12 | One or more Spies don't know the secret location. Ask questions to catch a spy — but don't reveal the location too obviously. |
| **Wavelength** | 2–12 | One Guesser listens while every Psychic gives a clue based on the same spectrum. The Guesser picks the secret number. |

---

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18, Tailwind CSS 3 |
| Bundler | Vite 5 |
| Deterministic engine | Custom mulberry32 PRNG + lz-string URL compression |
| QR | `qrcode` (generate) + `jsqr` (scan) |
| Tests | Vitest |
| Deployment | GitHub Actions → GitHub Pages (custom domain via CNAME) |

---

## Local development

```bash
# Install dependencies
npm install

# Start dev server (HTTP)
npm run dev
```

The dev server listens on `0.0.0.0:5173` so it is reachable on your local network and via Tailscale.

### HTTPS dev certs (optional)

```bash
mkcert -install
mkdir .cert
mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 ::1
```

Vite detects the certs automatically. The `.cert/` directory is gitignored.

---

## Running tests

```bash
npm test          # run once
npm run test:watch  # watch mode
npm run coverage  # coverage report
```

---

## Project structure

```
src/
  engine/         # Deterministic core (PRNG, seed nav, lz-string envelope, state,
  |               # usePersistentTimer, useLongPress)
  games/          # Game module registry + per-game folders
  |  index.js     # Registry: maps gameType → module
  |  insider/     # Insider module (index.js, constants.js, words.js, components/)
  |  chameleon/   # Chameleon module
  |  spyfall/     # Spyfall module
  |  wavelength/  # Wavelength module
  components/     # Screen components (LobbyScreen, PreGameScreen, GamePlayScreen, …)
  |  shared/      # Reusable UI primitives (Button, GlassCard, Modal, RevealShield, …)
  styles/         # ThemeContext (game-module color tokens)
```

Each game folder (`src/games/<name>/`) exports a module that satisfies a standard interface:

| Export | Type | Description |
|---|---|---|
| `name` | `string` | Internal key (matches registry key) |
| `displayName` | `string` | Human-readable name |
| `minPlayers` / `maxPlayers` | `number` | Valid player count range |
| `constants` | `object` | `COLORS`, `ROLES`, `ROLE_COLORS`, `ROUND_SECONDS`, `ROLE_META` |
| `defaultState()` | `function` | Returns game-specific state defaults for a new lobby |
| `getTimerSeconds(state)` | `function` | Returns round duration in seconds (0 = no timer) |
| `getSetup(players, seed, category, state)` | `function` | Deterministic role assignment; returns `Assignment[]` or `null` |
| `encodeGameState(state)` | `function` | Encode lobby state to `Uint8Array` for the `?gs=` URL param |
| `decodeGameState(payload)` | `function` | Reconstruct lobby state from encoded payload |
| `GameExtras` | `ReactComponent \| null` | Game-specific UI rendered below the role card in `GamePlayScreen` |

---

## Adding a new deterministic game mode

1. **Create the folder** `src/games/<name>/` with the files below.

2. **`constants.js`** — brand colors and `ROLE_META`:
   ```js
   export const MY_COLORS     = { primary: '#…', … };
   export const MY_ROLES      = { ROLE_A: 'role_a', ROLE_B: 'role_b' };
   export const MY_ROLE_META  = {
     role_a: { label: 'ROLE A', desc: '…', showsTimer: false },
     role_b: { label: 'ROLE B', desc: '…', showsTimer: true  },
   };
   export const MY_ROUND_SECONDS = 300;
   ```

3. **`components/GameExtras.jsx`** — optional supplemental UI below the role card:
   ```jsx
   export function MyGameExtras({ assignment, state, roleRevealed, module }) {
     // return null if the game needs no supplemental UI
     return <div>…game-specific content…</div>;
   }
   ```

4. **`index.js`** — the module itself. Must satisfy the standard interface:
   ```js
   import { MyGameExtras } from './components/GameExtras';
   export const MyModule = {
     name: 'mygame', displayName: 'My Game',
     minPlayers: 3, maxPlayers: 10,
     constants: { COLORS: MY_COLORS, ROLES: MY_ROLES, ROLE_META: MY_ROLE_META,
                  ROUND_SECONDS: MY_ROUND_SECONDS },
     defaultState:     () => ({}),
     getTimerSeconds:  (state) => state?.roundSeconds ?? MY_ROUND_SECONDS,
     getSetup:         (players, seed, category, state) => { /* … */ },
     encodeGameState:  (state) => { /* return Uint8Array */ },
     decodeGameState:  (payload) => { /* return state object */ },
     GameExtras: MyGameExtras,
   };
   ```

5. **Register it** in `src/games/index.js`:
   ```js
   import { MyModule } from './mygame/index';
   export const GAME_REGISTRY = {
     // existing entries …
     mygame: MyModule,
   };
   ```

6. **Assign a type ID** in `src/engine/gamestate.js`:
   ```js
   export const GAME_TYPE_IDS = {
     // existing entries …
     mygame: 4,   // next available 3-bit slot (0–7)
   };
   ```

That is all — no other files need to change.

---

## Deployment

Pushes to `main` trigger the GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which:

1. Installs dependencies (`npm ci`)
2. Runs the test suite (`npm test`)
3. Builds the app (`npm run build`)
4. Publishes `./dist` to the `gh-pages` branch with the custom CNAME

The live domain is configured via `public/CNAME` and the workflow's `cname` parameter.

---

## License

MIT

