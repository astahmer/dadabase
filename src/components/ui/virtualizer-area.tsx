import { useVirtualizer, type Virtualizer, type VirtualizerOptions } from "@tanstack/react-virtual";
import { ReactNode, useRef } from "react";

interface VirtualizerAreaProps {
  /** Number of items in the list */
  count: number;
  /** Optional virtualizer configuration overrides */
  virtualizerOptions?: Partial<VirtualizerOptions<HTMLDivElement, HTMLDivElement>>;
  /** Render function that receives virtual items and rendering context */
  children: (context: {
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
    virtualItems: ReturnType<ReturnType<typeof useVirtualizer>["getVirtualItems"]>;
    totalSize: number;
    paddingTop: number;
    paddingBottom: number;
  }) => ReactNode;
  /** CSS class for the scroll container */
  className?: string;
}

/**
 * VirtualizerArea is a virtualization wrapper for Ark UI Listbox components.
 *
 * Usage:
 * ```tsx
 * <Listbox.Root collection={tableCollection}>
 *   <Listbox.Input ... />
 *   <VirtualizerArea count={filteredTables.length}>
 *     {({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
 *       <div style={{ height: `${totalSize}px` }}>
 *         {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
 *         <Listbox.Content>
 *           {virtualItems.map(virtualItem => (
 *             <Listbox.Item key={virtualItem.key} ...>
 *               {items[virtualItem.index]}
 *             </Listbox.Item>
 *           ))}
 *         </Listbox.Content>
 *         {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
 *       </div>
 *     )}
 *   </VirtualizerArea>
 * </Listbox.Root>
 * ```
 */
export const VirtualizerArea = ({
  count,
  virtualizerOptions,
  children,
  className = "overflow-y-auto flex-1 max-h-96",
}: VirtualizerAreaProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    useFlushSync: false,
    count,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 41, // Default: py-2.5 + border = ~41px
    overscan: 10,
    ...virtualizerOptions,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;

  return (
    <div ref={scrollContainerRef} className={className} style={{ minHeight: 0 }}>
      {children({
        virtualizer,
        virtualItems,
        totalSize,
        paddingTop,
        paddingBottom,
      })}
    </div>
  );
};
