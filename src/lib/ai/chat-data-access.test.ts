import { describe, expect, it } from "vitest";

import {
  applyChatDataAccessToTools,
  dataClassesForChatTurn,
  DEFAULT_CHAT_DATA_ACCESS,
  normalizeChatDataAccess,
} from "./chat-data-access.ts";

describe("chat data access", () => {
  it("defaults to schema metadata plus permitted values", () => {
    expect(DEFAULT_CHAT_DATA_ACCESS).toEqual({
      schema: true,
      sampleRows: true,
      queryResults: true,
    });
    expect(normalizeChatDataAccess(undefined)).toEqual(DEFAULT_CHAT_DATA_ACCESS);
    expect(normalizeChatDataAccess({ schema: true })).toEqual(DEFAULT_CHAT_DATA_ACCESS);
    expect(normalizeChatDataAccess({ sampleRows: false })).toEqual({
      schema: true,
      sampleRows: false,
      queryResults: true,
    });
  });

  it("removes row-returning tools unless their data class is allowed", () => {
    expect(
      applyChatDataAccessToTools(
        ["propose_sql", "preview_rows", "run_sql", "table_details"],
        DEFAULT_CHAT_DATA_ACCESS,
      ),
    ).toEqual(["propose_sql", "preview_rows", "run_sql", "table_details"]);
  });

  it("reports the data classes used by the effective tool set", () => {
    expect(
      dataClassesForChatTurn({
        hasSchema: true,
        enabledTools: ["propose_sql", "preview_rows", "run_sql"],
      }),
    ).toEqual(["schema", "sample-rows", "query-results"]);
  });
});
