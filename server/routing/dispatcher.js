const { validateTicket } = require("../validators/validateTicket");
const { classify } = require("../classifier/classify");
const { DEPT_ZONE, TEAMS, LEVEL2, ROUTING_TABLE } = require("./routingTable");

const PRIORITY_RANK = { H: 0, M: 1, L: 2 };
const LEVEL1_IDS = TEAMS.map((t) => t.id);

// Create a fresh, empty routing state (teams, queues, logs)
function createState() {
  const teams = {};
  for (const t of [...TEAMS, LEVEL2]) {
    teams[t.id] = { ...t, available: true, load: 0 };
  }
  return {
    teams,
    rrPointer: {},        // round-robin position for each routing key
    reports: {},          // reportId -> record
    waitingQueue: [],
    correctionQueue: [],
    seq: 0,
  };
}

const canTake = (team) => team.available && team.load < team.capacity;

// Pick a team from a list of team ids.
// leastLoaded = true  -> priority-override style (fewest open tickets)
// leastLoaded = false -> round-robin, remembering where we stopped last time
function pickFromPool(state, key, pool, leastLoaded) {
  const eligible = pool.filter((id) => canTake(state.teams[id]));
  if (eligible.length === 0) return null;

  if (leastLoaded) {
    return eligible.reduce((best, id) =>
      state.teams[id].load < state.teams[best].load ? id : best
    );
  }

  const start = state.rrPointer[key] || 0;
  for (let i = 0; i < pool.length; i++) {
    const idx = (start + i) % pool.length;
    if (eligible.includes(pool[idx])) {
      state.rrPointer[key] = (idx + 1) % pool.length;
      return pool[idx];
    }
  }
  return null;
}

// Try to assign one record to a team. Returns true if assigned.
function tryAssign(state, rec) {
  const pool = ROUTING_TABLE[rec.routingKey];
  let teamId = null;
  let decision = null;

  if (rec.priority === "H") {
    // Priority override: least-loaded in own pool, else least-loaded of ANY team
    teamId = pickFromPool(state, rec.routingKey, pool, true);
    decision = "PRIORITY_OVERRIDE";
    if (!teamId) {
      teamId = pickFromPool(state, "ALL", LEVEL1_IDS, true);
      decision = "PRIORITY_OVERRIDE_BACKUP";
    }
  } else {
    teamId = pickFromPool(state, rec.routingKey, pool, false);
    decision = "ROUND_ROBIN";
  }

  // Everything full or unavailable: escalate to Level-2
  if (!teamId && canTake(state.teams[LEVEL2.id])) {
    teamId = LEVEL2.id;
    decision = "ESCALATED_LEVEL2";
  }

  if (!teamId) return false;

  state.teams[teamId].load++;
  rec.assignedTo = teamId;
  rec.status = "Assigned";
  rec.decision = decision;
  rec.assignedAt = new Date().toISOString();
  return true;
}

// Deterministic queue order: priority, then submission time, then sequence number
function sortQueue(queue) {
  queue.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.submittedAt.localeCompare(b.submittedAt) ||
      a.seq - b.seq
  );
}

// Called whenever capacity frees up: place waiting reports in queue order
function processWaitingQueue(state) {
  const stillWaiting = [];
  for (const rec of state.waitingQueue) {
    if (tryAssign(state, rec)) rec.wasQueued = true;
    else stillWaiting.push(rec);
  }
  state.waitingQueue = stillWaiting;
}

// MAIN ENTRY: validate -> classify -> routing-table lookup -> assign / queue
function dispatch(state, input) {
  const { reportId, ticketId, description = "" } = input;
  const submittedAt = input.submittedAt || new Date().toISOString();

  // Duplicate prevention
  if (state.reports[reportId]) {
    return { outcome: "REJECTED", reason: `Duplicate report ID ${reportId}: already dispatched.` };
  }

  // Malformed identifier: rejected BEFORE dispatch
  const v = validateTicket(ticketId);
  if (!v.valid) return { outcome: "REJECTED", reason: v.message };

  // The routing key is extracted only from the validated ticket
  const { dept, issue, priority } = v.parts;
  const c = classify(issue, description);

  const rec = {
    reportId, ticketId, dept, issue, priority, description, submittedAt,
    seq: ++state.seq,
    category: c.category,
    zone: DEPT_ZONE[dept] || null,
    routingKey: null,
    status: "Pending",
    assignedTo: null,
    decision: null,
    reason: "",
  };
  state.reports[reportId] = rec;

  // Unmapped issue code: correction queue (never silently given a category)
  if (c.category === null) {
    rec.decision = "CORRECTION_QUEUE";
    rec.reason = c.reason;
    state.correctionQueue.push(rec);
    return { outcome: rec.decision, record: rec };
  }

  // Unknown zone: correction queue
  if (!rec.zone) {
    rec.decision = "CORRECTION_QUEUE";
    rec.reason = `Unknown department/zone '${dept}'. Sent to correction queue.`;
    state.correctionQueue.push(rec);
    return { outcome: rec.decision, record: rec };
  }

  rec.routingKey = `${rec.zone}:${rec.category}`;

  if (tryAssign(state, rec)) {
    rec.reason = `Routed via ${rec.routingKey} -> ${rec.assignedTo} (${rec.decision}).`;
    return { outcome: rec.decision, record: rec };
  }

  // Nobody can take it: waiting queue
  rec.decision = "WAITING_QUEUE";
  rec.reason = "All eligible teams and Level-2 are full or unavailable.";
  state.waitingQueue.push(rec);
  sortQueue(state.waitingQueue);
  return { outcome: rec.decision, record: rec };
}

// Status changes: Assigned -> In Progress -> Resolved (no skipping)
function startWork(state, reportId) {
  const rec = state.reports[reportId];
  if (!rec) return { ok: false, error: "Report not found." };
  if (rec.status !== "Assigned")
    return { ok: false, error: `Cannot start work: status is ${rec.status}.` };
  rec.status = "In Progress";
  return { ok: true, record: rec };
}

function resolveReport(state, reportId) {
  const rec = state.reports[reportId];
  if (!rec) return { ok: false, error: "Report not found." };
  if (rec.status !== "In Progress")
    return { ok: false, error: `Cannot resolve: status is ${rec.status}.` };
  rec.status = "Resolved";
  rec.resolvedAt = new Date().toISOString();
  state.teams[rec.assignedTo].load--;
  processWaitingQueue(state); // freed capacity may let a waiting report in
  return { ok: true, record: rec };
}

// Handler dashboard controls
function setAvailability(state, teamId, available) {
  state.teams[teamId].available = available;
  if (available) processWaitingQueue(state);
}

function setCapacity(state, teamId, capacity) {
  state.teams[teamId].capacity = capacity;
  processWaitingQueue(state);
}

module.exports = {
  createState, dispatch, startWork, resolveReport,
  setAvailability, setCapacity, processWaitingQueue, sortQueue,
};