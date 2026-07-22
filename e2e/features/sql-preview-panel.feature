Feature: SQL preview panel collapse

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: SQL editor is collapsed by default
    Given I open the "users" table
    Then the SQL monaco panel should be hidden
    And I should see the SQL query toggle

  Scenario: Expanding SQL Query shows the editor
    Given I open the "users" table
    When I expand the SQL query panel
    Then I should see the unified SQL editor
