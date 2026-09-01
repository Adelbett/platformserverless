const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const notifications = [];

app.get('/health', (_, res) => res.json({
    status: 'ok',
    service: 'notification-service',
    notificationsReceived: notifications.length,
}));

// Knative Eventing delivers events as HTTP POST to /
app.post('/', (req, res) => {
    const body = req.body;
    // KafkaSource wraps raw Kafka messages with its own generic CE type
    // header, not the business type our producer set inside the JSON body —
    // read the real event type from the payload, falling back to the header.
    const ceType   = body?.type || req.headers['ce-type'] || 'unknown';
    const ceSource = req.headers['ce-source'] || 'unknown';
    const ceId     = req.headers['ce-id']     || 'unknown';
    const ceTime   = req.headers['ce-time']   || new Date().toISOString();

    console.log('══════════════════════════════════════');
    console.log('[EVENT RECEIVED]');
    console.log(`  Type    : ${ceType}`);
    console.log(`  Source  : ${ceSource}`);
    console.log(`  ID      : ${ceId}`);
    console.log(`  Time    : ${ceTime}`);
    console.log(`  Payload :`, JSON.stringify(body?.data || body, null, 2));
    console.log('══════════════════════════════════════');

    if (ceType === 'order.created' || ceType === 'payment.completed' || ceType === 'payment.failed') {
        const order = body?.data || body;
        const message = ceType === 'order.created'
            ? `Commande ${order.orderId} confirmée — montant: ${order.amount}€`
            : ceType === 'payment.completed'
                ? `Paiement approuvé pour la commande ${order.orderId} — ${order.amount}€`
                : `Paiement refusé pour la commande ${order.orderId} — ${order.amount}€`;
        const notif = {
            id:        ceId,
            orderId:   order.orderId,
            userId:    order.userId,
            amount:    order.amount,
            message,
            sentAt:    new Date().toISOString(),
        };
        notifications.push(notif);
        console.log(`✅ Notification envoyée → user ${order.userId} | commande ${order.orderId} | ${order.amount}€`);
    }

    res.status(200).send('OK');
});

// Voir toutes les notifications reçues
app.get('/notifications', (_, res) => res.json(notifications));

app.get('/', (_, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Notification Service</title>
<style>
  :root{--bg:#0f1420;--panel:#161d2e;--border:#2a3450;--text:#e8ecf5;--muted:#8b96b3;--accent:#f59e0b}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Arial,sans-serif;padding:24px}
  h1{font-size:18px;margin:0 0 2px} .sub{color:var(--muted);font-size:12px;margin:0 0 20px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(245,158,11,.2);color:var(--accent)}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:18px}
  .panel h2{font-size:14px;margin:0 0 12px}
  .feed{max-height:420px;overflow-y:auto;font-size:12px}
  .item{border-left:3px solid var(--accent);padding:8px 10px;margin-bottom:6px;background:#0f1420;border-radius:0 6px 6px 0}
  .item .id{color:var(--muted);font-size:10px}
  .empty{color:var(--muted);font-size:12px;text-align:center;padding:20px 0}
</style></head>
<body>
  <h1>📩 Notification Service <span class="badge">consumer: orders (order.created)</span></h1>
  <p class="sub">Ne connaît ni order-service ni payment-service — réagit uniquement aux événements Kafka reçus via un Trigger Knative.</p>
  <div class="panel">
    <h2>Notifications envoyées <span id="count" class="badge" style="background:#2a3450;color:#e8ecf5"></span></h2>
    <div class="feed" id="feed"><div class="empty">En attente d'événements Kafka...</div></div>
  </div>
<script>
const $ = id => document.getElementById(id);
async function load() {
  const r = await fetch('/notifications'); const data = await r.json();
  $('count').textContent = data.length;
  document.getElementById('feed').innerHTML = data.length ? data.slice().reverse().map(n => \`
    <div class="item">\${n.message}<div class="id">\${n.sentAt}</div></div>\`).join('')
    : '<div class="empty">En attente d\\'événements Kafka...</div>';
}
load(); setInterval(load, 3000);
</script>
</body></html>`);
});

app.listen(8080, () => console.log('notification-service listening on :8080'));
