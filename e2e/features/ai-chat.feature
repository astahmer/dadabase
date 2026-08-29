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
    And the console contains no duplicate React key warnings

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
    And the SQL editor keeps the executed query

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
    Then all tools are checked by default
    And I toggle tool "Run SQL"
    And I type "list tables" and press send
    Then the last chat request carries enabled tools "explain_sql,open_workspace_view,preview_rows,propose_sql,table_details"
    When I toggle tool "Run SQL"
    And I toggle tool "Propose SQL"
    And I type "no tools now" and press send
    Then the last chat request carries enabled tools "explain_sql,open_workspace_view,preview_rows,run_sql,table_details"
    When I press "Select all" in the tools settings
    And I type "tools are back" and press send
    Then the last chat request carries enabled tools "explain_sql,open_workspace_view,preview_rows,propose_sql,run_sql,table_details"

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

  Scenario: Read-only access sends a question without a schema approval step
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I fill the chat composer with "count users"
    And I press the chat send button
    Then the full reply "Hello from the mocked assistant stream" is visible
    And the last chat request carries access mode "read-only"
    And an approval prompt is not shown

  Scenario: Composer exposes a safe read-only default and writable modes
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the composer access picker shows "Read only"
    When I choose composer access "Read & Write"
    Then the composer access picker shows "Read & Write"
    When I choose composer access "Full Access"
    Then the composer access picker shows "Full Access"

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
    Then the schema mode switcher is a labelled radiogroup with "Auto" checked
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
    And the restored messages keep user before assistant order
    And the active chat thread is present in the URL
    When I reload the chat page
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

  Scenario: Code fences are highlighted, labeled, and copyable (M1/M2)
    Given clipboard permissions are granted
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned reply containing a sql code fence
    When I open the AI chat page
    And I approve sharing schema context
    And I type "count users via sql fence" and press send
    Then the assistant reply contains a highlighted "sql" code block
    When I copy the assistant code block
    Then the clipboard contains "SELECT count(*) FROM users;"

  Scenario: Proposal SQL has a copy button (M2)
    Given clipboard permissions are granted
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT count(*) AS users FROM users"
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I type "count users" and press send
    When I copy the proposed SQL
    Then the clipboard contains "SELECT count(*) AS users FROM users"

  Scenario: Enter sends and Shift+Enter inserts a newline (K1)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    Then the composer shows the keyboard hint
    When I type "first question" in the chat composer
    And I press Enter in the chat composer
    Then my message "first question" is visible in the thread
    And the composer is empty after sending
    When I type "line one" in the chat composer
    And I press Shift+Enter in the chat composer
    And I type "line two" more in the chat composer
    Then the composer value contains a newline

  Scenario: Retry re-sends without retyping after a failure (S4)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "first question" and press send
    Then the full reply "Hello from the mocked assistant stream" is visible
    When the current mock mode is "fail500"
    And I note the number of chat requests
    And I type "second question" and press send
    Then a chat error becomes visible
    And the latest assistant reply offers retry
    When the current mock mode is "text"
    And I retry the latest assistant reply
    Then at least one more chat request has been sent

  Scenario: Stop hides the generating state before a stalled stream ends (S5)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "stalled"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "long question" and press send
    And I stop the generation
    Then the generating indicator disappears after stopping

  Scenario: Use this SQL offers a return path to the conversation (S8)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT 42 AS answer"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "draft a query" and press send
    Then the full reply "Here is a query you can run." is visible
    When I click "Use this SQL" on the assistant proposal
    Then I land on a custom SQL editor seeded with the proposal
    And a back-to-chat link for the conversation is shown
    When I follow the back-to-chat link
    Then the AI chat page is open again

  Scenario: Threads can be renamed, pinned, and deleted with confirmation (S3)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And a persisted chat thread "pin me" exists for the connection
    And a persisted chat thread "rename me" exists for the connection
    And a persisted chat thread "delete me" exists for the connection
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I pin the chat titled "pin me"
    Then the chat titled "pin me" shows as pinned
    When I rename the chat titled "rename me" to "renamed probe"
    Then the thread list shows a chat titled "renamed probe"
    When I delete the chat titled "delete me"
    Then a delete confirmation is requested for "delete me"
    When I confirm deleting the chat titled "delete me"
    Then the thread list no longer shows a chat titled "delete me"

  Scenario: Thread search filters the saved chats (K3)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And a persisted chat thread "alpha research" exists for the connection
    And a persisted chat thread "beta notes" exists for the connection
    When I open the AI chat page
    And I approve sharing schema context if needed
    When I search chats for "alpha"
    Then only chats matching "alpha" are listed

  Scenario: Thread search also matches saved message content
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And a persisted chat thread "ordinary title" exists with searchable content "needle inside the saved answer"
    And a persisted chat thread "unrelated title" exists with searchable content "something else"
    When I open the AI chat page
    And I approve sharing schema context if needed
    When I search chats for "needle"
    Then the chat titled "ordinary title" is shown by content search

  Scenario: Export downloads the conversation as markdown (K2)
    Given console errors are being collected
    And BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "exportable question" and press send
    And the full reply "Hello from the mocked assistant stream" is visible
    When I export the chat as markdown
    Then a markdown download named after the chat is offered

  Scenario: Draft survives a reload (S6)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context
    And I type "unsent draft text" in the chat composer
    And I reload the chat page
    Then the composer contains "unsent draft text"

  Scenario: Ask-about-table deep link scopes schema without an unnecessary draft (K4)
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page with askTable "posts"
    And I approve sharing schema context if needed
    Then the composer is empty after sending
    When I open the AI schema settings
    Then the schema mode switcher is a labelled radiogroup with "Selected" checked

  Scenario: Opening an AI tab preserves existing workspace tabs
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the connection workspace
    And I pick table "users" from the new-tab listbox
    Then the rows grid is visible
    When I open a new AI tab from the tab strip
    And I approve sharing schema context if needed
    Then the AI assistant is visible inside the workspace tabs
    And the tab strip shows 2 tabs
    When I switch back to the "users" workspace tab
    Then the rows grid is visible
    When I switch to the AI assistant workspace tab
    Then the AI assistant is visible inside the workspace tabs

  Scenario: Use this SQL adds an editor tab without replacing workspace tabs
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a canned propose_sql reply with sql "SELECT 42 AS answer"
    When I open the connection workspace
    And I pick table "users" from the new-tab listbox
    And I open a new AI tab from the tab strip
    And I type "draft a query" and press send
    Then the full reply "Here is a query you can run." is visible
    When I click "Use this SQL" on the assistant proposal
    Then I land on a custom SQL editor seeded with the proposal
    And the tab strip shows 3 tabs

  Scenario: Suggest query with AI opens a seeded AI tab
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the connection workspace
    And I pick table "users" from the new-tab listbox
    And I click "Suggest query with AI"
    And I approve sharing schema context if needed
    Then the AI assistant is visible inside the workspace tabs
    And the composer contains "Write a SQL query for `users`:"

  Scenario: open_workspace_view tool renders a card that opens a filtered tab
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams an open_workspace_view call for table "users" filtered by "status" equals "active"
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I type "show me active users" and press send
    Then the workspace view card is visible
    When I click the open workspace view card button
    Then a browse tab opens on table "users" with a filter on "status"

  Scenario: Suggest query with AI from a custom SQL tab
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API is mocked with canned streams and request recording
    And the current mock mode is "text"
    When I open the connection workspace
    And I open the custom SQL workspace
    And I click "Suggest query with AI"
    And I approve sharing schema context if needed
    Then the AI assistant is visible inside the workspace tabs
    And the composer contains "Write a SQL query for the current schema:"

  Scenario: New table tab focuses its keyboard-searchable listbox
    When I open the connection workspace
    Then the new-tab table search is focused
    When I filter new-tab tables to "users"
    And I open the highlighted table with the keyboard
    Then the rows grid is visible
    And the active table tab is "users"

  Scenario: Sidebar hide removes navigation and reopen restores it
    Given I open the "users" table
    When I collapse the sidebar
    Then the sidebar should be fully collapsed
    And the hidden sidebar has no visible table navigation
    When I restore the sidebar
    Then the table sidebar navigation is visible

  Scenario: Bulk selection header is represented by an accessible checkbox only
    Given I open the "users" table
    Then the bulk selection header has no visible Select label

  Scenario: Read-only AI inspection tools render their results
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams read-only inspection tool results
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I type "inspect users" and press send
    Then the preview rows result is visible
    And the readable AI preview matches its visual snapshot
    And the table details result is visible
    And the explain SQL result is visible
    And the successful SQL result shows provenance and a readable preview
    And the successful AI reply does not offer retry

  Scenario: Failed SQL tools keep their error visible
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And the chat API streams a failed SQL tool result
    When I open the AI chat page
    And I type "inspect missing table" and press send
    Then the failed SQL tool shows its error

  Scenario: Restored tool outcomes match their original states
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    And a persisted chat thread "restored tool outcomes" exists with successful and failed SQL tools
    When I open the AI chat page
    And I open the thread titled "restored tool outcomes"
    Then the successful SQL tool is marked completed
    And the failed SQL tool shows its error

  Scenario: AI sidechat stays readable across desktop and narrow widths
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the connection workspace
    And I pick table "users" from the new-tab listbox
    And I open the AI sidechat
    And I approve sharing schema context if needed
    Then the AI sidechat stays within the main content panel
    Then the AI sidechat suggestions are expanded
    Then the AI sidechat matches the "default" visual snapshot
    When I drag the AI sidechat resize handle outward
    When I resize the AI sidechat to its wide keyboard size
    Then the AI sidechat matches the "wide" visual snapshot
    When I set a narrow mobile viewport
    Then the mobile AI sidechat resize handle is visible

  Scenario: AI context picker stays open for multi-table attachment
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context if needed
    And I attach tables "users" and "posts" to AI context
    Then the AI context picker remains open

  Scenario: Full chat thread sidebar can be resized
    Given BYOK chat config preset "openai" with key "sk-e2e-key" and model "gpt-4o-mini"
    When I open the AI chat page
    And I approve sharing schema context if needed
    Then the chat threads sidebar can be resized
