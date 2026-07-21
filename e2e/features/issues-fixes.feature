Feature: Connection page UX issues from issues.md

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Sidebar collapses completely
    Given I open the "users" table
    When I collapse the sidebar
    Then the sidebar should be fully collapsed

  Scenario: AI assistant uses whole database schema context
    Given I open the "users" table
    When I open the AI assistant
    Then the AI assistant should mention the whole database schema

  Scenario: SQL editor is unified without preview/editor tabs
    Given I open the "users" table
    When I expand the SQL query panel
    Then I should see the unified SQL editor
    And I should not see Preview or Editor mode tabs

  Scenario: SQL snippets menu opens near the trigger
    Given I open the "users" table
    When I expand the SQL query panel
    And I open the SQL snippets menu
    Then the SQL snippets menu content should be near the trigger

  Scenario: Utility columns have no header filter buttons
    Given I open the "users" table
    Then I should not see column header filters for expand or select columns
    And I should see a column header filter for column "name"

  Scenario: Relationships expand button has a tooltip
    Given I open the "users" table
    When I hover the relationships expand button for the first row
    Then I should see a tooltip containing "Expand relationships panel"

  Scenario: Table stays visible while refetching
    Given I open the "users" table
    Then I should see cell value "Alice" in column "name"
    When I refresh the table rows
    Then I should still see cell value "Alice" in column "name" while refreshing
    And the table body should not show loading skeletons
