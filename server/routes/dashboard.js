const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const svc = require("../services/routerService");
const { sortQueue } = require("../routing/dispatcher");
const { ROUTING_TABLE, DEPT_ZONE } = require("../routing/routingTable");

// Catches unexpected errors so the server never crashes on a bad request
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error." });
  });

// ---- User Dashboard: counts
router.get("/stats", wrap(async (req, res) => {
  const rows = await Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const counts = { Pending: 0, Assigned: 0, "In Progress": 0, Resolved: 0 };
  let total = 0;
  for (const r of rows) {
    if (r._id in counts) counts[r._id] = r.count;
    total += r.count;
  }
  res.json({
    total,
    pending: counts.Pending,
    assigned: counts.Assigned,
    inProgress: counts["In Progress"],
    resolved: counts.Resolved,
  });
}));

// ---- List reports (newest first). Optional filter: /reports?status=Assigned
router.get("/reports", wrap(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const reports = await Report.find(filter).sort({ seq: -1 }).limit(200).lean();
  res.json({ reports });
}));

// ---- Handler Dashboard: reports assigned to one team
router.get("/handlers/:teamId/reports", wrap(async (req, res) => {
  const teamId = req.params.teamId.toUpperCase();
  const reports = await Report.find({ assignedTo: teamId }).sort({ seq: -1 }).lean();
  res.json({ teamId, reports });
}));

// ---- Routing Management Dashboard
router.get("/routing", wrap(async (req, res) => {
  const handlers = await svc.listHandlers();

  // The explicit routing table as a list of rows
  const routingTable = Object.entries(ROUTING_TABLE).map(([key, teams]) => {
    const [zone, category] = key.split(":");
    return { key, zone, category, teams };
  });

  // Waiting queue, in the same deterministic order the dispatcher uses
  const waitingQueue = await Report.find({ status: "Pending", decision: "WAITING_QUEUE" }).lean();
  sortQueue(waitingQueue);

  const correctionQueue = await Report.find({ decision: "CORRECTION_QUEUE" }).sort({ seq: 1 }).lean();
  const backupAssignments = await Report.find({ decision: "PRIORITY_OVERRIDE_BACKUP" }).sort({ seq: -1 }).limit(50).lean();
  const escalations = await Report.find({ decision: "ESCALATED_LEVEL2" }).sort({ seq: -1 }).limit(50).lean();
  const priorityOverrides = await Report.find({ decision: "PRIORITY_OVERRIDE" }).sort({ seq: -1 }).limit(50).lean();

  res.json({
    routingTable,
    zones: DEPT_ZONE,
    handlers,
    waitingQueue,
    correctionQueue,
    backupAssignments,
    escalations,
    priorityOverrides,
  });
}));

// ---- Analytics Dashboard
async function groupBy(field, emptyLabel) {
  const rows = await Report.aggregate([
    {
      $group: {
        _id: `$${field}`,
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] } },
      },
    },
  ]);
  return rows
    .map((r) => ({
      name: r._id || emptyLabel,
      total: r.total,
      resolved: r.resolved,
      unresolved: r.total - r.resolved,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

router.get("/analytics", wrap(async (req, res) => {
  const total = await Report.countDocuments();
  const resolved = await Report.countDocuments({ status: "Resolved" });
  res.json({
    total,
    resolved,
    unresolved: total - resolved,
    byZone: await groupBy("zone", "Unknown zone"),
    byCategory: await groupBy("category", "Unclassified"),
    byPriority: await groupBy("priority", "Unknown"),
  });
}));

module.exports = router;