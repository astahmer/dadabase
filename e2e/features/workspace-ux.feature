Feature: Workspace UX audit fixes

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"
    And I open the "users" table

  Scenario: View mode survives deep link (W1)
    When I switch to the structure view
    And I reload the page
    Then the structure view is active after load

  Scenario: Back restores the previous view mode (W1)
    When I switch to the structure view
    And I go back
    Then the rows view is active

  Scenario: Row editor opens from explicit row action (W2)
    When I click the edit button on the first row
    Then the row editor sheet should be visible

  Scenario: Row editor opens from cell double-click (W2)
    When I double-click the first data cell
    Then the row editor sheet should be visible

  Scenario: Structure view mode is encoded in the URL (W1)
    When I switch to the structure view
    Then the URL contains the structure view mode

  Scenario: Pagination buttons announce boundaries (W5)
    Then the pagination controls have accessible names and boundary hints

  Scenario: Icon controls are named (W7, G4)
    Then no unnamed icon buttons remain on the grid surface
    And the connection switcher trigger has an accessible name
