const http = require('http');
const https = require('https');

const PLATFORM_URL   = process.env.PLATFORM_API_URL || 'http://platform-api.platform.svc.cluster.local:8082';
const API_KEY        = process.env.PLATFORM_API_KEY || '';
const TOPIC          = process.env.KAFKA_TOPIC       || 'demo-events';
const EVENT_TYPE     = process.env.EVENT_TYPE        || 'com.platform.demo';
const INTERVAL_MS    = parseInt(process.env.SEND_INTERVAL_MS || '30000');

let sentCount = 0;

function sendEvent(trigger = 'auto') {
    sentCount++;
    const body = JSON.stringify({
        type:  EVENT_TYPE,
        topic: TOPIC,
        data: {
            message:  `Event #${sentCount} — scale from zero demo!`,
            trigger,
            sentAt:   new Date().toISOString(),
            producer: 'demo-producer-service',
        },
    });

    const url    = new URL(`${PLATFORM_URL}/api/events`);
    const lib    = url.protocol === 'https:' ? https : http;
    const options = {
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     url.pathname,
        method:   'POST',
        headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-Api-Key':      API_KEY,
        },
    };

    const req = lib.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`[Producer] Event #${sentCount} sent (trigger=${trigger}) → ${res.statusCode} ${data}`);
        });
    });

    req.on('error', err => console.error(`[Producer] Error sending event: ${err.message}`));
    req.write(body);
    req.end();
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/health' || req.url === '/') {
        res.end(JSON.stringify({
            status: 'ok', sentCount,
            topic: TOPIC, eventType: EVENT_TYPE,
            platformUrl: PLATFORM_URL,
            intervalMs: INTERVAL_MS,
        }));
        return;
    }

    if (req.url === '/send') {
        sendEvent('http-manual');
        res.end(JSON.stringify({ status: 'sent', sentCount }));
        return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found. Use GET /send to trigger manually.' }));
});

server.listen(8080, () => {
    console.log(`[Producer] Started — topic=${TOPIC} type=${EVENT_TYPE} interval=${INTERVAL_MS}ms`);
    // Send one immediately at startup
    setTimeout(() => sendEvent('startup'), 2000);
    // Then auto-send every INTERVAL_MS
    setInterval(() => sendEvent('auto'), INTERVAL_MS);
});
