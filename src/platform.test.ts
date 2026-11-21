import { afterEach, expect, it, vi } from 'vitest';
import { SHORTCUTS, setShortcut } from '@/lib/shortcuts';
import { resolvedTheme, subscribeTheme } from '@/theme/theme';
import { webPlatform } from './platform';

vi.mock('@wevir-renderer', () => ({ unsupportedPlatformApi: (api: object) => api }));
vi.mock('@/theme/theme', () => ({ resolvedTheme: vi.fn(), subscribeTheme: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('keeps the browser toolbar in sync when only the resolved theme changes', async () => {
  const meta = { content: '' };
  vi.stubGlobal('document', { querySelector: () => meta });
  vi.mocked(resolvedTheme).mockReturnValue('light');
  await webPlatform(undefined, {}).api.setWindowAppearance({
    background: { light: '#eeeeee', dark: '#111111' },
    translucentWindow: false,
  });
  expect(meta.content).toBe('#eeeeee');
  vi.mocked(resolvedTheme).mockReturnValue('dark');
  vi.mocked(subscribeTheme).mock.calls[0]?.[0]();
  expect(meta.content).toBe('#111111');
});

it('restores the theme with the current binding and stops listening on unmount', () => {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  const restore = vi.fn();
  const off = webPlatform(undefined, {}).api.onRestoreDefaultTheme(restore);
  const press = (code: string) =>
    target.dispatchEvent(
      Object.assign(new Event('keydown', { cancelable: true }), {
        code,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    );
  try {
    setShortcut('restoreDefaultTheme', { code: 'F7' });
    expect(press('F8')).toBe(true);
    expect(press('F7')).toBe(false);
    off();
    expect(press('F7')).toBe(true);
    expect(restore).toHaveBeenCalledTimes(1);
  } finally {
    off();
    setShortcut('restoreDefaultTheme', SHORTCUTS.restoreDefaultTheme);
  }
});
