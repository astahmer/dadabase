import { createContext } from "react";

export interface ConnectionContextValue {
	schema: string;
	table: string;
	connectionUrl: string;
	hasMultipleSchemas: boolean;
}

export const ConnectionContext = createContext<
	ConnectionContextValue | undefined
>({ schema: "", table: "", connectionUrl: "", hasMultipleSchemas: false });
