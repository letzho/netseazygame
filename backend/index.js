// index.js (backend root)
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const pool = require("./db");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3002;

// ---- Safety: surface boot errors in logs
process.on("unhandledRejection", (r) => console.error("UNHANDLED REJECTION:", r));
process.on("uncaughtException", (e) => { console.error("UNCAUGHT EXCEPTION:", e); process.exit(1); });

// ---- OpenAI (guarded so missing key won’t crash boot)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } else {
    console.warn("OPENAI_API_KEY not set; /api/ai-response will return 503.");
  }
} catch (e) {
  console.error("OpenAI init failed:", e.message);
}

// ---- Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://eazygamepay-52b0185fda6d.herokuapp.com",
    "https://eazygamepay-frontend.herokuapp.com",
    "https://netseazygame-0dd1ff80b2d1.herokuapp.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors()); // preflight
app.use(express.json());

// ---- Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- Static: serve SPA built into /eazygame/dist (ONE source of truth)
const clientBuild = path.join(__dirname, "eazygame", "dist");
app.use(express.static(clientBuild));

// ---- API ROUTES -------------------------------------------------------------

// DB connectivity test
app.get("/api/test-db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "Database connected successfully!", timestamp: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed", details: error.message });
  }
});

// Schema check
app.get("/api/db-schema", async (_req, res) => {
  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users','cards','transactions')
      ORDER BY table_name
    `);
    const tableNames = tablesResult.rows.map(r => r.table_name);

    const schemaInfo = {};
    for (const t of tableNames) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t]);
      schemaInfo[t] = cols.rows;
    }

    const counts = {};
    for (const t of tableNames) {
      const c = await pool.query(`SELECT COUNT(*) FROM ${t}`);
      counts[t] = parseInt(c.rows[0].count, 10);
    }

    res.json({ tables_exist: tableNames, schema: schemaInfo, record_counts: counts, all_tables_present: tableNames.length === 3 });
  } catch (error) {
    res.status(500).json({ error: "Schema check failed", details: error.message });
  }
});

// Auth (demo)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND password_hash = $2",
      [username, password]
    );
    if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid username or password" });

    const user = userResult.rows[0];
    const cardsResult = await pool.query("SELECT * FROM cards WHERE user_id = $1", [user.id]);
    const cardIds = cardsResult.rows.map(c => c.id);
    let transactions = [];
    if (cardIds.length > 0) {
      const tx = await pool.query("SELECT * FROM transactions WHERE card_id = ANY($1::int[])", [cardIds]);
      transactions = tx.rows;
    }
    res.json({ user: { id: user.id, username: user.username }, cards: cardsResult.rows, transactions });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// Cards + transactions
app.get("/api/cards", async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: "Missing user_id" });
  try {
    const r = await pool.query("SELECT * FROM cards WHERE user_id = $1", [userId]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch cards", details: err.message });
  }
});

app.get("/api/transactions", async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: "Missing user_id" });
  try {
    const cards = await pool.query("SELECT id FROM cards WHERE user_id = $1", [userId]);
    const cardIds = cards.rows.map(c => c.id);
    let transactions = [];
    if (cardIds.length > 0) {
      const tx = await pool.query("SELECT * FROM transactions WHERE card_id = ANY($1::int[])", [cardIds]);
      transactions = tx.rows;
    }
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions", details: err.message });
  }
});

app.post("/api/cards", async (req, res) => {
  const { user_id, number, holder, expiry, design } = req.body;
  if (!user_id || !number || !holder || !expiry) return res.status(400).json({ error: "Missing required fields" });
  try {
    const r = await pool.query(
      "INSERT INTO cards (user_id, number, holder, expiry, balance, design) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [user_id, number, holder, expiry, 0, design || "netscard1"]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to add card", details: err.message });
  }
});

app.post("/api/cards/topup", async (req, res) => {
  const { card_id, amount } = req.body;
  if (!card_id || !amount) return res.status(400).json({ error: "Missing card_id or amount" });
  try {
    const cardCheck = await pool.query("SELECT * FROM cards WHERE id = $1", [card_id]);
    if (cardCheck.rows.length === 0) return res.status(404).json({ error: "Card not found" });

    const updated = await pool.query("UPDATE cards SET balance = balance + $1 WHERE id = $2 RETURNING *", [amount, card_id]);
    const tx = await pool.query(
      "INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1,$2,NOW(),$3,$4) RETURNING *",
      [card_id, "Top-up", amount, "income"]
    );
    res.json({ success: true, updated_card: updated.rows[0], transaction: tx.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Top up failed", details: err.message });
  }
});

app.post("/api/cards/deduct", async (req, res) => {
  const { card_id, amount } = req.body;
  if (!card_id || amount === undefined || amount === null) return res.status(400).json({ error: "Missing card_id or amount" });
  if (amount < 0) return res.status(400).json({ error: "Amount cannot be negative" });
  try {
    const updated = await pool.query(
      "UPDATE cards SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *",
      [amount, card_id]
    );
    if (updated.rows.length === 0) return res.status(400).json({ error: "Insufficient balance" });
    res.json({ success: true, updated_card: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Deduct failed", details: err.message });
  }
});

app.post("/api/transactions", async (req, res) => {
  const { card_id, name, amount, type } = req.body;
  if (!card_id || !name || amount === undefined || !type) return res.status(400).json({ error: "Missing required fields" });
  try {
    const tx = await pool.query(
      "INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1,$2,NOW(),$3,$4) RETURNING *",
      [card_id, name, amount, type]
    );
    res.status(201).json(tx.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create transaction", details: err.message });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const r = await pool.query("SELECT id, username FROM users WHERE id = $1", [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user", details: err.message });
  }
});

// Split bill
app.post("/api/split-bill", async (req, res) => {
  const { payer, payerEmail, amount, friends, message, cardId } = req.body;
  if (!payer || !payerEmail || !amount || !Array.isArray(friends) || friends.length === 0 || !cardId)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const deductResult = await pool.query(
      "UPDATE cards SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *",
      [amount, cardId]
    );
    if (deductResult.rows.length === 0) return res.status(400).json({ error: "Insufficient balance on selected card" });

    await pool.query(
      "INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1,$2,NOW(),$3,$4)",
      [cardId, "Split Bill Payment", -Math.abs(amount), "expense"]
    );

    const totalPeople = friends.length + 1;
    const splitAmount = (amount / totalPeople).toFixed(2);
    const qrData = JSON.stringify({ payer, payerEmail, amount: splitAmount, message: message || "Split bill payment" });
    const qrImage = await QRCode.toDataURL(qrData);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    for (const friend of friends) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: friend.email,
        subject: `Split Bill Request from ${payer}`,
        text: `${payer} has split a bill with you. Your share is $${splitAmount}. Message: ${message || "Split bill payment"}`,
        attachments: [{ filename: "split-bill-qr.png", content: qrImage.split(",")[1], encoding: "base64", contentType: "image/png" }]
      };
      await transporter.sendMail(mailOptions);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Split bill error:", err);
    res.status(500).json({ error: "Failed to process split bill", details: err.message });
  }
});

// AI endpoint
app.post("/api/ai-response", async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: "AI not configured" });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful AI assistant for a payment app called NETS. Keep responses concise and friendly." },
        { role: "user", content: message }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse, source: "openai" });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to get AI response", details: error.message, source: "error" });
  }
});

// ---- SPA catch-all (must be last non-API handler)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(clientBuild, "index.html"));
});

// ---- Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the API: http://localhost:${PORT}/api/test-db`);
});
