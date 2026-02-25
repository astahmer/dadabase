import { Zap } from "lucide-react";

interface UniqueConstraintIconProps {
  isUnique: boolean;
  className?: string;
}

/**
 * Displays a small lightning bolt icon when a column has a unique constraint
 */
export const UniqueConstraintIcon = ({ isUnique, className }: UniqueConstraintIconProps) => {
  if (!isUnique) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 ${className || ""}`}
      title="Unique Constraint"
    >
      <Zap className="h-3 w-3" />
    </div>
  );
};

UniqueConstraintIcon.displayName = "UniqueConstraintIcon";
