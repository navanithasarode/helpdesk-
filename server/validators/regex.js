const TICKET_REGEX = /^[A-Za-z]{2}-\d{3}-[HML]$/;

function runRegex(input) {
  const accepted = typeof input === "string" && TICKET_REGEX.test(input);
  return { accepted };
}

module.exports = { runRegex, TICKET_REGEX };