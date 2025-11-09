import type { ColumnReference } from "#src/server/pg/fns/get-table-foreign-keys.kysely.ts";
import { Popover, Portal } from "@ark-ui/react";
import { Link as LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InlineReferencesPopover } from "./inline-references.popover";
import { Button } from "./ui/button.tsx";

interface InlineReferencesButton {
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
	onPrefetchReferences: () => void;
	onExpandToSheet?: () => void;
	children: React.ReactNode;
}

export function InlineReferencesButton({
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
	onPrefetchReferences,
	children,
}: InlineReferencesButton) {
	const [isOpen, setIsOpen] = useState(false);
	const divRef = useRef<HTMLDivElement>(null);
	const mousePositionRef = useRef({ x: 0, y: 0 });
	const isModifierPressedRef = useRef(false);

	const updateDataAttribute = () => {
		if (!divRef.current) return;

		// Use parent's bounding box to avoid overflow issues
		// Such as the previous column overflowing into the one currently hovered
		// so that both the previous and the (visually) current column would have the underline style
		const parentRect = divRef.current.parentElement?.getBoundingClientRect();
		if (!parentRect) return;

		const { x, y } = mousePositionRef.current;
		const isMouseOver =
			x >= parentRect.left &&
			x <= parentRect.right &&
			y >= parentRect.top &&
			y <= parentRect.bottom;

		if (isMouseOver && isModifierPressedRef.current) {
			divRef.current.dataset.cmdHover = "true";
			onPrefetchReferences();
		} else {
			delete divRef.current.dataset.cmdHover;
		}
	};

	useEffect(() => {
		const trackMouse = (e: MouseEvent) => {
			mousePositionRef.current = { x: e.clientX, y: e.clientY };
			updateDataAttribute();
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			isModifierPressedRef.current = e.ctrlKey || e.metaKey;
			updateDataAttribute();
		};

		const handleKeyUp = () => {
			isModifierPressedRef.current = false;
			if (divRef.current) {
				delete divRef.current.dataset.cmdHover;
			}
		};

		window.addEventListener("mousemove", trackMouse);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("mousemove", trackMouse);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	return (
		<Popover.Root
			open={isOpen}
			onOpenChange={(details) => setIsOpen(details.open)}
			lazyMount
		>
			<Popover.Trigger
				className="focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
				title="View relationships (⌘ click on Mac, Ctrl click on Windows)"
				aria-label="View relationships"
				asChild
				onMouseEnter={onPrefetchReferences}
			>
				<Button variant="ghost" size="xs" className="px-1">
					<LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300" />
				</Button>
			</Popover.Trigger>
			<div
				ref={divRef}
				onClick={(e) => {
					if (e.ctrlKey || e.metaKey) {
						setIsOpen(true);
					}
				}}
				className="group cursor-pointer transition-all"
			>
				{children}
			</div>

			<Portal>
				<Popover.Positioner>
					<Popover.Content className="z-50">
						<InlineReferencesPopover
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
