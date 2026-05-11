const cron = require("node-cron");
const fetch = require("node-fetch");

const FIREBASE_URL     = "https://florrie-s-tracker-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SECRET  = "Yh9mPzEnEXR8MBW5AOzBavcLoGWuujKWmW41qSKg";
const ONESIGNAL_APP_ID = "b75dbfaa-fa6e-467e-88c4-8828565c5ffe";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

function getStartOfDayUK() {
  var now = new Date();
  var ukOffset = isDST(now) ? 60 : 0;
  var ukNow = new Date(now.getTime() + ukOffset * 60000);
  ukNow.setHours(0, 0, 0, 0);
  return ukNow.getTime() - ukOffset * 60000;
}

function isDST(date) {
  var jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  var jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}

async function checkAndNotify() {
  console.log("Checking if anything logged today...");
  try {
    var startOfDay = getStartOfDayUK();
    var res = await fetch(FIREBASE_URL + "/logs.json?auth=" + FIREBASE_SECRET);
    var data = await res.json();
    var loggedToday = false;
    if (data && typeof data === "object") {
      loggedToday = Object.values(data).some(function(log) {
        return log.timestamp && log.timestamp >= startOfDay;
      });
    }
    console.log("Logged today:", loggedToday, "| Start of day:", new Date(startOfDay).toISOString());
    if (!loggedToday) {
      await sendNotification();
    } else {
      console.log("Already logged today — no notification sent.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

async function sendNotification() {
  console.log("Sending notification...");
  try {
    var res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + ONESIGNAL_API_KEY
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["All"],
        headings: { en: "Florrie's Food Tracker 🌸" },
        contents: { en: "Nothing logged today! Don't forget to log Florrie's meals 🍼" },
        url: "https://florrietracker.pages.dev"
      })
    });
    var result = await res.json();
    console.log("Notification result:", JSON.stringify(result));
  } catch (err) {
    console.error("Send error:", err);
  }
}

// Schedule 7pm UK time
cron.schedule("0 19 * * *", function() {
  console.log("7pm UK check triggered");
  checkAndNotify();
}, { timezone: "Europe/London" });

// HTTP server with test endpoints
var http = require("http");
http.createServer(function(req, res) {
  res.setHeader("Content-Type", "text/plain");
  if (req.url === "/test") {
    res.writeHead(200);
    res.end("Running check — see Render logs for result.");
    checkAndNotify();
  } else if (req.url === "/force") {
    res.writeHead(200);
    res.end("Forcing notification now...");
    sendNotification();
  } else {
    res.writeHead(200);
    res.end("Florrie reminder running. Use /test or /force");
  }
}).listen(process.env.PORT || 3000, function() {
  console.log("Server started. Endpoints: /test /force");
});

console.log("Scheduler running — notifies at 7pm UK if nothing logged.");
