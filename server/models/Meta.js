const mongoose = require("mongoose");

const metaSchema = new mongoose.Schema(
  {
    _id: String,
    seq: Number,
    rrPointer: mongoose.Schema.Types.Mixed,
  },
  { minimize: false }
);

module.exports = mongoose.model("Meta", metaSchema);