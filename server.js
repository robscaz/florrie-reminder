const cron = require("node-cron");
const fetch = require("node-fetch");

const FIREBASE_URL     = "https://florrie-s-tracker-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SECRET  = "Yh9mPzEnEXR8MBW5AOzBavcLoGWuujKWmW41qSKg";
const ONESIGNAL_APP_ID = "b75dbfaa-fa6e-467e-88c4-8828565c5ffe";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

// Get today's date string in UK time e.g. "2026-05-30"
function getTodayUK() {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).split("/").reverse().join("-"); // converts "30/05/2026" to "2026-05-30"
}

// Get the date string for a timestamp
function getDateUK(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).split("/").reverse().join("-");
}

async function checkAndNotify() {
  var today = getTodayUK();
  console.log("Checking logs for today:", today);

  try {
    var res = await fetch(FIREBASE_URL + "/logs.json?auth=" + FIREBASE_SECRET);
    var data = await res.json();

    var loggedToday = false;
    if (data && typeof data === "object") {
      loggedToday = Object.values(data).some(function(log) {
        if (!log.timestamp) return false;
        return getDateUK(log.timestamp) === today;
      });
    }

    console.log("Logged today:", loggedToday, "| Today is:", today);

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
    console.log("Notification sent:", JSON.stringify(result));
  } catch (err) {
    console.error("Error sending notification:", err);
  }
}

// Schedule 7pm UK time every day
cron.schedule("0 19 * * *", function() {
  console.log("7pm UK check triggered");
  checkAndNotify();
}, { timezone: "Europe/London" });

// HTTP server
var http = require("http");
http.createServer(function(req, res) {
  res.setHeader("Content-Type", "text/plain");
  if (req.url === "/test") {
    res.writeHead(200);
    res.end("Running check — see Render logs.");
    checkAndNotify();
  } else if (req.url === "/force") {
    res.writeHead(200);
    res.end("Forcing notification now...");
    sendNotification();
  } else {
    res.writeHead(200);
    res.end("Florrie reminder running. Endpoints: /test /force");
  }
}).listen(process.env.PORT || 3000, function() {
  console.log("Server started. Endpoints: /test /force");
});

console.log("Scheduler running — notifies at 7pm UK if nothing logged.");
