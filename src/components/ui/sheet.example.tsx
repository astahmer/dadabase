import { Button } from "#src/components/ui/button.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "#src/components/ui/sheet.tsx";

export function SheetExample() {
	return (
		<div>
			<Sheet>
				<SheetTrigger asChild>
					<Button variant="outline">Open Sheet</Button>
				</SheetTrigger>
				<SheetContent side="right">
					<SheetHeader>
						<SheetTitle>Edit Profile</SheetTitle>
						<SheetDescription>
							Make changes to your profile here. Click save when you're done.
						</SheetDescription>
					</SheetHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Name</label>
							<input
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								defaultValue="John Doe"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Email</label>
							<input
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								defaultValue="john@example.com"
							/>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
