import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { HStack } from "../../ui/layout.tsx";
import type { StructureFilters } from "./use-structure-filter-state.ts";
import {
	hasActiveStructureFilters,
	useStructureFilters,
} from "./use-structure-filter-state.ts";

const filterOptions: Array<{
	key: keyof Omit<StructureFilters, "search">;
	label: string;
}> = [
	{ key: "nullable", label: "Nullable" },
	{ key: "primaryKey", label: "Primary Key" },
	{ key: "unique", label: "Unique" },
	{ key: "foreignKey", label: "Foreign Key" },
	{ key: "hasDefaults", label: "Has Defaults" },
];

/**
 * Structure filter controls with search input and dropdown for filter options
 */
export const StructureFilterControls = () => {
	const { filters, updateFilters, clearFilters } = useStructureFilters();
	const hasFilters = hasActiveStructureFilters(filters);
	const [open, setOpen] = useState(false);

	const activeCount = filterOptions.reduce((count, opt) => {
		return count + (filters[opt.key] ? 1 : 0);
	}, 0);

	return (
		<HStack className="gap-2">
			{/* Search Input */}
			<Input
				placeholder="Search columns, types..."
				value={filters.search}
				onChange={(e) => updateFilters({ search: e.target.value })}
				className="text-sm h-8 w-48"
			/>

			{/* Filters Dropdown */}
			<Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
				<Popover.Trigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-8 px-2 gap-1 justify-between"
					>
						<span className="text-xs font-medium text-foreground">
							Filters {activeCount > 0 ? `(${activeCount})` : ""}
						</span>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</Popover.Trigger>
				<Portal>
					<Popover.Positioner>
						<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 min-w-56">
							<div className="p-2 space-y-1">
								{filterOptions.map((option) => (
									<label
										key={option.key}
										className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-muted transition-colors"
									>
										<input
											type="checkbox"
											checked={filters[option.key]}
											onChange={(e) =>
												updateFilters({
													[option.key]: e.target.checked,
												})
											}
											className="rounded"
										/>
										<span className="flex-1">{option.label}</span>
									</label>
								))}
							</div>
							{hasFilters && (
								<div className="border-t border-border px-2 py-1.5">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											clearFilters();
											setOpen(false);
										}}
										className="w-full text-xs h-7 text-muted-foreground hover:text-foreground gap-2"
									>
										<X className="h-3 w-3" />
										Clear All
									</Button>
								</div>
							)}
						</Popover.Content>
					</Popover.Positioner>
				</Portal>
			</Popover.Root>
		</HStack>
	);
};
