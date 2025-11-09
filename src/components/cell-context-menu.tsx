import { Copy, Eye, Link, Search } from "lucide-react";
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
	onShowQuickReferences?: () => void;
	children: ReactNode;
}

export function CellContextMenu({
	cellValue,
	columnName,
	foreignKey,
	onFollowFK,
	onFindReferences,
	onShowQuickReferences,
	children,
}: CellContextMenuProps) {
	const [isOpen, setIsOpen] = useState(false);

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
					<MenuItem
						value="log"
						onClick={() => {
							console.log(`Cell [${columnName}]:`, cellValue);
							setIsOpen(false);
						}}
					>
						<Eye className="size-4" />
						<MenuItemText>Log cell to console</MenuItemText>
					</MenuItem>
					<MenuItem
						value="copy"
						onClick={() => {
							const text = cellValue === null ? "null" : String(cellValue);
							navigator.clipboard.writeText(text).catch((err) => {
								console.error("Failed to copy:", err);
							});
							setIsOpen(false);
						}}
					>
						<Copy className="size-4" />
						<MenuItemText>Copy value</MenuItemText>
					</MenuItem>

					{foreignKey && cellValue !== null && onFollowFK && (
						<>
							<MenuSeparator />
							<MenuItem
								value="follow-fk"
								onClick={() => {
									if (onFollowFK && foreignKey && cellValue !== null) {
										onFollowFK(foreignKey, cellValue);
									}
									setIsOpen(false);
								}}
							>
								<Link className="size-4" />
								<MenuItemText>
									Go to {foreignKey.referencedTable}.
									{foreignKey.referencedColumn}
								</MenuItemText>
							</MenuItem>
						</>
					)}

					{cellValue !== null && onFindReferences && (
						<>
							<MenuSeparator />
							<MenuItem
								value="find-refs"
								onClick={() => {
									if (onFindReferences && cellValue !== null) {
										onFindReferences(columnName, cellValue);
									}
									setIsOpen(false);
								}}
							>
								<Search className="size-4" />
								<MenuItemText>Filter rows with this value</MenuItemText>
							</MenuItem>
						</>
					)}

					{cellValue !== null && onShowQuickReferences && (
						<>
							<MenuSeparator />
							<MenuItem
								value="quick-refs"
								onClick={() => {
									if (onShowQuickReferences) {
										onShowQuickReferences();
									}
									setIsOpen(false);
								}}
							>
								<Search className="size-4" />
								<MenuItemText>View all relationships</MenuItemText>
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Portal>
		</Menu>
	);
}
