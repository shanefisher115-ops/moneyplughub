export function speak(lines = [], options = {}) {
  if (!lines.length) return;
  console.log("\n=======================================================");
  console.log("??? [PRIMORDIAOS NARRATOR ECHO]");
  console.log("=======================================================");
  for (const line of lines) {
    console.log(`? ${line}`);
  }
  console.log("=======================================================\n");
  return lines;
}
