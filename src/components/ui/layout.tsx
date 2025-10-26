import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "#src/lib/utils.ts";

const stackVariants = cva("flex gap-4", {
	variants: {
		direction: {
			row: "flex-row",
			col: "flex-col",
		},
		align: {
			itemsCenter: "items-center",
			itemsStart: "items-start",
			itemsEnd: "items-end",
			selfStart: "self-start",
			selfCenter: "self-center",
			selfEnd: "self-end",
		},
		justify: {
			center: "justify-center",
			start: "justify-start",
			end: "justify-end",
			between: "justify-between",
			around: "justify-around",
		},
		wrap: {
			true: "flex-wrap",
		},
	},
	defaultVariants: {
		align: "itemsCenter",
	},
});

export const Stack = (
	props: React.ComponentProps<"div"> & VariantProps<typeof stackVariants>,
) => {
	const { className, align, justify, wrap, ...rest } = props;
	return (
		<div
			{...rest}
			className={cn(
				stackVariants({
					direction: props.direction ?? "col",
					align,
					justify,
					wrap,
				}),
				className,
			)}
		/>
	);
};
export const HStack = (
	props: React.ComponentProps<"div"> & VariantProps<typeof stackVariants>,
) => {
	const { className, align, justify, wrap, ...rest } = props;
	return (
		<div
			{...rest}
			className={cn(
				stackVariants({
					direction: props.direction ?? "row",
					align,
					justify,
					wrap,
				}),
				className,
			)}
		/>
	);
};
