Feature: AI chat assistant
  Deterministic coverage for the connection-scoped AI chat page.
  All LLM traffic is intercepted with canned SSE streams — no real provider.

  Background:
    Given I have a SQLite sample database connection named "e2e-sqlite"

  Scenario: Workspace shell stays visible around the AI chat
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the connection workspace shell stays visible

  Scenario: Assistant reply streams into the thread incrementally
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned text reply in parts "Hello ", "from the mocked ", "assistant stream"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "show recent orders" and press send
    Then my message "show recent orders" is visible in the thread
    And the generating indicator shows while the reply is pending
    And the full reply "Hello from the mocked assistant stream" is visible

  Scenario: propose_sql approval round-trip posts the user decision
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "approval"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "count users" and press send
    Then an approval prompt is shown
    When I reject the proposal
    Then a later chat request carries decision approved "false"
    When I approve the proposal
    Then a later chat request carries decision approved "true"

  Scenario: Provider settings ride along in the chat request config
    Given the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I pick preset "Groq" with base url "" key "gsk-e2e-key" model "llama-3.3-70b"
    And I type "top customers" and press send
    Then the last chat request config has provider "groq", base url "https://api.groq.com/openai/v1", key "gsk-e2e-key" and model "llama-3.3-70b"
    When I pick preset "Custom (OpenAI-compatible)" with base url "http://127.0.0.1:9999/v1" key "" model "local-model"
    And I type "and again locally" and press send
    Then the last chat request config has provider "custom", base url "http://127.0.0.1:9999/v1", key "" and model "local-model"

  Scenario: Mid-stream provider failure surfaces an error and the composer recovers
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "first question" and press send
    Then the full reply "Hello from the mocked assistant stream" is visible
    When the current mock mode is "fail500"
    And I type "second question" and press send
    Then a chat error becomes visible
    And the composer is enabled again
    When the current mock mode is "text"
    And I type "third time lucky" and press send
    Then my message "third time lucky" is visible in the thread
    And the full reply "Hello from the mocked assistant stream" is visible

  Scenario: No stopped-actor errors while typing before sending or after reload
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I type "draft one" character by character
    And I reload the page, approve schema context if needed and type "draft two" character by character
    Then the console contains no stopped-actor errors

  Scenario: Assistant reply stays one message when the provider omits the message id
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned text reply without a message id in parts "I have prepared ", "a query to count ", "the videos."
    When I open the AI chat page
    And I approve sharing schema context
    And I type "how many videos do we have" and press send
    Then the full reply "I have prepared a query to count the videos." is visible
    And the thread shows exactly 1 assistant reply

  Scenario: Use this SQL seeds the editor and manual Run executes the proposal
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT 42 AS answer"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "draft a query" and press send
    Then the full reply "Here is a query you can run." is visible
    When I click "Use this SQL" on the assistant proposal
    Then I land on a custom SQL editor seeded with the proposal
    And the query is staged but not executed
    When I press Run in the SQL editor
    Then the query results are shown

  Scenario: Run from the chat auto-executes the proposal after navigation
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT 42 AS answer"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "run a count for me" and press send
    Then the full reply "Here is a query you can run." is visible
    When I click "Run" on the assistant proposal
    Then I land on a custom SQL editor seeded with the proposal
    And the query runs automatically after navigation

  Scenario: Tool toggles shape the chat request payload
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    When I open the AI settings panel
    Then both tools are checked by default
    And I toggle tool "Run SQL"
    And I type "list tables" and press send
    Then the last chat request carries enabled tools "propose_sql"
    When I toggle tool "Run SQL"
    And I toggle tool "Propose SQL"
    And I type "no tools now" and press send
    Then the last chat request carries enabled tools "run_sql"
    When I press "Select all" in the tools settings
    And I type "tools are back" and press send
    Then the last chat request carries enabled tools "propose_sql,run_sql"

  Scenario: Composer model picker persists a custom model into requests
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    Then the composer picker shows model "gpt-4o-mini"
    When I pick custom model "my-model/beta-1" in the composer picker
    And I type "hello again" and press send
    Then the last chat request config has provider "openai", base url "https://api.openai.com/v1", key "sk-e2e-key" and model "my-model/beta-1"

  Scenario: Schema selection narrows the context sent to the provider
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I open the AI schema settings
    And I pick schema mode "Selected"
    And I toggle schema table "users"
    And I toggle schema table "posts"
    And I close the AI settings panel
    And I type "count users" and press send
    Then the last chat request carries schema tables "users,posts"
    And the full reply "Hello from the mocked assistant stream" is visible

  Scenario: Schema selection persists per connection across reloads
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I open the AI schema settings
    And I pick schema mode "Selected"
    And I toggle schema table "users"
    When I reload the page, approve schema context if needed and type " again" character by character
    And I press the chat send button
    Then my message "again" is visible in the thread
    And the last chat request carries schema tables "users"

  Scenario: Auto schema mode flags requests and streams replies normally
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I open the AI schema settings
    And I pick schema mode "Auto"
    And I close the AI settings panel
    And I type "how many videos" and press send
    Then the last chat request carries schema mode "auto"
    And the full reply "Hello from the mocked assistant stream" is visible
    And the schema hint reports auto mode with fewer tables than exist

  Scenario: Consent gate keeps the surface mounted and gates only Send (C1)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    Then the chat surface is visible while schema consent is still pending
    Then the send button is disabled because of pending schema consent
    When I approve sharing schema context
    And I fill the chat composer with "count users"
    Then the send button becomes enabled

  Scenario: Keyless local providers can send without an API key (C2)
    Given console errors are being collected
    And BYOK chat config preset "ollama-local" with key "" and model "llama3"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I fill the chat composer with "local question"
    Then the send button is enabled without any API key
    When I press the chat send button
    Then the full reply "Hello from the mocked assistant stream" is visible
    Then the full reply "Hello from the mocked assistant stream" is visible
    And the last chat request config has provider "ollama-local", base url "http://localhost:11434/v1", key "" and model "llama3"

  Scenario: Legacy bare-string API keys migrate on first read (C13)
    Given a legacy bare-string OpenAI API key "sk-legacy-key" stored from an older version
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I fill the chat composer with "legacy question"
    Then the send button becomes enabled
    And the stored chat config has been migrated to provider "openai" with key "sk-legacy-key"

  Scenario: Schema status never reports zero tables (C3)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "count users" and press send
    Then the full reply "Hello from the mocked assistant stream" is visible
    And the schema context hint never reports zero tables

  Scenario: Proposed SQL is readable without expanding anything (C4)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT 42 AS answer"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "draft a query" and press send
    Then the proposed SQL is visible without expanding any tool group

  Scenario: Generation can be stopped mid-stream (C11)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned text reply in parts "Hello ", "from the mocked ", "assistant stream"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "long question" and press send
    Then the generating indicator shows elapsed seconds
    When I stop the generation
    Then the composer recovers after stopping

  Scenario: Threads list renders a ghost entry or known conversations (C12)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the threads list is visible

  Scenario: Schema mode switcher exposes radio semantics (C5)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I open the AI schema settings
    Then the schema mode switcher is a labelled radiogroup with "All" checked
    When I pick schema mode "Auto"
    Then schema mode "Auto" reports checked and "All" does not

  Scenario: Configured settings sections stay collapsed on open (C7)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I toggle the AI settings region open
    Then provider, tools, and schema sections are present but collapsed

  Scenario: Persisted conversations hydrate into the thread list (S1)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And a persisted chat thread "hydration probe" exists for the connection
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the thread list shows a chat titled "hydration probe"
    When I open the thread titled "hydration probe"
    Then my message "count the users table rows" is visible in the thread
    And the full reply "Hello from the mocked assistant stream" is visible

  Scenario: Schema-sharing consent persists across reloads (S2)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I reload the chat page
    Then the schema-sharing consent banner is not shown
    And I can send a message without approving again

  Scenario: Keyless local providers can send without an API key
    Given BYOK chat config preset "ollama-local" with key "" and model "llama3"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I type "local model question" and press send
    Then the full reply "Hello from the mocked assistant stream" is visible
    Then the last chat request config has provider "ollama-local", base url "http://localhost:11434/v1", key "" and model "llama3"

  Scenario: Assistant role label precedes its message text (C8)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned text reply in parts "Hello ", "from the mocked ", "assistant stream"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "order check" and press send
    Then the full reply "Hello from the mocked assistant stream" is visible
    Then the assistant role label precedes its message text

  Scenario: Narrow viewport keeps the chat usable (N1/C6)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the viewport is 620 px wide by 900 px tall
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the chat thread is visible and the page has no horizontal overflow
