// `/computers`: the computers this browser is paired with. Open one (it becomes the current one and the app connects to
// it), rename it here, or remove it (the device key is deleted; the computer still lists this device until it is
// removed there too).
import { Button, currentLocale } from '@wevir-renderer';
import { Monitor, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { wt } from './i18n';
import { pageUrl } from './paths';
import { ErrorText, ShellFrame } from './shell-frame';
import {
  type ComputerRecord,
  computerName,
  deleteComputer,
  listComputers,
  setCurrentComputerId,
  updateComputer,
} from './store';

export function ComputersPage() {
  const [computers, setComputers] = useState<ComputerRecord[]>();
  const [error, setError] = useState<string>();
  const reload = () =>
    listComputers().then(setComputers, (reason: unknown) => setError(String(reason)));

  useEffect(() => {
    void reload();
  }, []);

  return (
    <ShellFrame title={wt('computers.title')}>
      {error && <ErrorText>{error}</ErrorText>}
      {computers !== undefined && computers.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="font-medium">{wt('computers.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{wt('computers.add')}</p>
        </div>
      )}
      {computers !== undefined && computers.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {computers.map((computer) => (
            <ComputerRow key={computer.routeId} computer={computer} onChanged={reload} />
          ))}
        </ul>
      )}
      {computers !== undefined && computers.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{wt('computers.add')}</p>
      )}
    </ShellFrame>
  );
}

function ComputerRow({
  computer,
  onChanged,
}: {
  computer: ComputerRecord;
  onChanged: () => Promise<void>;
}) {
  const name = computerName(computer, wt('computers.fallbackName'));
  const [mode, setMode] = useState<'view' | 'rename' | 'remove'>('view');
  const [draft, setDraft] = useState(name);
  const removed = computer.removedAt !== undefined;
  const last = computer.lastConnectedAt ?? computer.pairedAt;
  const time = new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(last));

  const open = async () => {
    await setCurrentComputerId(computer.routeId);
    location.assign(pageUrl('app'));
  };
  const rename = async () => {
    const label = draft.trim();
    await updateComputer(computer.routeId, (record) => {
      const { label: _old, ...rest } = record;
      return label === '' || label === record.hostName ? rest : { ...rest, label };
    });
    setMode('view');
    await onChanged();
  };
  const remove = async () => {
    await deleteComputer(computer.routeId);
    await onChanged();
  };

  return (
    <li className="px-4 py-3" data-computer={computer.routeId}>
      {mode === 'rename' ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <input
            value={draft}
            aria-label={wt('computers.name')}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={64}
            // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked to rename.
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:focus-ring"
          />
          <Button size="sm" type="submit">
            {wt('computers.save')}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setMode('view')}>
            {wt('computers.cancel')}
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <Monitor aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {removed ? wt('computers.removedThere') : wt('computers.lastConnected', { time })}
            </p>
          </div>
          {!removed && (
            <Button size="sm" onClick={() => void open()} data-action="open-computer">
              {wt('computers.open')}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={wt('computers.rename')}
            title={wt('computers.rename')}
            onClick={() => {
              setDraft(name);
              setMode('rename');
            }}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={wt('computers.remove')}
            title={wt('computers.remove')}
            onClick={() => setMode('remove')}
            data-action="remove-computer"
          >
            <Trash2 />
          </Button>
        </div>
      )}
      {mode === 'remove' && (
        <div className="mt-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">{wt('computers.removeConfirm', { name })}</p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void remove()}
            data-action="confirm-remove"
          >
            {wt('computers.remove')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
            {wt('computers.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}
