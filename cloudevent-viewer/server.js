const express = require('express');
const app = express();
app.use(express.json());

const events = [];

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>CloudEvent Viewer</title>
  <style>
    body { background: #0d1117; color: #dde6f0; font-family: monospace; padding: 20px; }
    h1 { color: #4a9ef5; }
    .event { background: #161b22; border: 1px solid #1f2b3a; border-radius: 8px;
             padding: 16px; margin: 10px 0; }
    .type { color: #3fb950; font-weight: bold; }
    .time { color: #5a7080; font-size: 12px; }
    pre { color: #a8b8c8; margin: 8px 0 0; }
  </style>
</head>
<body>
  <h1>⚡ CloudEvent Viewer</h1>
  <p style="color:#5a7080">Waiting for events... (auto-refresh every 3s)</p>
  <div id="events"></div>
  <script>
    async function load() {
      const res = await fetch('/events');
      const data = await res.json();
      document.getElementById('events').innerHTML = data.map(e => \`
        <div class="event">
          <span class="type">⚡ \${e.type}</span>
          <span class="time"> · \${e.time}</span>
          <pre>\${JSON.stringify(e.data, null, 2)}</pre>
        </div>
      \`).join('');
    }
    load();
    setInterval(load, 3000);
  </script>
</body>
</html>
`));

app.get('/events', (req, res) => res.json(events.slice(-20).reverse()));

app.post('/', (req, res) => {
  events.push({
    type: req.headers['ce-type'] || 'unknown',
    time: new Date().toLocaleTimeString(),
    data: req.body
  });
  console.log('Event received:', req.headers['ce-type']);
  res.status(200).send('OK');
});

app.listen(8080, () => console.log('CloudEvent Viewer running on port 8080'));
