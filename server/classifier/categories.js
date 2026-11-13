// Exactly five categories, as required by the problem statement
const CATEGORIES = ["Hardware", "Software", "Network", "Access", "Other"];

// Deterministic conflict rule: lower index wins when several categories match
const PRIORITY_ORDER = ["Network", "Access", "Hardware", "Software", "Other"];

// Issue code ranges (inclusive)
const CODE_MAP = [
  { from: 100, to: 199, category: "Hardware" },
  { from: 200, to: 299, category: "Software" },
  { from: 300, to: 399, category: "Network" },
  { from: 400, to: 499, category: "Access" },
  { from: 500, to: 599, category: "Other" },
];

// Keywords found in the description. "Other" has none: it comes only from its code.
const KEYWORDS = {
  Hardware: [/\blaptop\b/i, /\bcomputer\b/i, /\bpc\b/i, /\bkeyboard\b/i, /\bmouse\b/i,
             /\bmonitor\b/i, /\bscreen\b/i, /\bprinter\b/i, /\bbattery\b/i, /\bprojector\b/i],
  Software: [/\binstall(ed|ation|ing)?\b/i, /\bsoftware\b/i, /\blicen[sc]e\b/i, /\bupdate\b/i,
             /\bupgrade\b/i, /\bcrash(es|ed|ing)?\b/i, /\bmicrosoft\b/i, /\bantivirus\b/i],
  Network:  [/\bwi-?fi\b/i, /\binternet\b/i, /\bnetwork\b/i, /\blan\b/i, /\bvpn\b/i,
             /\brouter\b/i, /\boutage\b/i],
  Access:   [/\bpassword\b/i, /\blog ?in\b/i, /\baccount\b/i, /\blocked\b/i,
             /\bpermission\b/i, /\bcredentials?\b/i, /\botp\b/i],
  Other:    [],
};

module.exports = { CATEGORIES, PRIORITY_ORDER, CODE_MAP, KEYWORDS };