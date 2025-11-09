import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import { Popover, Portal } from "@ark-ui/react";
import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { InlineRelationshipsPopover } from "./inline-relationships-popover";

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
}: RelationshipsQuickButtonProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover.Root
			open={isOpen}
			onOpenChange={(details) => setIsOpen(details.open)}
			lazyMount
		>
			<Popover.Trigger
				className="focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
				title="View relationships"
				aria-label="View relationships"
			>
				<LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" />
			</Popover.Trigger>

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
