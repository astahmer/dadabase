import { cva, type VariantProps } from "class-variance-authority";

const kbdRecipe = cva(
	"inline-flex items-center font-medium font-mono flex-shrink-0 whitespace-nowrap select-none rounded-[6px]",
	{
		variants: {
			variant: {
				raised:
					"bg-slate-200 text-slate-900 border border-slate-300 border-b-2 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:border-b-slate-500",
				outline:
					"border border-slate-300 text-slate-900 dark:border-slate-600 dark:text-slate-100",
				subtle:
					"bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
				plain: "text-slate-900 dark:text-slate-100",
			},
			size: {
				sm: "text-xs h-4.5 px-1",
				md: "text-sm h-5 px-1",
				lg: "text-base h-6 px-1",
			},
		},
		defaultVariants: {
			size: "md",
			variant: "raised",
		},
	},
);

type KbdVariants = VariantProps<typeof kbdRecipe>;

interface KbdProps extends KbdVariants {
	children: string;
	className?: string;
}

export const Kbd = ({
	children,
	variant = "raised",
	size = "md",
	className,
}: KbdProps) => {
	return (
		<kbd className={kbdRecipe({ variant, size, className })}>{children}</kbd>
	);
};
