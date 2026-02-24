import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "../ui/button";

export interface OrderDirectionToggleProps {
  /**
   * Current sort direction
   */
  orderDirection?: "asc" | "desc";
  /**
   * Callback when direction changes
   */
  onOrderDirectionChange: (direction: "asc" | "desc") => void;
  /**
   * Whether to disable the button
   */
  disabled?: boolean;
  /**
   * Minimal styling variant
   */
  minimal?: boolean;
}

export function OrderDirectionToggle(props: OrderDirectionToggleProps) {
  const {
    orderDirection = "asc",
    onOrderDirectionChange,
    disabled = false,
    minimal = false,
  } = props;

  const handleToggle = () => {
    const newDirection = orderDirection === "asc" ? "desc" : "asc";
    onOrderDirectionChange(newDirection);
  };

  if (minimal) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="h-8 gap-1 px-2"
      >
        {orderDirection === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUp className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <div className="bg-muted/30 flex items-center gap-2 border-b px-4 py-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="h-9 w-48 justify-between"
      >
        <span className="text-foreground text-xs font-medium tracking-wide uppercase">
          📈 Sort Direction
        </span>
        {orderDirection === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUp className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
