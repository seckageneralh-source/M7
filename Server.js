require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* =========================
   TREASURY LEDGER (CORE)
========================= */

const treasury = {
  revenue: 0,
  users: {}, // apiKey -> user
  transactions: []
};

/* =========================
   CONSTANTS
========================= */

const PRICE_PER_REQUEST = 0.99;
const CREDITS_PER_PURCHASE = 1;

/* =========================
   API KEY GENERATOR
========================= */

function generateApiKey() {
  return crypto.randomBytes(24).toString("hex");
}

/* =========================
   DASHBOARD (MATTE BLACK UI)
========================= */

app.get("/", (req, res) => {
  res.send(`
  <html>
  <body style="margin:0;background:#0A0A0A;color:white;font-family:Arial">

    <div style="padding:20px;background:#111111;border:1px solid #1A1A2E;margin:20px;">
      <h1 style="color:#0066FF">M7 PHASE 100 DASHBOARD</h1>
      <p>Revenue: <span style="color:#00FF88">$${treasury.revenue.toFixed(2)}</span></p>
      <p>Users: ${Object.keys(treasury.users).length}</p>
    </div>

    <div style="padding:20px;background:#111111;border:1px solid #1A1A2E;margin:20px;">
      <h2>Create API Key</h2>
      <form action="/create-user" method="POST">
        <button style="background:#0066FF;color:white;padding:10px;border:none">
          Generate Key + Buy Access
        </button>
      </form>
    </div>

    <div style="padding:20px;background:#111111;border:1px solid #1A1A2E;margin:20px;">
      <h2>Route Funds</h2>
      <form action="/route-funds" method="POST">
        <button style="background:#00A3FF;color:white;padding:10px;border:none">
          Send to Stripe Payout
        </button>
      </form>
    </div>

  </body>
  </html>
  `);
});

/* =========================
   CREATE USER + STRIPE CHECKOUT
========================= */

app.post("/create-user", async (req, res) => {
  const apiKey = generateApiKey();

  treasury.users[apiKey] = {
    credits: 0
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "M7 API Credit (1 request)"
          },
          unit_amount: 99
        },
        quantity: 1
      }
    ],
    success_url: `${process.env.BASE_URL}/success?key=${apiKey}`,
    cancel_url: `${process.env.BASE_URL}/cancel`
  });

  res.redirect(session.url);
});

/* =========================
   PAYMENT SUCCESS
========================= */

app.get("/success", (req, res) => {
  const key = req.query.key;

  if (!treasury.users[key]) {
    return res.send("Invalid user");
  }

  treasury.users[key].credits += CREDITS_PER_PURCHASE;

  res.send(`
    <h2>Payment Successful</h2>
    <p>Your API Key:</p>
    <code>${key}</code>
    <p>Credits added: ${CREDITS_PER_PURCHASE}</p>
  `);
});

/* =========================
   M7 API (CORE ENGINE)
========================= */

app.post("/api/m7", (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (!treasury.users[apiKey]) {
    return res.status(403).json({ error: "Invalid API Key" });
  }

  if (treasury.users[apiKey].credits <= 0) {
    return res.status(402).json({ error: "No credits. Please purchase access." });
  }

  // consume credit
  treasury.users[apiKey].credits -= 1;

  // ledger update
  treasury.revenue += PRICE_PER_REQUEST;
  treasury.transactions.push({
    apiKey,
    amount: PRICE_PER_REQUEST,
    time: Date.now()
  });

  res.json({
    success: true,
    message: "M7 executed",
    remainingCredits: treasury.users[apiKey].credits
  });
});

/* =========================
   ROUTE FUNDS (STRIPE PAYOUT)
========================= */

app.post("/route-funds", async (req, res) => {
  try {
    const payout = await stripe.payouts.create({
      amount: Math.floor(treasury.revenue * 100),
      currency: "usd"
    });

    treasury.revenue = 0;

    res.send("Funds routed via Stripe payout system.");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("M7 Phase 100 running on port", PORT);
});
