import { createFormHook } from "@tanstack/react-form";
import {
	Select,
	SubscribeButton,
	TextArea,
	TextField,
} from "./form.components.tsx";
import { fieldContext, formContext } from "./form.context.ts";

export const { useAppForm, withFieldGroup, withForm } = createFormHook({
	fieldComponents: {
		TextField,
		Select,
		TextArea,
	},
	formComponents: {
		SubscribeButton,
	},
	fieldContext,
	formContext,
});
