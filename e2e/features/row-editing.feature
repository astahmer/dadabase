Feature: Row create and edit UX

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Insert row via sheet
    Given I open the "users" table
    When I click Add row
    And I fill the row editor field "name" with "Carol"
    And I fill the row editor field "email" with "carol@example.com"
    And I fill the row editor field "age" with "28"
    And I save the row editor
    Then I should see cell value "Carol" in column "name"

  Scenario: Edit row via sheet
    Given I open the "users" table
    When I open the edit sheet for the row with "Alice" in column "name"
    And I fill the row editor field "name" with "Alicia"
    And I save the row editor
    Then I should see cell value "Alicia" in column "name"

  Scenario: Edit cell inline
    Given I open the "users" table
    When I double-click the cell in column "name" for the row with "Bob"
    And I type "Bobby" into the inline editor and press Enter
    Then I should see cell value "Bobby" in column "name"

  Scenario: Duplicate row via context menu
    Given I open the "users" table
    When I open the duplicate sheet for the row with "Charlie" in column "name"
    And I fill the row editor field "email" with "charlie.copy@example.com"
    And I save the row editor
    Then I should see cell value "Charlie" in column "name"
    And I should see cell value "charlie.copy@example.com" in column "email"

  Scenario: Show SQL preview in row editor
    Given I open the "users" table
    When I click Add row
    And I fill the row editor field "name" with "Dana"
    And I fill the row editor field "email" with "dana@example.com"
    And I click Show SQL
    Then I should see SQL preview containing "INSERT INTO"

  Scenario: Cancel row editor discards changes
    Given I open the "users" table
    When I open the edit sheet for the row with "Alice" in column "name"
    And I fill the row editor field "name" with "ShouldNotPersist"
    And I cancel the row editor
    Then I should see cell value "Alice" in column "name"
    And I should not see cell value "ShouldNotPersist" in column "name"

  Scenario: Unique constraint error surfaces in sheet
    Given I open the "users" table
    When I click Add row
    And I fill the row editor field "name" with "Dup"
    And I fill the row editor field "email" with "alice@example.com"
    And I save the row editor expecting failure
    Then I should see a row editor error containing "Unique"

  Scenario: Edit composite primary key row via sheet
    Given I open the "memberships" table
    When I open the edit sheet for the row with "admin" in column "role"
    And I fill the row editor field "role" with "owner"
    And I save the row editor
    Then I should see cell value "owner" in column "role"

  Scenario: Inline edit foreign key cell
    Given I open the "posts" table
    When I double-click the cell in column "title" for the row with "Hello"
    And I type "Hello updated" into the inline editor and press Enter
    Then I should see cell value "Hello updated" in column "title"

  Scenario: Edit text payload via sheet
    Given I open the "notes" table
    When I open the edit sheet for the row with "meta" in column "title"
    And I fill the row editor field "payload" with "{\"color\":\"red\",\"count\":2}"
    And I save the row editor
    Then I should see cell value "meta" in column "title"

  Scenario: Bulk delete selected row
    Given I open the "users" table
    When I select the row with "Charlie" in column "name"
    And I delete the selected rows from the bulk action bar
    Then I should not see cell value "Charlie" in column "name"

  Scenario: Tables without primary key can still edit via system row id
    Given I open the "no_pk_items" table
    When I open the edit sheet for the row with "alpha" in column "label"
    When I fill the row editor field "value" with "99"
    And I save the row editor
    Then I should see cell value "99" in column "value"

  Scenario: Pick foreign key value via FK picker
    Given I open the "posts" table
    When I open the edit sheet for the row with "Hello" in column "title"
    And I pick FK value "2" for field "user_id"
    And I save the row editor
    Then I should see cell value "2" in column "user_id"
