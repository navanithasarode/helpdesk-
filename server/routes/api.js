const express = require("express");
const router = express.Router();
const svc = require("../services/routerService");
const Report = require("../models/Report");
const Team = require("../models/Team");

// Catches unexpected errors so the server never crashes on a bad request
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error." });
  });

// Live validation + classification preview (nothing saved)
router.post("/validate", (req, res) => {
  const { ticketId, description } = req.body;
  res.json(svc.preview(ticketId, description));
});

// Submit a report
router.post("/reports", wrap(async (req, res) => {
  const result = await svc.submitReport(req.body);
  res.status(result.ok ? 201 : 400).json(result);
}));

// Search by report ID: status and assigned handler
router.get("/reports/:reportId", wrap(async (req, res) => {
  const report = await Report.findOne({ reportId: req.params.reportId.toUpperCase() }).lean();
  if (!report) return res.status(404).json({ ok: false, error: "Report not found." });
  const team = report.assignedTo ? await Team.findOne({ id: report.assignedTo }).lean() : null;
  res.json({ ok: true, report, assignedHandler: team ? team.name : null });
}));

// Update status: { "status": "In Progress" } or { "status": "Resolved" }
router.patch("/reports/:reportId/status", wrap(async (req, res) => {
  const result = await svc.updateStatus(req.params.reportId.toUpperCase(), req.body.status);
  res.status(result.ok ? 200 : result.code || 400).json(result);
}));

// Handlers with current loads
router.get("/handlers", wrap(async (req, res) => {
  res.json({ handlers: await svc.listHandlers() });
}));

// Set availability / capacity: { "available": false } and/or { "capacity": 5 }
router.patch("/handlers/:teamId", wrap(async (req, res) => {
  const result = await svc.updateHandler(req.params.teamId.toUpperCase(), req.body);
  res.status(result.ok ? 200 : result.code || 400).json(result);
}));

module.exports = router;