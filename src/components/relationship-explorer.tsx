import { ChevronDown } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TableRelationship } from "#src/types/relationships.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/pg/start-fns/get-table-relationships.start.ts";
import { getRelationshipsCountsQueryOptions } from "#src/server/pg/start-fns/get-relationships-counts.start.ts";
import { cn } from "#src/lib/utils";
import { RelationshipExplorerKey } from "#src/components/relationship-explorer.key";

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
 * RelationshipExplorer displays a row as JSON with collapsible relationship keys.
 * Relationships are shown with row counts when collapsed, and lazy-load data on expand.
 * This unified interface makes it easy to visualize a row and its relations without switching tables.
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

	// Filter relationships where the FK/PK value is not null
	const validRelationships = showRelationships
		? allRelationships.filter((rel) => {
				const filterValue =
					row[
						rel.type === "incoming"
							? rel.referencedColumn
							: rel.referencingColumn
					];
				return (
					filterValue !== null &&
					filterValue !== undefined &&
					filterValue !== "null"
				);
			})
		: [];

	// Fetch counts for all relationships
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

	const counts = countsQuery.data ?? {};

	// Separate relationship data by type
	const relationshipsByType = useMemo(() => {
		return {
			outgoing: validRelationships.filter((r) => r.type === "outgoing"),
			incoming: validRelationships.filter((r) => r.type === "incoming"),
		};
	}, [validRelationships]);

	// Extract regular data (non-relationship columns)
	const regularData = useMemo(() => {
		const result = { ...row };
		// Keep all data - relationships will be handled separately
		return result;
	}, [row]);

	const handleToggleRelationship = (constraintName: string) => {
		setExpandedRelationships((prev) => {
			const next = new Set(prev);
			if (next.has(constraintName)) {
				next.delete(constraintName);
			} else {
				next.add(constraintName);
			}
			return next;
		});
	};

	return (
		<div className={cn("font-mono text-sm", className)}>
			<RelationshipExplorerValue
				value={regularData}
				relationships={validRelationships}
				relationshipsByType={relationshipsByType}
				counts={counts}
				expandedRelationships={expandedRelationships}
				onToggleRelationship={handleToggleRelationship}
				depth={0}
				maxDepth={maxDepth}
				connectionUrl={connectionUrl}
				schema={schema}
				table={table}
				row={row}
				relationshipsLoading={relationshipsQuery.isLoading}
				countsLoading={countsQuery.isLoading}
			/>
		</div>
	);
});

interface RelationshipExplorerValueProps {
	value: unknown;
	relationships: TableRelationship[];
	relationshipsByType: {
		outgoing: TableRelationship[];
		incoming: TableRelationship[];
	};
	counts: Record<string, number>;
	expandedRelationships: Set<string>;
	onToggleRelationship: (constraintName: string) => void;
	depth: number;
	maxDepth: number;
	connectionUrl: string;
	schema: string;
	table: string;
	row: Record<string, unknown>;
	relationshipsLoading: boolean;
	countsLoading: boolean;
}

const RelationshipExplorerValue = memo(function RelationshipExplorerValue({
	value,
	relationships,
	relationshipsByType,
	counts,
	expandedRelationships,
	onToggleRelationship,
	depth,
	maxDepth,
	connectionUrl,
	schema,
	table,
	row,
	relationshipsLoading,
	countsLoading,
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
				relationshipsByType={relationshipsByType}
				counts={counts}
				expandedRelationships={expandedRelationships}
				onToggleRelationship={onToggleRelationship}
				depth={depth}
				maxDepth={maxDepth}
				connectionUrl={connectionUrl}
				schema={schema}
				table={table}
				row={row}
				relationshipsLoading={relationshipsLoading}
				countsLoading={countsLoading}
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
	relationshipsByType: {
		outgoing: TableRelationship[];
		incoming: TableRelationship[];
	};
	counts: Record<string, number>;
	expandedRelationships: Set<string>;
	onToggleRelationship: (constraintName: string) => void;
	depth: number;
	maxDepth: number;
	connectionUrl: string;
	schema: string;
	table: string;
	row: Record<string, unknown>;
	relationshipsLoading: boolean;
	countsLoading: boolean;
}

const RelationshipExplorerObject = memo(function RelationshipExplorerObject({
	object,
	relationships,
	relationshipsByType,
	counts,
	expandedRelationships,
	onToggleRelationship,
	depth,
	maxDepth,
	connectionUrl,
	schema,
	table,
	row,
	relationshipsLoading,
	countsLoading,
}: RelationshipExplorerObjectProps) {
	const keys = Object.keys(object);
	const isEmpty = keys.length === 0 && relationships.length === 0;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`{`}</span>
			{!isEmpty && (
				<div className="ml-4 border-l border-muted">
					{/* Regular data fields */}
					{keys.map((key, index) => (
						<div key={key} className="py-0.5">
							<span className="text-blue-600 dark:text-blue-400">"{key}"</span>
							<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
							<RelationshipExplorerValue
								value={object[key]}
								relationships={relationships}
								relationshipsByType={relationshipsByType}
								counts={counts}
								expandedRelationships={expandedRelationships}
								onToggleRelationship={onToggleRelationship}
								depth={depth + 1}
								maxDepth={maxDepth}
								connectionUrl={connectionUrl}
								schema={schema}
								table={table}
								row={row}
								relationshipsLoading={relationshipsLoading}
								countsLoading={countsLoading}
							/>
							<span className="text-gray-800 dark:text-gray-200">,</span>
						</div>
					))}

					{/* Relationship sections */}
					{(["outgoing", "incoming"] as const).map((type) => {
						const rels = relationshipsByType[type];
						if (rels.length === 0) return null;

						return (
							<div key={type} className="py-0.5">
								<div className="text-blue-600 dark:text-blue-400">
									{type === "outgoing" ? `"__outgoing"` : `"__incoming"`}
								</div>
								<span className="text-gray-800 dark:text-gray-200">{`: {`}</span>
								<div className="ml-4 border-l border-muted">
									{rels.map((rel) => (
										<RelationshipExplorerKey
											key={rel.constraintName}
											relationship={rel}
											count={counts[rel.constraintName] ?? 0}
											isExpanded={expandedRelationships.has(rel.constraintName)}
											onToggle={() => onToggleRelationship(rel.constraintName)}
											connectionUrl={connectionUrl}
											row={row}
											relationshipsLoading={relationshipsLoading}
											countsLoading={countsLoading}
										/>
									))}
								</div>
								<span className="text-gray-800 dark:text-gray-200">{`},`}</span>
							</div>
						);
					})}
				</div>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`}`}</span>
		</>
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
									<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
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
