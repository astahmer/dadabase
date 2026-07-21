Feature: Read-only connection guard

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite-readonly"

  Scenario: Blocks row insert on a read-only connection
    Given I open the "users" table
    When I click Add row
    And I fill the row editor field "name" with "Nope"
    And I fill the row editor field "email" with "nope@example.com"
    And I save the row editor expecting failure
    Then I should see a row editor error containing "read-only"
