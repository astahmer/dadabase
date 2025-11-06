export const getErrorMessage = (error: unknown): string => {
	if (!error) return "Unknown error occurred";

	// Check if it's an Error object with a message
	if (error instanceof Error) {
		// Check for cause chain (from FiberFailure -> SqlError -> postgres error)
		if (error.cause) {
			if (error.cause instanceof Error) {
				return error.cause.message;
			}
			if (typeof error.cause === "string") {
				return error.cause;
			}
			if (typeof error.cause === "object" && error.cause !== null) {
				const cause = error.cause as any;
				if (cause.message) {
					return cause.message;
				}
			}
		}
		return error.message;
	}

	// Check if it's an object with message property
	if (typeof error === "object" && error !== null) {
		const err = error as any;
		if (err.message) {
			return err.message;
		}
		if (err.cause && err.cause.message) {
			return err.cause.message;
		}
	}

	return String(error);
};
