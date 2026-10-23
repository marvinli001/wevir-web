// The browser's implementation of the renderer's platform interface. What a browser can do itself: clipboard, links in a
// new tab, notifications, the app badge, theme colour, downloads. Everything about the computer's own files, windows,
// built-in browser, computer use and updates is off; the renderer hides those features.

import {
  REMOTE_ENDPOINT,
  relayRoute,
  remoteTransport,
  type TransportFactory,
} from '@wevir/client-sdk';
import { CloseCode } from '@wevir/protocol';
import {
  type HostConnectionSource,
  type Platform,
  type PlatformApi,
  type PlatformSlots,
  unsupportedPlatformApi,
} from '@wevir-renderer';
import { deviceStaticKey } from './device-key';
import { pageUrl } from './paths';
import { type ComputerRecord, loadIdentity, updateComputer } from './store';

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function openExternal(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.reject(new Error('invalid address'));
  }
  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol))
    return Promise.reject(new Error('unsupported link'));
  // noopener: the opened page gets no handle back to this one.
  window.open(parsed.href, '_blank', 'noopener,noreferrer');
  return Promise.resolve();
}

const notifications = new Map<string, Notification>();
const clickListeners = new Set<(tag: string) => void>();

const notify: PlatformApi['notify'] = async ({ tag, title, body, sound }) => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'default') {
    // Some browsers only ask during a user gesture; this one is shown if the answer is yes.
    if ((await Notification.requestPermission()) !== 'granted') return false;
  }
  if (Notification.permission !== 'granted') return false;
  notifications.get(tag)?.close();
  const shown = new Notification(title, { body, tag, silent: !sound });
  shown.onclick = () => {
    window.focus();
    shown.close();
    for (const listener of clickListeners) listener(tag);
  };
  shown.onclose = () => {
    if (notifications.get(tag) === shown) notifications.delete(tag);
  };
  notifications.set(tag, shown);
  return true;
};

function saveTextAs(name: string, text: string): Promise<'saved' | 'cancelled'> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Promise.resolve('saved');
}

function setThemeColor(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta === null) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = color;
}

const api = unsupportedPlatformApi({
  openExternal,
  copyText: (text) => navigator.clipboard.writeText(text),
  notify,
  closeNotifications: async (tag) => {
    for (const [key, shown] of notifications) {
      if (tag !== undefined && key !== tag) continue;
      shown.close();
      notifications.delete(key);
    }
  },
  onNotificationClick: (listener) => {
    clickListeners.add(listener);
    return () => {
      clickListeners.delete(listener);
    };
  },
  setBadgeCount: async (count) => {
    const badge = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    await (count > 0 ? badge.setAppBadge?.(count) : badge.clearAppBadge?.())?.catch(
      () => undefined,
    );
  },
  setWindowAppearance: async ({ background }) => {
    const dark = document.documentElement.dataset.theme === 'dark';
    setThemeColor(dark ? background.dark : background.light);
  },
  saveTextAs,
});

/** The connection to one paired computer: through its relay, Noise IK with this browser's device key. */
export function computerConnection(computer: ComputerRecord | undefined): HostConnectionSource {
  return {
    async open() {
      if (computer === undefined) throw new Error('no computer');
      const identity = await loadIdentity();
      let relayUrl = computer.relayUrl;
      return {
        identity: { ...identity, clientKind: 'mobile' },
        endpoint: REMOTE_ENDPOINT,
        transport: watchRemoval(
          computer,
          remoteTransport({
            host: { hostPublicKey: computer.hostPublicKey, routeId: computer.routeId },
            device: deviceStaticKey({
              privateKey: computer.devicePrivateKey,
              publicKey: computer.devicePublicKey,
            }),
            routes: () => [relayRoute(WebSocket, relayUrl, computer.routeId)],
            fallbackDelayMs: 0,
            onConnected: ({ host }) => {
              if (host.relayUrl !== undefined) relayUrl = host.relayUrl;
              void updateComputer(computer.routeId, (record) => ({
                ...record,
                relayUrl,
                ...(host.hostName !== undefined && { hostName: host.hostName }),
                lastConnectedAt: new Date().toISOString(),
              })).catch(() => undefined);
            },
          }),
        ),
      };
    },
  };
}

/**
 * The computer closes a removed device's connections with `DEVICE_REVOKED`; its later handshakes just fail, which
 * looks like an offline computer. So the close is the one chance to tell: mark the computer and show the list.
 */
function watchRemoval(computer: ComputerRecord, transport: TransportFactory): TransportFactory {
  return (url, handlers) =>
    transport(url, {
      ...handlers,
      onClose(info) {
        handlers.onClose(info);
        if (info.code !== CloseCode.DEVICE_REVOKED) return;
        void updateComputer(computer.routeId, (record) => ({
          ...record,
          removedAt: new Date().toISOString(),
        }))
          .catch(() => undefined)
          .then(() => location.assign(pageUrl('computers')));
      },
    });
}

export function webPlatform(computer: ComputerRecord | undefined, slots: PlatformSlots): Platform {
  return {
    api,
    capabilities: {
      localHost: false,
      localFiles: false,
      browserPane: false,
      computerUse: false,
      updates: false,
      preventSleep: false,
      notifications: typeof Notification !== 'undefined',
      saveText: true,
    },
    connection: computerConnection(computer),
    slots,
  };
}
