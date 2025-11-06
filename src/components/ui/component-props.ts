import type { ComponentProps } from "react";

type AllowedProps =
	| "ref"
	| "children"
	| "className"
	| "id"
	| "onClick"
	| "onBlur";

export interface ExposedComponentProps<T extends "div" | "button" | "label">
	extends Pick<ComponentProps<T>, AllowedProps> {}

export interface ExposedInputProps
	extends Pick<
		ComponentProps<"input">,
		| AllowedProps
		| "type"
		| "placeholder"
		| "value"
		| "defaultValue"
		| "onFocus"
		| "onChange"
		| "onChangeCapture"
		| "onBlur"
	> {}

export interface ExposedTextareaProps
	extends Pick<
		ComponentProps<"textarea">,
		| AllowedProps
		| "rows"
		| "value"
		| "defaultValue"
		| "onFocus"
		| "onChange"
		| "onChangeCapture"
		| "onBlur"
	> {}
