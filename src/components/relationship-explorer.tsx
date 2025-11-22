import { ChevronDown } from "lucide-react";
import { memo, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/types/relationships.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { getRelationshipsCountsQueryOptions } from "#src/server/pg/start-fns/get-relationships-counts.start.ts";
import { cn } from "#src/lib/utils";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start.ts";
import { isDateTimeDataType } from "#src/lib/data-type-utils.ts";

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
 * Outgoing relationships are merged into the row structure as nested objects/arrays.
 * Only shows outgoing relationships (where this table has the FK).
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
	// Outgoing: this table has the FK
	// Incoming: another table references this table
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
			<RelationshipExplorerValue
				value={row}
				relationships={validRelationships}
				counts={countsQuery.data ?? {}}
				expandedRelationships={expandedRelationships}
				onToggleRelationship={handleToggleRelationship}
				depth={0}
				maxDepth={maxDepth}
				connectionUrl={connectionUrl}
				schema={schema}
				table={table}
				relationshipsLoading={relationshipsQuery.isLoading}
			/>
		</div>
	);
});

interface RelationshipExplorerValueProps {
	value: unknown;
	relationships: TableRelationship[];
	counts: Record<string, number>;
	expandedRelationships: Set<string>;
	onToggleRelationship: (constraintName: string) => void;
	depth: number;
	maxDepth: number;
	connectionUrl: string;
	schema: string;
	table: string;
	relationshipsLoading: boolean;
}

const RelationshipExplorerValue = memo(function RelationshipExplorerValue({
	value,
	relationships,
	counts,
	expandedRelationships,
	onToggleRelationship,
	depth,
	maxDepth,
	connectionUrl,
	schema,
	table,
	relationshipsLoading,
}: RelationshipExplorerValueProps) {
	if (value === null) {
		return <span className="text-yellow-600 dark:text-yellow-500">null</span>;
	}

	if (typeof value === "boolean") {
		return (
			<span className="text-yellow-600 dark:text-yellow-500">
				{String(value)}
			</span>
		);
	}

	if (typeof value === "number") {
		return <span className="text-cyan-600 dark:text-cyan-400">{value}</span>;
	}

	if (typeof value === "string") {
		return (
			<span className="text-green-600 dark:text-green-400">"{value}"</span>
		);
	}

	// Handle Date objects - display as ISO string
	if (value instanceof Date) {
		return (
			<span className="text-green-600 dark:text-green-400">
				"{value.toISOString()}"
			</span>
		);
	}

	if (Array.isArray(value)) {
		return <JsonArray array={value} depth={depth} maxDepth={maxDepth} />;
	}

	if (typeof value === "object") {
		return (
			<RelationshipExplorerObject
				object={value as Record<string, unknown>}
				relationships={relationships}
				counts={counts}
				expandedRelationships={expandedRelationships}
				onToggleRelationship={onToggleRelationship}
				depth={depth}
				maxDepth={maxDepth}
				connectionUrl={connectionUrl}
				schema={schema}
				table={table}
				relationshipsLoading={relationshipsLoading}
			/>
		);
	}

	return (
		<span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
	);
});

interface RelationshipExplorerObjectProps {
	object: Record<string, unknown>;
	relationships: TableRelationship[];
	counts: Record<string, number>;
	expandedRelationships: Set<string>;
	onToggleRelationship: (constraintName: string) => void;
	depth: number;
	maxDepth: number;
	connectionUrl: string;
	schema: string;
	table: string;
	relationshipsLoading: boolean;
}

