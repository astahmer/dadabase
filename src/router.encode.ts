/**
 * Safe binary encoding for URL-safe compression with Zipson
 */
export function encodeToBinary(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_match, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    }),
  );
}

/**
 * Safe binary decoding for URL-safe compression with Zipson
 */
export function decodeFromBinary(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
}
