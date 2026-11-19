const ACRONYMS = new Set(["MUN", "CNA", "MI", "YMCA", "NL", "YYT"]);
export function titleCaseHeadsign(value) {
  return value
    .toLocaleLowerCase("en-CA")
    .replace(/[\p{L}][\p{L}\p{M}'’]*/gu, (word) =>
      ACRONYMS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word[0].toLocaleUpperCase("en-CA") + word.slice(1),
    );
}
export function headwayLabel(minutes) {
  return minutes === null || !Number.isFinite(minutes)
    ? "Not enough service"
    : `About every ${Math.round(minutes)} min`;
}
