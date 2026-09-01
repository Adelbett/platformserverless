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
    clientId: 'payment-service',
    brokers: [(process.env.KAFKA_BROKERCONNECT || process.env.KAFKA_BOOTSTRAP || 'my-cluster-kafka-bootstrap.kafka.svc.cluster.local:9092')],
    retry: { initialRetryTime: 3000, retries: 10 },
});
const producer = kafka.producer();

let producerReady = false;
const payments = [];

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
    service: 'payment-service',
    kafka: producerReady ? 'connected' : 'disconnected',
    paymentsProcessed: payments.length,
}));

app.get('/payments', (_, res) => res.json(payments));

// Knative Eventing delivers "order.created" events here as HTTP POST
app.post('/', async (req, res) => {
    const body = req.body;
    // KafkaSource wraps raw Kafka messages with its own generic CE type
    // header (not the business type our producer set inside the JSON body),
    // so read the real event type from the payload, falling back to the header.
    const ceType = body?.type || req.headers['ce-type'] || 'unknown';
    const ceId   = req.headers['ce-id'] || uuidv4();

    console.log('══════════════════════════════════════');
    console.log('[EVENT RECEIVED]', ceType, ceId);

    if (ceType !== 'order.created') {
        console.log(`[PAYMENT] Ignored event type: ${ceType}`);
        return res.status(200).send('OK');
    }

    const order = body?.data || body;
    const approved = (order.amount || 0) < 1000;

    const payment = {
        paymentId: uuidv4(),
        orderId:   order.orderId,
        userId:    order.userId,
        amount:    order.amount,
        status:    approved ? 'APPROVED' : 'REJECTED',
        processedAt: new Date().toISOString(),
    };
    payments.push(payment);
    console.log(`💳 Paiement ${payment.status} — commande ${order.orderId} — ${order.amount}€`);

    if (producerReady) {
        const cloudEvent = {
            specversion:     '1.0',
            type:            approved ? 'payment.completed' : 'payment.failed',
            source:          'nextstep/payment-service',
            id:              uuidv4(),
            time:            payment.processedAt,
            datacontenttype: 'application/json',
            data:            payment,
        };
        await producer.send({
            topic:    process.env.KAFKA_TOPIC_OUT || 'payments',
            messages: [{ key: payment.orderId, value: JSON.stringify(cloudEvent) }],
        });
        console.log(`[Kafka] Published ${cloudEvent.type} for order ${payment.orderId}`);
    }

    res.status(200).send('OK');
});

app.get('/', (_, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Payment Service</title>
<style>
  :root{--bg:#0f1420;--panel:#161d2e;--border:#2a3450;--text:#e8ecf5;--muted:#8b96b3;--accent:#10b981;--danger:#ef4444}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Arial,sans-serif;padding:24px}
  h1{font-size:18px;margin:0 0 2px} .sub{color:var(--muted);font-size:12px;margin:0 0 20px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(16,185,129,.2);color:var(--accent)}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:18px}
  .panel h2{font-size:14px;margin:0 0 12px}
  .feed{max-height:420px;overflow-y:auto;font-size:12px}
  .item{border-left:3px solid var(--border);padding:8px 10px;margin-bottom:6px;background:#0f1420;border-radius:0 6px 6px 0}
  .item.APPROVED{border-color:var(--accent)} .item.REJECTED{border-color:var(--danger)}
  .item .id{color:var(--muted);font-size:10px}
  .b{display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700}
  .b.APPROVED{background:rgba(16,185,129,.2);color:var(--accent)} .b.REJECTED{background:rgba(239,68,68,.2);color:var(--danger)}
  .empty{color:var(--muted);font-size:12px;text-align:center;padding:20px 0}
</style></head>
<body>
  <h1>💳 Payment Service <span class="badge">consumer: orders → producer: payments</span></h1>
  <p class="sub">Ne connaît pas order-service — réagit uniquement aux événements Kafka reçus via un Trigger Knative.</p>
  <div class="panel">
    <h2>Paiements traités <span id="count" class="badge" style="background:#2a3450;color:#e8ecf5"></span></h2>
    <div class="feed" id="feed"><div class="empty">En attente d'événements Kafka...</div></div>
  </div>
<script>
const $ = id => document.getElementById(id);
async function load() {
  const r = await fetch('/payments'); const data = await r.json();
  $('count').textContent = data.length;
  document.getElementById('feed').innerHTML = data.length ? data.slice().reverse().map(p => \`
    <div class="item \${p.status}"><span class="b \${p.status}">\${p.status}</span>
      <b>\${p.amount}€</b> — commande \${p.orderId.slice(0,8)}
      <div class="id">\${p.processedAt}</div></div>\`).join('')
    : '<div class="empty">En attente d\\'événements Kafka...</div>';
}
load(); setInterval(load, 3000);
</script>
</body></html>`);
});

app.listen(8080, () => console.log('payment-service listening on :8080'));
