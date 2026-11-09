# Wevir Web

[English](README.md) · 简体中文

[Wevir](https://github.com/marvinli001/wevir) 桌面端界面的静态站点版本，经中继连接运行 Wevir 的电脑。会话、项目与 Agent 保留在该电脑上；浏览器负责显示，并发送消息与审批。

官方托管地址：**https://web.wevir.si**；支持自托管。

## 使用

1. 在电脑上打开 **设置 → 设备 → 添加网页设备**（需启用中继），获取配对链接与二维码。
2. 在浏览器中打开链接，或在电脑列表中选择 **添加电脑**，扫描二维码或粘贴链接；然后选择 **配对**。
3. 在电脑上批准请求。

已配对的电脑自动重连。侧栏 **电脑** 列出此浏览器配对过的所有电脑，支持打开、重命名与移除。

### 仅限桌面端的功能

- 用本机应用、访达或编辑器打开电脑上的文件；依赖本机流式地址的预览
- 创建项目（在电脑上选择文件夹）
- 在会话或助理的消息中附加电脑上的文件和文件夹（图片仍可从浏览器添加）
- 内置浏览器、电脑操作、防休眠、应用更新与存储页

访问范围另受电脑端设备权限限制。默认权限：读取并操作会话、读取项目。电脑设置、模型服务商、审批规则与终端需在电脑的 **设置 → 设备** 中授予权限。无权限的功能隐藏或只读。

## 信任模型

- **端到端加密。** 浏览器与电脑经 [Noise](https://noiseprotocol.org) 通道通信：配对使用 `XXpsk2`，重连使用 `IK`，并固定电脑公钥。中继只转发加密帧，可见每个连接的路由、时间与流量，不可见内容。
- **配对链接。** 密钥位于链接片段（`#` 之后），浏览器不会将其发送至服务器；页面加载后即从地址栏与历史记录中移除。每个链接一次有效、时效很短，且仍需电脑端批准。
- **设备密钥。** 每个浏览器用 WebCrypto 生成独立的*不可导出* X25519 密钥，存于站点的 IndexedDB。页面脚本可使用但无法导出。清除站点数据即删除密钥，需重新配对。
- **电脑端授权。** 每个设备有独立权限，电脑对每个请求逐一校验。移除设备后，其连接立即关闭，此后一律拒绝。
- **站点完整性。** 页面代码持有设备密钥，并可见页面内的全部操作，托管副本的可信度取决于其运营方。站点无后端、无统计、无第三方脚本。内容安全策略只允许本源脚本，连接只允许本站与 `wss://` 中继。如需消除这一依赖，可自托管（见下文）；配对按源区分，自托管副本需单独配对。

## 自托管

构建产物为一组静态文件。托管要求：

- 对未知路径（`/pair`、`/computers`）返回 `index.html`
- 发送 [`public/_headers`](public/_headers) 中的响应头，尤其是内容安全策略

```sh
git clone --recurse-submodules https://github.com/marvinli001/wevir-web.git
cd wevir-web
pnpm run setup
pnpm run build      # → dist/
```

- **Cloudflare**：[`wrangler.jsonc`](wrangler.jsonc) 将 `dist/` 部署为 Workers 静态资源。修改 `name` 与 `routes` 域名后运行 `npx wrangler deploy`。响应头由 `dist/` 中的 `_headers` 设置。
- **Vercel**：[`vercel.json`](vercel.json) 定义构建命令、SPA 重写与相同的响应头。
- **其他平台**：将 `public/_headers` 中的内容安全策略及其他响应头写入平台配置。

配对链接指向官方站点。使用自托管副本时，可在电脑上设置其地址（**设置 → 设备 → 网页设备**），或在副本中使用 **添加电脑**（接受任意地址的链接），或保留 `#` 及其后部分，将前面替换为自有地址，例如 `https://wevir.example.com/pair#v=1&k=…`。

中继在电脑端配置，与站点无关：官方中继，或基于 wevir `apps/relay` 自建的中继。自建中继须使用 `wss://`；生产环境的内容安全策略拦截 `ws://`。

## 开发

要求：Node 24.22.1+、pnpm 12.6.0，与共用的 Desktop checkout 一致。

渲染层来自 wevir，以 git 子模块（`wevir/`）引入；站点基于子模块锁定的提交构建。`pnpm run setup` 分别按两个仓库的锁文件安装，再将 Desktop 的依赖链接到浏览器外壳，确保 React、Vite、Tailwind 等共用依赖与 Desktop 一致。本仓库只声明浏览器扫码专用依赖。使用 `pnpm run setup`，不要只运行 `pnpm install`。

应用界面、样式、翻译与交互逻辑以 Desktop 为准，Web 直接引入其 `embed.ts` 和 `index.css`；共用界面的更改放在 Desktop，不在浏览器端复制。本仓库负责配对、电脑列表与浏览器平台接口。可用功能仍由设备权限和浏览器能力决定。

```sh
git submodule update --init
pnpm run setup                          # 使用 ./wevir
WEVIR_DIR=../wevir pnpm run setup       # 或其他 wevir checkout
pnpm dev                                # http://localhost:5173
```

| 命令 | |
|---|---|
| `pnpm dev` | 开发服务器；内容安全策略额外允许 Vite HMR 与 `ws://` 中继 |
| `pnpm build` | 生产构建，输出至 `dist/` |
| `pnpm preview` | 以生产内容安全策略托管 `dist/`（额外允许本地中继的 `ws://`） |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Biome、TypeScript 与 Vitest，使用 wevir 的工具链 |

本地端到端测试：

1. 在本地运行 wevir 的中继（`apps/relay`）。
2. 在桌面端将中继设为 `ws://127.0.0.1:<port>`。
3. 生成配对链接，将其地址替换为 `http://localhost:5173/pair`。

### 目录结构

| 路径 | |
|---|---|
| `src/main.tsx` | 页面选择：配对链接、电脑列表或当前电脑的应用 |
| `src/platform.ts` | 渲染层平台接口的浏览器实现；中继连接 |
| `src/pairing.ts`、`src/pair-page.tsx` | 配对链接解析与配对 |
| `src/add-computer-dialog.tsx`、`src/qr-scan.ts` | 添加电脑：扫码（Barcode Detection API，回退 ZXing WebAssembly）或粘贴链接 |
| `src/store.ts`、`src/device-key.ts` | IndexedDB 中的已配对电脑与设备密钥 |
| `src/computers-page.tsx`、`src/computer-slot.tsx` | 电脑列表；侧栏中的当前电脑 |
| `src/csp.ts` | 内容安全策略与安全响应头（测试保证 `_headers` 与 `vercel.json` 同步） |
| `.github/workflows/web.yml` | 检查并构建共用渲染层、站点与中继；将 `main` 部署至 Cloudflare，每小时同步 Desktop 更新 |

`main` 上的 Web 工作流每小时检查 Desktop 的 `master`。发现更新后，检查并构建该确切提交，使用现有 Cloudflare secrets 部署，再由 `GITHUB_TOKEN` 记录子模块版本。检查失败时不推进版本或部署；没有上游更新时跳过构建与部署。无需新增 secret，记录版本的作业需要仓库内容写权限。

立即更新：手动运行 **Web** 工作流，保持 **Sync Desktop** 开启（默认）；关闭则重建当前锁定版本。推送与 PR 始终检查已提交的版本。本地仍可在 `wevir/` 中检出指定提交，运行 `pnpm run setup` 与各项检查，再提交新的锁定版本。

## 许可证

[MIT](LICENSE)
