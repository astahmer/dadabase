import { Copy, Eye, Link, Link2, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Clipboard } from "@ark-ui/react";
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
	primaryKey?: boolean;
	foreignKey?: ForeignKeyInfo;
	onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onFindReferences?: (columnName: string, cellValue: unknown) => void;
	onShowQuickReferences?: () => void;
	onOpen?: () => void;
	children: ReactNode;
}

export function CellContextMenu({
	cellValue,
	columnName,
	primaryKey,
	foreignKey,
	onFollowFK,
	onFindReferences,
	onShowQuickReferences,
	onOpen,
	children,
}: CellContextMenuProps) {
	const text = cellValue === null ? "null" : String(cellValue);

	return (
		<Menu
			lazyMount
			onOpenChange={(details) => {
				if (details.open && cellValue !== null && onOpen) {
					onOpen();
				}
			}}
		>
			<MenuContextTrigger asChild>
				<span className="select-text! cursor-auto group-data-cmd-hover:underline group-data-cmd-hover:underline-offset-2 group-data-cmd-hover:cursor-pointer">
					{children}
				</span>
			</MenuContextTrigger>
			<Portal>
				<MenuContent className="z-1">
					<MenuItem
						value="log"
						onClick={() => {
							console.log(`Cell [${columnName}]:`, cellValue);
						}}
					>
						<Eye className="size-4" />
						<MenuItemText>Log cell to console</MenuItemText>
					</MenuItem>
					<Clipboard.Root value={text}>
						<MenuItem value="copy" asChild>
							<Clipboard.Trigger>
								<Copy className="size-4" />
								<MenuItemText>Copy value</MenuItemText>
							</Clipboard.Trigger>
						</MenuItem>
					</Clipboard.Root>

					{foreignKey && cellValue !== null && onFollowFK && (
						<>
							<MenuSeparator />
							<MenuItem
								value="follow-fk"
								onClick={() => {
									if (onFollowFK && foreignKey && cellValue !== null) {
										onFollowFK(foreignKey, cellValue);
									}
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
								}}
							>
								<Search className="size-4" />
								<MenuItemText>Filter rows with this value</MenuItemText>
							</MenuItem>
						</>
					)}

					{(foreignKey || primaryKey) &&
						cellValue !== null &&
						onShowQuickReferences && (
							<>
								<MenuSeparator />
								<MenuItem
									value="quick-refs"
									onClick={() => {
										if (onShowQuickReferences) {
											onShowQuickReferences();
										}
									}}
								>
									<Link2 className="size-4" />
									<MenuItemText>View all references</MenuItemText>
								</MenuItem>
							</>
						)}
				</MenuContent>
			</Portal>
		</Menu>
	);
}
