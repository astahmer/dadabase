import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon, LucidePlus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import * as Breadcrumb from "../../ui/breadcrumb";
import { Button } from "../../ui/button";
import { DarkModeToggle } from "../../ui/dark-mode-toggle";
import { HStack } from "../../ui/layout.tsx";
import * as ListboxMenu from "../../ui/listbox-menu";
import { Tooltip } from "../../ui/tooltip.tsx";
import type { DbConnection } from "../connection.types";
import { createListCollection } from "@ark-ui/react";

interface ConnectionPageHeaderProps {
	connection: DbConnection;
	onAddConnection: () => void;
}

export const ConnectionPageHeader = (props: ConnectionPageHeaderProps) => {
	const { connection } = props;
	const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connectionName = connection.name;
	const redactedUrl = redactConnectionUrl(connection.url);

	return (
		<div className="border-b bg-card px-4 py-2 sm:px-6 space-y-2">
			<div className="flex items-center justify-between gap-4">
				<div className="flex-1 min-w-0">
					<Breadcrumb.BreadcrumbRoot>
						<Breadcrumb.BreadcrumbList size="sm">
							<Breadcrumb.BreadcrumbItem>
								<Breadcrumb.BreadcrumbLink
									href="#"
									onClick={(e) => {
										e.preventDefault();
										navigate({ to: "/" });
									}}
								>
									Connections
								</Breadcrumb.BreadcrumbLink>
							</Breadcrumb.BreadcrumbItem>
							<Breadcrumb.BreadcrumbSeparator />
							<Breadcrumb.BreadcrumbItem>
								<ListboxMenu.ListboxMenuRoot
									open={connectionMenuOpen}
									onOpenChange={(details) => {
										setConnectionMenuOpen(details.open);
									}}
								>
									<ListboxMenu.ListboxMenuTrigger
										variant="unstyled"
										size="unstyled"
										asChild
									>
										<Button variant="ghost" size="sm">
											<span className="text-foreground">{connection.name}</span>
											<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
										</Button>
									</ListboxMenu.ListboxMenuTrigger>
									<ListboxMenu.ListboxMenuContent>
										<ListboxMenu.ListboxRoot
											collection={createListCollection({
												items: connectionList.data.map((conn) => ({
													label: conn.name,
													value: conn.name,
												})),
											})}
											onValueChange={(details) => {
												if (
													details.value &&
													details.value[0] !== connectionName
												) {
													setConnectionMenuOpen(false);
													navigate({
														to: "/connections/$connectionName",
														params: { connectionName: details.value[0] },
													});
												}
											}}
										>
											<ListboxMenu.ListboxMenuList>
												{connectionList.data.map((conn) => (
													<ListboxMenu.ListboxMenuItem
														key={conn.name}
														item={{ label: conn.name, value: conn.name }}
														showIndicator={conn.name === connectionName}
														className={
															conn.name === connectionName
																? "bg-primary/15 text-primary font-semibold hover:bg-primary/20"
																: ""
														}
													>
														{conn.name}
													</ListboxMenu.ListboxMenuItem>
												))}
												<div className="border-t" />
												<ListboxMenu.ListboxMenuItem
													item={{
														label: "Add new connection",
														value: "__add",
													}}
													onClick={() => {
														setConnectionMenuOpen(false);
														props.onAddConnection();
													}}
												>
													<HStack gap="1" align="center">
														<LucidePlus className="h-3 w-3" />
														<span>Add new connection</span>
													</HStack>
												</ListboxMenu.ListboxMenuItem>
											</ListboxMenu.ListboxMenuList>
										</ListboxMenu.ListboxRoot>
									</ListboxMenu.ListboxMenuContent>
								</ListboxMenu.ListboxMenuRoot>
							</Breadcrumb.BreadcrumbItem>
						</Breadcrumb.BreadcrumbList>
					</Breadcrumb.BreadcrumbRoot>
					<span className="text-xs text-muted-foreground truncate block">
						{redactedUrl}
					</span>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							navigate({
								search: (prev) => {
									return {
										dbName: prev.dbName,
										schema: undefined,
										table: undefined,
										viewMode: undefined,
										tableSize: undefined,
										tableFilter: undefined,
										hiddenColumnList: [],
										filters: undefined,
										filtersOpened: false,
										offset: 0,
										limit: 50,
										orderBy: undefined,
										orderDirection: undefined,
										relationshipRowId: undefined,
										quickReferencesCellValue: undefined,
										quickReferencesColumnName: undefined,
										quickReferencesOpen: false,
										tabs: [],
										activeTabId: undefined,
									};
								},
							});
						}}
					>
						Reset page
					</Button>
					<Tooltip content="Refetch all">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								queryClient.invalidateQueries();
							}}
							className="shrink-0"
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</Tooltip>
					<DarkModeToggle />
				</div>
			</div>
		</div>
	);
};
