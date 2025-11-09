import { Copy, Link, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	Menu,
	MenuContextTrigger,
	MenuContent,
	MenuItem,
	MenuItemText,
	MenuSeparator,
} from "./ui/menu";
import { Portal } from "@ark-ui/react";

export interface ForeignKeyInfo {
	referencedSchema: string;
	referencedTable: string;
	referencedColumn: string;
}

export interface CellContextMenuProps {
	cellValue: unknown;
	columnName: string;
	foreignKey?: ForeignKeyInfo;
	onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onFindReferences?: (columnName: string, cellValue: unknown) => void;
	children: ReactNode;
}

export function CellContextMenu({
	cellValue,
	columnName,
	foreignKey,
	onFollowFK,
	onFindReferences,
	children,
}: CellContextMenuProps) {
	const [isOpen, setIsOpen] = useState(false);

	const handleLogCell = () => {
		console.log(`Cell [${columnName}]:`, cellValue);
		setIsOpen(false);
	};

	const handleCopyCell = () => {
		const text = cellValue === null ? "null" : String(cellValue);
		navigator.clipboard.writeText(text).catch((err) => {
			console.error("Failed to copy:", err);
		});
		setIsOpen(false);
	};

	const handleFollowFK = () => {
		if (onFollowFK && foreignKey && cellValue !== null) {
			onFollowFK(foreignKey, cellValue);
		}
		setIsOpen(false);
	};

	const handleFindReferences = () => {
		if (onFindReferences && cellValue !== null) {
			onFindReferences(columnName, cellValue);
		}
		setIsOpen(false);
	};

	return (
		<Menu
			lazyMount
			open={isOpen}
			onOpenChange={(details) => setIsOpen(details.open)}
		>
			<MenuContextTrigger>
				<span className="select-text cursor-auto">{children}</span>
			</MenuContextTrigger>
			<Portal>
				<MenuContent className="z-1">
					<MenuItem value="log" onClick={handleLogCell}>
						<MenuItemText>Log cell to console</MenuItemText>
					</MenuItem>
					<MenuItem value="copy" onClick={handleCopyCell}>
						<Copy className="size-4" />
						<MenuItemText>Copy value</MenuItemText>
					</MenuItem>

					{foreignKey && cellValue !== null && (
						<>
							<MenuSeparator />
							<MenuItem value="follow-fk" onClick={handleFollowFK}>
								<Link className="size-4" />
								<MenuItemText>
									Follow to {foreignKey.referencedTable}
								</MenuItemText>
							</MenuItem>
						</>
					)}

					{cellValue !== null && (
						<>
							<MenuSeparator />
							<MenuItem value="find-refs" onClick={handleFindReferences}>
								<Search className="size-4" />
								<MenuItemText>Find references</MenuItemText>
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Portal>
		</Menu>
	);
}
