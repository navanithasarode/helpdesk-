const { PRIORITY_ORDER, CODE_MAP, KEYWORDS } = require("./categories");

function classify(issueCode, description = "") {
  // Guard: issue code must be exactly 3 digits (the validator should already ensure this)
  if (!/^\d{3}$/.test(String(issueCode))) {
    return {
      category: null,
      needsReview: true,
      conflict: false,
      candidates: [],
      reason: `Issue code '${issueCode}' is not a 3-digit code.`,
    };
  }

  const n = parseInt(issueCode, 10);
  const range = CODE_MAP.find((r) => n >= r.from && n <= r.to);

  // Unmapped code: do NOT silently assign a category
  if (!range) {
    return {
      category: null,
      needsReview: true,
      conflict: false,
      candidates: [],
      reason: `Issue code ${issueCode} is not mapped to any category. Sent for manual review.`,
    };
  }

  // Collect candidate categories: one from the code, plus any from keywords
  const candidates = new Set([range.category]);
  const matchedKeywordCategories = [];
  for (const [category, patterns] of Object.entries(KEYWORDS)) {
    if (patterns.some((p) => p.test(description))) {
      candidates.add(category);
      matchedKeywordCategories.push(category);
    }
  }

  // Deterministic priority rule: first match in PRIORITY_ORDER wins
  const category = PRIORITY_ORDER.find((c) => candidates.has(c));
  const conflict = candidates.size > 1;

  return {
    category,
    needsReview: false,
    conflict,
    candidates: PRIORITY_ORDER.filter((c) => candidates.has(c)),
    reason: conflict
      ? `Multiple categories matched (${[...candidates].join(", ")}). Priority rule picked ${category}.`
      : `Matched ${category} from issue code ${issueCode}.`,
  };
}

module.exports = { classify };