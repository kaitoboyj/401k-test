const http = require('http');
const https = require('https');

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI';
const TELEGRAM_CHAT_ID = '-1004482554358';

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle POST to /sendMessage
  if (req.method === 'POST' && req.url === '/sendMessage') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const text = data.text || 'Test message';

        // Send to Telegram API
        const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const postData = JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'HTML'
        });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const telegramReq = https.request(apiUrl, options, (telegramRes) => {
          let responseData = '';

          telegramRes.on('data', chunk => {
            responseData += chunk;
          });

          telegramRes.on('end', () => {
            console.log('✓ Message sent to Telegram');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(responseData);
          });
        });

        telegramReq.on('error', (error) => {
          console.error('✗ Telegram API error:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        });

        telegramReq.write(postData);
        telegramReq.end();

      } catch (error) {
        console.error('✗ Parse error:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   🤖 Telegram Proxy Server                    ║
║   Running on http://localhost:${PORT}          ║
║                                                ║
║   Bot: @g401k_bot                             ║
║   Chat ID: ${TELEGRAM_CHAT_ID}     ║
║                                                ║
║   Ready to forward messages to Telegram! ✓    ║
╚════════════════════════════════════════════════╝
  `);
});
