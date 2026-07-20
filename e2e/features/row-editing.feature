Feature: Row create and edit UX

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"
    And I open the "users" table

  Scenario: Insert row via sheet
    When I click Add row
    And I fill the row editor field "name" with "Carol"
    And I fill the row editor field "email" with "carol@example.com"
    And I fill the row editor field "age" with "28"
    And I save the row editor
    Then I should see cell value "Carol" in column "name"

  Scenario: Edit row via sheet
    When I open the edit sheet for the row with "Alice" in column "name"
    And I fill the row editor field "name" with "Alicia"
    And I save the row editor
    Then I should see cell value "Alicia" in column "name"

  Scenario: Edit cell inline
    When I double-click the cell in column "name" for the row with "Bob"
    And I type "Bobby" into the inline editor and press Enter
    Then I should see cell value "Bobby" in column "name"
