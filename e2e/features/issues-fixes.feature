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
    And I should see text "Add OpenAI key"

  Scenario: AI assistant unlocks ask UI after saving a key
    Given I open the "users" table
    And I store a fake OpenAI API key in localStorage
    When I open the AI assistant
    Then I should see text "Ask for a query"
    And I should see text "saved"
    And the AI assistant should mention the whole database schema

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

  Scenario: Saved query empty state opens a reviewable SQL workspace
    Given I open the "users" table
    And the query logger panel is expanded
    When I open saved queries
    Then I should see text "No saved queries yet."
    When I open the saved query SQL workspace
    Then I should see the table-independent SQL workspace

  Scenario: Utility columns have no header filter buttons
    Given I open the "users" table
    Then I should not see column header filters for expand or select columns
    And I should see a column header filter for column "name"

  Scenario: Filters open in a compact advanced workbench
    Given I open the "users" table
    When I open the table filter builder
    Then I should see the compact filter workbench

  Scenario: Joins open in an inline workspace
    Given I open the "users" table
    When I open the join builder
    Then I should see the inline join workspace

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

  Scenario: Refresh tooltip does not show 1970 epoch before first load settles
    Given I open the "users" table
    Then the refresh button tooltip should not mention 1970

  Scenario: Detach button is gone from the SQL editor
    Given I open the "users" table
    When I expand the SQL query panel
    Then I should not see a Detach button

  Scenario: Zen mode collapses sidebar and query logger
    Given I open the "users" table
    And the query logger panel is expanded
    When I enable zen mode
    Then the sidebar should be fully collapsed
    And the query logger panel should be collapsed
    And the connection page header should be hidden

  Scenario: Narrow viewport keeps Sort reachable via horizontal scroll
    Given I open the "users" table
    When I resize the viewport to 1280 by 720
    Then I can reach the order-by button in the filters toolbar
