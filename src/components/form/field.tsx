import { Field as ArkField } from "@ark-ui/react";
import { forwardRef } from "react";
import { Label } from "../ui/label.tsx";

export interface FieldProps extends Omit<ArkField.RootProps, "label"> {
	label?: React.ReactNode;
	helperText?: React.ReactNode;
	errorText?: React.ReactNode;
	asterisk?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(
	function Field(props, ref) {
		const { label, children, helperText, errorText, asterisk, ...rest } = props;
		return (
			<ArkField.Root ref={ref} {...rest}>
				{label && (
					<Label className="w-full">
						{label} {asterisk && <ArkField.RequiredIndicator />}
					</Label>
				)}
				{children}
				{helperText && <ArkField.HelperText>{helperText}</ArkField.HelperText>}
				{errorText && <ArkField.ErrorText>{errorText}</ArkField.ErrorText>}
			</ArkField.Root>
		);
	},
);
