const BASE = "http://localhost:5000/api";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function finish(id) {
  await call("PATCH", `/reports/${id}/status`, { status: "In Progress" });
  await call("PATCH", `/reports/${id}/status`, { status: "Resolved" });
}

(async () => {
  console.log("\n--- 1. Live validation preview ---");
  let r = await call("POST", "/validate", { ticketId: "IT-101-H", description: "Laptop cannot connect to WiFi" });
  console.log(r.status, "valid:", r.data.valid, "| category:", r.data.category, "| zone:", r.data.zone, "| key:", r.data.routingKey);
  r = await call("POST", "/validate", { ticketId: "IT-101-X" });
  console.log(r.status, "valid:", r.data.valid, "|", r.data.message);

  console.log("\n--- 2. Submit a valid report ---");
  r = await call("POST", "/reports", {
    reporterName: "Asha", reporterEmail: "asha@college.edu",
    ticketId: "IT-101-M", description: "Laptop will not turn on", urgency: "Normal",
  });
  if (!r.data.report) { console.log(r.status, r.data); process.exit(1); }
  const id = r.data.report.reportId;
  console.log(r.status, id, r.data.outcome, "->", r.data.report.assignedTo, "|", r.data.report.status);

  console.log("\n--- 3. Malformed ticket is rejected ---");
  r = await call("POST", "/reports", { ticketId: "IT101H", description: "x" });
  console.log(r.status, "ok:", r.data.ok, "|", r.data.reason);

  console.log("\n--- 4. Search by report ID ---");
  r = await call("GET", `/reports/${id}`);
  console.log(r.status, r.data.report.reportId, "| status:", r.data.report.status,
    "| handler:", r.data.assignedHandler, "| category:", r.data.report.category);

  console.log("\n--- 5. Status rules ---");
  r = await call("PATCH", `/reports/${id}/status`, { status: "Resolved" });
  console.log("Resolve before starting:", r.status, r.data.error);
  r = await call("PATCH", `/reports/${id}/status`, { status: "In Progress" });
  console.log("Start work:", r.status, r.data.record.status);
  r = await call("PATCH", `/reports/${id}/status`, { status: "Resolved" });
  console.log("Resolve:", r.status, r.data.record.status);

  console.log("\n--- 6. Handlers ---");
  r = await call("GET", "/handlers");
  r.data.handlers.forEach((h) =>
    console.log(h.id, h.name.padEnd(26), "load:", h.load, "/", h.capacity, "| available:", h.available));

  console.log("\n--- 7. Five simultaneous reports ---");
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map(() =>
      call("POST", "/reports", { ticketId: "IT-201-M", description: "Install software" })
    )
  );
  const ids = results.map((x) => x.data.report.reportId);
  console.log("IDs:", ids.join(", "));
  console.log("All unique:", ids.length === new Set(ids).size);
  console.log("Teams used:", results.map((x) => x.data.report.assignedTo).join(", "));

  console.log("\n--- 8. Unavailable handler is skipped ---");
  await call("PATCH", "/handlers/T1", { available: false });
  r = await call("POST", "/reports", { ticketId: "IT-101-M", description: "Monitor broken" });
  console.log("T1 down, Zone-A Hardware ->", r.data.report.assignedTo, "(", r.data.outcome, ")");
  ids.push(r.data.report.reportId);
  await call("PATCH", "/handlers/T1", { available: true });

  console.log("\n--- Cleaning up test reports ---");
  for (const x of ids) await finish(x);
  console.log("Done.");
})();