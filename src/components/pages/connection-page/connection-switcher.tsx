import { createListCollection, Portal } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EllipsisIcon,
	LucidePlus,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { DarkModeToggle } from "#src/components/ui/dark-mode-toggle.tsx";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuItemText,
	MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { queryClient } from "#src/query-client.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import * as ListboxMenu from "../../ui/listbox-menu";
import { Tooltip } from "../../ui/tooltip.tsx";
import type { DbConnection } from "../connection.types";

interface ConnectionSwitcherProps {
	connection: DbConnection;
	onAddConnection: () => void;
}

export const ConnectionSwitcher = (props: ConnectionSwitcherProps) => {
	const { connection } = props;
	const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);

	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
	const connectionName = connection.name;
	const redactedUrl = redactConnectionUrl(connection.url);

	return (
		<div className="flex flex-col gap-1 px-4 py-3 border-b">
			<div className="flex items-center justify-between gap-2">
				<div className="flex-1 min-w-0">
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
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-start px-0 h-8 gap-1"
							>
								<span className="text-sm text-foreground font-medium truncate">
									{connection.name}
								</span>
								<ChevronDownIcon className="h-3 w-3 text-muted-foreground shrink-0" />
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
									if (details.value && details.value[0] !== connectionName) {
										setConnectionMenuOpen(false);
										navigate({
											to: "/connections/$connectionName",
											params: { connectionName: details.value[0] },
										});
									}
								}}
							>
								<ListboxMenu.ListboxMenuList>
									<ListboxMenu.ListboxMenuItem
										item={{ label: "Back to connections", value: "__back" }}
										onClick={() => {
											setConnectionMenuOpen(false);
											navigate({
												to: "/",
											});
										}}
									>
										<HStack gap="1" align="center">
											<ChevronLeftIcon className="h-3 w-3 text-muted-foreground shrink-0" />
											<span>Back to connections</span>
										</HStack>
									</ListboxMenu.ListboxMenuItem>
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
										item={{ label: "Add new connection", value: "__add" }}
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
				</div>
				<DarkModeToggle variant="ghost" />

				<Menu lazyMount>
					<MenuTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							className="rounded-full shadow-none"
							aria-label="Open menu"
						>
							<EllipsisIcon size={16} aria-hidden="true" />
						</Button>
					</MenuTrigger>
					<Portal>
						<MenuContent className="z-50">
							<MenuItem
								value="reset-page"
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
								<RotateCcw className="size-4" />
								<MenuItemText>Reset page</MenuItemText>
							</MenuItem>
							<MenuItem
								value="refetch-all"
								onClick={() => {
									queryClient.invalidateQueries();
								}}
							>
								<RefreshCw className="size-4" />
								<MenuItemText>Refetch all</MenuItemText>
							</MenuItem>
						</MenuContent>
					</Portal>
				</Menu>
			</div>
			<Tooltip content={redactedUrl}>
				<span className="text-[10px] text-muted-foreground truncate">
					{redactedUrl}
				</span>
			</Tooltip>
		</div>
	);
};
