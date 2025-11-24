export const runIfFn = <T>(
	v: T | undefined,
	...a: T extends (...a: never[]) => void ? Parameters<T> : never
): T extends (...a: never[]) => void
	? NonNullable<ReturnType<T>>
	: NonNullable<T> => {
	const res = (typeof v === "function" ? v(...a) : v) as never;
	return res ?? undefined;
};
