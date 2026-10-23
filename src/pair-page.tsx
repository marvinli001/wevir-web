// `/pair#…`: the page a pairing link opens. Shows which computer, takes this device's name, pairs through the relay and
// waits for the computer's user to allow it, then opens the app.
import { DEVICE_NAME_MAX_LENGTH } from '@wevir/protocol';
import { Button, describeError } from '@wevir-renderer';
import { useEffect, useMemo, useRef, useState } from 'react';
import { x25519Supported } from './device-key';
import { defaultDeviceName } from './device-name';
import { wt } from './i18n';
import { pairComputer, parsePairingFragment } from './pairing';
import { pageUrl } from './paths';
import { ErrorText, ShellFrame } from './shell-frame';

type Step =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'awaiting'; hostName: string }
  | { kind: 'failed'; error: string };

export function PairPage({ fragment }: { fragment: string }) {
  const link = useMemo(() => parsePairingFragment(fragment), [fragment]);
  const [name, setName] = useState(() => defaultDeviceName(navigator.userAgent));
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [supported, setSupported] = useState<boolean>();
  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    void x25519Supported().then(setSupported);
    return () => abort.current?.abort(new Error('left the page'));
  }, []);

  if (link.kind !== 'ok') {
    return (
      <ShellFrame title={wt('pair.invalid')}>
        {link.kind === 'no_relay' && <ErrorText>{wt('pair.noRelay')}</ErrorText>}
        <a
          className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          href={pageUrl('computers')}
        >
          {wt('computers.title')}
        </a>
      </ShellFrame>
    );
  }

  const hostName = link.payload.hostName ?? wt('computers.fallbackName');
  const busy = step.kind === 'connecting' || step.kind === 'awaiting';
  const trimmed = name.trim();

  const pair = async () => {
    abort.current = new AbortController();
    setStep({ kind: 'connecting' });
    try {
      await pairComputer({
        payload: link.payload,
        deviceName: trimmed,
        signal: abort.current.signal,
        onAwaitingApproval: ({ host }) =>
          setStep({ kind: 'awaiting', hostName: host.hostName ?? hostName }),
      });
      location.replace(pageUrl('app'));
    } catch (error) {
      setStep({ kind: 'failed', error: describeError(error) });
    }
  };

  return (
    <ShellFrame title={wt('pair.title', { name: hostName })}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && trimmed !== '' && supported) void pair();
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{wt('pair.deviceName')}</span>
          <input
            value={name}
            maxLength={DEVICE_NAME_MAX_LENGTH}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            data-testid="device-name"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:focus-ring disabled:opacity-60"
          />
        </label>
        <Button
          type="submit"
          className="w-full"
          disabled={busy || trimmed === '' || supported !== true}
          data-testid="pair"
        >
          {step.kind === 'failed' ? wt('pair.retry') : wt('pair.submit')}
        </Button>
        {step.kind === 'connecting' && (
          <p className="text-sm text-muted-foreground" role="status">
            {wt('pair.connecting')}
          </p>
        )}
        {step.kind === 'awaiting' && (
          <p className="text-sm text-warning" role="status" data-testid="awaiting">
            {wt('pair.awaiting', { name: step.hostName })}
          </p>
        )}
        {step.kind === 'failed' && (
          <ErrorText>{wt('pair.failed', { error: step.error })}</ErrorText>
        )}
        {supported === false && <ErrorText>{wt('pair.unsupported')}</ErrorText>}
      </form>
    </ShellFrame>
  );
}
