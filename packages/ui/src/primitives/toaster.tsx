"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      data-slot="toaster"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-2",
          description: "text-muted-foreground",
          actionButton:
            "inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm text-primary-foreground",
          cancelButton:
            "inline-flex h-8 items-center justify-center rounded-md bg-surface-2 px-3 text-sm text-foreground",
          error: "border-destructive text-destructive",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
export type { ToasterProps };
