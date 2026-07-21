/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
  doc: Document = document,
): void {
  const blob = new Blob([content], { type: mimeType });
  const link = doc.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  doc.body.appendChild(link);
  link.click();
  doc.body.removeChild(link);

  URL.revokeObjectURL(url);
}
