import {
	LucideChevronDown,
	LucideChevronUp,
	LucideListFilter,
	X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../../ui/button";
import { HStack, Stack } from "../../ui/layout.tsx";
import { Tooltip } from "../../ui/tooltip.tsx";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";
import type { StructureFilters } from "./use-structure-filter-state.ts";
import {
	getDefaultStructureFilters,
	hasActiveStructureFilters,
	useStructureFilters,
} from "./use-structure-filter-state.ts";

interface StructureTableFiltersProps {
	filtersOpened: boolean;
	onToggleFilters: () => void;
	isLoading?: boolean;
}

export const StructureTableFilters = (props: StructureTableFiltersProps) => {
	const { filtersOpened, onToggleFilters, isLoading } = props;
	const { filters, updateFilters, clearFilters } = useStructureFilters();
	const hasFilters = hasActiveStructureFilters(filters);

	return (
		<div className="space-y-2">
			<HStack className="justify-between">
				<Button
					variant={hasFilters && !filtersOpened ? "default" : "outline"}
					size="sm"
					onClick={onToggleFilters}
					disabled={isLoading}
					className={hasFilters ? "gap-2" : ""}
				>
					<LucideListFilter className="h-3 w-3" />
					{filtersOpened ? "Filters" : "Show filters"}
					{hasFilters && (
						<span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-semibold bg-background/20">
							{Object.values(filters).filter(Boolean).length}
						</span>
					)}
					{filtersOpened ? (
						<LucideChevronUp className="h-3 w-3" />
					) : (
						<LucideChevronDown className="h-3 w-3" />
					)}
				</Button>
				{hasFilters && (
					<Button
						variant="ghost"
						size="sm"
						onClick={clearFilters}
						className="gap-2 text-muted-foreground hover:text-foreground"
					>
						<X className="h-3 w-3" />
						Clear all
					</Button>
				)}
			</HStack>

			{filtersOpened && (
				<Stack className="border rounded-lg p-3 space-y-3 bg-muted/20">
					{/* Search Input */}
					<div className="space-y-1.5">
						<Label htmlFor="structure-search" className="text-xs font-medium">
							Search
						</Label>
						<Input
							id="structure-search"
							placeholder="Column name, type, or foreign key..."
							value={filters.search}
							onChange={(e) => updateFilters({ search: e.target.value })}
							className="text-sm h-8"
						/>
					</div>

					{/* Checkboxes */}
					<div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:gap-3">
						<FilterCheckbox
							id="nullable"
							label="Nullable"
							checked={filters.nullable}
							onChange={() => updateFilters({ nullable: !filters.nullable })}
						/>
						<FilterCheckbox
							id="primaryKey"
							label="Primary Key"
							checked={filters.primaryKey}
							onChange={() =>
								updateFilters({ primaryKey: !filters.primaryKey })
							}
						/>
						<FilterCheckbox
							id="unique"
							label="Unique"
							checked={filters.unique}
							onChange={() => updateFilters({ unique: !filters.unique })}
						/>
						<FilterCheckbox
							id="foreignKey"
							label="Foreign Key"
							checked={filters.foreignKey}
							onChange={() =>
								updateFilters({ foreignKey: !filters.foreignKey })
							}
						/>
						<FilterCheckbox
							id="hasDefaults"
							label="Has Defaults"
							checked={filters.hasDefaults}
							onChange={() =>
								updateFilters({ hasDefaults: !filters.hasDefaults })
							}
						/>
					</div>
				</Stack>
			)}
		</div>
	);
};

interface FilterCheckboxProps {
	id: string;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

const FilterCheckbox = ({
	id,
	label,
	checked,
	onChange,
}: FilterCheckboxProps) => (
	<div className="flex items-center gap-2">
		<Checkbox
			id={id}
			checked={checked}
			onCheckedChange={(details) => onChange(Boolean(details.checked))}
		/>
		<Label htmlFor={id} className="text-xs font-normal cursor-pointer">
			{label}
		</Label>
	</div>
);
