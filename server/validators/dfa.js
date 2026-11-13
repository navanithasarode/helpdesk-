const START = "q0";
const ACCEPT_STATES = new Set(["q8"]);
const DEAD = "dead";

const isAlpha = (c) => /^[A-Za-z]$/.test(c);
const isDigit = (c) => /^[0-9]$/.test(c);

// Transition function: for each state, given a character, return the next state
const transitions = {
  q0: (c) => (isAlpha(c) ? "q1" : DEAD),
  q1: (c) => (isAlpha(c) ? "q2" : DEAD),
  q2: (c) => (c === "-" ? "q3" : DEAD),
  q3: (c) => (isDigit(c) ? "q4" : DEAD),
  q4: (c) => (isDigit(c) ? "q5" : DEAD),
  q5: (c) => (isDigit(c) ? "q6" : DEAD),
  q6: (c) => (c === "-" ? "q7" : DEAD),
  q7: (c) => (c === "H" || c === "M" || c === "L" ? "q8" : DEAD),
  q8: () => DEAD, // nothing is allowed after a complete ticket
};

// Used to build meaningful error messages
const expected = {
  q0: "a letter (1st letter of the 2-letter department code)",
  q1: "a letter (2nd letter of the 2-letter department code)",
  q2: "'-' after the department code",
  q3: "a digit (1st of 3 issue digits)",
  q4: "a digit (2nd of 3 issue digits)",
  q5: "a digit (3rd of 3 issue digits)",
  q6: "'-' after the 3-digit issue code",
  q7: "priority H, M or L (uppercase)",
  q8: "end of ticket (no extra characters)",
};

function runDFA(input) {
  if (typeof input !== "string" || input.length === 0) {
    return { accepted: false, finalState: START, trace: [], error: "Ticket ID is empty." };
  }

  let state = START;
  const trace = []; // step-by-step record, handy for the "DFA simulation" demo

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = transitions[state](ch);
    trace.push({ from: state, char: ch, to: next });

    if (next === DEAD) {
      const error =
        state === "q8"
          ? `Unexpected extra character '${ch}' at position ${i + 1}: ticket should end after the priority.`
          : `Invalid character '${ch}' at position ${i + 1}: expected ${expected[state]}.`;
      return { accepted: false, finalState: DEAD, trace, error };
    }
    state = next;
  }

  if (ACCEPT_STATES.has(state)) {
    return { accepted: true, finalState: state, trace, error: null };
  }
  return {
    accepted: false,
    finalState: state,
    trace,
    error: `Incomplete ticket: expected ${expected[state]}.`,
  };
}

module.exports = { runDFA };