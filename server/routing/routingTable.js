// Department code -> zone. Anything not listed is an "unknown zone".
const DEPT_ZONE = {
  CS: "Zone-A", IT: "Zone-A", EC: "Zone-A", ME: "Zone-A", CE: "Zone-A",
  HR: "Zone-B", AD: "Zone-B", FN: "Zone-B", LB: "Zone-B",
};

// Four Level-1 helpdesk teams, each capped at 8 open tickets
const TEAMS = [
  { id: "T1", name: "Helpdesk Team 1", level: 1, capacity: 8 },
  { id: "T2", name: "Helpdesk Team 2", level: 1, capacity: 8 },
  { id: "T3", name: "Helpdesk Team 3", level: 1, capacity: 8 },
  { id: "T4", name: "Helpdesk Team 4", level: 1, capacity: 8 },
];

// Overflow team
const LEVEL2 = { id: "L2", name: "Level-2 Escalation Team", level: 2, capacity: 10 };

// The explicit routing table: "zone:category" -> teams that share the work (round-robin)
const ROUTING_TABLE = {
  "Zone-A:Hardware": ["T1", "T2"],
  "Zone-A:Software": ["T2", "T3"],
  "Zone-A:Network":  ["T3", "T4"],
  "Zone-A:Access":   ["T4", "T1"],
  "Zone-A:Other":    ["T1", "T2", "T3", "T4"],

  "Zone-B:Hardware": ["T3", "T4"],
  "Zone-B:Software": ["T4", "T1"],
  "Zone-B:Network":  ["T1", "T2"],
  "Zone-B:Access":   ["T2", "T3"],
  "Zone-B:Other":    ["T1", "T2", "T3", "T4"],
};

module.exports = { DEPT_ZONE, TEAMS, LEVEL2, ROUTING_TABLE };