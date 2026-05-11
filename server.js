const cron = require("node-cron");
const fetch = require("node-fetch");

// ── Config ────────────────────────────────────────────────────────────────────
const FIREBASE_URL    = "https://florrie-s-tracker-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SECRET = "Yh9mPzEnEXR8MBW5AOzBavcLoGWuujKWmW41qSKg";
const ONESIGNAL_APP_ID = "b75dbfaa-fa6e-467e-88c4-8828565c5ffe";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY; // set in Render env vars

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStartOfDayUK() {
  // Get midnight UK time (GMT+1 BST / GMT+0 GMT)
  var now = new Date();
  var ukOffset = isDST(now) ? 60 : 0; // UK BST offset in minutes
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

    // Fetch all logs from Firebase
    var res = await fetch(
      FIREBASE_URL + "/logs.json?auth=" + FIREBASE_SECRET
    );
    var data = await res.json();

    // Check if anything logged today
    var loggedToday = false;
    if (data && typeof data === "object") {
      loggedToday = Object.values(data).some(function(log) {
        return log.timestamp && log.timestamp >= startOfDay;
      });
    }

    console.log("Logged today:", loggedToday);

    if (!loggedToday) {
      await sendNotification();
    } else {
      console.log("Already logged today — no notification sent.");
    }
  } catch (err) {
    console.error("Error checking logs:", err);
  }
}

async function sendNotification() {
  console.log("Sending notification...");

  var body = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["All"],
    headings: { en: "Florrie's Food Tracker 🌸" },
    contents: { en: "Nothing logged today! Don't forget to log Florrie's meals 🍼" },
    url: "https://florrietracker.pages.dev"
  };

  try {
    var res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + ONESIGNAL_API_KEY
      },
      body: JSON.stringify(body)
    });
    var result = await res.json();
    console.log("Notification sent:", JSON.stringify(result));
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
// Run at 7pm UK time every day
// Render runs on UTC so 7pm BST = 18:00 UTC (summer), 7pm GMT = 19:00 UTC (winter)
// Run at both to cover both seasons
cron.schedule("0 18 * * *", function() {
  console.log("7pm BST check triggered");
  checkAndNotify();
}, { timezone: "Europe/London" });

cron.schedule("0 19 * * *", function() {
  console.log("7pm GMT check triggered");
  checkAndNotify();
}, { timezone: "Europe/London" });

// ── Keep alive ────────────────────────────────────────────────────────────────
// Render free tier spins down after inactivity — this keeps it alive
var http = require("http");
http.createServer(function(req, res) {
  res.writeHead(200);
  res.end("Florrie reminder server running");
}).listen(process.env.PORT || 3000, function() {
  console.log("Florrie reminder server started");
});

console.log("Scheduler running — will notify at 7pm UK time if nothing logged");
