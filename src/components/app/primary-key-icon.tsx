import { Key } from "lucide-react";

interface PrimaryKeyIconProps {
  isPrimaryKey: boolean;
  className?: string;
}

/**
 * Displays a small key icon when a column is a primary key
 */
export const PrimaryKeyIcon = ({ isPrimaryKey, className }: PrimaryKeyIconProps) => {
  if (!isPrimaryKey) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 ${className || ""}`}
      title="Primary Key"
    >
      <Key className="h-3 w-3" />
    </div>
  );
};

PrimaryKeyIcon.displayName = "PrimaryKeyIcon";
