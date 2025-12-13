import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { memo, useCallback, useId, useMemo, useState } from "react";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { renderPrimitiveValue } from "#src/components/ui/json-viewer.render-primitive-value.tsx";
import { JsonArray } from "#src/components/ui/json-viewer.tsx";
import { cn } from "#src/lib/utils";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/introspection/start-fns/get-relationship-subrow-data.start.ts";
import { getRelationshipsCountsQueryOptions } from "#src/server/introspection/start-fns/get-relationships-counts.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";

interface RelationshipExplorerProps {
	/** The current row data to display and explore relations for */
	row: Record<string, unknown>;
	/** Current schema name */
	schema: string;
	/** Current table name */
	table: string;
	/** Connection URL */
	connectionUrl: string;
	/** Optional className */
	className?: string;
	/** Max depth for JSON expansion (default: 3) */
	maxDepth?: number;
	/** Whether to show relationship explorer keys (default: true) */
	showRelationships?: boolean;
}

/**
 * RelationshipExplorer displays a row as JSON with nested related data.
 * Relationships are merged into the row structure as nested objects/arrays.
 */
export const RelationshipExplorer = memo(function RelationshipExplorer({
	row,
	schema,
	table,
	connectionUrl,
	className,
	maxDepth = 3,
	showRelationships = true,
}: RelationshipExplorerProps) {
	const [expandedRelationships, setExpandedRelationships] = useState<
		Set<string>
	>(new Set());

	// Fetch all relationships for this table
	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url: connectionUrl,
			schema,
			table,
		}),
	);

	const allRelationships = relationshipsQuery.data ?? [];

	// Filter valid relationships (both outgoing and incoming)
	const validRelationships = useMemo(() => {
		return showRelationships
			? allRelationships.filter((rel) => {
					const fkValue =
						rel.type === "incoming"
							? row[rel.referencedColumn]
							: row[rel.referencingColumn];
					return (
						fkValue !== null && fkValue !== undefined && fkValue !== "null"
					);
				})
			: [];
	}, [allRelationships, showRelationships, row]);

	// Fetch counts for all valid relationships
	const countsQuery = useQuery({
		...getRelationshipsCountsQueryOptions({
			url: connectionUrl,
			schema,
			table,
			relationships: validRelationships,
			rowData: row,
		}),
		enabled: validRelationships.length > 0,
	});

	const handleToggleRelationship = useCallback((constraintName: string) => {
		setExpandedRelationships((prev) => {
			const next = new Set(prev);
			if (next.has(constraintName)) {
				next.delete(constraintName);
			} else {
				next.add(constraintName);
			}
			return next;
		});
	}, []);

	return (
		<div className={cn("font-mono text-sm", className)}>
			<RenderRelationshipValue
				value={row}
				relationships={validRelationships}
				counts={countsQuery.data ?? {}}
				expandedRelationships={expandedRelationships}
				onToggleRelationship={handleToggleRelationship}
				depth={0}
				maxDepth={maxDepth}
				connectionUrl={connectionUrl}
				relationshipsLoading={relationshipsQuery.isLoading}
			/>
		</div>
	);
});

interface RenderRelationshipValueProps {
	value: unknown;
	relationships: TableRelationship[];
	counts: Record<string, number>;
	expandedRelationships: Set<string>;
	onToggleRelationship: (constraintName: string) => void;
	depth: number;
	maxDepth: number;
	connectionUrl: string;
	relationshipsLoading: boolean;
}

/**
 * Renders a value with relationship fields merged into objects.
 * Primitives and arrays use standard JSON rendering.
 * Objects render data fields and inject relationship fields inline.
 */
const RenderRelationshipValue = memo(function RenderRelationshipValue({
	value,
	relationships,
	counts,
	expandedRelationships,
	onToggleRelationship,
	depth,
	maxDepth,
	connectionUrl,
	relationshipsLoading,
}: RenderRelationshipValueProps) {
	const [isExpanded, setIsExpanded] = useState(depth <= 1);

	// Handle primitives
	const primitiveRender = renderPrimitiveValue(value);
	if (primitiveRender !== null) {
		return primitiveRender;
	}

	// Handle arrays
	if (Array.isArray(value)) {
		return (
			<div data-explorer-key={`array-${depth}`} className="inline">
				<JsonArray
					array={value}
					depth={depth}
					maxDepth={maxDepth}
					isExpanded={isExpanded}
					onToggle={() => setIsExpanded(!isExpanded)}
				/>
			</div>
		);
	}

	// Handle objects with relationships
	if (typeof value === "object" && value !== null) {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);
		const isEmpty = keys.length === 0 && relationships.length === 0;
		const id = useId();

		return (
			<>
				<span className="text-gray-800 dark:text-gray-200">{`{`}</span>
				{!isEmpty && (
					<div className="ml-4 border-l border-muted" id={id}>
						{/* Regular data fields */}
						{keys.map((key) => {
							const fieldValue = obj[key];
							const isExpandable =
								typeof fieldValue === "object" && fieldValue !== null;
							return (
								<div key={key} className="py-0.5">
									{isExpandable ? (
										<button
											onClick={(e) => {
												e.preventDefault();
												const jsonValue = document.querySelector(
													`#${id} [data-explorer-key="${key}-${depth}"]`,
												);
												if (jsonValue && jsonValue !== e.currentTarget) {
													const toggleBtn = jsonValue.querySelector("button");
													if (toggleBtn) {
														toggleBtn.click();
													}
												}
											}}
											className="text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity"
										>
											"{key}"
										</button>
									) : (
										<span className="text-blue-600 dark:text-blue-400">
											"{key}"
										</span>
									)}
									<span className="text-gray-800 dark:text-gray-200">
										{`: `}
									</span>
									<div data-explorer-key={`${key}-${depth}`} className="inline">
										<RenderRelationshipValue
											value={fieldValue}
											relationships={[]}
											counts={{}}
											expandedRelationships={expandedRelationships}
											onToggleRelationship={onToggleRelationship}
											depth={depth + 1}
											maxDepth={maxDepth}
											connectionUrl={connectionUrl}
											relationshipsLoading={relationshipsLoading}
										/>
									</div>
									<span className="text-gray-800 dark:text-gray-200">,</span>
								</div>
							);
						})}

						{/* Inline relationships - merged into the object */}
						{relationships.map((rel) => (
							<RelationshipField
								key={`${rel.constraintName}.${rel.referencingColumn}.${rel.referencedColumn}.${rel.referencingTable}.${rel.referencedTable}`}
								relationship={rel}
								rowData={obj}
								count={counts[rel.constraintName] ?? 0}
								isExpanded={expandedRelationships.has(rel.constraintName)}
								onToggle={() => onToggleRelationship(rel.constraintName)}
								connectionUrl={connectionUrl}
								depth={depth}
								maxDepth={maxDepth}
								relationshipsLoading={relationshipsLoading}
							/>
						))}
					</div>
				)}
				<span className="text-gray-800 dark:text-gray-200">{`}`}</span>
			</>
		);
	}

	return (
		<span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
	);
});

