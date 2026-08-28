Feature: Table-independent custom SQL

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Run SQL without selecting a table first
    Given I open the connection named "e2e-sqlite"
    When I open the custom SQL workspace
    Then I should see the table-independent SQL workspace
    When I run custom SQL "SELECT 42 AS custom_sql_answer"
    Then I should see custom SQL cell value "42"
    And I should see a custom SQL result receipt
    And the SQL editor should retain "SELECT 42 AS custom_sql_answer"

  Scenario: Favorite SQL opens directly from its title
    Given I open the "users" table
    When I expand the SQL query panel
    And I enter custom SQL "SELECT 7 AS favorite_answer"
    And I save the current SQL as a favorite
    And the query logger panel is expanded
    And I open saved queries
    Then I should see a saved favorite titled "SELECT 7 AS favorite_answer"
    When I click the saved favorite title "SELECT 7 AS favorite_answer"
    Then I should see the table-independent SQL workspace
    And the SQL editor should retain "SELECT 7 AS favorite_answer"

  Scenario: Running SQL in the table workspace preserves the editor draft
    Given I open the "users" table
    When I expand the SQL query panel
    And I run custom SQL "SELECT 42 AS table_workspace_answer"
    Then I should see custom SQL cell value "42"
    And I should see a custom SQL result receipt
    And the SQL editor should retain "SELECT 42 AS table_workspace_answer"

  Scenario: Editing after execution marks the previous result stale
    Given I open the "users" table
    When I expand the SQL query panel
    And I run custom SQL "SELECT 1 AS previous_answer"
    And I enter custom SQL "SELECT 2 AS current_answer"
    Then the current result should be marked stale
    When I run the current SQL from the editor
    Then I should see custom SQL cell value "2"
    And the SQL editor should retain "SELECT 2 AS current_answer"

  Scenario: Running and resizing never replaces a multi-statement draft
    Given I open the "users" table
    When I expand the SQL query panel
    And I enter custom SQL "SELECT 1 AS first_statement; SELECT 2 AS second_statement"
    And I run the current SQL from the editor
    Then I should see custom SQL cell value "2"
    And the SQL editor should retain "SELECT 1 AS first_statement; SELECT 2 AS second_statement"
    When the query logger panel is expanded
    And I toggle the query logger panel size
    Then the SQL editor should retain "SELECT 1 AS first_statement; SELECT 2 AS second_statement"
    When I choose the SQL layout "Results focus"
    Then the SQL editor should retain "SELECT 1 AS first_statement; SELECT 2 AS second_statement"

  Scenario: Persistent transactions can roll back and commit
    Given I open the "users" table
    When I expand the SQL query panel
    And I begin a persistent transaction
    And I run custom SQL "UPDATE users SET age = 99 WHERE id = 1"
    And I roll back the persistent transaction
    And I run custom SQL "SELECT age FROM users WHERE id = 1"
    Then I should see custom SQL cell value "30"
    When I begin a persistent transaction
    And I run custom SQL "UPDATE users SET age = 99 WHERE id = 1"
    And I commit the persistent transaction
    And I run custom SQL "SELECT age FROM users WHERE id = 1"
    Then I should see custom SQL cell value "99"

  Scenario: Run a multi-statement script atomically
    Given I open the "users" table
    When I expand the SQL query panel
    And I enter custom SQL "UPDATE users SET active = active WHERE id = 1; SELECT 2 AS second_result"
    And I run the current SQL as a transaction
    Then I should see custom SQL cell value "2"
    And the SQL editor should retain "UPDATE users SET active = active WHERE id = 1; SELECT 2 AS second_result"

  Scenario: Pinned results survive later runs and reloads
    Given I open the "users" table
    When I expand the SQL query panel
    And I run custom SQL "SELECT 1 AS persisted_result"
    And I pin the current SQL result
    And I run custom SQL "SELECT 2 AS newer_result"
    Then I should see a pinned SQL result containing "SELECT 1 AS persisted_result"
    And I should see a SQL request ID
    And I should see the SQL execution timeline
    When I reload the page
    Then I should see a pinned SQL result containing "SELECT 1 AS persisted_result"

  Scenario: A clean reload does not claim crash recovery
    Given I open the "users" table
    When I expand the SQL query panel
    And I enter custom SQL "SELECT 3 AS clean_reload"
    And I reload the page
    Then I should not see crash-specific SQL draft recovery

  Scenario: An interrupted editor session offers crash-specific recovery
    Given I open the "users" table
    When I expand the SQL query panel
    And I enter custom SQL "SELECT 4 AS interrupted_session"
    Then a fresh page should offer crash-specific SQL draft recovery

  Scenario: Narrow custom SQL layout keeps primary actions reachable
    Given I open the "users" table
    When I resize the viewport to 390 by 844
    And I expand the SQL query panel
    Then the SQL editor actions should fit the narrow viewport
