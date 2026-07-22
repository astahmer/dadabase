export type AiGeneratingMode = "generate" | "generate-and-run";

export const getAiGeneratingStatus = (
  mode: AiGeneratingMode,
): { title: string; detail: string } => {
  if (mode === "generate-and-run") {
    return {
      title: "Generating SQL and preparing to run…",
      detail: "Using the whole schema for context. This usually takes a few seconds.",
    };
  }
  return {
    title: "Generating SQL…",
    detail: "Using the whole schema for context. This usually takes a few seconds.",
  };
};
