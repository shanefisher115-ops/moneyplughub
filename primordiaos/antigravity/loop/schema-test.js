import { step1_inspectSchema } from "./steps/1-inspect-schema.js";

const result = await step1_inspectSchema();

console.log(
  JSON.stringify(result, null, 2)
);
