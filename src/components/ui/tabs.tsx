"use client";

import { cn } from "#src/lib/utils";
import { Tabs as TabsPrimitive } from "@ark-ui/react/tabs";

import type { ExposedComponentProps } from "./component-props.ts";

const Tabs = ({
  className,
  ...props
}: TabsPrimitive.RootBaseProps & ExposedComponentProps<"div">) => (
  <TabsPrimitive.Root className={cn("flex flex-col gap-2", className)} {...props} />
);
Tabs.displayName = "Tabs";

const TabsContent = ({ className, ...props }: TabsPrimitive.ContentProps) => (
  <TabsPrimitive.Content className={cn("flex-1 outline-none", className)} {...props} />
);
TabsContent.displayName = "TabsContent";

const TabsContext = TabsPrimitive.Context;

const TabsIndicator = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Indicator>) => (
  <TabsPrimitive.Indicator
    className={cn(
      "bg-background text-foreground h-(--height) w-(--width) rounded-sm shadow-xs",
      className,
    )}
    {...props}
  />
);
TabsIndicator.displayName = "TabsIndicator";

const TabsList = ({ className, ...props }: TabsPrimitive.ListProps) => (
  <TabsPrimitive.List
    className={cn(
      "bg-muted text-muted-foreground/70 relative inline-flex items-center justify-center rounded-md p-0.5 data-[orientation=vertical]:flex-col",
      className,
    )}
    {...props}
  />
);
TabsList.displayName = "TabsList";

const TabsRootProvider = TabsPrimitive.RootProvider;

const TabsTrigger = ({ className, ...props }: TabsPrimitive.TriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      "hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 data-[selected]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[orientation=vertical]:w-full data-[selected]:z-10 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
);
TabsTrigger.displayName = "TabsTrigger";

export { Tabs, TabsContent, TabsContext, TabsIndicator, TabsList, TabsRootProvider, TabsTrigger };

export {
  type TabsFocusChangeDetails,
  type TabsValueChangeDetails,
  useTabs,
  useTabsContext,
} from "@ark-ui/react/tabs";
