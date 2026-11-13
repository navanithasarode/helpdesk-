const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  level: Number,
  capacity: Number,
  available: { type: Boolean, default: true },
});

module.exports = mongoose.model("Team", teamSchema);