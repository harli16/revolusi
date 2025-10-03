const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    aktivitas: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
