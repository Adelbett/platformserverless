# Serverless Container Platform — UI Design Specification

## Overview
Build a modern dark-themed web application that is more intuitive and visually impressive than Azure Container Apps. The design uses a deep dark background (#07090E), clean card surfaces (#0D1117), and sharp accent colors. Every section must feel production-grade and enterprise-ready.

**Font stack:** `'Syne', sans-serif` for headings, `'JetBrains Mono', monospace` for code/labels/metrics  
**Color system:**
- Background: `#07090E` (page), `#0D1117` (cards), `#161B22` (inputs/surfaces)
- Borders: `#1F2B3A` (subtle), `#2D3D52` (emphasis)
- Text: `#DDE6F0` (primary), `#5A7080` (muted)
- Blue: `#4A9EF5` | Green: `#3FB950` | Orange: `#E8A838` | Red: `#F85149`
- Purple: `#9B6FD8` | Teal: `#64C8C8` | Pink: `#F778BA`

---

## Page 1 — Login `/login`

### Layout
Full-screen centered layout. Left panel (40%) = branding. Right panel (60%) = login form.

### Left Panel — Branding
- Large logo: rocket icon + "Serverless" in white bold, "Container Platform" in blue `#4A9EF5`
- Tagline: *"Deploy anything. Scale to zero. Pay nothing at rest."*
- 3 feature pills below:
  - `⚡ Scale-to-zero` — green pill
  - `☕ Kafka Event-Driven` — orange pill  
  - `☸️ Kubernetes Native` — blue pill
- Animated cluster diagram: 3 nodes (vm01/vm02/vm03) with pulsing connection lines

### Right Panel — Login Form
Card with `border-radius: 16px`, padding `2rem`

```
[Logo icon 32px]
"Welcome back"   — 22px Syne bold
"Sign in to your platform"  — muted text

[Email input]
  placeholder: "your@email.com"
  
[Password input]
  placeholder: "••••••••"
  eye toggle icon
  
[Sign in button] — full width, blue bg, "Sign in →"

"Don't have an account? Register"  — link text
```

### Behavior
- On submit: `POST /api/auth/login`
- Store JWT in `localStorage`
- Redirect to `/dashboard`
- Show spinner on button during loading
- Show red error banner if credentials wrong

---

## Page 2 — Dashboard `/dashboard`

### Shell Layout
```
┌──────────────────────────────────────────────────┐
│  SIDEBAR (220px fixed)  │  MAIN CONTENT (flex 1) │
│                         │                         │
│  Logo                   │  Top header bar         │
│  Navigation items       │  Page content           │
│                         │                         │
│  User info at bottom    │                         │
└──────────────────────────────────────────────────┘
```

### Sidebar
Background: `#0D1117`, border-right: `1px solid #1F2B3A`

**Logo section:**
```
🚀 Serverless
   Container Platform   ← 10px muted text
[rainbow gradient line 2px]
```

**Navigation items** (each 40px height, 16px padding, 8px border-radius on hover):
```
[icon] Dashboard          /dashboard
[icon] My Apps            /apps
[icon] Kafka Topics       /kafka
[icon] Eventing           /eventing
[icon] Logs               /logs
[icon] Monitoring         /monitoring
─────────────────────
[icon] Users (ADMIN)      /users
[icon] Settings           /settings
```

Active item: blue left border `3px solid #4A9EF5` + blue text + subtle blue bg

**Bottom user card:**
```
[avatar circle with initials]
adel@esprit.tn
DEVELOPER  ← blue badge
[logout button]
```

### Top Header Bar
Height 52px, border-bottom: `1px solid #1F2B3A`
```
[Page title]                    [notifications bell] [user menu]
"Dashboard"  ← 18px Syne 500
"Good morning, Adel"  ← 13px muted
```

---

## Page 3 — Dashboard Main Content

### Section A — Metrics Row (4 cards)
Grid: `repeat(4, 1fr)`, gap `12px`, margin-bottom `24px`

**Card 1 — Total Apps**
```
TOTAL APPS         ← 11px muted label
12                 ← 32px Syne bold white
↑ 3 this week      ← 12px green trend
```

**Card 2 — Running**
```
RUNNING            ← 11px muted label
8                  ← 32px Syne bold #3FB950
2/2 pods each      ← 12px muted
```

**Card 3 — Scale-to-zero**
```
SCALE-TO-ZERO      ← 11px muted label
4                  ← 32px Syne bold muted
0 cost at rest     ← 12px muted
```

**Card 4 — Kafka Topics**
```
KAFKA TOPICS       ← 11px muted label
5                  ← 32px Syne bold #E8A838
LAG: all 0         ← 12px green
```

Each card: bg `#0D1117`, border `1px solid #1F2B3A`, radius `12px`, padding `16px 20px`

---

### Section B — Two Column Grid

**Left column (60%) — My Apps**
Card title: "Running Services" + "Deploy new →" button (right aligned, blue outline)

Table headers: `APP NAME | IMAGE | URL | PODS | STATUS | ACTIONS`

Each row:
```
order-processor  |  nginx:latest  |  order-proc.default...  |  2/2  |  [RUNNING ●]  |  [logs] [delete]
notification-svc |  python:3.11   |  notif.default...       |  0/2  |  [SCALE-ZERO] |  [logs] [delete]
payment-api      |  node:18       |  payment.default...     |  2/2  |  [ERROR ●]    |  [logs] [delete]
```

Status badges:
- `RUNNING` → green pill `rgba(63,185,80,0.15)` text `#3FB950`
- `SCALE-TO-ZERO` → gray pill, pulsing dot animation
- `ERROR` → red pill `rgba(248,81,73,0.15)` text `#F85149`
- `PENDING` → orange pill

**Right column (40%) — Kafka Topics**
Card title: "Kafka Topics" + "New topic →"

Each topic row:
```
orders      |  3 partitions  |  LAG: 0   [●green]
knative-demo|  1 partition   |  LAG: 0   [●green]
payments    |  3 partitions  |  LAG: 12  [●orange]
```

LAG indicator: colored number + small bar showing relative size

---

### Section C — Live Logs Terminal
Full-width card below grid

Header: "Live Logs — order-processor" + app selector dropdown + [● LIVE] blinking badge + [Clear] button

```
Terminal area (bg: #020408, font: JetBrains Mono 12px, padding 16px):

  2026-04-01 12:00:01  [INFO ]  Service started on port 8080
  2026-04-01 12:00:03  [INFO ]  Connected to Kafka topic: orders
  2026-04-01 12:00:05  [WARN ]  Slow response detected: 450ms
  2026-04-01 12:00:07  [ERROR]  Connection refused on port 5432

Colors:
  timestamp → #2D3D52 (dark blue-gray)
  [INFO]    → #4A9EF5 (blue)
  [WARN]    → #E8A838 (orange)
  [ERROR]   → #F85149 (red)
  message   → #DDE6F0 (white)
```

Auto-scroll to bottom. Max height 200px with overflow scroll.

---

### Section D — Recent Activity Timeline
Right side card

Each item:
```
[DEPLOY ●]  order-processor deployed          2 min ago
[SCALE  ●]  notification-svc scaled to zero   5 min ago  
[ERROR  ●]  payment-api crash detected        8 min ago
[UPDATE ●]  order-processor image updated    15 min ago
```

---

## Page 4 — Deploy New App `/apps/new`

### Layout
2-column: left 65% (form), right 35% (preview/help)

### Form — 4 Tabs

#### Tab 1: Basic Configuration
```
Section: "Application"
┌─────────────────────┬─────────────────────┐
│ App Name *          │ Namespace           │
│ order-processor     │ ▼ default           │
├─────────────────────┴─────────────────────┤
│ Docker Image *                            │
│ adelbettaieb/order-processor:v1           │
│ [validate image] button → checks Docker Hub│
├─────────────────────┬─────────────────────┤
│ Container Port *    │ Description         │
│ 8080                │ Processes orders... │
└─────────────────────┴─────────────────────┘
```

#### Tab 2: Scale & Resources
```
Section: "Scaling"
┌─────────────────────┬─────────────────────┐
│ Min Replicas        │ Max Replicas        │
│ 0  [slider 0-5]     │ 10 [slider 1-20]    │
│ "0 = scale-to-zero" │                     │
├─────────────────────┴─────────────────────┤

Section: "Resources per container"
┌─────────────────────┬─────────────────────┐
│ CPU Request         │ CPU Limit           │
│ 100m                │ 500m                │
├─────────────────────┼─────────────────────┤
│ Memory Request      │ Memory Limit        │
│ 128Mi               │ 512Mi               │
└─────────────────────┴─────────────────────┘
```

#### Tab 3: Environment Variables
```
[+ Add variable] button

┌─────────────────────┬─────────────────────┬───┐
│ KEY                 │ VALUE               │ ✕ │
│ DATABASE_URL        │ jdbc:postgresql://  │ ✕ │
│ REDIS_HOST          │ localhost           │ ✕ │
│ API_KEY             │ ••••••••            │ ✕ │
└─────────────────────┴─────────────────────┴───┘
```

#### Tab 4: Kafka Trigger (Optional)
```
[Toggle] Enable Kafka trigger  ← off by default

When ON:
┌─────────────────────┬─────────────────────┐
│ Select Kafka Topic  │ Consumer Group      │
│ ▼ orders            │ orders-group        │
├─────────────────────┴─────────────────────┤
│ Filter Type (optional)                    │
│ ▼ None (accept all events)                │
└───────────────────────────────────────────┘

Info box: "When enabled, your app will automatically 
start when a message arrives in the selected topic.
Scale-to-zero between messages = zero cost."
```

### Right Panel — Live Preview
```
Card: "Deployment Preview"

Service name:   order-processor
Namespace:      default
Image:          adelbettaieb/order-processor:v1
URL:            http://order-processor.default.nextstep.com
Min replicas:   0  (scale-to-zero ✓)
Max replicas:   10
CPU:            100m → 500m
Memory:         128Mi → 512Mi

[Knative YAML preview - collapsed]
```

### Bottom Action Bar
```
[Cancel]                    [Save as Draft]  [🚀 Deploy to Cluster]
                                              blue filled button, full right
```

Deploy button behavior:
1. Show loading spinner "Deploying..."
2. Call `POST /api/apps`
3. Show success toast "✓ App deployed! URL ready in ~30s"
4. Redirect to `/apps/{name}`

---

## Page 5 — App Details `/apps/:name`

### Header Section
```
← Back to Apps

[app icon] order-processor                    [Update Image] [Delete App]
           RUNNING ● 2/2 pods
           http://order-processor.default.nextstep.com  [copy icon] [open ↗]
           nginx:latest | default namespace | Revision: order-processor-00002
```

### Tabs
`Overview | Logs | Metrics | Settings`

#### Overview Tab
**Info grid (3 columns):**
```
Image             nginx:latest
Port              8080
Namespace         default
Min Replicas      0
Max Replicas      10
CPU Request       100m
Memory Request    128Mi
Deployed at       2026-04-01 12:00
Last updated      2026-04-01 14:30
Revision          order-processor-00002
Kafka trigger     orders (enabled)
```

**Current status card:**
```
PODS STATUS
[●●] 2/2 Running
queue-proxy    ● Running
user-container ● Running

Scale-to-zero: active (60s timeout)
```

#### Logs Tab
```
Filter bar:
[● LIVE toggle]  [Level: ALL ▼]  [Search logs...]  [Export]

Terminal:
  (same terminal design as dashboard but full height)
  WebSocket /ws/logs/order-processor
```

#### Metrics Tab
4 mini charts in a 2x2 grid:

**Chart 1 — Requests/sec** (line chart, blue)
**Chart 2 — Response time ms** (line chart, teal)
**Chart 3 — CPU usage %** (bar chart, orange)
**Chart 4 — Memory usage MB** (area chart, purple)

Each chart: title + current value large + sparkline

**Scale events timeline:**
```
12:00:01  ↑ scaled up 0→1 (event triggered)
12:02:34  ↑ scaled up 1→2 (load increase)
12:04:12  ↓ scaled down 2→1 (load decrease)
12:06:01  ↓ scaled to zero (no activity)
```

---

## Page 6 — Kafka Topics `/kafka`

### Layout
Split: topic list (left 55%) + create form (right 45%)

### Topic List
```
Header: "Kafka Topics"  [Refresh] [+ New Topic]

Filter: [Search topic name...] [LAG: All ▼]

Table:
TOPIC NAME   | PARTITIONS | REPLICAS | LAG     | MESSAGES | STATUS | ACTIONS
─────────────────────────────────────────────────────────────────────────────
orders       | 3          | 1        | 0 ●     | 1,234    | ACTIVE | [view][delete]
knative-demo | 1          | 1        | 0 ●     | 89       | ACTIVE | [view][delete]
payments     | 3          | 1        | 12 ⚠    | 5,621    | ACTIVE | [view][delete]
```

LAG badge:
- `0` → green dot pill
- `1-10` → orange pill
- `>10` → red pill with pulse animation

### Click on topic → expand row:
```
▼ orders  (expanded)
  Consumer Groups:
  ┌─────────────────────┬───────────┬──────────────┐
  │ Group               │ Offset    │ LAG          │
  │ knative-group       │ 1,234     │ 0 ✓          │
  │ orders-group        │ 1,220     │ 14 ⚠         │
  └─────────────────────┴───────────┴──────────────┘
  
  Message sample: {"orderId":"123","total":49.99}
  
  [Send test message] button → opens mini modal
```

### Create Topic Form
```
Card: "Create Kafka Topic"

Topic Name *
[orders-notifications    ]

Partitions
[1] [2] [3 ●] [5] [10]   ← pill selector, 3 = selected

Replicas
[1 ●] [2] [3]             ← pill selector

Advanced config (collapsed by default):
  Retention (ms): 604800000   ← 7 days
  Cleanup policy: ▼ delete

[Create Topic →] blue button
```

---

## Page 7 — Eventing `/eventing`

### Layout
3 tabs: `KafkaSources | Triggers | Pipeline View`

### KafkaSources Tab
```
Header: "Kafka Sources" [+ Create Source]

Table:
NAME          | TOPIC        | CONSUMER GROUP | SINK BROKER | READY  | ACTIONS
──────────────────────────────────────────────────────────────────────────────
orders-source | orders       | orders-group   | default     | ✓ True | [edit][delete]
kafka-source  | knative-demo | knative-group  | default     | ✓ True | [edit][delete]
```

Create form:
```
Source Name *        [orders-source           ]
Select Topic *       [▼ orders                ]
Consumer Group       [orders-group            ]
Sink Broker          [▼ default               ]
Namespace            [▼ default               ]

[Create KafkaSource →]
```

### Triggers Tab
```
Header: "Triggers" [+ Create Trigger]

Table:
NAME            | BROKER  | SUBSCRIBER APP    | FILTER TYPE | READY  | ACTIONS
──────────────────────────────────────────────────────────────────────────────
orders-trigger  | default | order-processor   | (none)      | ✓ True | [edit][delete]
hello-trigger   | default | hello-serverless  | (none)      | ✓ True | [edit][delete]
```

Create form:
```
Trigger Name *       [payment-trigger         ]
Select Broker        [▼ default               ]
Subscriber App *     [▼ payment-processor     ]
Filter Type          [▼ None (accept all)     ]

[Create Trigger →]
```

### Pipeline View Tab
Visual flow diagram showing:
```
[Kafka Topic: orders]
        ↓
[KafkaSource: orders-source]
  consumerGroup: orders-group
        ↓
[Broker: default]
        ↓
[Trigger: orders-trigger]
  filter: none
        ↓
[App: order-processor]
  0 → 2/2 Running (auto)
```

Each box: rounded card with icon + name + status badge
Arrows: animated dashed lines with flow direction

---

## Page 8 — Logs `/logs`

### Layout
Full-width with filter sidebar (left 280px) + log output (right flex)

### Filter Sidebar
```
"Filters" header

Application
[▼ order-processor]

Log Level
[✓] INFO  ← blue checkbox
[✓] WARN  ← orange
[✓] ERROR ← red
[ ] DEBUG ← unchecked

Date Range
[From: 2026-04-01 00:00]
[To:   2026-04-01 23:59]

Search
[Search in logs...      ]

[Apply Filters] button
[Reset] link
```

### Log Output
```
Header bar:
"Application Logs"    [● LIVE]  [1,234 lines]  [Export .log]

Toolbar:
[Word wrap ↕] [Auto-scroll ↓] [Font size: 12 ▾]

Terminal (full height, dark bg #020408):
  2026-04-01 12:00:01.234 | order-processor | [INFO ] | Service started on port 8080
  2026-04-01 12:00:02.891 | order-processor | [INFO ] | Kafka consumer connected: orders-group
  2026-04-01 12:00:05.123 | order-processor | [WARN ] | Response time 450ms > threshold 200ms
  2026-04-01 12:00:07.445 | order-processor | [ERROR] | Connection refused: localhost:5432
  2026-04-01 12:00:07.890 | order-processor | [INFO ] | Retrying connection (1/3)...

Click on any log line → expand full details panel below
```

---

## Page 9 — Monitoring `/monitoring`

### Layout
Full-width dashboard with metric cards + charts

### Section A — Overview Metrics (4 cards)
```
TOTAL REQUESTS/hr    AVG RESPONSE TIME    ERROR RATE    ACTIVE PODS
    12,450               145ms               0.2%           16
    ↑ 12% vs yesterday   ↓ 30ms better      ✓ healthy       across 5 apps
```

### Section B — Charts Grid (2x2)

**Chart 1 — Requests over time** (line chart, blue)
```
Title: "Requests / minute"
Y-axis: 0 to 200
X-axis: last 60 minutes
Line: smooth, blue #4A9EF5, filled area below with 10% opacity
Current: 145 req/min  ← shown large above chart
```

**Chart 2 — Response time P95** (line chart, teal)
```
Title: "Response time (ms)"
Y-axis: 0 to 1000ms
Threshold line at 200ms → orange dashed
Line: teal #64C8C8
Show P50 and P95 as two lines
```

**Chart 3 — CPU Usage per App** (grouped bar chart, orange)
```
Title: "CPU Usage %"
X-axis: app names
Y-axis: 0 to 100%
Color: #E8A838 bars
Threshold: red dashed line at 80%
```

**Chart 4 — Memory Usage per App** (horizontal bar, purple)
```
Title: "Memory Usage (MB)"
Each app has a horizontal bar
Color: purple gradient intensity by usage level
Show actual value at bar end
```

### Section C — Scale Events Timeline
```
Title: "Scale Events — last 24h"

Timeline visualization:
  order-processor    ██░░░░░░████░░░░░░░░██░░  (green=running, gray=zero)
  notification-svc   ░░░░███░░░░░░░░░░░░░░███░
  payment-api        ██████████████████████████  (running all day)

Legend: [■ Running] [□ Scale-to-zero]
```

### Section D — App Health Table
```
APP                | STATUS  | CPU   | MEMORY | REQ/MIN | ERRORS | HEALTH
───────────────────────────────────────────────────────────────────────────
order-processor    | RUNNING | 12%   | 145MB  | 45      | 0      | ● Good
notification-svc   | ZERO    | 0%    | 0MB    | 0       | 0      | ● Idle
payment-api        | ERROR   | 89%   | 498MB  | 12      | 23     | ● Critical
hello-serverless   | ZERO    | 0%    | 0MB    | 0       | 0      | ● Idle
```

Health indicator colors:
- `Good` → green
- `Warning` → orange  
- `Critical` → red blinking
- `Idle` → gray

---

## Global Components

### Toast Notifications
Top-right corner, stacked:
```
✓  App deployed successfully!          [×]   ← green, auto-dismiss 4s
⚠  Kafka LAG detected on "payments"   [×]   ← orange
✕  Error: image not found on Hub       [×]   ← red, stays until dismissed
```

### Confirmation Modal
```
Overlay: rgba(0,0,0,0.7)
Card centered:

  "Delete order-processor?"
  
  This will permanently remove the Knative Service
  from your cluster. This action cannot be undone.
  
  [Cancel]          [Delete App]  ← red button
```

### Status Badge Component
```
RUNNING      → bg rgba(63,185,80,0.12)  text #3FB950  dot ●
SCALE-ZERO   → bg rgba(93,101,110,0.12) text #5A7080  dot ○ (pulse)
PENDING      → bg rgba(232,168,56,0.12) text #E8A838  dot ● (spin)
ERROR        → bg rgba(248,81,73,0.12)  text #F85149  dot ● (blink)
READY        → bg rgba(63,185,80,0.12)  text #3FB950  ✓ checkmark
```

---

## Implementation Notes

### Tech Stack
```
Framework:    Next.js 14 (App Router)
Styling:      TailwindCSS + custom CSS variables
Charts:       Recharts (npm install recharts)
WebSocket:    socket.io-client
HTTP:         Axios with JWT interceptor
State:        Zustand
Icons:        Lucide React
Fonts:        Google Fonts — Syne + JetBrains Mono
```

### API Endpoints to Connect
```
POST   /api/auth/login           → login
POST   /api/auth/register        → register
GET    /api/auth/me              → current user

GET    /api/apps                 → list apps
POST   /api/apps                 → deploy app
GET    /api/apps/:name           → app details
GET    /api/apps/:name/status    → live status
PUT    /api/apps/:name           → update image
DELETE /api/apps/:name           → delete app

GET    /api/kafka/topics         → list topics
POST   /api/kafka/topics         → create topic
DELETE /api/kafka/topics/:name   → delete topic
GET    /api/kafka/topics/:name/lag → get LAG

POST   /api/eventing/kafkasource → create source
POST   /api/eventing/triggers    → create trigger
GET    /api/eventing/kafkasource → list sources
GET    /api/eventing/triggers    → list triggers

GET    /api/logs/:appName        → log history
WS     /ws/logs/:podName         → live logs

GET    /api/monitoring/metrics   → all metrics
GET    /api/monitoring/pods      → pods status
```

### JWT Axios Interceptor
```javascript
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
```

### WebSocket Live Logs
```javascript
import { io } from 'socket.io-client'

const socket = io('ws://localhost:8080')

socket.emit('subscribe', { pod: 'order-processor' })

socket.on('log', (data) => {
  setLogs(prev => [...prev.slice(-500), data])
  if (autoScroll) logRef.current?.scrollToBottom()
})

return () => socket.disconnect()
```

---

## Design Priorities

1. **Speed** — every page loads data immediately, show skeleton loaders
2. **Real-time** — live status badges, live logs, no manual refresh needed
3. **Clarity** — status always visible with color + text (never color alone)
4. **Actions** — deploy and delete always one click away
5. **Mobile** — sidebar collapses to hamburger menu on small screens
