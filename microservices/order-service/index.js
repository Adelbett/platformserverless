const express = require('express');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const kafka = new Kafka({
    clientId: 'order-service',
    brokers: [(process.env.KAFKA_BROKERCONNECT || process.env.KAFKA_BOOTSTRAP || 'my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092')],
    retry: { initialRetryTime: 3000, retries: 10 },
});
const producer = kafka.producer();

let producerReady = false;
const orders = [];

(async () => {
    try {
        await producer.connect();
        producerReady = true;
        console.log('[Kafka] Producer connected');
    } catch (err) {
        console.error('[Kafka] Producer connection failed:', err.message);
    }
})();

app.get('/health', (_, res) => res.json({
    status: 'ok',
    service: 'order-service',
    kafka: producerReady ? 'connected' : 'disconnected',
}));

app.post('/orders', async (req, res) => {
    if (!producerReady) {
        return res.status(503).json({ error: 'Kafka producer not ready' });
    }

    const order = {
        orderId:   uuidv4(),
        userId:    req.body.userId  || 'user-001',
        amount:    req.body.amount  || 99.99,
        items:     req.body.items   || [],
        createdAt: new Date().toISOString(),
    };

    const cloudEvent = {
        specversion:     '1.0',
        type:            'order.created',
        source:          'nextstep/order-service',
        id:              uuidv4(),
        time:            order.createdAt,
        datacontenttype: 'application/json',
        data:            order,
    };

    await producer.send({
        topic:    process.env.KAFKA_TOPIC || 'orders',
        messages: [{ key: order.orderId, value: JSON.stringify(cloudEvent) }],
    });

    orders.push(order);
    console.log(`[ORDER] Created ${order.orderId} — user: ${order.userId} — amount: ${order.amount}`);
    res.status(201).json(order);
});

app.get('/orders', (_, res) => res.json(orders));

app.get('/orders/test', async (req, res) => {
    if (!producerReady) {
        return res.status(503).json({ error: 'Kafka producer not ready' });
    }

    const order = {
        orderId:   uuidv4(),
        userId:    'test-user',
        amount:    19.99,
        items:     [{ productId: 'prod-test', qty: 1 }],
        createdAt: new Date().toISOString(),
    };

    const cloudEvent = {
        specversion:     '1.0',
        type:            'order.created',
        source:          'nextstep/order-service',
        id:              uuidv4(),
        time:            order.createdAt,
        datacontenttype: 'application/json',
        data:            order,
    };

    await producer.send({
        topic:    process.env.KAFKA_TOPIC || 'orders',
        messages: [{ key: order.orderId, value: JSON.stringify(cloudEvent) }],
    });

    orders.push(order);
    console.log(`[ORDER][TEST] Sent test event ${order.orderId}`);
    res.json({ message: 'Test order sent to Kafka', order });
});

app.get('/', (_, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Order Service</title>
<style>
  :root{--bg:#0f1420;--panel:#161d2e;--border:#2a3450;--text:#e8ecf5;--muted:#8b96b3;--accent:#3b82f6}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Arial,sans-serif;padding:24px}
  h1{font-size:18px;margin:0 0 2px} .sub{color:var(--muted);font-size:12px;margin:0 0 20px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(59,130,246,.2);color:var(--accent)}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:16px}
  .panel h2{font-size:14px;margin:0 0 12px}
  form{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
  .field{display:flex;flex-direction:column;gap:4px}
  .field label{font-size:11px;color:var(--muted)}
  .field input{background:#0f1420;border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:6px;width:140px}
  button{background:var(--accent);color:#fff;border:none;padding:9px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
  button:hover{opacity:.9}
  .status{font-size:12px;color:var(--muted);margin-top:10px}
  .feed{max-height:340px;overflow-y:auto;font-size:12px}
  .item{border-left:3px solid var(--accent);padding:8px 10px;margin-bottom:6px;background:#0f1420;border-radius:0 6px 6px 0}
  .item .id{color:var(--muted);font-size:10px}
  .empty{color:var(--muted);font-size:12px;text-align:center;padding:20px 0}
</style></head>
<body>
  <h1>🛒 Order Service <span class="badge">producer → topic: orders</span></h1>
  <p class="sub">Aucune connaissance des autres services — publie uniquement sur Kafka.</p>

  <div class="panel">
    <h2>Créer une commande</h2>
    <form id="f">
      <div class="field"><label>User ID</label><input name="userId" value="user-demo"></div>
      <div class="field"><label>Montant (€)</label><input name="amount" type="number" value="149.90"></div>
      <button type="submit">Envoyer</button>
    </form>
    <div class="status" id="status"></div>
  </div>

  <div class="panel">
    <h2>Commandes créées <span id="count" class="badge" style="background:#2a3450;color:#e8ecf5"></span></h2>
    <div class="feed" id="feed"><div class="empty">Aucune commande pour l'instant</div></div>
  </div>

<script>
const $ = id => document.getElementById(id);
$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $('status').textContent = 'Envoi en cours...';
  try {
    const r = await fetch('/orders', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId: fd.get('userId'), amount: parseFloat(fd.get('amount')) }) });
    const data = await r.json();
    $('status').textContent = '✅ Commande ' + data.orderId + ' publiée sur Kafka (topic: orders).';
    load();
  } catch (err) { $('status').textContent = '❌ ' + err.message; }
});
async function load() {
  const r = await fetch('/orders'); const data = await r.json();
  $('count').textContent = data.length;
  $('feed').innerHTML = data.length ? data.slice().reverse().map(o => \`
    <div class="item"><b>\${o.amount}€</b> — user: \${o.userId}
      <div class="id">\${o.orderId} · \${o.createdAt}</div></div>\`).join('')
    : '<div class="empty">Aucune commande pour l\\'instant</div>';
}
load(); setInterval(load, 4000);
</script>
</body></html>`);
});

app.listen(8080, () => console.log('order-service listening on :8080'));
