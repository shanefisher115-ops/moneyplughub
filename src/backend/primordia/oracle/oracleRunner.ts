import { OracleMemory } from "./oracleMemory";
import { OracleAgent } from "./oracleAgent";

console.log("=== MEMORY ===");

console.log(
  OracleMemory.getMemories()
);

console.log("");

console.log("=== ORACLE ===");

console.log(
  OracleAgent.evaluate({
    userId: "test-user",
    question: "What is my highest leverage action?"
  })
);
