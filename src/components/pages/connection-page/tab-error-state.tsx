import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
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
		retry: 3,
	});

	return (
		<div className="flex-1 flex items-center justify-center h-full min-h-0">
			<div className="max-w-2xl w-full mx-4">
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
