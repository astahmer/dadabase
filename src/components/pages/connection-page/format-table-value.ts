export const formatTableValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    // Check if it looks like a date
    const dateObj = new Date(value);
    if (!isNaN(dateObj.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return dateObj.toISOString();
    }

    if (value.at(0) === "{" && value.at(-1) === "}") {
      // Check if it looks like a JSON object
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }

  return value;
};
