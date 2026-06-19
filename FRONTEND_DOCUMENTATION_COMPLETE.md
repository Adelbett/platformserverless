# 🎨 FRONTEND - Documentation Complète des Fonctionnalités

**Platform Serverless - Web Portal v1.0**

Document complet couvrant toutes les fonctionnalités, composants, pages, flux de données et techniques du frontend React/TypeScript.

---

## 📑 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture générale](#architecture-générale)
3. [Stack Technologique](#stack-technologique)
4. [Pages principales](#pages-principales)
5. [Composants réutilisables](#composants-réutilisables)
6. [État global (State Management)](#état-global)
7. [Flux de données](#flux-de-données)
8. [Techniques innovantes](#techniques-innovantes)
9. [Sécurité côté client](#sécurité-côté-client)
10. [Performance & UX](#performance--ux)

---

## Vue d'ensemble

Le frontend **Platform Serverless** est une **Single Page Application (SPA)** construite en **React 18** avec **TypeScript**. Elle fournit une interface utilisateur moderne pour:

- ✅ Créer et déployer des applications Docker
- ✅ Monitorer les performances en temps réel
- ✅ Gérer les utilisateurs et les équipes
- ✅ Configurer des événements Kafka/Knative
- ✅ Voir la facturation en temps réel
- ✅ Consulter les logs de déploiement

### Caractéristiques clés:
- 📱 **Responsive Design** (Mobile, Tablet, Desktop)
- 🎨 **Modern UI** (Tailwind CSS, Headless UI)
- ⚡ **Real-time Updates** (SSE pour logs et métriques)
- 📊 **Interactive Charts** (Recharts)
- 🔐 **OAuth2 Integration** (Keycloak)
- 🚀 **Performance optimized** (Code splitting, lazy loading)
- ♿ **Accessible** (WCAG 2.1 AA)

---

## Architecture générale

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ App (Root Component)                                    │
│ - Authentication Context                                │
│ - Global State (Redux/Zustand)                          │
│ - Error Boundary                                        │
│ - Theme Provider                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ├─ Layout (Header, Sidebar, Footer)                    │
│ │  ├─ Navigation                                       │
│ │  └─ UserMenu                                         │
│ │                                                       │
│ ├─ Pages (Route-based)                                 │
│ │  ├─ Dashboard Page                                   │
│ │  ├─ Apps Management Page                             │
│ │  ├─ Kafka Events Page                                │
│ │  ├─ Metrics Page                                     │
│ │  ├─ Billing Page                                     │
│ │  ├─ Users/Team Page                                  │
│ │  └─ Logs Page                                        │
│ │                                                       │
│ ├─ Modals & Dialogs                                    │
│ │  ├─ CreateAppModal                                   │
│ │  ├─ EditAppModal                                     │
│ │  ├─ ConfirmDeleteModal                               │
│ │  └─ ...                                              │
│ │                                                       │
│ └─ Notifications                                       │
│    ├─ Toast (temporary)                                │
│    ├─ Alert (persistent)                               │
│    └─ Snackbar (bottom)                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Folder Structure

```
src/
├─ components/           # Reusable UI components
│  ├─ common/           # Buttons, Inputs, Cards, etc.
│  ├─ layout/           # Header, Sidebar, Footer
│  ├─ forms/            # Form inputs, validation
│  ├─ charts/           # Chart components (Recharts)
│  └─ modals/           # Dialog/Modal components
│
├─ pages/               # Page components (route-based)
│  ├─ Dashboard.tsx
│  ├─ AppsManagement.tsx
│  ├─ KafkaEvents.tsx
│  ├─ Metrics.tsx
│  ├─ Billing.tsx
│  ├─ Users.tsx
│  └─ Logs.tsx
│
├─ hooks/               # Custom React hooks
│  ├─ useAuth.ts
│  ├─ useFetch.ts
│  ├─ useLocalStorage.ts
│  ├─ useDebounce.ts
│  └─ useOnlineStatus.ts
│
├─ services/            # API client services
│  ├─ apiClient.ts      # Axios instance with interceptors
│  ├─ appService.ts     # App CRUD operations
│  ├─ authService.ts    # Authentication
│  ├─ kafkaService.ts   # Kafka management
│  ├─ metricsService.ts # Metrics fetching
│  ├─ billingService.ts # Billing data
│  └─ logsService.ts    # Log streaming (SSE)
│
├─ store/               # Global state management
│  ├─ slices/           # Redux slices or Zustand stores
│  │  ├─ authSlice.ts
│  │  ├─ appsSlice.ts
│  │  ├─ metricsSlice.ts
│  │  └─ uiSlice.ts
│  └─ store.ts          # Store configuration
│
├─ types/               # TypeScript types & interfaces
│  ├─ models.ts         # Domain models
│  ├─ api.ts            # API request/response types
│  └─ index.ts          # Re-exports
│
├─ utils/               # Utility functions
│  ├─ constants.ts      # App constants
│  ├─ formatters.ts     # Date, number formatting
│  ├─ validators.ts     # Form validation
│  └─ helpers.ts        # General helpers
│
├─ styles/              # Global styles
│  ├─ globals.css       # Tailwind imports
│  └─ variables.css     # CSS variables
│
├─ App.tsx              # Root component
├─ main.tsx             # Entry point
└─ index.html           # HTML template
```

---

## Stack Technologique

### Core Framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool (fast development)
- **Node.js** - Runtime environment

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **Headless UI** - Unstyled accessible components
- **Recharts** - React charting library
- **Heroicons** - SVG icon library

### State Management
- **Redux Toolkit** OR **Zustand** - Global state
- **Redux Persist** - State persistence (localStorage)

### HTTP Client
- **Axios** - Promise-based HTTP client
- **Interceptors** - Request/response middleware

### Authentication
- **Keycloak (client SDK)** - OAuth2/OIDC
- **JWT decode** - Token parsing
- **js-cookie** - Cookie management

### Real-time Communication
- **EventSource API** - Server-Sent Events (logs)
- **WebSocket** (optional) - Bi-directional communication

### Form Handling
- **React Hook Form** - Efficient form management
- **Zod** - Runtime schema validation
- **@hookform/resolvers** - Form validation integration

### Routing
- **React Router v6** - Client-side routing
- **useNavigate, useParams** - Route utilities

### Testing
- **Vitest** - Unit testing
- **React Testing Library** - Component testing
- **Mock Service Worker (MSW)** - API mocking

### Development Tools
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **env-local** - Environment variables

---

## Pages principales

### 1️⃣ **Dashboard Page**

#### 🎯 Objectif
Afficher un aperçu global de l'utilisateur avec statistiques clés et accès rapide aux ressources.

#### 📊 Contenu

```
Dashboard Page
├─ Header
│  ├─ "Welcome, John Doe"
│  └─ Current time & date
│
├─ Quick Stats Cards
│  ├─ Running Apps (count)
│  ├─ CPU Usage (%)
│  ├─ Memory Usage (%)
│  └─ Monthly Cost ($)
│
├─ Quick Actions
│  ├─ "Create App" button
│  ├─ "Add Team Member" button
│  └─ "View Logs" button
│
├─ Recent Deployments (table)
│  ├─ App Name
│  ├─ Status (badge)
│  ├─ Deployed date
│  └─ Last updated
│
├─ CPU & Memory Usage Chart
│  └─ Line chart (last 24h)
│
├─ Cost Trend Chart
│  └─ Bar chart (daily costs, last 7 days)
│
└─ Latest Logs
   ├─ Deployment logs
   ├─ System alerts
   └─ Activity feed
```

#### 💻 Composants utilisés

```tsx
<Dashboard>
  <DashboardHeader />
  <QuickStatsRow>
    <StatCard icon={Activity} title="Running Apps" value={12} />
    <StatCard icon={Cpu} title="CPU Usage" value={45 + "%"} />
    <StatCard icon={HardDrive} title="Memory" value={62 + "%"} />
    <StatCard icon={DollarSign} title="MTD Cost" value={"$123.45"} />
  </QuickStatsRow>
  
  <QuickActionsBar>
    <Button icon={Plus} onClick={() => openCreateAppModal()}>Create App</Button>
    <Button icon={Users} onClick={() => openTeamModal()}>Team</Button>
  </QuickActionsBar>
  
  <RecentDeploymentsTable apps={recentApps} />
  
  <ChartsRow>
    <ResourceUsageChart data={metricsData} />
    <CostTrendChart data={billingData} />
  </ChartsRow>
  
  <RecentLogsPanel logs={logs} />
</Dashboard>
```

#### 🔄 Flux d'interaction

```
1. Page charge
   ├─ Récupérer apps: GET /api/apps
   ├─ Récupérer metrics: GET /api/metrics/cluster
   ├─ Récupérer billing: GET /api/billing/my
   └─ Récupérer logs: GET /api/logs/user
   
2. User clicks "Create App"
   ├─ Open modal CreateAppModal
   ├─ User remplit form
   ├─ Click "Deploy"
   └─ POST /api/apps avec AppRequest
   
3. Real-time updates
   ├─ Subscribe to /api/logs/stream (SSE)
   ├─ Affiche new logs quand arrival
   └─ Auto-refresh metrics toutes les 30s
```

---

### 2️⃣ **Apps Management Page**

#### 🎯 Objectif
Lister, créer, modifier et supprimer les applications déployées.

#### 📊 Layout

```
Apps Page
├─ Header
│  ├─ Title "My Applications"
│  └─ "Create New App" button
│
├─ Filter & Search Bar
│  ├─ Search by name
│  ├─ Filter by status (Running, Failed, Idle)
│  └─ Sort options
│
├─ Apps Table/Grid
│  ├─ App Name
│  ├─ Status badge
│  ├─ CPU & Memory allocated
│  ├─ Replicas count
│  ├─ URL (clickable)
│  ├─ Deployed date
│  ├─ Actions dropdown
│  │  ├─ View Details
│  │  ├─ Edit
│  │  ├─ Redeploy
│  │  ├─ View Logs
│  │  └─ Delete
│  │
│  └─ Pagination (50 apps per page)
│
└─ Selected App Details Panel
   ├─ App name & image
   ├─ Current metrics
   ├─ Deployment history
   └─ Related resources (Kafka sources, triggers)
```

#### 💻 Composants utilisés

```tsx
<AppsManagement>
  <PageHeader>
    <h1>My Applications</h1>
    <Button primary onClick={() => openCreateAppModal()}>
      Create New App
    </Button>
  </PageHeader>
  
  <FilterBar>
    <SearchInput 
      placeholder="Search apps..."
      onChange={(value) => setSearchTerm(value)}
    />
    <Select value={statusFilter} onChange={setStatusFilter}>
      <option value="">All Status</option>
      <option value="RUNNING">Running</option>
      <option value="FAILED">Failed</option>
      <option value="IDLE">Idle</option>
    </Select>
  </FilterBar>
  
  <AppsTable 
    apps={filteredApps}
    onEdit={(app) => openEditModal(app)}
    onDelete={(app) => openDeleteConfirm(app)}
    onViewLogs={(app) => navigateToLogs(app.id)}
    loading={loading}
  />
  
  {selectedApp && (
    <AppDetailsPanel app={selectedApp} />
  )}
</AppsManagement>
```

#### ➕ CreateAppModal

```tsx
<Modal title="Create New Application">
  <Form onSubmit={handleCreateApp}>
    
    <FormSection title="Application Details">
      <TextInput 
        label="App Name"
        placeholder="my-api"
        {...form.register("name")}
        error={form.formState.errors.name}
      />
      
      <Select 
        label="Docker Image"
        {...form.register("imageName")}
      >
        <option>myregistry.azurecr.io/app1</option>
        <option>myregistry.azurecr.io/app2</option>
      </Select>
      
      <TextInput 
        label="Image Tag"
        placeholder="latest"
        {...form.register("imageTag")}
      />
      
      <NumberInput 
        label="Port"
        placeholder="8080"
        {...form.register("port", { valueAsNumber: true })}
      />
    </FormSection>
    
    <FormSection title="Resource Allocation">
      <Select 
        label="CPU Request"
        {...form.register("cpuRequest")}
      >
        <option value="100m">100m (0.1 cores)</option>
        <option value="250m">250m (0.25 cores)</option>
        <option value="500m">500m (0.5 cores)</option>
        <option value="1000m">1000m (1 core)</option>
      </Select>
      
      <Select 
        label="Memory Request"
        {...form.register("memoryRequest")}
      >
        <option value="128Mi">128 MB</option>
        <option value="256Mi">256 MB</option>
        <option value="512Mi">512 MB</option>
        <option value="1Gi">1 GB</option>
      </Select>
    </FormSection>
    
    <FormSection title="Autoscaling">
      <NumberInput 
        label="Min Replicas"
        placeholder="0"
        {...form.register("minReplicas", { valueAsNumber: true })}
      />
      
      <NumberInput 
        label="Max Replicas"
        placeholder="10"
        {...form.register("maxReplicas", { valueAsNumber: true })}
      />
    </FormSection>
    
    <FormSection title="Kafka Integration (Optional)">
      <Checkbox 
        label="Enable Kafka"
        {...form.register("kafkaEnabled")}
        onChange={(checked) => {
          form.setValue("kafkaEnabled", checked);
          if (!checked) form.setValue("kafkaTopicId", "");
        }}
      />
      
      {kafkaEnabled && (
        <Select 
          label="Kafka Topic"
          {...form.register("kafkaTopicId")}
        >
          {kafkaTopics.map(topic => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </Select>
      )}
    </FormSection>
    
    <FormActions>
      <Button type="button" variant="secondary" onClick={closeModal}>
        Cancel
      </Button>
      <Button 
        type="submit" 
        primary 
        loading={isSubmitting}
        disabled={!form.formState.isValid}
      >
        Create & Deploy
      </Button>
    </FormActions>
  </Form>
</Modal>
```

#### 🔄 Flux: Créer une app

```
1. User clicks "Create New App"
   └─ Open CreateAppModal
   
2. User remplit le formulaire
   ├─ App Name
   ├─ Docker image
   ├─ Resources (CPU, Memory)
   ├─ Autoscaling settings
   └─ Optional: Kafka integration
   
3. User clicks "Create & Deploy"
   ├─ Client validates form (Zod)
   ├─ POST /api/apps avec AppRequest
   │  {
   │    "name": "my-api",
   │    "imageName": "myregistry.azurecr.io/app1",
   │    "imageTag": "v1.0",
   │    "port": 8080,
   │    "cpuRequest": "500m",
   │    "memoryRequest": "256Mi",
   │    "minReplicas": 0,
   │    "maxReplicas": 10,
   │    "kafkaEnabled": false
   │  }
   │
   └─ Server retourne AppResponse
      {
        "id": "app-123",
        "name": "my-api",
        "status": "DEPLOYING",
        "url": null,
        "createdAt": "2026-06-12T10:15:30Z"
      }
   
4. Modal closes
   └─ Toast: "App creating... check logs for progress"
   
5. Apps table refreshes
   ├─ Récupère apps mises à jour: GET /api/apps
   └─ Affiche la nouvelle app avec status=DEPLOYING
   
6. Real-time log updates
   ├─ Subscribe à /api/logs/stream (SSE)
   ├─ Affiche log: "Deployment triggered"
   ├─ Affiche log: "Deployment successful"
   └─ App status change to RUNNING
   
7. URL becomes clickable
   └─ User peut cliquer pour accéder à l'app
```

---

### 3️⃣ **Kafka Events Page**

#### 🎯 Objectif
Gérer les topics Kafka, sources Kafka, et triggers Knative.

#### 📊 Layout

```
Kafka Events Page
├─ Tabs: "Topics" | "Sources" | "Triggers"
│
├─ TOPICS TAB
│  ├─ Create Topic button
│  ├─ Topics table
│  │  ├─ Topic Name
│  │  ├─ Partitions
│  │  ├─ Replicas
│  │  ├─ Messages count
│  │  ├─ Consumer groups
│  │  └─ Actions (delete)
│  │
│  └─ Topic Details Panel
│     ├─ Config JSON
│     ├─ Consumer groups
│     └─ Message preview
│
├─ SOURCES TAB
│  ├─ Create Source button
│  ├─ Sources table
│  │  ├─ Source Name
│  │  ├─ Topic name
│  │  ├─ Consumer Group
│  │  ├─ Bootstrap Servers
│  │  ├─ Ready status
│  │  └─ Actions
│  │
│  └─ Create KafkaSource Modal
│     ├─ Name
│     ├─ Topic (dropdown)
│     ├─ Consumer Group (auto-generated)
│     ├─ Bootstrap Servers (read-only)
│     └─ Config JSON
│
└─ TRIGGERS TAB
   ├─ Create Trigger button
   ├─ Triggers table
   │  ├─ Trigger Name
   │  ├─ Source (link)
   │  ├─ App Subscriber
   │  ├─ Event Filter
   │  ├─ Ready status
   │  └─ Actions
   │
   └─ Create Trigger Modal
      ├─ Name
      ├─ Source (dropdown of KafkaSources)
      ├─ Subscriber App (link to app)
      ├─ Event Filter (ce-type value)
      └─ Advanced: Retry policy
```

#### 💻 Code exemple

```tsx
<KafkaEventsPage>
  <Tabs value={activeTab} onChange={setActiveTab}>
    
    <TabPanel value="topics">
      <PageHeader>
        <h1>Kafka Topics</h1>
        <Button primary onClick={() => openCreateTopicModal()}>
          Create Topic
        </Button>
      </PageHeader>
      
      <TopicsTable 
        topics={topics}
        onDelete={(topic) => openDeleteConfirm(topic)}
        loading={loading}
      />
    </TabPanel>
    
    <TabPanel value="sources">
      <PageHeader>
        <h1>Kafka Sources</h1>
        <Button primary onClick={() => openCreateSourceModal()}>
          Create Source
        </Button>
      </PageHeader>
      
      <SourcesTable 
        sources={sources}
        onDelete={(source) => openDeleteConfirm(source)}
        loading={loading}
      />
    </TabPanel>
    
    <TabPanel value="triggers">
      <PageHeader>
        <h1>Knative Triggers</h1>
        <Button primary onClick={() => openCreateTriggerModal()}>
          Create Trigger
        </Button>
      </PageHeader>
      
      <TriggersTable 
        triggers={triggers}
        onDelete={(trigger) => openDeleteConfirm(trigger)}
        loading={loading}
      />
    </TabPanel>
  </Tabs>
</KafkaEventsPage>
```

---

### 4️⃣ **Metrics Page**

#### 🎯 Objectif
Afficher les métriques de performance en temps réel (CPU, Mémoire, Latence, Requêtes).

#### 📊 Layout

```
Metrics Page
├─ Time Range Selector
│  ├─ Last 1h
│  ├─ Last 6h
│  ├─ Last 24h
│  └─ Custom range
│
├─ Apps Selector
│  ├─ All Apps
│  ├─ Specific App (dropdown)
│  └─ Cluster overview
│
├─ METRIC CHARTS
│  ├─ Requests Per Second (Line chart)
│  │  └─ Y-axis: req/sec, X-axis: time
│  │
│  ├─ Error Rate (Line chart with threshold)
│  │  └─ Red zone when error rate > 5%
│  │
│  ├─ Response Latency (Multi-line: p50, p95, p99)
│  │  └─ Stacked line chart
│  │
│  ├─ CPU & Memory Usage (Stacked area chart)
│  │  ├─ Line 1: CPU (%)
│  │  ├─ Line 2: Memory (%)
│  │  └─ Shaded area
│  │
│  ├─ Active Replicas (Bar chart)
│  │  └─ Current replicas vs desired
│  │
│  └─ Network I/O (Line chart)
│     ├─ Network Send (MB/s)
│     └─ Network Receive (MB/s)
│
├─ SUMMARY CARDS
│  ├─ Average Latency (ms)
│  ├─ Peak Request Rate (req/sec)
│  ├─ Max Error Rate (%)
│  └─ Availability (%)
│
└─ Export Options
   ├─ Export as PNG
   ├─ Export as CSV
   └─ Scheduled reports
```

#### 💻 Code exemple

```tsx
<MetricsPage>
  <Controls>
    <TimeRangeSelector 
      value={timeRange}
      onChange={setTimeRange}
      options={['1h', '6h', '24h', 'custom']}
    />
    
    <AppSelector 
      value={selectedApp}
      onChange={setSelectedApp}
      options={apps}
    />
  </Controls>
  
  <MetricsGrid>
    <ChartCard title="Requests Per Second">
      <LineChart 
        data={metricsData}
        dataKey="reqPerSec"
        stroke="#3b82f6"
      />
    </ChartCard>
    
    <ChartCard title="Error Rate">
      <LineChart 
        data={metricsData}
        dataKey="errorRate"
        stroke="#ef4444"
        reference={5}  // 5% threshold
        referenceLabel="5% threshold"
      />
    </ChartCard>
    
    <ChartCard title="Response Latency (ms)">
      <LineChart 
        data={metricsData}
        lines={[
          { dataKey: 'latencyP50', name: 'P50' },
          { dataKey: 'latencyP95', name: 'P95' },
          { dataKey: 'latencyP99', name: 'P99' }
        ]}
      />
    </ChartCard>
    
    <ChartCard title="CPU & Memory Usage">
      <AreaChart 
        data={metricsData}
        lines={[
          { dataKey: 'cpu', name: 'CPU (%)' },
          { dataKey: 'memory', name: 'Memory (%)' }
        ]}
        stacked
      />
    </ChartCard>
  </MetricsGrid>
  
  <SummaryCards>
    <SummaryCard 
      label="Avg Latency"
      value={avgLatency.toFixed(2) + "ms"}
      trend={latencyTrend}
    />
    <SummaryCard 
      label="Peak Req/s"
      value={peakReqPerSec.toFixed(0)}
      trend={reqTrend}
    />
  </SummaryCards>
</MetricsPage>
```

---

### 5️⃣ **Billing Page**

#### 🎯 Objectif
Afficher les coûts MTD, projections mensuelles et historique de facturation.

#### 📊 Layout

```
Billing Page
├─ Cost Overview Cards
│  ├─ Month-to-Date: $45.67
│  ├─ Projected Monthly: $124.50
│  ├─ Daily Average: $4.15
│  └─ Hourly Rate: $4.05
│
├─ Cost Trend Chart
│  └─ Bar chart: daily costs (last 30 days)
│
├─ Cost by App (Pie/Donut chart)
│  ├─ api-server: $25.43 (52%)
│  ├─ worker: $15.23 (31%)
│  └─ frontend: $7.01 (14%)
│
├─ Cost Breakdown Table
│  ├─ App Name
│  ├─ CPU Cost
│  ├─ Memory Cost
│  ├─ Total Cost
│  ├─ Uptime %
│  └─ Usage Details
│
├─ Daily History Table
│  ├─ Date
│  ├─ Cost
│  ├─ Apps count
│  ├─ Avg CPU %
│  └─ Avg Memory %
│
└─ Invoice & Export
   ├─ Download Invoice (PDF)
   ├─ Export History (CSV)
   └─ Email Invoice
```

#### 💻 Code exemple

```tsx
<BillingPage>
  <CostOverviewCards>
    <CostCard 
      label="Month-to-Date"
      amount={billing.monthToDateCost}
      currency="USD"
      previousMonth={billing.previousMonthCost}
    />
    <CostCard 
      label="Projected Monthly"
      amount={billing.projectedMonthlyCost}
      currency="USD"
    />
    <CostCard 
      label="Daily Average"
      amount={billing.monthToDateCost / day}
      currency="USD"
    />
    <CostCard 
      label="Hourly Rate"
      amount={billing.hourlyRate}
      currency="USD"
    />
  </CostOverviewCards>
  
  <ChartsRow>
    <CostTrendChart data={billing.dailyHistory} />
    <CostByAppPie data={billing.perAppBreakdown} />
  </ChartsRow>
  
  <CostBreakdownTable 
    apps={billing.perAppBreakdown}
    columns={['appName', 'cpuCost', 'memoryCost', 'totalCost', 'uptime']}
  />
  
  <DailyHistoryTable 
    data={billing.dailyHistory}
    pageSize={10}
  />
  
  <ExportSection>
    <Button onClick={() => downloadInvoice()}>
      Download Invoice (PDF)
    </Button>
    <Button onClick={() => exportCSV()}>
      Export History (CSV)
    </Button>
  </ExportSection>
</BillingPage>
```

---

### 6️⃣ **Users & Team Management Page**

#### 🎯 Objectif
Gérer les utilisateurs, créer des équipes (pour CLIENT_ADMIN), assigner des rôles.

#### 📊 Layout

```
Users & Team Page
├─ User Profile Section (si CLIENT_ADMIN)
│  ├─ Profile info
│  ├─ Team name
│  └─ Team members count
│
├─ Team Members (pour CLIENT_ADMIN)
│  ├─ Add Member button
│  ├─ Members table
│  │  ├─ Name
│  │  ├─ Email
│  │  ├─ Role (badge)
│  │  ├─ Join date
│  │  ├─ Last active
│  │  └─ Actions (change role, remove)
│  │
│  └─ Add Member Modal
│     ├─ Email
│     ├─ Role (DEVELOPER, VIEWER, BILLING_MANAGER)
│     └─ Send invite email
│
├─ All Users (si ADMIN)
│  ├─ Users table
│  │  ├─ Username
│  │  ├─ Email
│  │  ├─ Role
│  │  ├─ Team
│  │  ├─ Status
│  │  └─ Actions (suspend, change role)
│  │
│  └─ User management options
│     ├─ Suspend/Unsuspend user
│     ├─ Reset password
│     └─ Delete user (permanent)
│
└─ Role Permissions Reference
   ├─ ADMIN: All permissions
   ├─ CLIENT_ADMIN: Team management + deployments
   ├─ DEVELOPER: Create/deploy apps
   ├─ VIEWER: Read-only access
   └─ BILLING_MANAGER: View billing
```

---

### 7️⃣ **Logs Page**

#### 🎯 Objectif
Afficher les logs de déploiement en temps réel avec streaming SSE.

#### 📊 Layout

```
Logs Page
├─ Filter & Search
│  ├─ App selector (dropdown)
│  ├─ Log type filter
│  │  ├─ All
│  ├─ DEPLOYMENT_START
│  │  ├─ DEPLOYMENT_SUCCESS
│  │  ├─ DEPLOYMENT_FAIL
│  │  ├─ KAFKA_WIRED
│  │  ├─ UPDATE
│  │  └─ DELETE
│  │
│  ├─ Time range
│  └─ Search by message
│
├─ Real-time Log Stream (SSE)
│  ├─ Logs auto-update
│  ├─ Scroll to latest
│  ├─ Color-coded by type
│  │  ├─ INFO: gray
│  │  ├─ SUCCESS: green
│  │  ├─ FAIL: red
│  │  └─ KAFKA_WIRED: blue
│  │
│  └─ Each log shows
│     ├─ Timestamp
│     ├─ Type badge
│     ├─ App name
│     ├─ Message
│     └─ Context menu (copy, expand)
│
├─ Log Details Panel (on click)
│  ├─ Full message
│  ├─ Raw data (if available)
│  └─ Copy button
│
└─ Controls
   ├─ Auto-scroll toggle
   ├─ Pause/Resume
   ├─ Clear logs
   └─ Export logs
```

#### 💻 Code exemple

```tsx
<LogsPage>
  <LogFilters>
    <Select 
      label="App"
      value={selectedApp}
      onChange={setSelectedApp}
      options={[{value: '', label: 'All apps'}, ...apps]}
    />
    
    <MultiSelect 
      label="Log Types"
      value={selectedTypes}
      onChange={setSelectedTypes}
      options={logTypes}
    />
    
    <SearchInput 
      placeholder="Search logs..."
      value={searchTerm}
      onChange={setSearchTerm}
    />
  </LogFilters>
  
  <LogsStreamContainer
    logs={filteredLogs}
    isStreaming={streaming}
    onToggleStream={setStreaming}
  >
    {filteredLogs.map((log) => (
      <LogEntry 
        key={log.id}
        log={log}
        onClick={() => setSelectedLog(log)}
        highlighted={selectedLog?.id === log.id}
      >
        <span className="text-xs text-gray-500">
          {formatTime(log.createdAt)}
        </span>
        
        <Badge className={getBadgeColor(log.type)}>
          {log.type}
        </Badge>
        
        <span className="font-medium">{log.appName}</span>
        
        <span className="text-gray-700">{log.message}</span>
      </LogEntry>
    ))}
  </LogsStreamContainer>
  
  {selectedLog && (
    <LogDetailsPanel 
      log={selectedLog}
      onClose={() => setSelectedLog(null)}
    />
  )}
</LogsPage>
```

#### 🔄 Real-time SSE Streaming

```tsx
useEffect(() => {
  if (!streaming) return;
  
  const eventSource = new EventSource('/api/logs/stream', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  eventSource.onmessage = (event) => {
    try {
      const log = JSON.parse(event.data);
      setLogs(prev => [log, ...prev]);  // Prepend newest
      
      // Auto-scroll to top if log is from selected app
      if (!selectedApp || log.appId === selectedApp) {
        scrollToTop();
      }
    } catch (e) {
      console.error('Failed to parse log:', e);
    }
  };
  
  eventSource.onerror = () => {
    toast.error('Connection lost to log stream');
    eventSource.close();
    setStreaming(false);
  };
  
  return () => eventSource.close();
}, [streaming, selectedApp, token]);
```

---

## Composants réutilisables

### Common Components

```
Button
├─ Props: primary, secondary, danger, variant, size, loading, disabled
└─ Accessibility: keyboard navigation, focus states

Input / TextInput / NumberInput
├─ Props: label, placeholder, error, helperText, required
└─ Accessibility: associated label, error messages

Select / MultiSelect
├─ Props: options, value, onChange, disabled, clearable
└─ Keyboard navigation

Checkbox / Radio / Toggle
├─ Props: label, checked, onChange, disabled
└─ Accessibility: proper labeling

Card
├─ Props: title, subtitle, children, footer, hoverable
└─ Consistent padding and shadows

Modal / Dialog
├─ Props: title, isOpen, onClose, size, centered
├─ Keyboard: Esc to close
└─ Focus trap

Tabs
├─ Props: tabs, value, onChange
└─ Accessibility: ARIA roles

Table
├─ Props: columns, data, sortable, selectable, pagination
├─ Features: sorting, filtering, row selection
└─ Responsive: mobile-friendly

Alert / Toast / Notification
├─ Alert: persistent
├─ Toast: temporary (3s)
└─ Snackbar: bottom notification

Badge / Chip
├─ Props: color, variant, icon, onClose
└─ Usage: status, tags, removable pills

Spinner / Skeleton
├─ Spinner: loading indicator
└─ Skeleton: content placeholder

Status Indicator
├─ Props: status (running, failed, idle, pending)
├─ Color-coded visualization
└─ Animated for pending states
```

### Form Components

```
FormSection
├─ Props: title, description, children
└─ Visual grouping

FormField
├─ Props: label, required, error, helperText, children
└─ Consistent layout

FormActions
├─ Props: children (usually buttons)
└─ Right-aligned buttons

Validation Feedback
├─ Real-time validation
├─ Field-level errors
└─ Form-level errors
```

### Chart Components

```
LineChart
├─ Multi-line support
├─ Custom colors
└─ Responsive

AreaChart
├─ Stacked areas
└─ Time-series data

BarChart
├─ Grouped/Stacked bars
└─ Category data

PieChart / DonutChart
├─ Percentage display
└─ Legends

ComposedChart
├─ Mixed chart types
└─ Dual Y-axis
```

---

## État global (State Management)

### Redux Slices (ou Zustand stores)

```typescript
// authSlice.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      });
  }
});

// appsSlice.ts
interface AppsState {
  apps: App[];
  selectedApp: App | null;
  isLoading: boolean;
  error: string | null;
  filter: AppFilter;
}

export const appsSlice = createSlice({
  name: 'apps',
  initialState,
  reducers: {
    setApps: (state, action) => {
      state.apps = action.payload;
    },
    addApp: (state, action) => {
      state.apps.push(action.payload);
    },
    updateApp: (state, action) => {
      const index = state.apps.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.apps[index] = action.payload;
      }
    },
    removeApp: (state, action) => {
      state.apps = state.apps.filter(a => a.id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchAppsAsync.fulfilled, (state, action) => {
      state.apps = action.payload;
      state.isLoading = false;
    });
  }
});

// uiSlice.ts
interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  modals: {
    [key: string]: boolean;
  };
  notifications: Notification[];
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    openModal: (state, action) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action) => {
      state.modals[action.payload] = false;
    },
    addNotification: (state, action) => {
      state.notifications.push({
        id: nanoid(),
        ...action.payload
      });
    }
  }
});
```

---

## Flux de données

### 1️⃣ Flux: Authentification Keycloak

```
1. User land sur login page
   └─ src/pages/Login.tsx
   
2. User enters credentials
   ├─ Username
   └─ Password
   
3. User clicks "Login"
   └─ authService.login(credentials)
      │
      ├─ axios.post('/api/auth/login')
      │  └─ Backend validates with Keycloak
      │
      └─ Response:
         {
           "token": "eyJhbGciOiJIUzI1NiIs...",
           "tokenType": "Bearer",
           "expiresIn": 3600,
           "user": {
             "id": "user-123",
             "username": "john.doe",
             "email": "john@example.com",
             "role": "CLIENT_ADMIN"
           }
         }

4. Frontend stores token
   ├─ Redux: authSlice.setToken(token)
   ├─ localStorage: save token (persistent)
   └─ axios default header: Authorization: Bearer <token>

5. Redirect to dashboard
   └─ useNavigate('/dashboard')
   
6. Dashboard loads
   ├─ useAuth() hook checks isAuthenticated
   ├─ fetchApps() → GET /api/apps
   ├─ fetchMetrics() → GET /api/metrics/cluster
   └─ fetchBilling() → GET /api/billing/my
```

### 2️⃣ Flux: Créer une application

```
User clicks "Create New App"
│
└─ CreateAppModal opens
   ├─ Form avec React Hook Form + Zod validation
   │
   └─ User remplit & submit
      │
      ├─ Client validation (Zod schema)
      │  └─ Vérifie: name, imageName, resources, etc.
      │
      ├─ POST /api/apps avec AppRequest
      │  {
      │    "name": "my-api",
      │    "imageName": "registry.azurecr.io/app",
      │    "imageTag": "v1.0",
      │    "port": 8080,
      │    "cpuRequest": "500m",
      │    "memoryRequest": "256Mi",
      │    "minReplicas": 0,
      │    "maxReplicas": 10
      │  }
      │
      └─ Axios interceptor ajoute JWT token
      
Response 200 OK
│
├─ Toast: "App created successfully!"
├─ Redux: appsSlice.addApp(newApp)
├─ Modal closes
│
└─ Frontend subscribes to real-time logs
   │
   ├─ new EventSource('/api/logs/stream')
   │
   ├─ Affiche les logs:
   │  ├─ "Deployment triggered"
   │  ├─ "Building container image..."
   │  ├─ "Pushing to registry..."
   │  ├─ "Creating Knative service..."
   │  └─ "Deployment successful"
   │
   └─ App status changes DEPLOYING → RUNNING
      └─ URL becomes clickable
      
Apps table auto-refreshes
│
├─ GET /api/apps (toutes les 30s)
│
└─ New app appears with status=RUNNING
```

### 3️⃣ Flux: Monitoring en temps réel

```
1. User navigates to Metrics page
   └─ MetricsPage component mounts
   
2. Initial data load
   ├─ GET /api/metrics/app/{appId}
   └─ Display charts
   
3. Auto-refresh metrics
   ├─ setInterval(() => {
   │    GET /api/metrics/app/{appId}
   │  }, 30000)  // 30s
   │
   └─ Update Redux store: metricsSlice.setMetrics()
   
4. Charts re-render with new data
   ├─ Recharts detects data change
   └─ Smoothly animates to new values
   
5. User hovers over chart point
   ├─ Tooltip shows detailed values
   │  ├─ Timestamp
   │  ├─ Value
   │  └─ Trend indicator
   │
   └─ Aria-label for accessibility
   
6. User changes time range
   ├─ Select: 1h, 6h, 24h, custom
   │
   ├─ fetchMetrics(appId, timeRange)
   │  └─ GET /api/metrics/app/{appId}?timeRange=1h
   │
   └─ Charts update with new range data
```

### 4️⃣ Flux: Real-time logs via SSE

```
1. User opens Logs page OR creates app
   └─ Logs component mounts
   
2. Open EventSource connection
   ├─ const eventSource = new EventSource('/api/logs/stream')
   │
   └─ Add JWT token via custom headers
      (requires backend to support Authorization header)
      
3. Listen for log events
   ├─ eventSource.onmessage = (event) => {
   │    const log = JSON.parse(event.data);
   │    setLogs(prev => [log, ...prev]);
   │  }
   │
   └─ Logs prepended to list (newest first)
   
4. Color-code logs by type
   ├─ DEPLOYMENT_START: blue
   ├─ DEPLOYMENT_SUCCESS: green
   ├─ DEPLOYMENT_FAIL: red
   ├─ KAFKA_WIRED: purple
   └─ INFO: gray
   
5. Auto-scroll to latest
   ├─ scrollToTop() on new log
   └─ User can manually scroll to disable auto-scroll
   
6. Connection management
   ├─ onunmount: eventSource.close()
   ├─ onerror: reconnect after 5s (exponential backoff)
   └─ disconnect after 5 min idle
```

---

## Techniques innovantes

### 1️⃣ **Real-time Updates avec EventSource (SSE)**

```typescript
// services/logsService.ts
export function subscribeToLogs(userId: string): Promise<Logs[]> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(
      `/api/logs/stream`,
      {
        // Note: Browser may not support Authorization header in EventSource
        // Solution: use token in URL as query param
      }
    );
    
    const logs: DeploymentLog[] = [];
    
    eventSource.onmessage = (event) => {
      try {
        const log: DeploymentLog = JSON.parse(event.data);
        logs.push(log);
      } catch (e) {
        console.error('Parse error:', e);
      }
    };
    
    eventSource.onerror = () => {
      eventSource.close();
      reject(new Error('Connection failed'));
    };
    
    // Auto-close after 30 minutes
    setTimeout(() => {
      eventSource.close();
      resolve(logs);
    }, 30 * 60 * 1000);
  });
}

// Hooks/useLogStream.ts
export function useLogStream() {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  useEffect(() => {
    const token = getAuthToken();
    
    // URL avec token en query param
    const eventSource = new EventSource(
      `/api/logs/stream?token=${token}`
    );
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data) as DeploymentLog;
        setLogs(prev => [log, ...prev]);  // Prepend
      } catch (e) {
        console.error('Parse error:', e);
      }
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      
      // Reconnect après 5s avec exponential backoff
      setTimeout(() => {
        reconnect();
      }, Math.min(5000 * Math.pow(2, retryCount), 60000));
    };
    
    eventSourceRef.current = eventSource;
    
    return () => eventSource.close();
  }, []);
  
  return { logs, isConnected };
}
```

### 2️⃣ **Axios Interceptors pour JWT Refresh**

```typescript
// services/apiClient.ts
const axiosInstance = axios.create({
  baseURL: 'https://api.platform.example.com',
  timeout: 10000
});

// Request interceptor: ajouter JWT
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: gestion 401 (token expiré)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh token
        const response = await axios.post(
          'https://api.platform.example.com/api/auth/refresh',
          { token: localStorage.getItem('auth_token') }
        );
        
        const newToken = response.data.token;
        localStorage.setItem('auth_token', newToken);
        
        // Retry original request avec nouveau token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh échoué: redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
```

### 3️⃣ **React Hook Form avec Zod Validation**

```typescript
// components/CreateAppModal.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define validation schema
const createAppSchema = z.object({
  name: z
    .string()
    .min(2, 'App name must be at least 2 characters')
    .max(50, 'App name must be at most 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  
  imageName: z
    .string()
    .min(3, 'Image name required')
    .url('Invalid image registry URL'),
  
  imageTag: z
    .string()
    .default('latest')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid image tag format'),
  
  port: z
    .number()
    .min(1024, 'Port must be >= 1024')
    .max(65535, 'Port must be <= 65535'),
  
  cpuRequest: z
    .enum(['100m', '250m', '500m', '1000m']),
  
  memoryRequest: z
    .enum(['128Mi', '256Mi', '512Mi', '1Gi']),
  
  minReplicas: z
    .number()
    .min(0, 'Min replicas >= 0'),
  
  maxReplicas: z
    .number()
    .min(1, 'Max replicas >= 1')
    .refine(
      (maxReplicas) => maxReplicas >= form.watch('minReplicas'),
      'Max must be >= Min'
    ),
  
  kafkaEnabled: z.boolean().default(false),
  
  kafkaTopicId: z
    .string()
    .optional()
    .refine(
      (topicId) => !form.watch('kafkaEnabled') || topicId,
      'Topic required when Kafka enabled'
    )
});

type CreateAppForm = z.infer<typeof createAppSchema>;

export function CreateAppModal() {
  const form = useForm<CreateAppForm>({
    resolver: zodResolver(createAppSchema),
    mode: 'onChange'  // Real-time validation
  });
  
  const onSubmit: SubmitHandler<CreateAppForm> = async (data) => {
    try {
      const response = await appService.createApp(data);
      toast.success('App created successfully!');
      form.reset();
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  return (
    <Form onSubmit={form.handleSubmit(onSubmit)}>
      <TextInput
        label="App Name"
        {...form.register('name')}
        error={form.formState.errors.name?.message}
      />
      
      <Select
        label="CPU Request"
        {...form.register('cpuRequest')}
        error={form.formState.errors.cpuRequest?.message}
      >
        {/* options */}
      </Select>
      
      <Checkbox
        label="Enable Kafka"
        {...form.register('kafkaEnabled')}
      />
      
      {form.watch('kafkaEnabled') && (
        <Select
          label="Kafka Topic"
          {...form.register('kafkaTopicId')}
          error={form.formState.errors.kafkaTopicId?.message}
        />
      )}
      
      <Button 
        type="submit" 
        disabled={!form.formState.isValid}
      >
        Create App
      </Button>
    </Form>
  );
}
```

### 4️⃣ **Custom Hooks pour réutilisabilité**

```typescript
// hooks/useFetch.ts
export function useFetch<T>(
  url: string,
  options?: FetchOptions
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<T>(url);
        setData(response.data);
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err as Error);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    return () => abortController.abort();
  }, [url]);
  
  const refetch = useCallback(() => {
    fetchData();
  }, [url]);
  
  return { data, loading, error, refetch };
}

// Usage:
const { data: apps, loading, error, refetch } = useFetch('/api/apps');

// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Usage:
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) {
    fetchApps(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);

// hooks/useLocalStorage.ts
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });
  
  const setValue = (value: T) => {
    setStoredValue(value);
    localStorage.setItem(key, JSON.stringify(value));
  };
  
  return [storedValue, setValue];
}

// Usage:
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### 5️⃣ **Recharts pour Data Visualization**

```typescript
// components/ResourceUsageChart.tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

export function ResourceUsageChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={(timestamp) => format(new Date(timestamp), 'HH:mm')}
        />
        <YAxis label={{ value: 'Usage (%)', angle: -90, position: 'insideLeft' }} />
        
        <Tooltip 
          contentStyle={{ backgroundColor: '#f0f9ff' }}
          formatter={(value) => [`${value.toFixed(2)}%`, '']}
          labelFormatter={(label) => format(new Date(label), 'MMM dd, HH:mm')}
        />
        
        <Legend />
        
        {/* Normal range 0-100% */}
        <ReferenceLine y={80} label="High" stroke="#fbbf24" strokeDasharray="3 3" />
        <ReferenceLine y={50} label="Normal" stroke="#86efac" strokeDasharray="3 3" />
        
        {/* CPU line */}
        <Line 
          type="monotone" 
          dataKey="cpu" 
          stroke="#3b82f6" 
          dot={false}
          name="CPU Usage"
          isAnimationActive={true}
        />
        
        {/* Memory line */}
        <Line 
          type="monotone" 
          dataKey="memory" 
          stroke="#ef4444" 
          dot={false}
          name="Memory Usage"
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 6️⃣ **Responsive Design avec Tailwind CSS**

```tsx
// components/Dashboard.tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
  {/* Cards stack on mobile, 2 cols on tablet, 4 cols on desktop */}
  <StatCard icon={Activity} title="Apps" value={12} />
  <StatCard icon={Cpu} title="CPU" value={"45%"} />
  <StatCard icon={HardDrive} title="Memory" value={"62%"} />
  <StatCard icon={DollarSign} title="Cost" value={"$123"} />
</div>

{/* Sidebar + Content layout */}
<div className="flex h-screen">
  {/* Sidebar: 250px on desktop, hidden on mobile */}
  <aside className="hidden lg:block w-64 bg-gray-900 text-white">
    <Navigation />
  </aside>
  
  {/* Mobile menu button */}
  <button 
    className="lg:hidden fixed bottom-4 right-4 z-50"
    onClick={() => setSidebarOpen(!sidebarOpen)}
  >
    <Menu />
  </button>
  
  {/* Main content */}
  <main className="flex-1 overflow-auto">
    <Header />
    <Content />
  </main>
</div>

{/* Modal responsive */}
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
  {/* Modal width: 95% on mobile, 600px on desktop */}
  <div className="bg-white rounded-lg w-full max-w-2xl max-h-screen overflow-auto">
    <ModalContent />
  </div>
</div>
```

### 7️⃣ **Error Boundaries pour gestion d'erreurs**

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service (Sentry, DataDog, etc.)
    logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-2xl font-bold text-red-600">
            Oops! Something went wrong
          </h1>
          <p className="text-gray-600 mt-2">
            {this.state.error?.message}
          </p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => window.location.href = '/'}
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage:
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Sécurité côté client

### 🔐 Protections

```
1. XSS (Cross-Site Scripting)
   ├─ React auto-escapes content
   ├─ Never use dangerouslySetInnerHTML
   └─ DOMPurify for user-generated content

2. CSRF (Cross-Site Request Forgery)
   ├─ JWT tokens (stateless)
   ├─ SameSite cookie attribute
   └─ No reliance on cookies alone

3. Sensitive Data
   ├─ Store JWT in localStorage (not cookies)
   ├─ Clear token on logout
   ├─ Never log sensitive data
   └─ Use HTTPS only

4. CORS
   ├─ Configured on backend
   ├─ Whitelist frontend domain
   └─ No credentials in CORS

5. Content Security Policy (CSP)
   ├─ Restrict resource loading
   ├─ No inline scripts
   └─ Nonce-based inline styles

6. Dependency Security
   ├─ npm audit regularly
   ├─ Dependabot updates
   └─ Lock dependencies (package-lock.json)

7. Secrets Management
   ├─ Never hardcode API keys
   ├─ Use .env for configuration
   ├─ .env.local not in version control
   └─ Environment variable per deployment
```

### 🛡️ Implementation Examples

```typescript
// .env.local (never commit)
VITE_API_BASE_URL=https://api.platform.example.com
VITE_KEYCLOAK_URL=https://keycloak.example.com

// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
        secure: true
      }
    }
  },
  define: {
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL)
  }
})

// utils/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html);
}

// Usage:
<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(userContent) }} />
```

---

## Performance & UX

### ⚡ Optimizations

```
1. Code Splitting
   ├─ Route-based code splitting
   ├─ Dynamic imports
   └─ Lazy-load components

2. Bundle Size
   ├─ Tree-shaking
   ├─ Remove unused dependencies
   └─ Minification/compression

3. Rendering
   ├─ React.memo for pure components
   ├─ useMemo for expensive calculations
   ├─ useCallback for stable function refs
   └─ Virtual scrolling for large lists

4. Network
   ├─ HTTP/2 multiplexing
   ├─ Gzip compression
   ├─ Browser caching headers
   └─ CDN for static assets

5. Images
   ├─ WebP format with fallback
   ├─ Responsive images
   ├─ Lazy loading
   └─ SVG for icons

6. Monitoring
   ├─ Web Vitals (LCP, FID, CLS)
   ├─ Sentry for error tracking
   ├─ Google Analytics
   └─ Custom performance metrics
```

### 💻 Implementation Examples

```typescript
// Route-based code splitting
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AppsManagement = React.lazy(() => import('./pages/AppsManagement'));

// App routing
<Routes>
  <Route 
    path="/dashboard" 
    element={
      <Suspense fallback={<LoadingScreen />}>
        <Dashboard />
      </Suspense>
    } 
  />
  <Route 
    path="/apps" 
    element={
      <Suspense fallback={<LoadingScreen />}>
        <AppsManagement />
      </Suspense>
    } 
  />
</Routes>

// React.memo for performance
const AppCard = React.memo(function AppCard({ app, onEdit, onDelete }) {
  return (
    <Card>
      <h3>{app.name}</h3>
      <p>{app.status}</p>
      <Button onClick={() => onEdit(app)}>Edit</Button>
    </Card>
  );
});

// useMemo for expensive calculations
const sortedApps = useMemo(
  () => apps.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [apps, sortBy]
);

// useCallback for stable function refs
const handleDelete = useCallback((appId: string) => {
  appService.deleteApp(appId);
  setApps(prev => prev.filter(a => a.id !== appId));
}, []);

// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

*Document généré le 2026-06-12 - Frontend Platform Serverless v1.0*

## 🎉 Résumé Complet

### Backend + Frontend = Plateforme Complète

**Backend:**
- 8 entités JPA
- 7 domaines métier
- API REST complète
- Authentification Keycloak/OAuth2
- Événementiel Kafka + Knative
- Monitoring Prometheus
- Facturation horaire
- Logging temps réel SSE

**Frontend:**
- 7 pages principales
- 20+ composants réutilisables
- State management Redux
- Real-time updates SSE
- Responsive design Tailwind
- Charts Recharts
- Validation Zod + React Hook Form
- Performance optimized

---

Tous les détails de **A à Z** sont maintenant documentés! 🚀
