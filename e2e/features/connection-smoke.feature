Feature: Connection bootstrap smoke

  Scenario: Sidebar loads tables without a generic server failure
    Given I have a SQLite sample database connection named "e2e-sqlite"
    Then I should see the table filter
    And I should not see text "An error has occurred"
    And I should not see text "Failed to load tables"
    And I should not see text "Invalid server function"
    When I open the "users" table
    Then I should see cell value "Alice" in column "name"

  Scenario: Unreachable postgres fails with a driver connect error
    Given I open the connection named "e2e-unreachable-pg"
    Then I should see a connection load error matching "ECONNREFUSED|Failed to connect|connect ECONNREFUSED"
    And I should not see text "An error has occurred"
    And I should not see text "Invalid server function"
