Feature: Read-only connection guard

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite-readonly"

  Scenario: Disables row insert on a read-only connection
    Given I open the "users" table
    Then I should not be able to add rows
