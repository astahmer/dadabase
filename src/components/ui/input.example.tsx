import { useState } from "react";
import { Input } from "#src/components/ui/input.tsx";
import { Label } from "#src/components/ui/label.tsx";
import { Stack } from "./layout.tsx";

export function InputExample() {
	const [values, setValues] = useState({
		default: "",
		email: "",
		password: "",
		search: "",
		number: "",
	});

	return (
		<Stack>
			<div className="space-y-3">
				<div className="space-y-1">
					<Label htmlFor="default-input">Default Input</Label>
					<Input
						id="default-input"
						placeholder="Type something..."
						value={values.default}
						onChange={(e) =>
							setValues((prev) => ({ ...prev, default: e.target.value }))
						}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="email-input">Email</Label>
					<Input
						id="email-input"
						type="email"
						placeholder="email@example.com"
						value={values.email}
						onChange={(e) =>
							setValues((prev) => ({ ...prev, email: e.target.value }))
						}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="password-input">Password</Label>
					<Input
						id="password-input"
						type="password"
						placeholder="••••••••"
						value={values.password}
						onChange={(e) =>
							setValues((prev) => ({ ...prev, password: e.target.value }))
						}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="search-input">Search</Label>
					<Input
						id="search-input"
						type="search"
						placeholder="Search..."
						value={values.search}
						onChange={(e) =>
							setValues((prev) => ({ ...prev, search: e.target.value }))
						}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="number-input">Number</Label>
					<Input
						id="number-input"
						type="number"
						placeholder="0"
						value={values.number}
						onChange={(e) =>
							setValues((prev) => ({ ...prev, number: e.target.value }))
						}
					/>
				</div>

				<div className="space-y-1">
					<Label htmlFor="disabled-input">Disabled</Label>
					<Input id="disabled-input" placeholder="Disabled input" disabled />
				</div>
			</div>
		</Stack>
	);
}
