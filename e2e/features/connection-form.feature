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
