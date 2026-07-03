// Maybach Rentals WhatsApp AI booking agent — Express server.

require('dotenv').config(); // loads .env locally; on Railway, vars come from the platform
const express = require('express');
const { version } = require('./package.json');
const webhookRouter = require('./routes/webhook');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Maybach Rentals agent listening on :${port}`);
});
