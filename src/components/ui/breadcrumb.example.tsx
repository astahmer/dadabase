import {
  BreadcrumbCurrentLink,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
} from "#src/components/ui/breadcrumb.tsx";
import * as React from "react";

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
          <h4 className="mb-2 text-sm font-semibold">Default</h4>
          <BreadcrumbRoot>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.current ? (
                      <BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
                    ) : (
                      <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </BreadcrumbRoot>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Small Size</h4>
          <BreadcrumbRoot>
            <BreadcrumbList size="sm">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.current ? (
                      <BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
                    ) : (
                      <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </BreadcrumbRoot>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Large Size</h4>
          <BreadcrumbRoot>
            <BreadcrumbList size="lg">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.current ? (
                      <BreadcrumbCurrentLink>{item.label}</BreadcrumbCurrentLink>
                    ) : (
                      <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </BreadcrumbRoot>
        </div>
      </div>
    </Stack>
  );
}
