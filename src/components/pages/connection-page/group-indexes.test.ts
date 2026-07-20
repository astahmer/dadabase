import { describe, expect, it } from "vitest";

import { groupIndexesByName } from "./group-indexes.ts";

describe("groupIndexesByName", () => {
  it("groups multi-column indexes under one name", () => {
    const grouped = groupIndexesByName([
      {
        index_name: "users_email_name_idx",
        column_name: "email",
        is_unique: true,
        is_primary: false,
      },
      {
        index_name: "users_email_name_idx",
        column_name: "name",
        is_unique: true,
        is_primary: false,
      },
      {
        index_name: "users_pkey",
        column_name: "id",
        is_unique: true,
        is_primary: true,
      },
    ]);

    expect(grouped).toEqual([
      {
        name: "users_pkey",
        columns: ["id"],
        isUnique: true,
        isPrimary: true,
      },
      {
        name: "users_email_name_idx",
        columns: ["email", "name"],
        isUnique: true,
        isPrimary: false,
      },
    ]);
  });

  it("returns empty array for no indexes", () => {
    expect(groupIndexesByName([])).toEqual([]);
  });
});
