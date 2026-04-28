const express = require('express');
const app = express();
app.use(express.json());

const notifications = [];

app.get('/health', (_, res) => res.json({
    status: 'ok',
    service: 'notification-service',
    notificationsReceived: notifications.length,
}));

// Knative Eventing delivers events as HTTP POST to /
app.post('/', (req, res) => {
    const ceType   = req.headers['ce-type']   || 'unknown';
    const ceSource = req.headers['ce-source'] || 'unknown';
    const ceId     = req.headers['ce-id']     || 'unknown';
    const ceTime   = req.headers['ce-time']   || new Date().toISOString();
    const body     = req.body;

    console.log('══════════════════════════════════════');
    console.log('[EVENT RECEIVED]');
    console.log(`  Type    : ${ceType}`);
    console.log(`  Source  : ${ceSource}`);
    console.log(`  ID      : ${ceId}`);
    console.log(`  Time    : ${ceTime}`);
    console.log(`  Payload :`, JSON.stringify(body?.data || body, null, 2));
    console.log('══════════════════════════════════════');

    if (ceType === 'order.created') {
        const order = body?.data || body;
        const notif = {
            id:        ceId,
            orderId:   order.orderId,
            userId:    order.userId,
            amount:    order.amount,
            message:   `Commande ${order.orderId} confirmée — montant: ${order.amount}€`,
            sentAt:    new Date().toISOString(),
        };
        notifications.push(notif);
        console.log(`✅ Notification envoyée → user ${order.userId} | commande ${order.orderId} | ${order.amount}€`);
    }

    res.status(200).send('OK');
});

// Voir toutes les notifications reçues
app.get('/notifications', (_, res) => res.json(notifications));

app.listen(8080, () => console.log('notification-service listening on :8080'));
