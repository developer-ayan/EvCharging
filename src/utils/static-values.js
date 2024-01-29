const { DATE_FORMATE } = require("./urls");
const moment = require("moment-timezone");

const time_zone = "Asia/Karachi";
const created_at = moment(new Date()).tz(time_zone).format(DATE_FORMATE) + " " + moment(new Date()).tz(time_zone).format("hh:mm A");

module.exports = { created_at, time_zone };