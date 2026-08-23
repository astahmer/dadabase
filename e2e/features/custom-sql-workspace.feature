Feature: Table-independent custom SQL

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Run SQL without selecting a table first
    Given I open the connection named "e2e-sqlite"
    When I open the custom SQL workspace
    Then I should see the table-independent SQL workspace
    When I run custom SQL "SELECT 42 AS custom_sql_answer"
    Then I should see custom SQL cell value "42"
