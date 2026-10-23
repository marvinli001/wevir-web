// The browser client. One page load serves one of three things: a pairing link (`/pair#…`), the computer list
// (`/computers`), or the app for the current computer. Switching computers reloads the page, so every connection starts
// from a clean renderer.
import './web.css';
import { App, bootstrapRenderer, installPlatform } from '@wevir-renderer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ComputerSlot } from './computer-slot';
import { ComputersPage } from './computers-page';
import { PairPage } from './pair-page';
import { currentPage, pageUrl } from './paths';
import { webPlatform } from './platform';
import { type ComputerRecord, getComputer, getCurrentComputerId, listComputers } from './store';

// A computer that removed this device opens the computer list instead of retrying a handshake it will refuse.
async function currentComputer(): Promise<ComputerRecord | undefined> {
  const id = await getCurrentComputerId();
  const record = id === undefined ? undefined : await getComputer(id);
  if (record !== undefined) return record.removedAt === undefined ? record : undefined;
  return (await listComputers()).find((computer) => computer.removedAt === undefined);
}

async function start(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root is missing');
  const page = currentPage(location.pathname);

  if (page === 'pair') {
    // The pairing secret leaves the address bar and history at once; the page keeps it in memory.
    const fragment = location.hash.slice(1);
    history.replaceState(null, '', pageUrl('pair'));
    // Opening another link in this tab only changes the fragment: start over with that link.
    window.addEventListener('hashchange', () => location.reload());
    installPlatform(webPlatform(undefined, {}));
    await bootstrapRenderer();
    createRoot(root).render(
      <StrictMode>
        <PairPage fragment={fragment} />
      </StrictMode>,
    );
    return;
  }

  const computer = page === 'app' ? await currentComputer() : undefined;
  if (page === 'computers' || computer === undefined) {
    if (page !== 'computers') history.replaceState(null, '', pageUrl('computers'));
    installPlatform(webPlatform(undefined, {}));
    await bootstrapRenderer();
    createRoot(root).render(
      <StrictMode>
        <ComputersPage />
      </StrictMode>,
    );
    return;
  }

  installPlatform(
    webPlatform(computer, { sidebarFooter: () => <ComputerSlot computer={computer} /> }),
  );
  await bootstrapRenderer();
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
