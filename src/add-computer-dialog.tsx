import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Segmented,
} from '@wevir-renderer';
import { useEffect, useRef, useState } from 'react';
import { ErrorNote } from '@/components/error-note';
import { Input } from '@/components/ui/input';
import { pairingInstructions, type WebMessageKey, wt } from './i18n';
import { pairingLinkFragment } from './pairing';
import { pageUrl } from './paths';
import { type CameraError, cameraError, createQrDetector, openCamera } from './qr-scan';

type Mode = 'scan' | 'paste';

/** Frames between QR reads: enough for a steady hand, light on a phone's battery. */
const SCAN_INTERVAL_MS = 150;

/** The square to aim at: a light outline over a dimmed picture, whatever the theme (it sits on the camera's image). */
const VIEWFINDER = {
  boxShadow: '0 0 0 2px rgb(255 255 255 / 0.85), 0 0 0 9999px rgb(0 0 0 / 0.35)',
} as const;

function openPairingPage(fragment: string): void {
  location.assign(`${pageUrl('pair')}#${fragment}`);
}

export function AddComputerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>(() =>
    navigator.mediaDevices?.getUserMedia === undefined ? 'paste' : 'scan',
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="add-computer">
        <DialogHeader>
          <DialogTitle>{wt('add.title')}</DialogTitle>
          <DialogDescription>{pairingInstructions()}</DialogDescription>
        </DialogHeader>
        <div>
          <Segmented
            label={wt('add.title')}
            value={mode}
            options={[
              { value: 'scan', label: wt('add.scan') },
              { value: 'paste', label: wt('add.paste') },
            ]}
            onChange={setMode}
          />
        </div>
        {mode === 'scan' ? <Scanner /> : <PasteLink />}
      </DialogContent>
    </Dialog>
  );
}

type ScanState =
  | { kind: 'starting' }
  | { kind: 'scanning'; mirrored: boolean; notice?: WebMessageKey }
  | { kind: 'failed'; error: CameraError };

const CAMERA_ERROR: Record<CameraError, WebMessageKey> = {
  denied: 'scan.denied',
  no_camera: 'scan.noCamera',
  unavailable: 'scan.unavailable',
};

function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>({ kind: 'starting' });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastText: string | undefined;

    const start = async () => {
      try {
        const [detector, camera] = await Promise.all([createQrDetector(), openCamera()]);
        stream = camera;
        const element = video.current;
        if (stopped || element === null) {
          for (const track of camera.getTracks()) track.stop();
          return;
        }
        element.srcObject = camera;
        await element.play();
        // A camera facing the user shows as a mirror, the way people expect to see themselves.
        const facing = camera.getVideoTracks()[0]?.getSettings().facingMode;
        setState({ kind: 'scanning', mirrored: facing !== 'environment' });

        const tick = async () => {
          if (stopped) return;
          let texts: string[] = [];
          try {
            if (element.readyState >= element.HAVE_CURRENT_DATA)
              texts = await detector.detect(element);
          } catch {
            // A frame the decoder could not read; the next one will do.
          }
          for (const text of texts) {
            const link = pairingLinkFragment(text);
            if (link.kind === 'ok') {
              stopped = true;
              openPairingPage(link.fragment);
              return;
            }
            if (text !== lastText) {
              lastText = text;
              const notice = link.kind === 'no_relay' ? 'pair.noRelay' : 'scan.notPairing';
              setState((current) =>
                current.kind === 'scanning' ? { ...current, notice } : current,
              );
            }
          }
          if (!stopped) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (error) {
        if (!stopped) setState({ kind: 'failed', error: cameraError(error) });
      }
    };
    void start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, []);

  return (
    <div className="space-y-2">
      <div
        className={
          state.kind === 'failed'
            ? 'relative h-32 w-full overflow-hidden rounded-xl bg-muted'
            : 'relative mx-auto aspect-square w-[min(100%,55vh)] overflow-hidden rounded-xl bg-muted'
        }
      >
        <video
          ref={video}
          muted
          playsInline
          aria-label={wt('add.scan')}
          className="size-full object-cover"
          style={
            state.kind === 'scanning' && state.mirrored ? { transform: 'scaleX(-1)' } : undefined
          }
          hidden={state.kind !== 'scanning'}
        />
        {state.kind === 'scanning' && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[18%] rounded-2xl"
            style={VIEWFINDER}
          />
        )}
        {state.kind !== 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {state.kind === 'starting' ? (
              <span role="status">{wt('scan.starting')}</span>
            ) : (
              <ErrorNote data-testid="scan-error">{wt(CAMERA_ERROR[state.error])}</ErrorNote>
            )}
          </div>
        )}
      </div>
      {state.kind === 'scanning' && state.notice !== undefined && (
        <ErrorNote className="text-sm">{wt(state.notice)}</ErrorNote>
      )}
    </div>
  );
}

function PasteLink() {
  const [text, setText] = useState('');
  const [error, setError] = useState<WebMessageKey>();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const link = pairingLinkFragment(text);
        if (link.kind === 'ok') openPairingPage(link.fragment);
        else setError(link.kind === 'no_relay' ? 'pair.noRelay' : 'pair.invalid');
      }}
    >
      <label htmlFor="pairing-link" className="block space-y-1.5">
        <span className="text-sm font-medium">{wt('add.link')}</span>
        <Input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(undefined);
          }}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== undefined}
          id="pairing-link"
          data-testid="pairing-link"
        />
      </label>
      {error !== undefined && <ErrorNote className="text-sm">{wt(error)}</ErrorNote>}
      <Button type="submit" className="w-full" disabled={text.trim() === ''}>
        {wt('add.continue')}
      </Button>
    </form>
  );
}