interface RelationshipFieldProps {
	relationship: TableRelationship;
	rowData: Record<string, unknown>;
	count: number;
	isExpanded: boolean;
	onToggle: () => void;
	connectionUrl: string;
	depth: number;
	maxDepth: number;
	relationshipsLoading: boolean;
}

const RelationshipField = memo(function RelationshipField({
	relationship,
	rowData,
	count,
	isExpanded,
	onToggle,
	connectionUrl,
	depth,
	maxDepth,
	relationshipsLoading,
}: RelationshipFieldProps) {
	// For outgoing (FK): fetch the referenced parent record
	// - current table has the FK pointing to parent
	// - query the parent table where parent PK = our FK value
	// For incoming (referenced by): fetch all child records
	// - another table references this table's PK
	// - query the other table where their FK = our PK value
	const querySchema =
		relationship.type === "outgoing"
			? relationship.referencedSchema
			: relationship.referencingSchema;
	const queryTable =
		relationship.type === "outgoing"
			? relationship.referencedTable
			: relationship.referencingTable;
	const queryFilterColumn =
		relationship.type === "outgoing"
			? relationship.referencedColumn
			: relationship.referencingColumn;
	const filterValue =
		relationship.type === "outgoing"
			? rowData[relationship.referencingColumn]
			: rowData[relationship.referencedColumn];

	// For outgoing (FK): fetch 1 parent record
	// For incoming (referenced by): fetch all child rows (up to 100)
	const limit =
		relationship.type === "outgoing" ? 1 : count > 0 ? Math.min(count, 100) : 1;

	const relatedDataQuery = useQuery(
		queryRelationshipSubrowDataQueryOptions({
			url: connectionUrl,
			schema: querySchema,
			table: queryTable,
			filterColumn: queryFilterColumn,
			filterValue,
			limit,
			offset: 0,
		}),
	);

	const allRelatedData = relatedDataQuery.data?.rows ?? [];
	const isLoading = relatedDataQuery.isLoading && isExpanded;

	// Use simple names like the relationships panel
	// For outgoing (foreign keys): show just the FK column name
	// For incoming (referenced by): show just the referenced table name
	const fieldName =
		relationship.type === "outgoing"
			? `${relationship.referencingColumn}`
			: `${relationship.referencingTable}.${relationship.referencingColumn}`;
	const displayCount = relationship.type === "incoming" ? ` (${count})` : "";

	return (
		<div className="py-0.5">
			<button
				onClick={onToggle}
				disabled={count === 0}
				className="flex items-center gap-1 w-full text-left hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
				aria-label={isExpanded ? "Collapse" : "Expand"}
			>
				<ChevronDown
					size={16}
					className={cn(
						"transition-transform shrink-0",
						isExpanded ? "" : "-rotate-90",
					)}
				/>
				<span className="text-blue-600 dark:text-blue-400">"{fieldName}"</span>
				<span className="text-gray-600 dark:text-gray-400 text-xs">
					{displayCount}
				</span>
				<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
				{!isExpanded && (
					<span className="text-gray-600 dark:text-gray-400">…</span>
				)}
			</button>

			{isExpanded && (
				<div className="ml-4">
					{isLoading ? (
						<span className="text-gray-500 dark:text-gray-500 italic">
							loading…
						</span>
					) : allRelatedData.length > 0 ? (
						<>
							{relationship.type === "outgoing" ? (
								// Outgoing (FK): Always single parent record, show as object
								<RenderRelationshipValue
									value={allRelatedData[0]}
									relationships={[]}
									counts={{}}
									expandedRelationships={new Set()}
									onToggleRelationship={() => {}}
									depth={depth + 1}
									maxDepth={maxDepth}
									connectionUrl={connectionUrl}
									relationshipsLoading={relationshipsLoading}
								/>
							) : (
								// Incoming (referenced by): Multiple child rows, show as array
								// Pass depth={0} so array bracket and items auto-expand
								<RenderRelationshipValue
									value={allRelatedData}
									relationships={[]}
									counts={{}}
									expandedRelationships={new Set()}
									onToggleRelationship={() => {}}
									depth={0}
									maxDepth={maxDepth}
									connectionUrl={connectionUrl}
									relationshipsLoading={relationshipsLoading}
								/>
							)}
						</>
					) : (
						<span className="text-yellow-600 dark:text-yellow-500">null</span>
					)}
				</div>
			)}
		</div>
	);
});
