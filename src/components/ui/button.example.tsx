import { Button } from "#src/components/ui/button.tsx";
import { Stack } from "./layout.tsx";

export function ButtonExample() {
	return (
		<Stack>
			<div className="flex flex-wrap gap-2">
				<Button variant="default" size="md">
					Default
				</Button>
				<Button variant="secondary" size="md">
					Secondary
				</Button>
				<Button variant="destructive" size="md">
					Destructive
				</Button>
				<Button variant="outline" size="md">
					Outline
				</Button>
				<Button variant="ghost" size="md">
					Ghost
				</Button>
				<Button variant="link" size="md">
					Link
				</Button>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button variant="default" size="sm">
					Small
				</Button>
				<Button variant="default" size="md">
					Medium
				</Button>
				<Button variant="default" size="lg">
					Large
				</Button>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button disabled variant="default" size="md">
					Disabled
				</Button>
				<Button disabled variant="secondary" size="md">
					Disabled
				</Button>
			</div>
		</Stack>
	);
}
