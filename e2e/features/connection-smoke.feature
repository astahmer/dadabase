Feature: Connection bootstrap smoke

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Sidebar loads tables without a generic server failure
    Then I should see the table filter
    And I should not see text "An error has occurred"
    And I should not see text "Failed to load tables"
    And I should not see text "Invalid server function"
    When I open the "users" table
    Then I should see cell value "Alice" in column "name"
