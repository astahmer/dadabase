import z from "zod";
import { useAppForm } from "../form/form.hook.ts";
import { Stack } from "../ui/layout.tsx";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().min(1, "Description is required"),
});

function SimpleForm() {
	const form = useAppForm({
		defaultValues: {
			title: "",
			description: "",
		},
		validators: {
			onBlur: schema,
		},
		onSubmit: ({ value }) => {
			console.log(value);
			// Show success message
			alert("Form submitted successfully!");
		},
	});

	return (
		<Stack className="min-h-screen" justify="center">
			<div className="w-full max-w-2xl p-8">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-6"
				>
					<form.AppField name="title">
						{(field) => <field.TextField label="Title" />}
					</form.AppField>

					<form.AppField name="description">
						{(field) => <field.TextArea label="Description" />}
					</form.AppField>

					<div className="flex justify-end">
						<form.AppForm>
							<form.SubscribeButton label="Submit" />
						</form.AppForm>
					</div>
				</form>
			</div>
		</Stack>
	);
}

export const HomePage = () => {
	return <SimpleForm />;
};