const RelationshipExplorerObject = memo(function RelationshipExplorerObject({
	object,
	relationships,
	counts,
	expandedRelationships,
	onToggleRelationship,
	depth,
	maxDepth,
	connectionUrl,
	schema,
	table,
	relationshipsLoading,
}: RelationshipExplorerObjectProps) {
	const keys = Object.keys(object);
	const isEmpty = keys.length === 0 && relationships.length === 0;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`{`}</span>
			{!isEmpty && (
				<div className="ml-4 border-l border-muted">
					{/* Regular data fields */}
					{keys.map((key) => (
						<div key={key} className="py-0.5">
							<span className="text-blue-600 dark:text-blue-400">"{key}"</span>
							<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
							<RelationshipExplorerValue
								value={object[key]}
								relationships={[]}
								counts={{}}
								expandedRelationships={expandedRelationships}
								onToggleRelationship={onToggleRelationship}
								depth={depth + 1}
								maxDepth={maxDepth}
								connectionUrl={connectionUrl}
								schema={schema}
								table={table}
								relationshipsLoading={relationshipsLoading}
							/>
							<span className="text-gray-800 dark:text-gray-200">,</span>
						</div>
					))}

					{/* Inline relationships - merged into the object */}
					{relationships.map((rel) => (
						<RelationshipField
							key={rel.constraintName}
							relationship={rel}
							rowData={object}
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
	// Add constraint name as tiebreaker to prevent duplicates when multiple relationships exist
	const fieldName =
		relationship.type === "outgoing"
			? `${relationship.referencingColumn}`
			: `${relationship.referencingTable}.${relationship.referencingColumn}`;
	const displayCount =
		relationship.type === "incoming" && count > 0 ? ` (${count})` : "";

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
								<RelationshipExplorerValue
									value={allRelatedData[0]}
									relationships={[]}
									counts={{}}
									expandedRelationships={new Set()}
									onToggleRelationship={() => {}}
									depth={depth + 1}
									maxDepth={maxDepth}
									connectionUrl={connectionUrl}
									schema={querySchema}
									table={queryTable}
									relationshipsLoading={relationshipsLoading}
								/>
							) : (
								// Incoming (referenced by): Multiple child rows, show as array
								// Pass depth={0} so array bracket and items auto-expand
								<RelationshipExplorerValue
									value={allRelatedData}
									relationships={[]}
									counts={{}}
									expandedRelationships={new Set()}
									onToggleRelationship={() => {}}
									depth={0}
									maxDepth={maxDepth}
									connectionUrl={connectionUrl}
									schema={querySchema}
									table={queryTable}
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

interface JsonArrayProps {
	array: unknown[];
	depth: number;
	maxDepth: number;
}

const JsonArray = memo(function JsonArray({
	array,
	depth,
	maxDepth,
}: JsonArrayProps) {
	const [isExpanded, setIsExpanded] = useState(depth === 0);
	const isEmpty = array.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`[`}</span>
			{!isEmpty && (
				<>
					{canExpand && (
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className="inline-flex items-center ml-1 p-0 h-4 w-4 hover:bg-muted rounded"
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							<ChevronDown
								size={16}
								className={cn(
									"transition-transform",
									isExpanded ? "" : "-rotate-90",
								)}
							/>
						</button>
					)}
					{isExpanded ? (
						<div className="ml-4 border-l border-muted">
							{array.map((item, index) => (
								<div key={index} className="py-0.5">
									<JsonValue
										value={item}
										depth={depth + 1}
										maxDepth={maxDepth}
									/>
									{index < array.length - 1 && (
										<span className="text-gray-800 dark:text-gray-200">,</span>
									)}
								</div>
							))}
						</div>
					) : (
						<span className="text-gray-600 dark:text-gray-400 ml-1">…</span>
					)}
				</>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`]`}</span>
		</>
	);
});

interface JsonValueProps {
	value: unknown;
	depth: number;
	maxDepth: number;
}

const JsonValue = memo(function JsonValue({
	value,
	depth,
	maxDepth,
}: JsonValueProps) {
	const [isExpanded, setIsExpanded] = useState(depth <= 1);

	if (value === null) {
		return <span className="text-yellow-600 dark:text-yellow-500">null</span>;
	}

	if (typeof value === "boolean") {
		return (
			<span className="text-yellow-600 dark:text-yellow-500">
				{String(value)}
			</span>
		);
	}

	if (typeof value === "number") {
		return <span className="text-cyan-600 dark:text-cyan-400">{value}</span>;
	}

	if (typeof value === "string") {
		return (
			<span className="text-green-600 dark:text-green-400">"{value}"</span>
		);
	}

	// Handle Date objects - display as ISO string
	if (value instanceof Date) {
		return (
			<span className="text-green-600 dark:text-green-400">
				"{value.toISOString()}"
			</span>
		);
	}

	if (Array.isArray(value)) {
		return <JsonArray array={value} depth={depth} maxDepth={maxDepth} />;
	}

	if (typeof value === "object") {
		return (
			<SimpleJsonObject
				object={value as Record<string, unknown>}
				depth={depth}
				maxDepth={maxDepth}
				isExpanded={isExpanded}
				onToggle={() => setIsExpanded(!isExpanded)}
			/>
		);
	}

	return (
		<span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
	);
});

interface SimpleJsonObjectProps {
	object: Record<string, unknown>;
	depth: number;
	maxDepth: number;
	isExpanded: boolean;
	onToggle: () => void;
}

const SimpleJsonObject = memo(function SimpleJsonObject({
	object,
	depth,
	maxDepth,
	isExpanded,
	onToggle,
}: SimpleJsonObjectProps) {
	const keys = Object.keys(object);
	const isEmpty = keys.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`{`}</span>
			{!isEmpty && (
				<>
					{canExpand && (
						<button
							onClick={onToggle}
							className="inline-flex items-center ml-1 p-0 h-4 w-4 hover:bg-muted rounded"
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							<ChevronDown
								size={16}
								className={cn(
									"transition-transform",
									isExpanded ? "" : "-rotate-90",
								)}
							/>
						</button>
					)}
					{isExpanded ? (
						<div className="ml-4 border-l border-muted">
							{keys.map((key, index) => (
								<div key={key} className="py-0.5">
									<span className="text-blue-600 dark:text-blue-400">
										"{key}"
									</span>
									<span className="text-gray-800 dark:text-gray-200">
										{`: `}
									</span>
									<JsonValue
										value={object[key]}
										depth={depth + 1}
										maxDepth={maxDepth}
									/>
									{index < keys.length - 1 && (
										<span className="text-gray-800 dark:text-gray-200">,</span>
									)}
								</div>
							))}
						</div>
					) : (
						<span className="text-gray-600 dark:text-gray-400 ml-1">…</span>
					)}
				</>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`}`}</span>
		</>
	);
});
