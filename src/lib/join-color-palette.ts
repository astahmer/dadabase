/**
 * Color palette for distinguishing between multiple joined tables
 * Each entry contains light mode and dark mode Tailwind classes
 */
export const joinColorPalette = [
	// Blue
	{ light: "bg-blue-50", dark: "dark:bg-[#0f1429]" },
	// Purple
	{ light: "bg-purple-50", dark: "dark:bg-[#1a0f2e]" },
	// Amber
	{ light: "bg-amber-50", dark: "dark:bg-[#2a1f0f]" },
	// Pink
	{ light: "bg-pink-50", dark: "dark:bg-[#2a0f1f]" },
	// Green
	{ light: "bg-green-50", dark: "dark:bg-[#0f2a1f]" },
	// Cyan
	{ light: "bg-cyan-50", dark: "dark:bg-[#0f2a2a]" },
	// Indigo
	{ light: "bg-indigo-50", dark: "dark:bg-[#0f1a2a]" },
	// Rose
	{ light: "bg-rose-50", dark: "dark:bg-[#2a0f15]" },
	// Lime
	{ light: "bg-lime-50", dark: "dark:bg-[#1a2a0f]" },
	// Sky
	{ light: "bg-sky-50", dark: "dark:bg-[#0f1f2a]" },
] as const;

/**
 * Get the color classes for a joined table by index
 * Cycles through the palette if index exceeds palette size
 */
export function getJoinColorClasses(
	joinIndex: number,
): (typeof joinColorPalette)[number] {
	return joinColorPalette[joinIndex % joinColorPalette.length];
}

/**
 * Get combined className string for a joined table
 */
export function getJoinColorClassName(joinIndex: number): string {
	const colors = getJoinColorClasses(joinIndex);
	return `${colors.light} ${colors.dark}`;
}
