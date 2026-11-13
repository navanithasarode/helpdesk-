const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true },
  seq: Number,

  // Original report as submitted
  reporterName: String,
  reporterEmail: String,
  ticketId: { type: String, required: true },
  description: { type: String, default: "" },
  urgency: { type: String, default: "Normal" },

  // Parsed from the validated ticket
  dept: String,
  issue: String,
  priority: String,

  // Validation outcome, stored with the report
  validation: {
    valid: Boolean,
    dfaAccepted: Boolean,
    regexAccepted: Boolean,
    agree: Boolean,
    message: String,
  },

  // Classification, stored with the report
  category: { type: String, default: null },
  classification: {
    conflict: Boolean,
    candidates: [String],
    reason: String,
  },

  // Routing and status
  zone: String,
  routingKey: String,
  status: { type: String, default: "Pending" },
  assignedTo: { type: String, default: null },
  decision: String,
  reason: String,
  wasQueued: Boolean,

  // Dates are ISO strings because the dispatcher sorts them as text
  submittedAt: String,
  assignedAt: String,
  resolvedAt: String,
});

module.exports = mongoose.model("Report", reportSchema);