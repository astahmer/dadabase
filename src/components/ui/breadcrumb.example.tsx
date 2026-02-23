import {
	BreadcrumbCurrentLink,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbRoot,
	BreadcrumbSeparator,
} from "#src/components/ui/breadcrumb.tsx";
import { Stack } from "./layout.tsx";

export function BreadcrumbExample() {
	const breadcrumbs = [
		{ label: "Home", href: "#" },
		{ label: "Components", href: "#" },
		{ label: "Breadcrumb", current: true },
	];

	return (
		<Stack>
			<div className="space-y-4">
				<div>
					<h4 className="text-sm font-semibold mb-2">Default</h4>
					<BreadcrumbRoot>
						<BreadcrumbList>
							{breadcrumbs.map((item, index) => (
								<BreadcrumbItem key={index}>
									{item.current ? (
										<BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
									) : (
										<BreadcrumbLink href={item.href}>
											{item.label}
										</BreadcrumbLink>
									)}
									{index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
								</BreadcrumbItem>
							))}
						</BreadcrumbList>
					</BreadcrumbRoot>
				</div>

				<div>
					<h4 className="text-sm font-semibold mb-2">Small Size</h4>
					<BreadcrumbRoot>
						<BreadcrumbList size="sm">
							{breadcrumbs.map((item, index) => (
								<BreadcrumbItem key={index}>
									{item.current ? (
										<BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
									) : (
										<BreadcrumbLink href={item.href}>
											{item.label}
										</BreadcrumbLink>
									)}
									{index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
								</BreadcrumbItem>
							))}
						</BreadcrumbList>
					</BreadcrumbRoot>
				</div>

				<div>
					<h4 className="text-sm font-semibold mb-2">Large Size</h4>
					<BreadcrumbRoot>
						<BreadcrumbList size="lg">
							{breadcrumbs.map((item, index) => (
								<BreadcrumbItem key={index}>
									{item.current ? (
										<BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
									) : (
										<BreadcrumbLink href={item.href}>
											{item.label}
										</BreadcrumbLink>
									)}
									{index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
								</BreadcrumbItem>
							))}
						</BreadcrumbList>
					</BreadcrumbRoot>
				</div>
			</div>
		</Stack>
	);
}
