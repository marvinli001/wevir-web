# Wevir Web

Wevir in the browser. This is the [Wevir](https://github.com/marvinli001/wevir) desktop app's interface, built as a static site, that connects to a computer running Wevir through a relay. The sessions, projects and agents stay on that computer; the browser shows them and sends your messages and approvals.

The hosted version is at **https://web.wevir.si**. You can also build and host it yourself.

## Using it

1. On the computer: **Settings → Devices**, turn on remote access with a relay, and add a device. Wevir shows a pairing link and QR code.
2. Open the link in the browser and choose **Pair**.
3. Allow the request on the computer.

The browser remembers the computer. Opening the site later reconnects on its own. **Computers** in the sidebar lists every computer this browser is paired with, where you can open, rename or remove them.

### What the browser can't do

The browser is a guest on another computer, so a few things stay on the desktop app:

- Opening the computer's files in local apps, Finder or an editor, and file previews
- Creating projects (choosing a folder on the computer)
- The built-in browser, computer use, preventing sleep, app updates, and the storage page

What a paired browser can do is also limited by the permissions the computer gave it. By default it can read and work in sessions and read projects. Settings that change the computer, model providers, approval rules and the terminal need permissions you grant under **Settings → Devices** on the computer. Anything the browser isn't allowed to use is hidden or read-only.

## Trust model

- **End-to-end encryption.** The browser and the computer talk over a [Noise](https://noiseprotocol.org) channel: `XXpsk2` for pairing, `IK` for every reconnect, pinned to the computer's public key. The relay only forwards encrypted frames between them. It sees which route a connection is for, when, and how much data goes through. It never sees the content.
- **Pairing link.** The secret is in the link's fragment (after `#`), which browsers never send to a server. The page takes it out of the address bar and history as soon as it loads. Each link works once, for a short time, and the computer still has to allow the request.
- **Device key.** Each browser creates its own X25519 key with WebCrypto as a *non-extractable* key. Scripts on the page can use it, but can't read it out, and it is stored in the site's IndexedDB. Clearing the site's data deletes it. After that, pairing again is the only way back.
- **The computer decides.** Every device has its own permissions, which the computer checks on every request. Removing a device on the computer closes its connections and rejects it from then on.
- **The site itself.** The page's code holds the device key and sees everything you do in it. Trusting a hosted copy means trusting whoever serves it. The site has no backend, no analytics and no third-party scripts. Its Content Security Policy allows scripts only from its own origin, and connections only to itself and `wss://` relays. If you'd rather not trust a hosted copy, host your own (below). Pairing is per origin, so a self-hosted copy pairs separately.

## Self-hosting

The build is a folder of static files. Any static host works if it:

- serves `index.html` for unknown paths (`/pair`, `/computers`), and
- sends the headers in [`public/_headers`](public/_headers), especially the Content Security Policy.

```sh
git clone --recurse-submodules https://github.com/marvinli001/wevir-web.git
cd wevir-web
pnpm run setup
pnpm run build      # → dist/
```

- **Cloudflare** — [`wrangler.jsonc`](wrangler.jsonc) deploys `dist/` as Workers static assets. Change `name` and the `routes` domain, then run `npx wrangler deploy`. The `_headers` file in `dist/` sets the headers.
- **Vercel** — [`vercel.json`](vercel.json) holds the build command, the SPA rewrite and the same headers.
- **Elsewhere** — copy the CSP and other headers from `public/_headers` into the host's config.

A pairing link opens the official site. To pair with your own copy, keep everything from `#` onward and replace the part before it with your address, for example `https://wevir.example.com/pair#v=1&k=…`.

The relay is configured on the computer, not on the site. The site connects to whichever relay the computer uses: the official one, or one you run from wevir's `apps/relay`. Self-hosted relays must use `wss://`, because the production CSP blocks plain `ws://`.

## Development

You'll need Node 24.15 or newer and pnpm 12.

wevir-web has no npm dependencies of its own. The renderer lives in wevir, which this repository includes as a git submodule (`wevir/`), and the site builds against the exact commit the submodule pins. `pnpm run setup` installs wevir's dependencies with wevir's lockfile, then links `node_modules` to the desktop app's. React, Vite, Tailwind and the rest are therefore the same versions the desktop app ships. Don't run `pnpm install` in this repository.

```sh
git submodule update --init
pnpm run setup                          # uses ./wevir
WEVIR_DIR=../wevir pnpm run setup       # or another wevir checkout, e.g. one you're changing
pnpm dev                                # http://localhost:5173
```

| Command | |
|---|---|
| `pnpm dev` | Dev server; the CSP also allows Vite's HMR and `ws://` relays |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serves `dist/` with the production CSP (plus `ws://` for a local relay) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Biome, TypeScript and Vitest, using wevir's toolchain |

To try it end to end without a hosted relay:

1. Run wevir's relay locally (`apps/relay`).
2. In the desktop app, set the relay to `ws://127.0.0.1:<port>`.
3. Make a pairing link, and replace its address with `http://localhost:5173/pair`.

### Layout

| Path | |
|---|---|
| `src/main.tsx` | Picks the page: pairing link, computer list, or the app for the current computer |
| `src/platform.ts` | The browser's side of the renderer's platform interface, and the connection through the relay |
| `src/pairing.ts`, `src/pair-page.tsx` | Reading pairing links and pairing |
| `src/store.ts`, `src/device-key.ts` | Paired computers and device keys in IndexedDB |
| `src/computers-page.tsx`, `src/computer-slot.tsx` | The computer list, and the current computer in the sidebar |
| `src/csp.ts` | The Content Security Policy and security headers (tests keep `_headers` and `vercel.json` in sync) |
| `.github/workflows/web.yml` | Checks and builds every push. Deploys `main` to Cloudflare when `CLOUDFLARE_API_TOKEN` is set |

To move to a newer wevir, update the submodule (`git -C wevir checkout <commit>`), run `pnpm run setup`, check, and commit the new pin.

## License

[MIT](LICENSE)
