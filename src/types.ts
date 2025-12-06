import type { RequiredFetcher } from "@tanstack/react-start";
import type { StandardSchemaV1 } from "./standard-schema.ts";

export type InferServerFnSchema<T> =
	T extends RequiredFetcher<any, infer U, any>
		? U extends StandardSchemaV1
			? StandardSchemaV1.InferInput<U>
			: never
		: never;
