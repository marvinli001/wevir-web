import { BrandMark } from '@wevir-renderer';
import type { ReactNode } from 'react';

/** The shell's pages: the brand mark, a title and one column. */
export function ShellFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-md">
        <BrandMark className="mb-6 size-9 text-brand" />
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
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
