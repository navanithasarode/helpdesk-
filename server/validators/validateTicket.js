const { runDFA } = require("./dfa");
const { runRegex } = require("./regex");

function validateTicket(ticketId) {
  const dfa = runDFA(ticketId);
  const regex = runRegex(ticketId);
  const agree = dfa.accepted === regex.accepted;

  const result = {
    valid: dfa.accepted && regex.accepted,
    dfaAccepted: dfa.accepted,
    regexAccepted: regex.accepted,
    agree,
    message: dfa.accepted ? "Valid ticket format." : dfa.error,
    trace: dfa.trace,
  };

  if (result.valid) {
    const [dept, issue, priority] = ticketId.split("-");
    result.parts = { dept: dept.toUpperCase(), issue, priority };
  }
  return result;
}

module.exports = { validateTicket };