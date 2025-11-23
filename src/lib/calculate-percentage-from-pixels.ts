/**
 * Calculates what percentage a pixel value represents of a given dimension
 * @param pixels - The pixel value to convert
 * @param containerSize - The container size in pixels (defaults to window height)
 * @returns The percentage value
 */
export function calculatePercentageFromPixelsInContainer(
	pixels: number,
	containerSize: number = typeof window !== "undefined"
		? window.innerHeight
		: 800,
): number {
	if (containerSize <= 0) return 0;
	return (pixels / containerSize) * 100;
}

/**
 * Calculates the percentage for the splitter relationship panel
 * based on desired pixel height (default 40px)
 * @param pixelHeight - The desired height in pixels (default: 40px)
 * @returns The percentage value rounded to 2 decimal places
 */
export function fromPixelToPercentage(pixelHeight: number = 40): number {
	const percentage = calculatePercentageFromPixelsInContainer(pixelHeight);
	// Round to 2 decimal places for cleaner values
	return Math.round(percentage * 100) / 100;
}
