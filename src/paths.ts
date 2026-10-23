// The shell's own pages sit beside the app: `<base>pair` (pairing links), `<base>computers` (the list); everything else
// is the app, whose routes live in the hash. `BASE_URL` lets a self-hosted copy live under a path.

const BASE = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export type ShellPage = 'pair' | 'computers' | 'app';

export function currentPage(pathname: string): ShellPage {
  const rest = pathname.startsWith(BASE)
    ? pathname.slice(BASE.length)
    : pathname.replace(/^\//, '');
  const page = rest.replace(/\/+$/, '');
  if (page === 'pair') return 'pair';
  if (page === 'computers') return 'computers';
  return 'app';
}

export function pageUrl(page: ShellPage): string {
  return page === 'app' ? BASE : `${BASE}${page}`;
}
