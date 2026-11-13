const BASE = "http://localhost:5000/api";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

let pass = 0, fail = 0;
function check(label, cond) {
  console.log(cond ? "PASS" : "FAIL", "-", label);
  cond ? pass++ : fail++;
}

(async () => {
  const before = (await call("GET", "/stats")).data;
  console.log("Stats before:", before);

  // Create three reports: priority override, normal, and unknown department
  const a = await call("POST", "/reports", { ticketId: "IT-101-H", description: "Laptop dead", reporterName: "Test" });
  const b = await call("POST", "/reports", { ticketId: "HR-401-L", description: "Password reset", reporterName: "Test" });
  const c = await call("POST", "/reports", { ticketId: "XX-101-M", description: "Unknown dept", reporterName: "Test" });
  const idA = a.data.report.reportId, idB = b.data.report.reportId, idC = c.data.report.reportId;
  const teamA = a.data.report.assignedTo;
  console.log("Created:", idA, "->", teamA, "|", idB, "->", b.data.report.assignedTo, "|", idC, "->", c.data.outcome);

  console.log("\n--- User Dashboard ---");
  const after = (await call("GET", "/stats")).data;
  console.log("Stats after:", after);
  check("total went up by 3", after.total === before.total + 3);
  check("assigned went up by 2", after.assigned === before.assigned + 2);
  check("pending went up by 1", after.pending === before.pending + 1);
  check("counts add up to total",
    after.pending + after.assigned + after.inProgress + after.resolved === after.total);
  const list = (await call("GET", "/reports?status=Assigned")).data.reports;
  check("status filter only returns Assigned", list.length > 0 && list.every((r) => r.status === "Assigned"));

  console.log("\n--- Handler Dashboard ---");
  const hr = (await call("GET", `/handlers/${teamA}/reports`)).data;
  const mine = hr.reports.find((r) => r.reportId === idA);
  check(`${teamA} sees ${idA}`, !!mine);
  check("report shows category, zone, priority, submission time",
    mine && mine.category && mine.zone && mine.priority && mine.submittedAt);

  console.log("\n--- Routing Dashboard ---");
  const rt = (await call("GET", "/routing")).data;
  check("routing table has 10 rows (2 zones x 5 categories)", rt.routingTable.length === 10);
  check("5 handlers listed", rt.handlers.length === 5);
  check("unknown-dept report is in the correction queue", rt.correctionQueue.some((r) => r.reportId === idC));
  check("H ticket shows as a priority override",
    rt.priorityOverrides.some((r) => r.reportId === idA) ||
    rt.backupAssignments.some((r) => r.reportId === idA));

  console.log("\n--- Analytics Dashboard ---");
  const an = (await call("GET", "/analytics")).data;
  console.log("By zone:", an.byZone.map((z) => `${z.name}=${z.total}`).join(", "));
  console.log("By category:", an.byCategory.map((z) => `${z.name}=${z.total}`).join(", "));
  check("resolved + unresolved = total", an.resolved + an.unresolved === an.total);
  check("zone totals add up", an.byZone.reduce((s, z) => s + z.total, 0) === an.total);
  check("category totals add up", an.byCategory.reduce((s, z) => s + z.total, 0) === an.total);
  check("Unknown zone group exists", an.byZone.some((z) => z.name === "Unknown zone"));

  // Clean up the two assigned reports so team loads go back down
  for (const id of [idA, idB]) {
    await call("PATCH", `/reports/${id}/status`, { status: "In Progress" });
    await call("PATCH", `/reports/${id}/status`, { status: "Resolved" });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(`(${idC} stays in the correction queue by design.)`);
})();