# Wevir Web

English · [简体中文](README.zh-CN.md)

The [Wevir](https://github.com/marvinli001/wevir) desktop interface as a static site, connected to a computer running Wevir through a relay. Sessions, projects, and agents remain on that computer; the browser displays them and sends messages and approvals.

Hosted at **https://web.wevir.si**; self-hosting supported.

## Usage

1. On the computer: **Settings → Devices**, enable remote access with a relay, and add a device to get a pairing link and QR code.
2. Open the link in the browser and choose **Pair**.
3. Approve the request on the computer.

Paired computers reconnect automatically. **Computers** in the sidebar lists every computer paired with this browser, with open, rename, and remove actions.

### Desktop-only features

- Opening the computer's files in local apps, Finder, or an editor; file previews
- Project creation (folder selection on the computer)
- Built-in browser, computer use, sleep prevention, app updates, and the storage page

Device permissions set on the computer further limit access. Defaults: read and work in sessions, read projects. Computer settings, model providers, approval rules, and the terminal require permissions granted under **Settings → Devices**. Features without permission are hidden or read-only.

## Trust model

- **End-to-end encryption.** Browser and computer communicate over a [Noise](https://noiseprotocol.org) channel: `XXpsk2` for pairing, `IK` for reconnects, pinned to the computer's public key. The relay forwards encrypted frames only; it observes the route, timing, and traffic volume of each connection, never the content.
- **Pairing link.** The secret is in the URL fragment (after `#`), which browsers never send to a server, and is removed from the address bar and history on load. Each link is single-use and short-lived, and still requires approval on the computer.
- **Device key.** Each browser generates its own *non-extractable* X25519 key with WebCrypto, stored in the site's IndexedDB. Page scripts can use the key but cannot export it. Clearing site data deletes it and requires pairing again.
- **Computer-side authorization.** Each device has its own permissions, checked by the computer on every request. Removing a device closes its connections and rejects it permanently.
- **Site integrity.** The page's code holds the device key and sees all activity in it, so a hosted copy is only as trustworthy as its operator. No backend, analytics, or third-party scripts. The Content Security Policy allows scripts from the site's own origin only, and connections to itself and `wss://` relays only. Self-host to remove that dependency (below); pairing is per origin, so a self-hosted copy pairs separately.

## Self-hosting

The build output is a folder of static files. Host requirements:

- `index.html` served for unknown paths (`/pair`, `/computers`)
- The headers in [`public/_headers`](public/_headers), in particular the Content Security Policy

```sh
git clone --recurse-submodules https://github.com/marvinli001/wevir-web.git
cd wevir-web
pnpm run setup
pnpm run build      # → dist/
```

- **Cloudflare**: [`wrangler.jsonc`](wrangler.jsonc) deploys `dist/` as Workers static assets. Set `name` and the `routes` domain, then run `npx wrangler deploy`. Headers come from `_headers` in `dist/`.
- **Vercel**: [`vercel.json`](vercel.json) defines the build command, SPA rewrite, and the same headers.
- **Other hosts**: copy the CSP and other headers from `public/_headers` into the host configuration.

Pairing links point to the official site. For a self-hosted copy, keep everything from `#` onward and replace the preceding part with your address, e.g. `https://wevir.example.com/pair#v=1&k=…`.

The relay is configured on the computer, not on the site: the official relay, or one built from wevir's `apps/relay`. Self-hosted relays require `wss://`; the production CSP blocks `ws://`.

## Development

Requirements: Node 24.15+ and pnpm 12.

No npm dependencies of its own. The renderer comes from wevir, included as a git submodule (`wevir/`); the site builds against the pinned commit. `pnpm run setup` installs wevir's dependencies from wevir's lockfile and links `node_modules` to the desktop app's, so React, Vite, Tailwind, and other dependencies match the desktop app's versions. Do not run `pnpm install` in this repository.

```sh
git submodule update --init
pnpm run setup                          # uses ./wevir
WEVIR_DIR=../wevir pnpm run setup       # or another wevir checkout
pnpm dev                                # http://localhost:5173
```

| Command | |
|---|---|
| `pnpm dev` | Dev server; the CSP also allows Vite's HMR and `ws://` relays |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serves `dist/` with the production CSP (plus `ws://` for a local relay) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Biome, TypeScript and Vitest, using wevir's toolchain |

Local end-to-end testing:

1. Run wevir's relay locally (`apps/relay`).
2. In the desktop app, set the relay to `ws://127.0.0.1:<port>`.
3. Create a pairing link and replace its address with `http://localhost:5173/pair`.

### Layout

| Path | |
|---|---|
| `src/main.tsx` | Page selection: pairing link, computer list, or the app for the current computer |
| `src/platform.ts` | Browser implementation of the renderer's platform interface; relay connection |
| `src/pairing.ts`, `src/pair-page.tsx` | Pairing link parsing and pairing |
| `src/store.ts`, `src/device-key.ts` | Paired computers and device keys in IndexedDB |
| `src/computers-page.tsx`, `src/computer-slot.tsx` | Computer list; current computer in the sidebar |
| `src/csp.ts` | Content Security Policy and security headers (tests keep `_headers` and `vercel.json` in sync) |
| `.github/workflows/web.yml` | Checks and builds every push; deploys `main` to Cloudflare when `CLOUDFLARE_API_TOKEN` is set |
| `.github/workflows/relay.yml` | Deploys the official relay (wevir's `apps/relay-worker`) to `relay.wevir.si` from the pinned commit when the pin changes on `main`, after protocol tests; also requires `SOURCE_TAG_KEY` |

Updating wevir: check out the new commit in the submodule (`git -C wevir checkout <commit>`), run `pnpm run setup` and the checks, then commit the new pin.

## License

[MIT](LICENSE)
