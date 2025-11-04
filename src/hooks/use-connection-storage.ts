import { useLocalStorage } from "./use-local-storage.ts";

export function useConnectionStorage(connectionName: string) {
	const [database, setDatabase] = useLocalStorage<string>(
		`connection:${connectionName}:database`,
	);
	const [schema, setSchema] = useLocalStorage<string>(
		`connection:${connectionName}:schema`,
		"public",
	);
	const [table, setTable] = useLocalStorage<string>(
		`connection:${connectionName}:table`,
	);

	return {
		database,
		setDatabase,
		schema,
		setSchema,
		table,
		setTable,
	};
}
