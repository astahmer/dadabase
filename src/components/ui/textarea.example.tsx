import { useState } from "react";
import { Label } from "#src/components/ui/label.tsx";
import { Textarea } from "#src/components/ui/textarea.tsx";
import { Stack } from "./layout.tsx";

export function TextareaExample() {
	const [value, setValue] = useState("");

	return (
		<Stack>
			<div className="space-y-3">
				<div className="space-y-1">
					<Label htmlFor="textarea">Default Textarea</Label>
					<Textarea
						id="textarea"
						placeholder="Enter your message here..."
						value={value}
						onChange={(e) => setValue(e.target.value)}
						rows={4}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="textarea-sm">Small Textarea</Label>
					<Textarea
						id="textarea-sm"
						placeholder="Small textarea..."
						// size="sm"
						rows={2}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="textarea-lg">Large Textarea</Label>
					<Textarea
						id="textarea-lg"
						placeholder="Large textarea..."
						// size="lg"
						rows={6}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="textarea-disabled">Disabled</Label>
					<Textarea
						id="textarea-disabled"
						placeholder="Disabled textarea..."
						disabled
						rows={4}
					/>
				</div>

				<div className="rounded-md bg-accent p-3 text-sm">
					<p className="font-medium">Character count:</p>
					<p className="text-muted-foreground">{value.length} characters</p>
				</div>
			</div>
		</Stack>
	);
}
