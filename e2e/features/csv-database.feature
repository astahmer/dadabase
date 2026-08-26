Feature: CSV files as editable databases

  Scenario: Browse, edit, insert, delete and save a CSV-backed table
    Given I have a CSV connection named "e2e-csv"
    And I open the "people" table
    Then I should see cell value "person_1" in column "name"
    And I should see cell value "person_10" in column "name"

    When I double-click the cell in column "name" for the row with "5"
    And I type "eve_edited" into the inline editor and press Enter
    Then I should see cell value "eve_edited" in column "name"
    When I commit the pending cell edits
    Then I should see the CSV save bar with 1 unsaved changes

    When I click Add row
    And I fill the row editor field "id" with "11"
    And I fill the row editor field "name" with "inserted_row"
    And I save the row editor
    Then I should see cell value "inserted_row" in column "name"
    And I should see the CSV save bar with 2 unsaved changes

    When I select the row with "7" in column "id"
    And I delete the selected rows from the bulk action bar
    Then I should not see cell value "person_7" in column "name"

    When I save the CSV table to file
    Then the CSV file on disk should contain "eve_edited"
    And the CSV file on disk should contain "inserted_row"
    And the CSV file on disk should not contain "person_7"
    And a .bak backup for "people.csv" should exist without "eve_edited"

    When I reload the page
    And I open the "people" table
    Then I should see cell value "eve_edited" in column "name"
