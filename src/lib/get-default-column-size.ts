import type { DataTableSize } from "#src/components/data-table.styles.ts";

export const getDefaultColumnSize = (props: {
	tableSize: DataTableSize;
	hasUuid: boolean;
}) => {
	const { tableSize, hasUuid } = props;
	let defaultColumnSize = 150;
	if (tableSize === "excel") {
		defaultColumnSize = 125;
	} else if (tableSize === "minimal") {
		defaultColumnSize = 135;
	} else if (tableSize === "compact") {
		defaultColumnSize = 150;
	} else if (tableSize === "cozy") {
		defaultColumnSize = hasUuid ? 180 : 150; // default
	} else if (tableSize === "comfortable") {
		defaultColumnSize = hasUuid ? 350 : 230;
	}
	return defaultColumnSize;
};
