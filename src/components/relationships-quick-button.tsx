import { Link as LinkIcon } from "lucide-react";
import { useState, useRef } from "react";
import { Popover, Portal } from "@ark-ui/react";
import { InlineRelationshipsPopover } from "./inline-relationships-popover";
import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";

export interface RelationshipsQuickButtonProps {
	schema: string;
	table: string;
	columnName: string;
	columnDataType: string;
	foreignKey?: {
		referencedSchema: string;
		referencedTable: string;
		referencedColumn: string;
	};
	cellValue: unknown;
	connectionUrl: string;
	onNavigateToFK?: (
		fkInfo: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		},
		cellValue: unknown,
	) => void;
	onNavigateToReference?: (ref: ColumnReference, cellValue: unknown) => void;
	onExpandToSheet?: () => void;
	children: React.ReactNode;
}

export function RelationshipsQuickButton({
	schema,
	table,
	columnName,
	columnDataType,
	foreignKey,
	cellValue,
	connectionUrl,
	onNavigateToFK,
	onNavigateToReference,
	onExpandToSheet,
	children,
}: RelationshipsQuickButtonProps) {
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	// Only show button if FK or if column could have reverse references
	const shouldShowButton = foreignKey !== undefined;

	if (!shouldShowButton || cellValue === null) {
		return <>{children}</>;
	}

	return (
		<Popover.Root
			open={isOpen}
			onOpenChange={(details) => setIsOpen(details.open)}
			lazyMount
		>
			<div className="flex items-center gap-1.5 group">
				<div>{children}</div>
				<Popover.Trigger
					ref={triggerRef}
					className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5 -m-0.5"
					title="View relationships"
					aria-label="View relationships"
				>
					<LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" />
				</Popover.Trigger>
			</div>

			<Portal>
				<Popover.Positioner>
					<Popover.Content className="z-50">
						<InlineRelationshipsPopover
							schema={schema}
							table={table}
							columnName={columnName}
							columnDataType={columnDataType}
							foreignKey={foreignKey}
							cellValue={cellValue}
							connectionUrl={connectionUrl}
							onNavigateToFK={onNavigateToFK}
							onNavigateToReference={onNavigateToReference}
							onExpandToSheet={() => {
								setIsOpen(false);
								onExpandToSheet?.();
							}}
						/>
					</Popover.Content>
				</Popover.Positioner>
			</Portal>
		</Popover.Root>
	);
}
