import { createContext } from "react";

export interface ConnectionContextValue {
	schema: string;
	table: string;
	connectionUrl: string;
}

export const ConnectionContext = createContext<
	ConnectionContextValue | undefined
>(undefined);
