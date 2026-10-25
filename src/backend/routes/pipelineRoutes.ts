import { Router, Request, Response } from "express";
import { ArchitectRealm } from "../realms/ArchitectRealm";
import { PlannerRealm } from "../realms/PlannerRealm";
import { BuilderRealm } from "../realms/BuilderRealm";

const router = Router();

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { intent, targetDomain } = req.body;
    
    if (!intent) {
      return res.status(400).json({ success: false, error: "Missing required field: intent" });
    }

    console.log(`[Pipeline API] Received execution request for intent: "${intent}"`);

    const architect = new ArchitectRealm();
    const spec = await architect.generateSpec({ intent, targetDomain });

    const planner = new PlannerRealm();
    const plan = await planner.createExecutionPlan(spec);

    const builder = new BuilderRealm();
    const result = await builder.executePlan(plan);

    return res.json({
      success: true,
      spec,
      plan,
      result
    });
  } catch (error: any) {
    console.error("[Pipeline API Error]", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
