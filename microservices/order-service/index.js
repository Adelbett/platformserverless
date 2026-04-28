const express = require('express');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const kafka = new Kafka({
    clientId: 'order-service',
    brokers: [(process.env.KAFKA_BOOTSTRAP || 'kafka.kafka.svc.cluster.local:9092')],
    retry: { initialRetryTime: 3000, retries: 10 },
});
const producer = kafka.producer();

let producerReady = false;

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

    console.log(`[ORDER] Created ${order.orderId} — user: ${order.userId} — amount: ${order.amount}`);
    res.status(201).json(order);
});

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

    console.log(`[ORDER][TEST] Sent test event ${order.orderId}`);
    res.json({ message: 'Test order sent to Kafka', order });
});

app.listen(8080, () => console.log('order-service listening on :8080'));
