import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { ConnectionForm } from "#src/components/pages/connection.form.tsx";
import { useDocumentTitle } from "#src/hooks/use-document-title.ts";

/**
 * H1/H2: dedicated deep-linkable creation form. Previously `/connections/new`
 * fell through to `$connectionName` and rendered "Connection unavailable".
 * The static segment takes precedence over the dynamic one.
 */
export const Route = createFileRoute("/connections/new")({
  component: NewConnectionPage,
});

function NewConnectionPage() {
  useDocumentTitle("New connection — Dadabase");

  return (
    <div className="bg-background flex min-h-screen items-start justify-center px-4 py-10 sm:py-16">
      <div className="bg-card w-full max-w-xl rounded-xl border p-6 shadow-sm sm:p-8">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to connections
        </Link>
        <h1 className="text-foreground mt-3 text-2xl font-semibold tracking-tight">
          New connection
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Read-only is on by default — turn it off only when you intend to make changes.
        </p>
        <div className="mt-6">
          <ConnectionForm mode="create" />
        </div>
      </div>
    </div>
  );
}
