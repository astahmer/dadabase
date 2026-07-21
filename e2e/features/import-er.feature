Feature: Import data and ER diagram

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Open ER diagram and see a table node
    Given I open the "users" table
    When I switch to ER diagram view
    Then I should see ER table node "users"

  Scenario: Import CSV rows into users
    Given I open the "users" table
    When I import CSV rows into the current table:
      """
      name,email
      ImportAlice,import-alice@example.com
      """
    Then I should see "ImportAlice" in the rows table
