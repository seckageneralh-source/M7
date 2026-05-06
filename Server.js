require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   STRIPE INITIALIZATION
========================= */

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* =========================
   TREASURY (INTERNAL LEDGER)
========================= */

const treasury = {
  revenue: 0,
  requests: 0,
  transactions: [],
  users: {}
};

/* =========================
   M7 PRICING MODEL
========================= */

const PRICE_PER_REQUEST = 0.99;

/* =========================
   DASHBOARD (MATTE BLACK UI)
========================= */

app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>M7 Dashboard</title>
    <style>
      body {
        margin: 0;
        font-family: Arial;
        background: #0A0A0A;
        color: white;
      }
      .panel {
        background: #111111;
        padding: 20px;
        margin: 20px;
        border: 1px solid #1A1A2E;
        border-radius: 10px;
      }
      .blue { color: #0066FF; }
      .green { color: #00FF88; }
      button {
        background: #0066FF;
        color: white;
        border: none;
        padding: 12px 20px;
        cursor: pointer;
        border-radius: 8px;
      }
      button:hover { background: #00A3FF; }
    </style>
  </head>

  <body>
    <div class="panel">
      <h1 class="blue">M7 TREASURY DASHBOARD</h1>
      <p>Revenue: <span class="green">$${treasury.revenue.toFixed(2)}</span></p>
      <p>Requests: ${treasury.requests}</p>
    </div>

    <div class="panel">
      <h2>Route Funds to Bank</h2>
      <form action="/route-funds" method="POST">
        <button type="submit">Route via Stripe</button>
      </form>
      <p style="color:#8899AA;">Funds go through Stripe payout system to your bank account</p>
    </div>

    <div class="panel">
      <h2>Buy Access ($0.99 per request)</h2>
      <form action="/checkout" method="POST">
        <button type="submit">Activate M7 Access</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

/* =========================
   STRIPE CHECKOUT SESSION
========================= */

app.post("/checkout", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "M7 Access Credit",
            },
            unit_amount: 99
          },
          quantity: 1
        }
      ],
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`
    });

    res.redirect(303, session.url);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* =========================
   PAYMENT SUCCESS HANDLER
========================= */

app.get("/success", (req, res) => {
  res.send("Payment successful. M7 access activated.");
});

/* =========================
   API REQUEST (M7 CORE)
========================= */

app.post("/api/m7", (req, res) => {
  const userId = req.body.userId || "anonymous";

  if (!treasury.users[userId]) {
    treasury.users[userId] = { credits: 0 };
  }

  if (treasury.users[userId].credits <= 0) {
    return res.status(402).json({
      error: "No credits. Please buy access."
    });
  }

  treasury.users[userId].credits -= 1;
  treasury.requests += 1;
  treasury.revenue += PRICE_PER_REQUEST;

  treasury.transactions.push({
    userId,
    amount: PRICE_PER_REQUEST,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    message: "M7 response executed",
    remainingCredits: treasury.users[userId].credits
  });
});

/* =========================
   ROUTE FUNDS (STRIPE PAYOUT)
========================= */

app.post("/route-funds", async (req, res) => {
  try {
    const balance = treasury.revenue;

    const payout = await stripe.payouts.create({
      amount: Math.floor(balance * 100),
      currency: "usd"
    });

    treasury.revenue = 0;

    res.send("Funds routed successfully via Stripe.");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`M7 running on port ${PORT}`);
});
