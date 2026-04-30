# Deceptive

A serverless, deterministic social deduction game platform. Host or join **Insider**, **Chameleon**, or **Spyfall** with no backend — the entire game state lives in a shareable URL or QR code.

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

# Start dev server with HTTPS (requires mkcert certs in .cert/)
# See vite.config.js for cert paths
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
  engine/         # Deterministic core (PRNG, seed nav, lz-string envelope, state)
  games/          # Game module registry + per-game folders (insider, chameleon, spyfall)
  components/     # Screen components + shared UI primitives
  styles/         # ThemeContext
```

Each game folder (`src/games/<name>/`) exports a module that satisfies a shared interface (`name`, `displayName`, `minPlayers`, `maxPlayers`, `getSetup()`, etc.). Adding a new game means creating a folder and registering it in `src/games/index.js` — no other files change.

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
