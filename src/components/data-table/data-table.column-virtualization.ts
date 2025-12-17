export type ColumnVirtualizationState =
	| {
			enabled: true;
			virtualCenterColumnIds: string[];
			centerPaddingLeftPx: number;
			centerPaddingRightPx: number;
			centerPaddingLeftColSpan: number;
			centerPaddingRightColSpan: number;
	  }
	| {
			enabled: false;
	  };
