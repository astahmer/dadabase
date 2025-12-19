export const getTabTriggerStyles = (isActive: boolean) => {
	const baseStyles =
		"flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 cursor-pointer transition-all whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

	if (isActive) {
		return `${baseStyles} bg-background text-foreground border-input`;
	}

	return `${baseStyles} bg-muted text-muted-foreground border-muted hover:bg-background/50 hover:text-foreground`;
};

export const editableInputStyles =
	"text-sm font-medium truncate outline-none border-0 bg-transparent p-0";
export const editablePreviewStyles = "truncate";
