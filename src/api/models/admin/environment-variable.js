const mongoose = require("mongoose");
const { created_at } = require("../../../utils/static-values");

const environmentVariable = new mongoose.Schema({
  minimun_amount_for_charging: {
    type: String,
    required: true,
    trim: true,
  },
});

const EnvironmentVariable = mongoose.model(
  "environment_variable",
  environmentVariable
);

module.exports = EnvironmentVariable;
