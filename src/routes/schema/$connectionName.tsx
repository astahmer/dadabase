import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { ArrowLeft } from "lucide-react";

import { MultiTableStructureViewer } from "#src/components/pages/connection-page/multi-table-structure-viewer.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { getDialectDefaultSchema } from "#src/db/dialect.ts";
import { toValidator } from "#src/db/effect-compat.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";

const searchSchema = Schema.Struct({
  schema: Schema.String.pipe(Schema.optional),
});

export const Route = createFileRoute("/schema/$connectionName")({
  validateSearch: searchSchema.pipe(toValidator),
  component: RouteComponent,
});

function RouteComponent() {
  const { connectionName } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/schema/$connectionName" });
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
  const connection = connectionList.data.find((item) => item.name === connectionName);

  if (!connection) {
    return (
      <div className="bg-background flex min-h-screen items-center px-4 py-8">
        <div className="bg-card mx-auto w-full max-w-lg rounded-xl border p-6 shadow-sm">
          <p className="text-muted-foreground text-sm font-medium">Connection unavailable</p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
            This connection no longer exists
          </h1>
          <Link to="/" className="mt-6 inline-flex">
            <Button>Back to connections</Button>
          </Link>
        </div>
      </div>
    );
  }

  const schemasQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: connection.url }),
    retry: 2,
  });
  const schemas = schemasQuery.data ?? [];
  const displaySchema =
    search.schema ??
    (schemas.length === 1 ? schemas[0] : undefined) ??
    getDialectDefaultSchema(connection.dialect);

  return (
    <main className="bg-background flex min-h-screen flex-col">
      <header className="border-b px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Link
                to="/connections/$connectionName"
                params={{ connectionName }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to workspace
              </Link>
              <span className="text-muted-foreground text-sm">{connection.name}</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">Schema Explorer</h1>
            <p className="text-muted-foreground text-sm">
              Browse, compare, and export table structures for this connection.
            </p>
          </div>
          {schemas.length > 1 && (
            <label className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
              Schema
              <select
                value={displaySchema}
                onChange={(event) => {
                  void navigate({ search: { schema: event.target.value } });
                }}
                className="border-border bg-background text-foreground h-8 rounded-md border px-2 text-sm"
              >
                {schemas.map((schema) => (
                  <option key={schema} value={schema}>
                    {schema}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 px-4 py-4 sm:px-6">
        {schemasQuery.isLoading ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
            <Spinner /> Loading schemas…
          </div>
        ) : (
          <MultiTableStructureViewer
            activeConnectionUrl={connection.url}
            connectionName={connectionName}
            schema={displaySchema}
            tableSize="compact"
          />
        )}
      </div>
    </main>
  );
}
