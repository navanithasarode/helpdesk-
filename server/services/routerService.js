const Report = require("../models/Report");
const Team = require("../models/Team");
const Meta = require("../models/Meta");
const { validateTicket } = require("../validators/validateTicket");
const { classify } = require("../classifier/classify");
const { DEPT_ZONE, TEAMS, LEVEL2 } = require("../routing/routingTable");
const {
  createState, dispatch, startWork, resolveReport,
  setAvailability, setCapacity, sortQueue,
} = require("../routing/dispatcher");

// ---- Lock: runs one operation at a time so simultaneous reports
// ---- can never be assigned twice or exceed a team's capacity.
let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(() => fn());
  lock = run.catch(() => {});
  return run;
}

// Create the 5 teams and the counter document the first time the server runs
async function seedTeams() {
  for (const t of [...TEAMS, LEVEL2]) {
    await Team.updateOne(
      { id: t.id },
      { $setOnInsert: { ...t, available: true } },
      { upsert: true }
    );
  }
  await Meta.updateOne(
    { _id: "router" },
    { $setOnInsert: { seq: 0, rrPointer: {} } },
    { upsert: true }
  );
}

// Build the dispatcher's in-memory state from MongoDB
async function loadState() {
  const state = createState();

  const teams = await Team.find().lean();
  for (const t of teams) {
    state.teams[t.id] = {
      id: t.id, name: t.name, level: t.level,
      capacity: t.capacity, available: t.available, load: 0,
    };
  }

  // Load = number of open tickets (Assigned or In Progress) per team
  const loads = await Report.aggregate([
    { $match: { status: { $in: ["Assigned", "In Progress"] } } },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);
  for (const l of loads) {
    if (state.teams[l._id]) state.teams[l._id].load = l.count;
  }

  const meta = await Meta.findById("router").lean();
  state.seq = meta.seq;
  state.rrPointer = meta.rrPointer || {};

  // Reports waiting for capacity, in deterministic queue order
  const waiting = await Report.find({ status: "Pending", decision: "WAITING_QUEUE" }).lean();
  for (const r of waiting) {
    state.reports[r.reportId] = r;
    state.waitingQueue.push(r);
  }
  sortQueue(state.waitingQueue);

  return state;
}

// Save every report the dispatcher touched, plus the counter and pointers
async function persist(state) {
  const ops = Object.values(state.reports).map((rec) => {
    const { _id, __v, ...data } = rec;
    return {
      updateOne: {
        filter: { reportId: rec.reportId },
        update: { $set: data },
        upsert: true,
      },
    };
  });
  if (ops.length > 0) await Report.bulkWrite(ops);
  await Meta.updateOne(
    { _id: "router" },
    { $set: { seq: state.seq, rrPointer: state.rrPointer } }
  );
}

// ---- Live preview (no saving): used for inline validation on the form
function preview(ticketId, description = "") {
  const v = validateTicket(ticketId);
  const base = {
    valid: v.valid,
    dfaAccepted: v.dfaAccepted,
    regexAccepted: v.regexAccepted,
    agree: v.agree,
    message: v.message,
    trace: v.trace,
  };
  if (!v.valid) return base;

  const c = classify(v.parts.issue, description);
  const zone = DEPT_ZONE[v.parts.dept] || null;
  return {
    ...base,
    parts: v.parts,
    category: c.category,
    conflict: c.conflict,
    candidates: c.candidates,
    classificationReason: c.reason,
    zone,
    routingKey: zone && c.category ? `${zone}:${c.category}` : null,
    needsReview: c.needsReview || !zone,
  };
}

// ---- Submit a new report
function submitReport(body) {
  return withLock(async () => {
    const state = await loadState();
    const reportId = `HD-${String(state.seq + 1).padStart(5, "0")}`;

    const result = dispatch(state, {
      reportId,
      ticketId: body.ticketId,
      description: body.description || "",
    });

    // Malformed ticket: rejected before dispatch, nothing is saved
    if (result.outcome === "REJECTED") {
      return { ok: false, reason: result.reason, validation: validateTicket(body.ticketId) };
    }

    const rec = result.record;
    const v = validateTicket(body.ticketId);
    const c = classify(rec.issue, rec.description);

    Object.assign(rec, {
      reporterName: body.reporterName || "",
      reporterEmail: body.reporterEmail || "",
      urgency: body.urgency || "Normal",
      validation: {
        valid: v.valid, dfaAccepted: v.dfaAccepted, regexAccepted: v.regexAccepted,
        agree: v.agree, message: v.message,
      },
      classification: { conflict: c.conflict, candidates: c.candidates, reason: c.reason },
    });

    await persist(state);
    return { ok: true, outcome: result.outcome, report: rec };
  });
}

// ---- Change a report's status (In Progress or Resolved)
function updateStatus(reportId, status) {
  return withLock(async () => {
    const state = await loadState();
    const doc = await Report.findOne({ reportId }).lean();
    if (!doc) return { ok: false, error: "Report not found.", code: 404 };
    if (!state.reports[reportId]) state.reports[reportId] = doc;

    let r;
    if (status === "In Progress") r = startWork(state, reportId);
    else if (status === "Resolved") r = resolveReport(state, reportId);
    else return { ok: false, error: "Status must be 'In Progress' or 'Resolved'.", code: 400 };

    if (!r.ok) return { ...r, code: 400 };
    await persist(state); // also saves any waiting report that got a free slot
    return r;
  });
}

// ---- Handler dashboard: list teams with current load
async function listHandlers() {
  const state = await loadState();
  return Object.values(state.teams);
}

// ---- Handler dashboard: set availability and/or capacity
function updateHandler(teamId, { available, capacity }) {
  return withLock(async () => {
    const state = await loadState();
    if (!state.teams[teamId]) return { ok: false, error: "Team not found.", code: 404 };

    if (available !== undefined) {
      if (typeof available !== "boolean")
        return { ok: false, error: "'available' must be true or false.", code: 400 };
      setAvailability(state, teamId, available);
      await Team.updateOne({ id: teamId }, { $set: { available } });
    }
    if (capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 0 || capacity > 50)
        return { ok: false, error: "'capacity' must be a whole number from 0 to 50.", code: 400 };
      setCapacity(state, teamId, capacity);
      await Team.updateOne({ id: teamId }, { $set: { capacity } });
    }

    await persist(state); // saves waiting reports placed after capacity freed up
    return { ok: true, handler: state.teams[teamId] };
  });
}

module.exports = {
  seedTeams, preview, submitReport, updateStatus, listHandlers, updateHandler,
};