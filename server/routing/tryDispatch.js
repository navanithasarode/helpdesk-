const {
  createState, dispatch, startWork, resolveReport, setAvailability,
} = require("./dispatcher");

function show(label, r) {
  if (r.outcome === "REJECTED") {
    console.log(label.padEnd(36), "REJECTED".padEnd(26), "->", r.reason);
  } else {
    console.log(
      label.padEnd(36), r.outcome.padEnd(26), "->",
      (r.record.assignedTo || "-").padEnd(4), "|", r.record.status
    );
  }
}

let n = 0;
const id = () => `R${++n}`;

console.log("\n--- 1. Round-robin (Zone-A Hardware: T1,T2) ---");
let s = createState();
for (let i = 1; i <= 4; i++)
  show(`IT-101-M #${i}`, dispatch(s, { reportId: id(), ticketId: "IT-101-M" }));

console.log("\n--- 2. Department changes the pool ---");
s = createState();
show("HR-301-M (Zone-B Network)", dispatch(s, { reportId: id(), ticketId: "HR-301-M" }));
show("IT-301-M (Zone-A Network)", dispatch(s, { reportId: id(), ticketId: "IT-301-M" }));

console.log("\n--- 3. Exceptions ---");
s = createState();
show("XX-101-M (unknown zone)", dispatch(s, { reportId: id(), ticketId: "XX-101-M" }));
show("IT-999-M (unmapped code)", dispatch(s, { reportId: id(), ticketId: "IT-999-M" }));
show("IT-1-H (malformed)", dispatch(s, { reportId: id(), ticketId: "IT-1-H" }));
const dupId = id();
show("IT-101-M (first time)", dispatch(s, { reportId: dupId, ticketId: "IT-101-M" }));
show("IT-101-M (same report ID again)", dispatch(s, { reportId: dupId, ticketId: "IT-101-M" }));

console.log("\n--- 4. Capacity overflow, Level-2, waiting queue ---");
s = createState();
const first = "OV1";
for (let i = 1; i <= 16; i++)
  dispatch(s, { reportId: i === 1 ? first : `OV${i}`, ticketId: "IT-101-M" });
console.log("T1 load:", s.teams.T1.load, "| T2 load:", s.teams.T2.load);
show("17th ticket (pool full)", dispatch(s, { reportId: "OV17", ticketId: "IT-101-M" }));
for (let i = 18; i <= 26; i++) dispatch(s, { reportId: `OV${i}`, ticketId: "IT-101-M" });
console.log("L2 load:", s.teams.L2.load);
show("27th ticket (L2 full too)", dispatch(s, { reportId: "OV27", ticketId: "IT-101-M" }));
startWork(s, first);
resolveReport(s, first);
console.log("After resolving OV1 -> OV27 is now:", s.reports.OV27.status, "on", s.reports.OV27.assignedTo);

console.log("\n--- 5. Priority override and unavailable handlers ---");
s = createState();
show("IT-101-H (all teams free)", dispatch(s, { reportId: id(), ticketId: "IT-101-H" }));
setAvailability(s, "T1", false);
setAvailability(s, "T2", false);
show("IT-101-M (T1,T2 down)", dispatch(s, { reportId: id(), ticketId: "IT-101-M" }));
show("IT-101-H (T1,T2 down)", dispatch(s, { reportId: id(), ticketId: "IT-101-H" }));

console.log("\n--- 6. Queue ordering ---");
s = createState();
for (const t of ["T1", "T2", "T3", "T4", "L2"]) setAvailability(s, t, false);
dispatch(s, { reportId: "Q1", ticketId: "IT-101-L", submittedAt: "2026-11-13T10:00:00Z" });
dispatch(s, { reportId: "Q2", ticketId: "IT-101-H", submittedAt: "2026-11-13T10:00:01Z" });
dispatch(s, { reportId: "Q3", ticketId: "IT-101-M", submittedAt: "2026-11-13T10:00:02Z" });
dispatch(s, { reportId: "Q4", ticketId: "IT-101-H", submittedAt: "2026-11-13T10:00:03Z" });
console.log("Queue order:", s.waitingQueue.map((r) => `${r.reportId}(${r.priority})`).join(" -> "));

console.log("\n--- 7. Status rules ---");
s = createState();
dispatch(s, { reportId: "S1", ticketId: "IT-101-M" });
console.log("Resolve before starting:", resolveReport(s, "S1").error);
console.log("Start work:", startWork(s, "S1").record.status);
console.log("Resolve:", resolveReport(s, "S1").record.status);