import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button";

interface RowsTableErrorStateProps {
	activeConnectionUrl: string;
}

export const RowsTableErrorState = ({
	activeConnectionUrl,
}: RowsTableErrorStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});
	return (
		<div className="flex-1 flex items-center justify-center">
			{schemaListQuery.isError ? (
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
			) : (
				<div className="text-center">
					<span className="text-muted-foreground">
						Select a schema and table to view data
					</span>
				</div>
			)}
		</div>
	);
};
