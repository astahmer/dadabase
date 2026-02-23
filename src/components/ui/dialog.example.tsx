import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#src/components/ui/dialog.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Stack } from "./layout.tsx";

export function DialogExample() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Stack>
			<Dialog open={isOpen} onOpenChange={(details) => setIsOpen(details.open)}>
				<DialogTrigger asChild>
					<Button variant="default">Open Dialog</Button>
				</DialogTrigger>
				<DialogContent size="md">
					<DialogHeader>
						<DialogTitle>Example Dialog</DialogTitle>
						<DialogDescription>
							This is an example dialog component showing how to use it.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<p>
							Dialog content goes here. You can put any content you want inside
							the dialog.
						</p>
						<div className="flex gap-2">
							<Button variant="default" onClick={() => setIsOpen(false)}>
								Save
							</Button>
							<Button variant="outline" onClick={() => setIsOpen(false)}>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</Stack>
	);
}
