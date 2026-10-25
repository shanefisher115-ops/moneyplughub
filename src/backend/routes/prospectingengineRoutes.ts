import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({
    status: "ACTIVE",
    service: "ProspectingEngine"
  });
});

export default router;
