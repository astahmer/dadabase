"use client";

import { Switch as SwitchPrimitive } from "@ark-ui/react/switch";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";

const Switch = ({
	className,
	children,
	...props
}: SwitchPrimitive.RootBaseProps & ExposedComponentProps<"label">) => (
	<SwitchPrimitive.Root
		className={cn(
			"inline-flex data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		{children}
	</SwitchPrimitive.Root>
);
Switch.displayName = "Switch";

const SwitchContext = SwitchPrimitive.Context;

const SwitchControl = ({
	className,
	children,
	...props
}: SwitchPrimitive.ControlProps) => (
	<SwitchPrimitive.Control
		className={cn(
			"inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
			className,
		)}
		{...props}
	>
		{children}
		<SwitchPrimitive.HiddenInput />
	</SwitchPrimitive.Control>
);
SwitchControl.displayName = "SwitchControl";

const SwitchLabel = ({ className, ...props }: SwitchPrimitive.LabelProps) => (
	<SwitchPrimitive.Label
		className={cn(
			"select-none font-medium text-foreground text-sm leading-4 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	/>
);
SwitchLabel.displayName = "SwitchLabel";

const SwitchRootProvider = SwitchPrimitive.RootProvider;

const SwitchThumb = ({ className, ...props }: SwitchPrimitive.ThumbProps) => (
	<SwitchPrimitive.Thumb
		className={cn(
			"data-[state=checked]:rtl:-translate-x-4 pointer-events-none block size-5 rounded-full bg-background shadow-xs ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
			className,
		)}
		{...props}
	/>
);
SwitchThumb.displayName = "SwitchThumb";

export {
	Switch,
	SwitchContext,
	SwitchControl,
	SwitchLabel,
	SwitchRootProvider,
	SwitchThumb,
};

export {
	type SwitchCheckedChangeDetails,
	useSwitch,
	useSwitchContext,
} from "@ark-ui/react/switch";
