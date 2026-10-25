import { BaseRealm } from "../BaseRealm";
import { SystemArchitectureSpec } from "./ArchitectRealm";
export interface ExecutionTask {
  taskId: string;
  stepNumber: number;
  title: string;
  description: string;
  targetFile?: string;
  dependencies: string[];
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export interface SystemExecutionPlan {
  planId: string;
  specId: string;
  targetModule: string;
  tasks: ExecutionTask[];
  estimatedMilestones: number;
  createdAt: string;
}

export class PlannerRealm extends BaseRealm {
  constructor() {
    super("Planner", "Task Decomposition and Milestone Scheduler");
  }

  public async createExecutionPlan(spec: SystemArchitectureSpec): Promise<SystemExecutionPlan> {
    this.log("Decomposing Architect Spec [" + spec.specId + "] into actionable task graph...");

    const isFrontend = /Widget|Component|View|UI|Dashboard/i.test(spec.targetModule);

    let tasks: ExecutionTask[] = [];

    if (isFrontend) {
      tasks = [
        {
          taskId: "TASK-" + spec.specId + "-1",
          stepNumber: 1,
          title: "Scaffold React UI Component for " + spec.targetModule,
          description: "Create primary TSX view component with obsidian dark theme and cyan accents.",
          targetFile: "src/frontend/components/" + spec.targetModule + ".tsx",
          dependencies: [],
          status: "PENDING"
        }
      ];
    } else {
      tasks = [
        {
          taskId: "TASK-" + spec.specId + "-1",
          stepNumber: 1,
          title: "Initialize Database Migrations for " + spec.targetModule,
          description: "Verify and apply schema changes for " + spec.targetModule + " module tables.",
          targetFile: "src/backend/db/migrations/" + spec.targetModule.toLowerCase() + "_migration.ts",
          dependencies: [],
          status: "PENDING"
        },
        {
          taskId: "TASK-" + spec.specId + "-2",
          stepNumber: 2,
          title: "Scaffold " + spec.targetModule + " Engine and Core Interfaces",
          description: "Create domain models and execution logic for components in " + spec.targetModule + ".",
          targetFile: "src/backend/services/" + spec.targetModule + "Engine.ts",
          dependencies: ["TASK-" + spec.specId + "-1"],
          status: "PENDING"
        },
        {
          taskId: "TASK-" + spec.specId + "-3",
          stepNumber: 3,
          title: "Mount API Endpoints in Server Router",
          description: "Expose REST/WebSocket controller handlers for " + spec.targetModule + " dispatch.",
          targetFile: "src/backend/routes/" + spec.targetModule.toLowerCase() + "Routes.ts",
          dependencies: ["TASK-" + spec.specId + "-2"],
          status: "PENDING"
        }
      ];
    }

    return {
      planId: "PLAN-" + Date.now(),
      specId: spec.specId,
      targetModule: spec.targetModule,
      tasks,
      estimatedMilestones: tasks.length,
      createdAt: new Date().toISOString()
    };
  }
}
