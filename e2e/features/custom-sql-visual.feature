Feature: Custom SQL visual regressions

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Desktop custom SQL workspace visual baseline
    Given I open the connection named "e2e-sqlite"
    When I open the custom SQL workspace
    Then the custom SQL workspace matches the "desktop" visual snapshot

  Scenario: Narrow custom SQL workspace visual baseline
    Given I open the connection named "e2e-sqlite"
    When I resize the viewport to 390 by 844
    And I open the custom SQL workspace
    Then the custom SQL workspace matches the "narrow" visual snapshot

  Scenario: Extra narrow custom SQL workspace visual baseline
    Given I open the connection named "e2e-sqlite"
    When I resize the viewport to 320 by 844
    And I open the custom SQL workspace
    Then the custom SQL workspace matches the "extra-narrow" visual snapshot

  Scenario: Tablet custom SQL workspace visual baseline
    Given I open the connection named "e2e-sqlite"
    When I resize the viewport to 768 by 900
    And I open the custom SQL workspace
    Then the custom SQL workspace matches the "tablet" visual snapshot
