Feature: Schema mutate UI

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Create table, add column, drop column, drop table
    Given I open the "users" table
    When I switch to structure view
    And I create a table named "widgets" with an id primary key
    Then I should see table "widgets" in the sidebar
    When I add a column named "color" with type "TEXT"
    Then I should see column "color" in the structure table
    When I drop column "color"
    Then I should not see column "color" in the structure table
    When I drop the current table
    Then I should not see table "widgets" in the sidebar

  Scenario: Alter a SQLite column via table rebuild
    Given I open the "users" table
    When I switch to structure view
    And I alter column "age" to type "TEXT"
    Then I should see column "age" in the structure table
