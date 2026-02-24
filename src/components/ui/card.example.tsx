import { Button } from "#src/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#src/components/ui/card.tsx";
import { Stack } from "./layout.tsx";

export function CardExample() {
	return (
		<Stack>
			<Card>
				<CardHeader>
					<CardTitle>Basic Card</CardTitle>
					<CardDescription>This is a basic card component</CardDescription>
				</CardHeader>
				<CardContent>
					<p>
						Cards are flexible containers that can hold various types of
						content.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Card with Actions</CardTitle>
					<CardDescription>Example with button actions</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="mb-4">
						This card demonstrates how to use cards with interactive elements.
					</p>
					<div className="flex gap-2">
						<Button variant="default" size="sm">
							Action
						</Button>
						<Button variant="outline" size="sm">
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-2 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Card 1</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Multiple cards can be arranged in a grid layout.</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Card 2</CardTitle>
					</CardHeader>
					<CardContent>
						<p>They work great for displaying grouped information.</p>
					</CardContent>
				</Card>
			</div>
		</Stack>
	);
}
