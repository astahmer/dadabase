# RESOLVED — Row context menu / selection targeted `__expand` button

| Field | Value |
| --- | --- |
| Status | **resolved** |
| Severity | high (e2e / UX) |
| Introduced | expand column predates competitor wave (`stmwpqxx` et al.); broke e2e assumptions in steps that used `getByRole("button").first()` |
| Resolved by | `mqlntknv` + `mkspvyuv` (`data-testid="row-select-button"`, step updates) |

## Original issue

Column order is `__expand` then `__select`. Playwright right-click / select used the first button (expand), so Edit/Duplicate menuitems never appeared and bulk select never armed.

## Resolution

Stable `row-select-button` test id + e2e steps. Product code already had a correct context menu on the select control.
