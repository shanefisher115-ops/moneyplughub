import { BaseRealm } from "../BaseRealm";
import { SystemExecutionPlan, ExecutionTask } from "./PlannerRealm";
import * as fs from "fs";import * as path from "path";

export class BuilderRealm extends BaseRealm {
  constructor() {
    super("Builder", "Autonomous Code Scaffolder & File Generator");
  }

  private generateTemplate(task: ExecutionTask, targetModule: string, filePath: string): string {
    const isTsx = filePath.endsWith(".tsx");
    const isMigration = filePath.includes("migrations");
    const isRoute = filePath.includes("routes");

    if (isTsx) {
      return `import React, { useState } from 'react';

export interface ${targetModule}Props {
  onAction?: () => void;
}

export const ${targetModule}: React.FC<${targetModule}Props> = ({ onAction }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-cyan-500/30">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-cyan-400">${targetModule} Interface</h2>
        <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
          SYSTEM ACTIVE
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Autonomous control interface for managing and monitoring ${targetModule} operations.
      </p>
      <div className="flex gap-3">
        <button 
          onClick={() => {
            setLoading(!loading);
            if (onAction) onAction();
          }} 
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition"
        >
          {loading ? "Processing..." : "Trigger Action"}
        </button>
      </div>
    </div>
  );
};

export default ${targetModule};
`;
    }

    if (isMigration) {
      return `// Auto-generated Migration: ${targetModule}
import { db } from "../db.ts";

export async function up() {
  console.log("Executing migration for ${targetModule}...");
}

export async function down() {
  console.log("Reverting migration for ${targetModule}...");
}
`;
    }

    if (isRoute) {
      return `// Auto-generated Express Router: ${targetModule}
import { Router, Request, Response } from "express";

const router = Router();

router.get("/status", (req: Request, res: Response) => {
  res.json({ status: "ACTIVE", module: "${targetModule}", timestamp: new Date().toISOString() });
});

export default router;
`;
    }

    return `// Auto-generated Service: ${targetModule}
// Task: ${task.title}

export class ${targetModule}Engine {
  public static status = "ACTIVE";

  public async initialize(): Promise<void> {
    console.log("[${targetModule}Engine] Initialized successfully.");
  }
}
`;
  }

  public async executePlan(plan: SystemExecutionPlan): Promise<{ success: boolean; generatedFiles: string[] }> {
    this.log(`Executing System Plan [${plan.planId}] for module [${plan.targetModule}]...`);
    const generatedFiles: string[] = [];

    for (const task of plan.tasks) {
      this.log(`[Task ${task.stepNumber}/${plan.tasks.length}] ${task.title}`);

      if (task.targetFile) {
        const filePath = path.resolve(process.cwd(), task.targetFile);
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const fileContent = this.generateTemplate(task, plan.targetModule, task.targetFile);

        fs.writeFileSync(filePath, fileContent, "utf8");
        this.log(`-> Created scaffolded file: ${task.targetFile}`);
        generatedFiles.push(task.targetFile);
        task.status = "COMPLETED";
      }
    }

    return { success: true, generatedFiles };
  }
}
