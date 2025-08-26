const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const pool = require('./db');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://eazygamepay-52b0185fda6d.herokuapp.com',
    'https://eazygamepay-frontend.herokuapp.com',
    'https://netseazygame-0dd1ff80b2d1.herokuapp.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Optional: a health check under /api
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use(express.json());
const clientBuild = path.join(__dirname, "eazygame", "dist");
app.use(express.static(clientBuild));

// Handle preflight requests
app.options('*', cors());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      message: 'Database connected successfully!',
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Check database schema
app.get('/api/db-schema', async (req, res) => {
  try {
    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'cards', 'transactions')
      ORDER BY table_name
    `);
    
    const tableNames = tablesResult.rows.map(row => row.table_name);
    
    // Check table structures
    const schemaInfo = {};
    for (const tableName of tableNames) {
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      schemaInfo[tableName] = columnsResult.rows;
    }
    
    // Count records in each table
    const counts = {};
    for (const tableName of tableNames) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      counts[tableName] = parseInt(countResult.rows[0].count);
    }
    
    res.json({
      tables_exist: tableNames,
      schema: schemaInfo,
      record_counts: counts,
      all_tables_present: tableNames.length === 3
    });
  } catch (error) {
    res.status(500).json({ error: 'Schema check failed', details: error.message });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND password_hash = $2', [username, password]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = userResult.rows[0];
    // Fetch cards
    const cardsResult = await pool.query('SELECT * FROM cards WHERE user_id = $1', [user.id]);
    // Fetch transactions for all cards
    const cardIds = cardsResult.rows.map(card => card.id);
    let transactions = [];
    if (cardIds.length > 0) {
      const txResult = await pool.query('SELECT * FROM transactions WHERE card_id = ANY($1::int[])', [cardIds]);
      transactions = txResult.rows;
    }
    res.json({
      user: { id: user.id, username: user.username },
      cards: cardsResult.rows,
      transactions
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Get cards for a user (by user_id query param for demo)
app.get('/api/cards', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Missing user_id' });
  try {
    const cardsResult = await pool.query('SELECT * FROM cards WHERE user_id = $1', [userId]);
    res.json(cardsResult.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cards', details: err.message });
  }
});

// Get transactions for a user (by user_id query param for demo)
app.get('/api/transactions', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Missing user_id' });
  try {
    const cardsResult = await pool.query('SELECT id FROM cards WHERE user_id = $1', [userId]);
    const cardIds = cardsResult.rows.map(card => card.id);
    let transactions = [];
    if (cardIds.length > 0) {
      const txResult = await pool.query('SELECT * FROM transactions WHERE card_id = ANY($1::int[])', [cardIds]);
      transactions = txResult.rows;
    }
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
});

// Add new card for a user
app.post('/api/cards', async (req, res) => {
  const { user_id, number, holder, expiry, design } = req.body;
  if (!user_id || !number || !holder || !expiry) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO cards (user_id, number, holder, expiry, balance, design) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user_id, number, holder, expiry, 0, design || 'netscard1']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add card', details: err.message });
  }
});

// User registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, password]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // PostgreSQL unique violation
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// Top up card balance
app.post('/api/cards/topup', async (req, res) => {
  console.log('Top-up request received:', req.body);
  const { card_id, amount } = req.body;
  
  if (!card_id || !amount) {
    console.log('Missing required fields:', { card_id, amount });
    return res.status(400).json({ error: 'Missing card_id or amount' });
  }
  
  try {
    // Check if card exists first
    const cardCheck = await pool.query('SELECT * FROM cards WHERE id = $1', [card_id]);
    if (cardCheck.rows.length === 0) {
      console.log('Card not found:', card_id);
      return res.status(404).json({ error: 'Card not found' });
    }
    
    console.log('Updating card balance:', { card_id, current_balance: cardCheck.rows[0].balance, amount });
    
    // Update card balance
    const updateResult = await pool.query(
      'UPDATE cards SET balance = balance + $1 WHERE id = $2 RETURNING *',
      [amount, card_id]
    );
    
    console.log('Card updated:', updateResult.rows[0]);
    
    // Insert a transaction record
    const transactionResult = await pool.query(
      'INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1, $2, NOW(), $3, $4) RETURNING *',
      [card_id, 'Top-up', amount, 'income']
    );
    
    console.log('Transaction created:', transactionResult.rows[0]);
    
    res.json({ 
      success: true, 
      updated_card: updateResult.rows[0],
      transaction: transactionResult.rows[0]
    });
  } catch (err) {
    console.error('Top-up error:', err);
    res.status(500).json({ error: 'Top up failed', details: err.message });
  }
});

// Deduct from card balance (for sending money)
app.post('/api/cards/deduct', async (req, res) => {
  console.log('Deduct request received:', req.body);
  console.log('Request headers:', req.headers);
  console.log('Request method:', req.method);
  const { card_id, amount } = req.body;

  if (!card_id || amount === undefined || amount === null) {
    console.log('Missing required fields:', { card_id, amount });
    console.log('card_id type:', typeof card_id, 'value:', card_id);
    console.log('amount type:', typeof amount, 'value:', amount);
    return res.status(400).json({ error: 'Missing card_id or amount' });
  }
  
  if (amount < 0) {
    console.log('Invalid amount (negative):', amount);
    return res.status(400).json({ error: 'Amount cannot be negative' });
  }

  try {
    // Atomic update: only deduct if balance is sufficient
    const updateResult = await pool.query(
      `UPDATE cards
       SET balance = balance - $1
       WHERE id = $2 AND balance >= $1
       RETURNING *`,
      [amount, card_id]
    );

    if (updateResult.rows.length === 0) {
      // Not enough balance
      console.log('Insufficient balance for atomic update');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    console.log('Card updated:', updateResult.rows[0]);

    res.json({
      success: true,
      updated_card: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Deduct error:', err);
    res.status(500).json({ error: 'Deduct failed', details: err.message });
  }
});

// Add transaction record
app.post('/api/transactions', async (req, res) => {
  console.log('Transaction request received:', req.body);
  const { user_id, card_id, name, amount, type } = req.body;
  // Ignore any 'time' sent from frontend
  if (!card_id || !name || amount === undefined || !type) {
    console.log('Missing required fields:', { card_id, name, amount, type });
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const transactionResult = await pool.query(
      'INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1, $2, NOW(), $3, $4) RETURNING *',
      [card_id, name, amount, type]
    );
    console.log('Transaction created:', transactionResult.rows[0]);
    res.status(201).json(transactionResult.rows[0]);
  } catch (err) {
    console.error('Transaction creation error:', err);
    res.status(500).json({ error: 'Failed to create transaction', details: err.message });
  }
});

// Get user details by user ID
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

// Split Bill endpoint
app.post('/api/split-bill', async (req, res) => {
  const { payer, payerEmail, amount, friends, message, cardId } = req.body;
  if (!payer || !payerEmail || !amount || !Array.isArray(friends) || friends.length === 0 || !cardId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Deduct total bill amount from selected card
    const deductResult = await pool.query(
      `UPDATE cards SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING *`,
      [amount, cardId]
    );
    if (deductResult.rows.length === 0) {
      return res.status(400).json({ error: 'Insufficient balance on selected card' });
    }
    // Add transaction for full bill amount
    await pool.query(
      'INSERT INTO transactions (card_id, name, time, amount, type) VALUES ($1, $2, NOW(), $3, $4)',
      [cardId, 'Split Bill Payment', -Math.abs(amount), 'expense']
    );
    // Calculate split amount (include payer)
    const totalPeople = friends.length + 1;
    const splitAmount = (amount / totalPeople).toFixed(2);
    // Generate QR code data
    const qrData = JSON.stringify({
      payer,
      payerEmail,
      amount: splitAmount,
      message: message || 'Split bill payment'
    });
    // Generate QR code as data URL
    const qrImage = await QRCode.toDataURL(qrData);
    // Set up nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    // Send email to each friend
    for (const friend of friends) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: friend.email,
        subject: `Split Bill Request from ${payer}`,
        text: `${payer} has split a bill with you. Your share is $${splitAmount}. Message: ${message || 'Split bill payment'}`,
        attachments: [
          {
            filename: 'split-bill-qr.png',
            content: qrImage.split(',')[1],
            encoding: 'base64',
            contentType: 'image/png'
          }
        ]
      };
      try {
        await transporter.sendMail(mailOptions);
      } catch (emailErr) {
        console.error('Failed to send email to', friend.email, emailErr);
        return res.status(500).json({ error: `Failed to send email to ${friend.email}`, details: emailErr.message });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Split bill error:', err);
    res.status(500).json({ error: 'Failed to process split bill', details: err.message });
  }
});

// Delete card endpoint
app.delete('/api/cards/:id', async (req, res) => {
  const cardId = req.params.id;
  try {
    // Check if card exists
    const cardCheck = await pool.query('SELECT * FROM cards WHERE id = $1', [cardId]);
    if (cardCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    // Delete the card
    await pool.query('DELETE FROM cards WHERE id = $1', [cardId]);
    
    res.json({ message: 'Card deleted successfully' });
  } catch (err) {
    console.error('Delete card error:', err);
    res.status(500).json({ error: 'Failed to delete card', details: err.message });
  }
});

// AI Eaze endpoint
app.post('/api/ai-response', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('AI Request received:', message);
    console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant for a payment app called NETS. You can help users with payment-related questions, financial advice, and general assistance. Keep responses concise and friendly."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('AI Response:', aiResponse);
    
    res.json({ 
      response: aiResponse,
      source: "openai"
    });
    
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response', 
      details: error.message,
      source: "error"
    });
  }
});

// Google Places API endpoint
app.get('/api/places/nearby', async (req, res) => {
  try {
    const { lat, lng, type = 'restaurant' } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    console.log('Places API Request:', { lat, lng, type });
    console.log('Google API Key:', process.env.GOOGLE_API_KEY ? 'Present' : 'Missing');

    if (!process.env.GOOGLE_API_KEY) {
      console.log('No Google API key found, returning mock data');
      // Return mock data if no API key
      const mockPlaces = [
        {
          id: 1,
          name: 'McDonald\'s',
          category: 'Fast Food',
          rating: 4.2,
          distance: '0.3km',
          deliveryTime: '15-25 min',
          image: '🍔',
          priceRange: '$$'
        },
        {
          id: 2,
          name: 'Starbucks Coffee',
          category: 'Coffee',
          rating: 4.5,
          distance: '0.5km',
          deliveryTime: '10-20 min',
          image: '☕',
          priceRange: '$$'
        },
        {
          id: 3,
          name: 'KFC',
          category: 'Fast Food',
          rating: 4.1,
          distance: '0.7km',
          deliveryTime: '20-30 min',
          image: '🍗',
          priceRange: '$$'
        }
      ];
      return res.json({ places: mockPlaces });
    }

    // Make request to Google Places API
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=${type}&key=${process.env.GOOGLE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status, data.error_message);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    // Transform Google Places data to our format
    const places = data.results.map((place, index) => ({
      id: index + 1,
      name: place.name,
      category: place.types?.[0] || 'Restaurant',
      rating: place.rating || 4.0,
      distance: `${Math.round(place.geometry?.location?.distance || 0.5)}km`,
      deliveryTime: `${Math.floor(Math.random() * 15) + 10}-${Math.floor(Math.random() * 15) + 20} min`,
      image: place.photos?.[0]?.photo_reference ? 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_API_KEY}` : 
        '🍽️',
      priceRange: place.price_level ? '$'.repeat(place.price_level) : '$$'
    }));

    console.log(`Found ${places.length} places`);
    res.json({ places });

  } catch (error) {
    console.error('Places API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nearby places', 
      details: error.message 
    });
  }
});

// Serve Vite build (only for production)
  const clientBuild = path.join(__dirname, "..", "eazygame", "dist");
  app.use(express.static(clientBuild));
  app.get("*", (_, res) => {
    res.sendFile(path.join(clientBuild, "index.html"));
  });


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the API: http://localhost:${PORT}/api/test-db`);
}); 
