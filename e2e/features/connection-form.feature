Feature: Connection setup

  Scenario: New connections start safe and explain invalid input
    Given I open the connections home page
    Then the new connection should default to read-only
    When I save the blank connection form
    Then I should see text "Check connection details"

  Scenario: A SQLite connection can be saved from individual fields
    Given I open the connections home page
    Then SQLite connections should default to read-only
    When I save a SQLite connection named "e2e-new-sqlite"
    Then I should see the saved connection named "e2e-new-sqlite"
    And the saved connection "e2e-new-sqlite" should be read-only

  Scenario: Saved connections are searchable and expose their safety mode
    Given I open the connections home page
    Then I should see a read-only saved connection
    When I search saved connections for "unreachable"
    Then I should see the saved connection named "e2e-unreachable-pg"
    And I should not see the saved connection named "e2e-sqlite"
