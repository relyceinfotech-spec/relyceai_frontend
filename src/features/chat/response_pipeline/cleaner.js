export function cleanOutput(text = "") {
  let out = String(text || "").replace(/\r\n/g, "\n").trim();
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/[ \t]{2,}/g, " ");
  return out;
}
