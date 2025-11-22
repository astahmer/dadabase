import { ChevronDown } from "lucide-react";
import { memo, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/types/relationships.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { cn } from "#src/lib/utils";
import { queryRelationshipSubrowDataQueryOptions } from "#src/server/pg/start-fns/get-relationship-subrow-data.start.ts";

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

	// Filter to only OUTGOING relationships (this table has the FK)
	// and where the FK value is not null
	const outgoingRelationships = useMemo(() => {
		return showRelationships
			? allRelationships.filter((rel) => {
					// Only outgoing relationships
					if (rel.type !== "outgoing") {
						return false;
					}

					const fkValue = row[rel.referencingColumn];
					return (
						fkValue !== null && fkValue !== undefined && fkValue !== "null"
					);
				})
			: [];
	}, [allRelationships, showRelationships, row]);

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
				relationships={outgoingRelationships}
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

	if (Array.isArray(value)) {
		return <JsonArray array={value} depth={depth} maxDepth={maxDepth} />;
	}

	if (typeof value === "object") {
		return (
			<RelationshipExplorerObject
				object={value as Record<string, unknown>}
				relationships={relationships}
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
	isExpanded,
	onToggle,
	connectionUrl,
	depth,
	maxDepth,
	relationshipsLoading,
}: RelationshipFieldProps) {
	const fkValue = rowData[relationship.referencingColumn];

	const relatedDataQuery = useQuery(
		queryRelationshipSubrowDataQueryOptions({
			url: connectionUrl,
			schema: relationship.referencingSchema,
			table: relationship.referencingTable,
			filterColumn: relationship.referencingColumn,
			filterValue: fkValue,
			limit: 1,
			offset: 0,
		}),
	);

	const relatedData = relatedDataQuery.data?.rows?.[0];
	const isLoading = relatedDataQuery.isLoading && isExpanded;

	// Use the referenced table name as the field name in the JSON
	const fieldName = relationship.referencedTable;

	return (
		<div className="py-0.5">
			<div className="flex items-center gap-1">
				<button
					onClick={onToggle}
					className="inline-flex items-center p-0 h-4 w-4 hover:bg-muted rounded"
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
				<span className="text-blue-600 dark:text-blue-400">"{fieldName}"</span>
				<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
			</div>

			{isExpanded ? (
				<div className="ml-4">
					{isLoading ? (
						<span className="text-gray-500 dark:text-gray-500 italic">
							loading…
						</span>
					) : relatedData ? (
						<RelationshipExplorerValue
							value={relatedData}
							relationships={[]}
							expandedRelationships={new Set()}
							onToggleRelationship={() => {}}
							depth={depth + 1}
							maxDepth={maxDepth}
							connectionUrl={connectionUrl}
							schema={relationship.referencedSchema}
							table={relationship.referencedTable}
							relationshipsLoading={relationshipsLoading}
						/>
					) : (
						<span className="text-yellow-600 dark:text-yellow-500">null</span>
					)}
				</div>
			) : (
				<span className="text-gray-600 dark:text-gray-400 ml-2">…</span>
			)}
			<span className="text-gray-800 dark:text-gray-200">,</span>
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
	const [isExpanded, setIsExpanded] = useState(depth === 0);

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
