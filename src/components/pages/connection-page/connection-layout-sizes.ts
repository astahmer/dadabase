/**
 * Splitter default sizes for the connection page layout.
 * Zen mode collapses chrome (sidebar + query logger) without persisting 0 into the URL,
 * so exiting zen restores the previous sizes.
 */

export type SidebarSplitterSizes = readonly [number, number];
export type QueryLoggerSplitterSizes = readonly [number, number];

export const getSidebarSplitterDefaultSize = (input: {
  zenMode: boolean;
  sidebarSize: number | undefined;
  sidebarMinSize: number;
}): SidebarSplitterSizes => {
  if (input.zenMode) return [0, 100];
  const size = input.sidebarSize ?? input.sidebarMinSize;
  return [size, Math.max(0, 100 - size)];
};

export const getQueryLoggerSplitterDefaultSize = (input: {
  zenMode: boolean;
  queryLoggerSize: number;
}): QueryLoggerSplitterSizes => {
  if (input.zenMode) return [100, 0];
  const logger = Math.max(0, input.queryLoggerSize);
  return [Math.max(0, 100 - logger), logger];
};

/** Remount key so Splitter.Root re-applies defaultSize when zen toggles. */
export const getZenLayoutRemountKey = (
  zenMode: boolean,
  panel: "sidebar" | "query-logger",
): string => `${panel}:${zenMode ? "zen" : "normal"}`;
