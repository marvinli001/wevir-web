// The app's sidebar entry for the computer this page is connected to: its name, the connection state, and the way back
// to the computer list.
import { StatusDot, type StatusTone, useHostConnection } from '@wevir-renderer';
import { Monitor } from 'lucide-react';
import { type WebMessageKey, wt } from './i18n';
import { pageUrl } from './paths';
import { type ComputerRecord, computerName } from './store';

const STATES: Record<string, { tone: StatusTone; label: WebMessageKey; pulse?: boolean }> = {
  connecting: { tone: 'accent', label: 'state.connecting', pulse: true },
  connected: { tone: 'success', label: 'state.connected' },
  reconnecting: { tone: 'warning', label: 'state.reconnecting', pulse: true },
  closed: { tone: 'danger', label: 'state.closed' },
  failed: { tone: 'danger', label: 'state.closed' },
};

export function ComputerSlot({ computer }: { computer: ComputerRecord }) {
  const { view } = useHostConnection();
  const state = STATES[view.status] ?? STATES.closed;
  return (
    <a
      href={pageUrl('computers')}
      title={wt('computers.title')}
      data-testid="web-computer"
      data-state={view.status}
      className="mb-px flex h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-base outline-none transition-[color,background-color,box-shadow] duration-150 ease-smooth hover:bg-sidebar-accent/70 focus-visible:focus-ring"
    >
      <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {computerName(computer, wt('computers.fallbackName'))}
      </span>
      {state && (
        <StatusDot tone={state.tone} pulse={state.pulse ?? false} label={wt(state.label)} />
      )}
    </a>
  );
}
