const { validateTicket } = require("./validateTicket");

const samples = [
  "IT-101-H",   // valid
  "hr-202-m",   // valid (lowercase dept allowed)
  "NW-999-L",   // valid
  "IT-1-H",     // too few digits
  "IT-1011-H",  // too many digits
  "IT101H",     // missing dashes
  "IT-101-X",   // bad priority
  "IT-101-h",   // lowercase priority
  "I-101-H",    // 1-letter dept
  "12-101-H",   // digits in dept
  "IT-101-H ",  // trailing space
  "",           // empty
];

for (const s of samples) {
  const r = validateTicket(s);
  console.log(
    `"${s}"`.padEnd(14),
    r.valid ? "VALID  " : "INVALID",
    "| agree:", r.agree,
    "|", r.message
  );
}