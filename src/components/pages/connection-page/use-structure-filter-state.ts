import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

export interface StructureFilters {
  search: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique: boolean;
  foreignKey?: boolean;
  hasDefaults?: boolean;
}

export const useStructureFilters = () => {
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const structureFilters = useSearch({
    from: "/connections/$connectionName",
    select: (s) => s.structureFilters,
  });

  // Provide default filters if undefined
  const filters = structureFilters ?? getDefaultStructureFilters();

  const updateStructureFilters = useCallback(
    (updates: Partial<StructureFilters>) => {
      navigate({
        search: (prev) => ({
          ...prev,
          structureFilters: {
            ...(structureFilters ?? getDefaultStructureFilters()),
            ...updates,
          },
        }),
      });
    },
    [navigate, structureFilters],
  );

  const clearStructureFilters = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        structureFilters: getDefaultStructureFilters(),
      }),
    });
  }, [navigate]);

  return {
    filters,
    updateFilters: updateStructureFilters,
    clearFilters: clearStructureFilters,
  };
};

export const getDefaultStructureFilters = (): StructureFilters => ({
  search: "",
  nullable: false,
  primaryKey: false,
  unique: false,
  foreignKey: false,
  hasDefaults: false,
});

export const hasActiveStructureFilters = (filters: StructureFilters): boolean => {
  return (
    filters.search.length > 0 ||
    filters.nullable ||
    Boolean(filters.primaryKey) ||
    filters.unique ||
    Boolean(filters.foreignKey) ||
    Boolean(filters.hasDefaults)
  );
};
