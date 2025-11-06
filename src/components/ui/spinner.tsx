import { cva, type VariantProps } from "class-variance-authority";
import type { ExposedComponentProps } from "./component-props.ts";

const spinnerRecipe = cva(
	"inline-block border-2 border-solid rounded-full animate-spin [--spinner-track-color:transparent] [border-bottom-color:var(--spinner-track-color)] [border-inline-start-color:var(--spinner-track-color)]",
	{
		variants: {
			size: {
				inherit: "w-[1em] h-[1em]",
				xs: "w-3 h-3",
				sm: "w-4 h-4",
				md: "w-5 h-5",
				lg: "w-6 h-6",
				xl: "w-7 h-7",
				"2xl": "w-8 h-8",
			},
			colorPalette: {
				primary: "border-primary",
				secondary: "border-secondary",
				muted: "border-muted",
				accent: "border-accent",
				destructive: "border-destructive",
			},
		},
		defaultVariants: {
			size: "md",
			colorPalette: "primary",
		},
	},
);

type SpinnerVariants = VariantProps<typeof spinnerRecipe>;

interface SpinnerProps extends ExposedComponentProps<"div"> {
	size?: SpinnerVariants["size"];
	colorPalette?: SpinnerVariants["colorPalette"];
	label?: string;
	className?: string;
}

export const Spinner = ({
	label = "Loading...",
	size = "md",
	colorPalette = "primary",
	className,
	...rest
}: SpinnerProps) => {
	return (
		<div {...rest} className={spinnerRecipe({ size, colorPalette, className })}>
			{label && <span className="sr-only">{label}</span>}
		</div>
	);
};
