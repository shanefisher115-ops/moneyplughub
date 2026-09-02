export function dispatchCommentary(commentary, HUD) {
  if (HUD && typeof HUD.addCommentary === "function") {
    HUD.addCommentary(commentary);
  }
  console.log(`?? [Commentary Dispatcher] Broadcasted ${commentary.length} agent observations to HUD.`);
}
