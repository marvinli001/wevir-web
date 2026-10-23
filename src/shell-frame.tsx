import { BrandMark } from '@wevir-renderer';
import type { ReactNode } from 'react';

/** The shell's pages: the brand mark, a title (with an action beside it) and one column. */
export function ShellFrame({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-full justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-md">
        <BrandMark className="mb-6 size-9 text-brand" />
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {action}
        </div>
        {children}
      </div>
    </main>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}
