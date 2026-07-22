import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button.tsx";

interface RowsTableErrorStateProps {
  activeConnectionUrl: string;
}

export const TabErrorState = (props: RowsTableErrorStateProps) => {
  const { activeConnectionUrl } = props;
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  const schemaListQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
    enabled: !!activeConnectionUrl,
    retry: 1,
  });

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center">
      <div className="mx-4 w-full max-w-2xl">
        <div className="flex flex-col gap-3">
          <ErrorBoundaryCard
            error={schemaListQuery.error}
            title="Failed to connect to database"
            onRetry={() => schemaListQuery.refetch()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate({ to: "/" });
            }}
          >
            Back to Connections
          </Button>
        </div>
      </div>
    </div>
  );
};
