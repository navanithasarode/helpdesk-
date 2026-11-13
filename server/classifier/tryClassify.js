const { classify } = require("./classify");

const samples = [
  ["101", "Laptop will not turn on"],
  ["201", "Need Microsoft Office installed"],
  ["301", "WiFi is down in lab 4"],
  ["401", "Forgot my password, account locked"],
  ["501", "Request for new chair"],
  ["101", "Laptop cannot connect to WiFi"],            // conflict: Hardware + Network
  ["201", "Cannot login after software update"],       // conflict: Software + Access
  ["301", "VPN login failed"],                         // conflict: Network + Access
  ["999", "Something broke"],                          // unmapped code
  ["000", "laptop"],                                   // unmapped code
  ["501", ""],                                         // empty description
];

for (const [code, desc] of samples) {
  const r = classify(code, desc);
  console.log(
    `${code} | "${desc}"`.padEnd(48),
    "->", String(r.category).padEnd(9),
    "| conflict:", String(r.conflict).padEnd(5),
    "| review:", r.needsReview
  );
}