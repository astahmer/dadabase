import type { DataTableSize } from "#src/components/data-table/data-table.styles.ts";

export const getDefaultColumnSize = (props: {
	tableSize: DataTableSize;
	hasUuid: boolean;
}) => {
	const { tableSize, hasUuid } = props;
	let defaultColumnSize = 230;
	if (tableSize === "excel") {
		defaultColumnSize = hasUuid ? 270 : 205;
	} else if (tableSize === "minimal") {
		defaultColumnSize = hasUuid ? 280 : 215;
	} else if (tableSize === "compact") {
		defaultColumnSize = hasUuid ? 305 : 230;
	} else if (tableSize === "cozy") {
		defaultColumnSize = hasUuid ? 330 : 220; // default
	} else if (tableSize === "comfortable") {
		defaultColumnSize = hasUuid ? 350 : 230;
	}
	return defaultColumnSize;
};
