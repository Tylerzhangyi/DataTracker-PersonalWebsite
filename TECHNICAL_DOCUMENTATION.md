# Technical Documentation: Website Tracking and Analytics System

**Author:** Yi Zhang  
**Date:** 19/01/2026

---

## Abstract

This document presents a comprehensive technical overview of a lightweight web analytics and tracking system designed to monitor user behavior on websites. The system consists of a JavaScript-based client-side tracking library, an Express.js backend server with SQLite database, and an interactive dashboard for data visualization. The architecture enables real-time collection of pageviews, click events, scroll depth, and session duration mtrics while maintaining user privacy through anonymized data collection. The system supports multiple visualization techniques including Sankey flow diagrams, pie charts, and tabular displays to provide actionable insights into user behavior patterns.

**Keywords:** web analytics, user tracking, event tracking, data visualization, Express.js, SQLite

---

## I. Introduction

### A. Purpose and Scope

This technical documentation describes the design, implementation, and architecture of a website tracking and analytics system. The system is designed to provide website owners with insights into visitor behavior through automated event collection and visualization. The solution is privacy-conscious, lightweight, and suitable for deployment on personal websites or small-scale applications.

### B. System Overview

The tracking system operates through three primary components:

1. **Client-side Tracker**: A JavaScript library injected into target websites to capture user interactions
2. **Backend Server**: An Express.js application that receives, stores, and processes tracking events
3. **Analytics Dashboard**: A web-based interface for visualizing collected data through charts and tables

---

## II. System Architecture

### A. Overall System Design

The system follows a client-server architecture with clear separation between data collection, storage, and presentation layers. Figure 1 illustrates the high-level architecture.

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Target Website │────────▶│  Tracking Server │────────▶│  SQLite Database│
│  (with tracker) │  Events │  (Express.js)    │  Store  │                 │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                      │
                                      │ GET /stats
                                      ▼
                            ┌──────────────────┐
                            │                  │
                            │ Analytics        │
                            │ Dashboard        │
                            │ (HTML/JS)        │
                            │                  │
                            └──────────────────┘
```

*Figure 1: System Architecture Overview*

### B. Backend Architecture

#### 1. Server Technology Stack

The backend server is implemented using Node.js with the following core dependencies:

- **Express.js 4.18.2**: Web application framework for handling HTTP requests
- **SQLite3 5.1.7**: Embedded relational database for event storage
- **ua-parser-js 1.0.37**: User-Agent parsing library for device information extraction
- **CORS 2.8.5**: Cross-Origin Resource Sharing middleware for API access control

#### 2. Database Schema

The system uses a single SQLite table `events` to store all tracking data with the following schema:

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  ts INTEGER NOT NULL,              -- epoch milliseconds
  type TEXT NOT NULL,               -- pageview/click/scroll/duration/custom
  session_id TEXT,                  -- session identifier
  visitor_id TEXT,                  -- anonymous visitor identifier
  url TEXT,
  path TEXT,
  referrer TEXT,
  ua TEXT,                          -- user agent string
  ip_hash TEXT,                     -- hashed IP address (privacy protection)
  data TEXT                         -- JSON payload for event-specific data
);
```

**Indexes:**
- `idx_events_site_ts`: Composite index on (site, ts) for time-based queries
- `idx_events_site_type_ts`: Composite index on (site, type, ts) for event type filtering
- `idx_events_site_session_ts`: Composite index on (site, session_id, ts) for session tracking

#### 3. Server Components

The server (`server.js`) implements the following key functions:

**a) Database Abstraction Layer:**
- `dbRun()`: Promise-wrapper for SQL INSERT/UPDATE/DELETE operations
- `dbGet()`: Promise-wrapper for single-row SELECT queries
- `dbAll()`: Promise-wrapper for multi-row SELECT queries

**b) Privacy Protection:**
- `hashIp()`: SHA-256 hashing function that truncates IP addresses to 16-character hashes
- IP addresses are never stored in plaintext, ensuring user privacy

**c) Device Information Parsing:**
- `parseDevice()`: Uses UAParser.js to extract device type, operating system, and browser information from User-Agent strings
- Returns structured object: `{device, deviceType, os, browser}`

**d) Sankey Diagram Data Builder:**
- `buildSankeyData()`: Constructs flow diagram data structures with configurable layers
- Supports multiple flow dimensions: referrer → device → path, referrer → OS → path, etc.

### C. Frontend Architecture

#### 1. Tracking Script Architecture

The client-side tracker (`tracker.js`) is implemented as an immediately-invoked function expression (IIFE) to avoid global namespace pollution. Key features:

**a) Configuration:**
- Site identifier extracted from `data-site` attribute or `location.host`
- Endpoint URL extracted from `data-endpoint` attribute or default server address
- Supports dynamic endpoint configuration without code modification

**b) Visitor Identification:**
- **Visitor ID**: Stored in `localStorage` with key `__wt_vid`, persists across sessions
- **Session ID**: Stored in `sessionStorage` with key `__wt_sid`, resets per browser session
- Both IDs use format: `{prefix}-{timestamp(hex)}-{random(hex)}`

**c) Event Transmission:**
- Primary method: `navigator.sendBeacon()` API for reliable delivery during page unload
- Fallback method: `fetch()` API with `keepalive: true` option
- Asynchronous transmission to avoid blocking page rendering

#### 2. Dashboard Architecture

The analytics dashboard (`dashboard/index.html`) is a single-page application (SPA) with the following structure:

**a) Libraries:**
- **Plotly.js 2.27.0**: For rendering Sankey flow diagrams
- **Chart.js 4.4.0**: For rendering pie/doughnut charts

**b) UI Components:**
- Header controls: Endpoint configuration, site selector, time range filter
- Metric cards: PV (Pageviews), UV (Unique Visitors), time window, event count
- Visualization panels: Sankey diagram, device/OS/browser distribution charts
- Data tables: Top pages, visitor list, recent events, device statistics

**c) Data Flow:**
```
User Input → API Request → /stats Endpoint → SQLite Query → 
Aggregation Logic → JSON Response → Chart Rendering → UI Update
```

### D. Communication Flow

#### 1. Event Collection Flow

1. **Page Load**: Tracker script executes automatically
2. **Pageview Event**: Sent immediately with page title and metadata
3. **Event Listeners**: Attached for click, scroll, and visibility change events
4. **Event Transmission**: Events sent via POST to `/collect` endpoint
5. **Server Processing**: Server validates, parses, and stores events in database
6. **Response**: Server returns confirmation with event ID

#### 2. Data Retrieval Flow

1. **Dashboard Load**: User opens dashboard and configures endpoint/site
2. **Statistics Request**: Dashboard sends GET request to `/stats` endpoint with query parameters
3. **Database Queries**: Server executes multiple SQL queries for different metrics
4. **Data Aggregation**: Server processes raw events into aggregated statistics
5. **JSON Response**: Server returns comprehensive statistics object
6. **Visualization**: Dashboard renders charts and tables from JSON data

---

## III. API Design

### A. Backend Interfaces

The server exposes three primary HTTP endpoints:

#### 1. POST /collect

**Purpose**: Receives and stores tracking events from client-side tracker

**Request Format**:
```json
{
  "site": "tyler.yunguhs.com",
  "type": "pageview",
  "ts": 1704067200000,
  "session_id": "s-abc123",
  "visitor_id": "v-xyz789",
  "url": "https://tyler.yunguhs.com/page",
  "path": "/page",
  "referrer": "https://google.com",
  "data": {
    "title": "Page Title",
    "depth": 75
  }
}
```

**Response Format**:
```json
{
  "ok": true,
  "id": "evt-1704067200000-abc123"
}
```

**Error Response**:
```json
{
  "ok": false,
  "error": "missing fields"
}
```

**Validation Rules**:
- Required fields: `site`, `type`, `ts`
- Optional site whitelist check via `ALLOWED_SITE` environment variable
- Returns HTTP 400 for missing fields
- Returns HTTP 403 for non-whitelisted sites

**Processing Steps**:
1. Extract client IP and User-Agent from request headers
2. Hash IP address for privacy protection
3. Generate unique event ID: `evt-{timestamp}-{random}`
4. Insert event record into database
5. Return success response with event ID

#### 2. GET /stats

**Purpose**: Retrieves aggregated statistics and visualization data

**Query Parameters**:
- `site` (required): Target site identifier
- `sinceMin` (optional, default: 1440): Time window in minutes (e.g., 60 = last hour)
- `sankeyLayers` (optional, default: "referrer,deviceType,path"): Comma-separated layer configuration for Sankey diagram

**Response Format**:
```json
{
  "ok": true,
  "pv": 1234,
  "uv": 567,
  "sinceMin": 1440,
  "topPages": [
    {
      "path": "/",
      "title": "Home Page",
      "pv": 456
    }
  ],
  "recent": [
    {
      "ts": 1704067200000,
      "type": "pageview",
      "path": "/page",
      "title": "Page Title",
      "data": "{\"title\":\"Page Title\"}",
      "visitor_id": "v-xyz789",
      "device": "Desktop",
      "browser": "Chrome 120"
    }
  ],
  "visitors": [
    {
      "visitor_id": "v-xyz789",
      "device": "Desktop",
      "deviceType": "desktop",
      "os": "macOS 14.0",
      "browser": "Chrome 120",
      "firstVisit": 1704067200000,
      "lastVisit": 1704070800000,
      "pagesCount": 5,
      "pvCount": 8
    }
  ],
  "deviceStats": {
    "deviceTypes": {
      "desktop": 800,
      "mobile": 400,
      "tablet": 34
    },
    "os": {
      "macOS 14.0": 500,
      "Windows 11": 300
    },
    "browsers": {
      "Chrome 120": 600,
      "Safari 17": 400
    }
  },
  "pvTrend": [
    {
      "time": "2024-01-01 10:00:00",
      "count": 45
    }
  ],
  "sankey": {
    "nodes": [
      {"label": "直接访问"},
      {"label": "google.com"},
      {"label": "desktop"},
      {"label": "mobile"},
      {"label": "/"},
      {"label": "/page"}
    ],
    "links": [
      {"source": 0, "target": 2, "value": 100},
      {"source": 2, "target": 4, "value": 80}
    ],
    "layers": ["referrer", "deviceType", "path"]
  },
  "userStats": {
    "newUsers": 150,
    "returningUsers": 417,
    "newUserPV": 320,
    "returningUserPV": 914,
    "totalUsers": 567,
    "totalPV": 1234
  }
}
```

**Aggregation Logic**:

**a) PV (Pageviews)**:
```sql
SELECT COUNT(*) FROM events
WHERE site = ? AND type = 'pageview' AND ts >= ?
```

**b) UV (Unique Visitors)**:
```sql
SELECT COUNT(DISTINCT visitor_id) FROM events
WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
```

**c) Top Pages**:
```sql
SELECT path, data, COUNT(*) as pv FROM events
WHERE site = ? AND type = 'pageview' AND ts >= ? AND path IS NOT NULL
GROUP BY path ORDER BY pv DESC LIMIT 20
```

**d) Visitors List**:
```sql
SELECT 
  visitor_id,
  MIN(ts) as first_ts,
  MAX(ts) as last_ts,
  COUNT(DISTINCT path) as pages_count,
  COUNT(CASE WHEN type = 'pageview' THEN 1 END) as pv_count,
  MAX(ua) as ua
FROM events
WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
GROUP BY visitor_id
ORDER BY last_ts DESC LIMIT 50
```

**e) New vs Returning Users**:
- **New Users**: Visitors whose first visit (`first_ts`) occurs within the selected time window
- **Returning Users**: Visitors who accessed the site within the time window but had their first visit before the time window
- Calculation logic:
  ```sql
  SELECT 
    visitor_id,
    MIN(ts) as first_ts,
    COUNT(CASE WHEN type = 'pageview' THEN 1 END) as pv_count
  FROM events
  WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
  GROUP BY visitor_id
  ```
- Classification: `first_ts >= sinceTs` → New User, `first_ts < sinceTs` → Returning User
- Metrics provided: User count, PV count, and percentage distribution for both categories

**f) Device Statistics**:
- Retrieves all pageview events with User-Agent
- Parses each User-Agent using `parseDevice()` function
- Aggregates counts by device type, OS, and browser

**g) PV Trend**:
```sql
SELECT 
  strftime('%Y-%m-%d %H:00:00', ts/1000, 'unixepoch', 'localtime') as hour_key,
  COUNT(*) as count
FROM events
WHERE site = ? AND type = 'pageview' AND ts >= ?
GROUP BY hour_key ORDER BY hour_key ASC
```

**h) Sankey Data**:
- Retrieves all pageview events with referrer, path, and User-Agent
- Applies configurable layer extraction (referrer, deviceType, OS, browser, path)
- Builds node and link arrays representing flow relationships
- Counts occurrences of each flow path

**i) User Trend (New vs Returning Users Over Time)**:
- Aggregates new and returning users by hour within the selected time window
- Calculation process:
  1. Retrieves all visitor first visit timestamps
  2. Groups events by hour and visitor_id
  3. Classifies each visitor as new (first_ts >= sinceTs) or returning (first_ts < sinceTs)
  4. Counts distinct visitors per hour for each category
- Returns array of objects with `time`, `newUsers`, `returningUsers`, and `totalUsers` fields
- Time format: `YYYY-MM-DD HH:00:00` (hourly granularity)
- Purpose: Enables temporal analysis of user acquisition and retention patterns

#### 3. GET /tracker.js

**Purpose**: Dynamically serves the tracking script with auto-configured endpoint

**Response**: JavaScript file with ENDPOINT variable replaced based on request host

**Implementation**:
```javascript
const defaultEndpoint = `${req.protocol}://${req.get('host')}/collect`;
const modifiedCode = trackerCode.replace(
  /const ENDPOINT = .*?;/,
  `const ENDPOINT = "${defaultEndpoint}";`
);
```

**Benefits**:
- Eliminates manual endpoint configuration
- Supports multiple deployment environments automatically
- Reduces configuration errors

### B. Request/Response Formats

#### Request Headers

**POST /collect**:
- `Content-Type: application/json`
- `User-Agent`: Automatically captured from request
- `Origin`: Validated for CORS

**GET /stats**:
- Standard HTTP GET with query parameters
- No authentication required (future enhancement)

#### Response Headers

- `Content-Type: application/json` for JSON responses
- `Content-Type: application/javascript` for `/tracker.js`
- CORS headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`

---

## IV. Frontend Event Tracking Method

### A. Event Instrumentation

The tracking script implements automatic event detection and transmission without requiring manual instrumentation. The system employs event delegation and passive event listeners to minimize performance impact.

#### 1. Automatic Pageview Tracking

**Trigger**: Page load event (executed immediately upon script execution)

**Implementation**:
```javascript
post("pageview", { title: document.title });
```

**Data Captured**:
- Site identifier
- Full URL and path
- Page title
- Referrer URL
- Timestamp
- Session and visitor IDs

**Purpose**: Provides baseline metrics for page popularity and traffic volume

#### 2. Click Event Tracking

**Trigger**: Click events on interactive elements

**Event Listener**:
```javascript
document.addEventListener("click", handler, { capture: true, passive: true });
```

**Target Elements**:
- Links (`<a>`)
- Buttons (`<button>`)
- Form elements (`input`, `textarea`, `select`, `label`)
- Elements with `role="button"` attribute
- Any element with interactive role

**Data Captured**:
- **Selector**: CSS selector string combining tag name, ID, and class names (first 3 classes)
  - Format: `{tag}{#id}{.class1.class2.class3}`
  - Example: `a#submit.btn.btn-primary`
- **Text**: Element text content truncated to 120 characters
- **Href**: Link destination URL (if applicable)

**Event Structure**:
```json
{
  "type": "click",
  "data": {
    "selector": "a.btn-primary#submit",
    "text": "Submit Form",
    "href": "/submit"
  }
}
```

**Privacy Considerations**:
- Text content is truncated to prevent excessive data collection
- Only first 3 CSS classes are included to balance specificity with privacy
- Sensitive form data is not captured

#### 3. Scroll Depth Tracking

**Trigger**: Scroll events with throttling (maximum once per second)

**Implementation Logic**:
```javascript
let maxDepth = 0;
window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const depth = Math.min(100, Math.round((scrollTop / height) * 100));
  if (depth > maxDepth) {
    maxDepth = depth;
    post("scroll", { depth });
  }
}, { passive: true });
```

**Data Captured**:
- **Depth**: Integer percentage (0-100) representing maximum scroll position reached
- Only new maximum depths trigger events (progressive tracking)

**Event Structure**:
```json
{
  "type": "scroll",
  "data": {
    "depth": 75
  }
}
```

**Purpose**: Measures user engagement and content consumption depth

#### 4. Session Duration Tracking

**Trigger**: Page visibility change or page unload events

**Implementation**:
```javascript
const startAt = Date.now();
function sendDuration(reason) {
  if (sent) return;
  sent = true;
  post("duration", { 
    ms: Date.now() - startAt, 
    maxScrollDepth: maxDepth, 
    reason: reason || "unknown" 
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sendDuration("hidden");
});
window.addEventListener("pagehide", () => sendDuration("pagehide"));
```

**Data Captured**:
- **Duration**: Time spent on page in milliseconds
- **Max Scroll Depth**: Maximum scroll percentage reached during session
- **Reason**: Event trigger reason ("hidden" or "pagehide")

**Event Structure**:
```json
{
  "type": "duration",
  "data": {
    "ms": 45230,
    "maxScrollDepth": 85,
    "reason": "hidden"
  }
}
```

**Purpose**: Provides engagement metrics and content quality indicators

#### 5. Custom Event Tracking

**API**: `window.WebsiteTracker.track(type, data)`

**Usage Example**:
```javascript
window.WebsiteTracker.track("purchase", {
  productId: "123",
  amount: 99.99
});
```

**Purpose**: Enables application-specific event tracking beyond standard events

### B. Event Definitions

#### Event Types

1. **pageview**: Initial page load or navigation
2. **click**: User click on interactive element
3. **scroll**: User scrolling to new maximum depth
4. **duration**: Session duration when page becomes hidden
5. **custom**: User-defined custom events

#### Event Data Structure

All events share a common base structure:

```json
{
  "site": "tyler.yunguhs.com",
  "type": "pageview",
  "ts": 1704067200000,
  "session_id": "s-abc123",
  "visitor_id": "v-xyz789",
  "url": "https://tyler.yunguhs.com/page",
  "path": "/page",
  "referrer": "https://google.com",
  "data": {
    // Event-specific data payload
  }
}
```

**Field Descriptions**:
- `site`: Target website identifier
- `type`: Event type identifier
- `ts`: Unix timestamp in milliseconds
- `session_id`: Current session identifier (resets per browser session)
- `visitor_id`: Persistent visitor identifier (survives sessions)
- `url`: Full page URL including query parameters and hash
- `path`: URL pathname component
- `referrer`: Previous page URL (if available)
- `data`: Type-specific data object

### C. Triggering Logic

#### Event Delegation Strategy

The system uses event delegation with capture-phase listeners to ensure comprehensive event capture:

- **Capture Phase**: Events are intercepted before reaching target elements
- **Passive Listeners**: Prevents blocking main thread during event processing
- **Closest Matching**: Uses `element.closest()` to find nearest interactive parent

#### Throttling and Debouncing

**Scroll Events**:
- Throttled to maximum 1 event per second
- Only triggers when new maximum depth is reached
- Prevents excessive API calls

**Duration Events**:
- Single event per page session
- Sent only when page becomes hidden or unloads
- Prevents duplicate duration records

#### Error Handling

- Network failures are silently logged to console (if available)
- Uses `navigator.sendBeacon()` for reliable delivery during page unload
- Fallback to `fetch()` with `keepalive` option if beacon unavailable
- No blocking behavior if API is unreachable

---

## V. Data Visualization and Interpretation

### A. Visualization Types

#### 1. Sankey Flow Diagrams

**Library**: Plotly.js 2.27.0

**Purpose**: Visualizes user flow through multiple dimensions (referrer → device → page)

**Configurable Layers**:
- **Referrer**: Traffic source (e.g., "直接访问", "google.com")
- **Device Type**: Device category (desktop, mobile, tablet)
- **OS**: Operating system (macOS, Windows, iOS, Android)
- **Browser**: Web browser (Chrome, Safari, Firefox)
- **Path**: Page path (/, /page, /about)

**Layer Combinations**:
- Default: `referrer → deviceType → path`
- Alternative: `referrer → os → path`, `referrer → browser → path`
- Extended: `referrer → deviceType → os → path`

**Visual Elements**:
- **Nodes**: Rectangular boxes representing each unique value in a layer
- **Links**: Curved flows connecting nodes between layers
- **Link Width**: Proportional to traffic volume (value count)
- **Colors**: Layer-specific color coding (blue gradient scheme)

**Interpretation**:
- **Node Size**: Indicates volume of traffic at that dimension value
- **Link Thickness**: Shows traffic flow magnitude between dimensions
- **Flow Paths**: Reveals user journey patterns (e.g., mobile users from Google → home page)

**Insights**:
- Identify primary traffic sources and their device preferences
- Discover device-specific page preferences
- Understand cross-dimensional user behavior patterns
- Detect traffic bottlenecks or drop-off points

#### 2. Doughnut Charts

**Library**: Chart.js 4.4.0

**Purpose**: Display distribution of categorical data

**Chart Types**:

**a) Device Type Distribution**:
- Categories: desktop, mobile, tablet
- Interpretation: Device usage patterns and mobile vs. desktop ratio
- Business Value: Informs responsive design priorities

**b) Operating System Distribution**:
- Categories: macOS, Windows, iOS, Android, etc.
- Interpretation: Platform popularity among visitors
- Business Value: Guides platform-specific testing and optimization

**c) Browser Distribution**:
- Categories: Chrome, Safari, Firefox, Edge, etc.
- Interpretation: Browser market share within user base
- Business Value: Ensures compatibility testing coverage

**d) New vs Returning Users Distribution**:
- **User Count Chart**: Shows proportion of new users vs. returning users by visitor count
- **PV Count Chart**: Shows proportion of pageviews from new users vs. returning users
- Categories: New Users, Returning Users
- Interpretation: User acquisition vs. retention patterns
- Business Value: Measures marketing effectiveness (new users) and content quality/engagement (returning users)
- Visual Design: Two side-by-side charts with distinct color coding for quick comparison

**e) New vs Returning Users Time Trend**:
- **Chart Type**: Multi-line chart (line chart with three datasets)
- **Data Points**: Hourly aggregation of new users, returning users, and total users
- **Lines**: 
  - New Users (solid blue line with filled area)
  - Returning Users (lighter blue line with filled area)
  - Total Users (dashed white line, unfilled)
- **Time Format**: Displays date and hour (e.g., "1月 15 14:00")
- **Visual Design**: Smooth curves with tension, interactive tooltips, responsive scaling
- **Interpretation**: Shows temporal patterns in user acquisition and retention
- **Business Value**: 
  - Identifies peak times for new user acquisition
  - Reveals retention patterns over time
  - Enables correlation with marketing campaigns or content releases
  - Helps identify growth trends and seasonal patterns

**Visual Design**:
- Blue gradient color scheme (rgba(79,124,255,0.2-0.8))
- Responsive sizing with `maintainAspectRatio: false`
- Bottom-positioned legends with compact labels
- Top 10 items displayed (sorted by count)

**Interpretation Guidelines**:
- **Larger Segments**: Indicate dominant categories
- **Segment Counts**: Absolute numbers shown in tables
- **Trends**: Compare across time periods for trend analysis

#### 3. Tabular Displays

**a) Top Pages Table**:
- Columns: Path, Title, PV count
- Sorted by: Pageview count (descending)
- Limit: Top 20 pages
- **Insight**: Identifies most popular content and pages

**b) Visitors Table**:
- Columns: Device, OS, Browser, Pages visited, Last visit time
- Sorted by: Last visit time (descending)
- Limit: Recent 50 visitors
- **Insight**: Provides individual visitor behavior snapshots

**c) Device Statistics Tables**:
- Device Types, Operating Systems, Browsers (separate tables)
- Columns: Category name, Count
- Sorted by: Count (descending)
- **Insight**: Detailed breakdown of technical distribution

**d) Recent Events Table**:
- Columns: Time, Type, Path, Title, Device, Data payload
- Sorted by: Timestamp (descending)
- Limit: Recent 50 events
- **Insight**: Real-time activity monitoring and debugging

**e) New vs Returning Users Table**:
- Columns: User Type, User Count, PV Count, Percentage Distribution
- Categories: New Users, Returning Users, Total
- **New Users**: Visitors whose first visit occurred within the selected time window
- **Returning Users**: Visitors who accessed the site within the time window but had their first visit before the time window
- **Insight**: Measures user acquisition vs. retention, indicates growth patterns and user loyalty

**f) New vs Returning Users Visualization**:
- **User Distribution Chart**: Doughnut chart showing the proportion of new users vs. returning users by user count
- **PV Distribution Chart**: Doughnut chart showing the proportion of pageviews from new users vs. returning users
- **Time Trend Chart**: Multi-line chart showing hourly trends of new users, returning users, and total users over time
- **Visual Design**: 
  - Doughnut charts: Blue gradient color scheme (darker blue `rgba(79,124,255,0.8)` for new users, lighter blue `rgba(79,124,255,0.5)` for returning users)
  - Time trend: Three lines with filled areas (new users: solid blue, returning users: lighter blue, total: dashed white)
- **Interactive Features**: Tooltips display exact counts and percentages on hover
- **Layout**: Two side-by-side doughnut charts, followed by time trend chart, then detailed statistics table
- **Chart Library**: Chart.js 4.4.0 (doughnut and line chart types)
- **Insight**: 
  - Doughnut charts: Quick visual comparison of user acquisition vs. retention patterns
  - Time trend: Enables identification of growth trends, peak acquisition times, and correlation with marketing activities

### B. Key Metrics Dashboard

#### 1. PV (Pageviews)

**Definition**: Total count of pageview events within selected time window

**Calculation**: `COUNT(*) WHERE type = 'pageview' AND ts >= sinceTs`

**Interpretation**:
- Measures overall website traffic volume
- Higher values indicate more content consumption
- Can be compared across time periods for trend analysis

#### 2. UV (Unique Visitors)

**Definition**: Count of distinct `visitor_id` values within selected time window

**Calculation**: `COUNT(DISTINCT visitor_id) WHERE ts >= sinceTs`

**Interpretation**:
- Indicates unique visitor count (anonymous identification)
- PV/UV ratio indicates average pages per visitor (engagement metric)
- Higher UV suggests broader audience reach

#### 2.5. New vs Returning Users

**Definition**: Classification of visitors based on whether their first visit occurred within the selected time window

**New Users**:
- **Definition**: Visitors whose first visit (`first_ts`) is within the selected time window
- **Calculation**: Count of `visitor_id` where `MIN(ts) >= sinceTs`
- **Interpretation**: Measures user acquisition, indicates growth and marketing effectiveness
- **Business Value**: Higher new user percentage suggests successful acquisition campaigns

**Returning Users**:
- **Definition**: Visitors who accessed the site within the time window but had their first visit before the time window
- **Calculation**: Count of `visitor_id` where `MIN(ts) < sinceTs` but `MAX(ts) >= sinceTs`
- **Interpretation**: Measures user retention and loyalty
- **Business Value**: Higher returning user percentage indicates strong user engagement and content quality

**Metrics Provided**:
- User count for each category
- PV count for each category
- Percentage distribution (both by user count and PV count)
- Total aggregated values

**Interpretation Guidelines**:
- **High New User Ratio**: Indicates successful marketing or viral growth
- **High Returning User Ratio**: Indicates strong retention and user loyalty
- **Balanced Distribution**: Suggests healthy growth with good retention
- **PV Distribution**: Shows engagement patterns (returning users typically have higher PV per user)

#### 3. Time Window

**Configurable Options**:
- 1 hour, 6 hours, 24 hours (default), 7 days, 30 days

**Purpose**: Enables temporal analysis and trend identification

#### 4. Event Count

**Definition**: Number of recent events displayed in Recent Events table

**Purpose**: Provides quick indicator of system activity level

### C. Insights and Behavioral Analysis

#### 1. Traffic Source Analysis

**Sankey Diagram Interpretation**:
- **Direct Access**: Users typing URL directly or using bookmarks (high intent)
- **Search Engines**: Organic search traffic (discovery-based)
- **Referral Sites**: External links from other websites (network effect)

**Actionable Insights**:
- Optimize SEO if search engine traffic is low
- Build partnerships if referral traffic shows potential
- Enhance bookmark-worthy content if direct traffic is high

#### 2. Device Preference Analysis

**Device Type Distribution**:
- **Mobile Dominance**: Indicates need for mobile-first design optimization
- **Desktop Dominance**: Suggests desktop experience should be prioritized
- **Balanced Distribution**: Requires equal attention to all device types

**Device-Page Correlation** (from Sankey):
- Identify pages preferred by specific device types
- Optimize mobile experience for mobile-favored pages
- Test responsive design on problematic page paths

#### 3. Content Performance

**Top Pages Analysis**:
- **Popular Pages**: Identify high-performing content for replication
- **Underperforming Pages**: Discover content requiring improvement or promotion
- **Path Patterns**: Understand user navigation preferences

**Scroll Depth Correlation**:
- Pages with high scroll depth indicate engaging content
- Low scroll depth suggests content optimization opportunities
- Duration metrics complement scroll depth for engagement scoring

#### 4. User Engagement Metrics

**Session Duration**:
- Longer durations indicate higher engagement
- Correlate with scroll depth to measure content quality
- Identify pages with high bounce rates (very short durations)

**Click Event Analysis**:
- Popular click targets reveal user interaction hotspots
- Low click rates on important elements indicate UX issues
- Button/link text analysis provides copy optimization insights

#### 5. Technical Stack Insights

**Browser/OS Distribution**:
- Ensures compatibility testing coverage matches actual user base
- Identifies outdated browser versions requiring support
- Guides progressive enhancement strategies

**Cross-Dimensional Patterns**:
- Example: "Chrome on Windows" vs. "Safari on macOS" usage patterns
- Platform-specific feature adoption rates
- Technology stack preferences by user segment

### D. Visualization Benefits

#### 1. Rapid Pattern Recognition

Visual representations enable quick identification of:
- Traffic anomalies and spikes
- Unexpected device or browser distributions
- Content performance outliers

#### 2. Comparative Analysis

Dashboard enables:
- Time period comparisons (e.g., week-over-week trends)
- Page-to-page performance comparisons
- Device/browser segment comparisons

#### 3. Real-Time Monitoring

Recent events table provides:
- Live activity feed for system health monitoring
- Immediate feedback on tracking implementation
- Debugging capabilities for event collection issues

#### 4. Data-Driven Decision Making

Visualizations support:
- Content strategy decisions (based on page popularity)
- UX optimization priorities (based on click/scroll patterns)
- Technical infrastructure decisions (based on device/browser data)

---

## VI. Implementation Details

### A. Privacy Considerations

#### 1. IP Address Protection

- IP addresses are hashed using SHA-256 algorithm
- Only first 16 characters of hash are stored
- Prevents identification of individual users while enabling basic fraud detection

#### 2. Data Minimization

- Text content truncated to 120 characters for click events
- Only essential metadata collected (no form field values)
- CSS selector limitation (first 3 classes only)

#### 3. Anonymous Identification

- Visitor IDs stored in localStorage (user-controlled)
- No personally identifiable information (PII) collected
- Session-based tracking without user authentication

### B. Performance Optimizations

#### 1. Client-Side

- Passive event listeners prevent main thread blocking
- Throttled scroll events reduce API call frequency
- `sendBeacon` API ensures non-blocking transmission
- Event delegation minimizes memory footprint

#### 2. Server-Side

- Database indexes on frequently queried columns
- Efficient SQL aggregation queries
- Minimal data processing (device parsing only when needed)
- CORS preflight optimization

#### 3. Database

- Composite indexes for common query patterns
- Single-table design reduces join overhead
- JSON storage for flexible event data schema

### C. Deployment Architecture

#### 1. Local Development

- SQLite database for zero-configuration setup
- Express server on configurable port (default: 5555)
- Static file serving for dashboard

#### 2. Production Deployment

- PM2 process manager for service reliability
- Nginx reverse proxy support for domain-based access
- Environment variable configuration for port and site whitelist
- Database backup recommendations

---

## VII. Conclusion

This technical documentation has presented a comprehensive overview of a lightweight web analytics and tracking system. The architecture successfully combines client-side event collection, server-side data processing, and interactive visualization to provide actionable insights into user behavior.

**Key Achievements**:
- Privacy-conscious data collection with anonymized identifiers
- Real-time event tracking with minimal performance impact
- Flexible visualization system supporting multiple analysis dimensions
- Scalable architecture suitable for personal to small-scale deployments

**Future Enhancements**:
- Authentication system for dashboard access control
- Automated data retention policies
- Advanced analytics features (funnels, cohorts, conversions)
- Export capabilities for data analysis tools

The system demonstrates that effective web analytics can be achieved with minimal infrastructure while maintaining user privacy and system performance.

---

## References

[1] Express.js Documentation. (2024). *Express - Fast, unopinionated, minimalist web framework for Node.js*. Retrieved from https://expressjs.com/

[2] SQLite Documentation. (2024). *SQLite - A self-contained, high-reliability, embedded, full-featured, public-domain, SQL database engine*. Retrieved from https://www.sqlite.org/docs.html

[3] Chart.js Documentation. (2024). *Chart.js - Simple yet flexible JavaScript charting library*. Retrieved from https://www.chartjs.org/

[4] Plotly.js Documentation. (2024). *Plotly.js - The open source JavaScript graphing library*. Retrieved from https://plotly.com/javascript/

[5] MDN Web Docs. (2024). *Navigator.sendBeacon()*. Retrieved from https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon

[6] W3C. (2024). *User Timing API*. Retrieved from https://www.w3.org/TR/user-timing/

[7] UAParser.js. (2024). *UAParser.js - Detect Browser, Engine, OS, CPU, and Device type/version from User-Agent data*. Retrieved from https://github.com/faisalman/ua-parser-js

---

## Appendices

### Appendix A: Database Schema SQL

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  session_id TEXT,
  visitor_id TEXT,
  url TEXT,
  path TEXT,
  referrer TEXT,
  ua TEXT,
  ip_hash TEXT,
  data TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site, ts);
CREATE INDEX IF NOT EXISTS idx_events_site_type_ts ON events(site, type, ts);
CREATE INDEX IF NOT EXISTS idx_events_site_session_ts ON events(site, session_id, ts);
```

### Appendix B: API Endpoint Summary

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/collect` | POST | Receive tracking events | JSON body |
| `/stats` | GET | Retrieve aggregated statistics | `site`, `sinceMin`, `sankeyLayers` |
| `/tracker.js` | GET | Serve tracking script | None |

**Response Fields for `/stats`**:
- `userStats`: Object containing new vs returning user statistics
  - `newUsers`: Count of new users (first visit in time window)
  - `returningUsers`: Count of returning users (first visit before time window)
  - `newUserPV`: Total pageviews from new users
  - `returningUserPV`: Total pageviews from returning users
  - `totalUsers`: Sum of new and returning users
  - `totalPV`: Sum of new and returning user pageviews
- `userTrend`: Array of objects containing hourly new vs returning user trends
  - Each object contains: `time` (hour timestamp), `newUsers` (count), `returningUsers` (count), `totalUsers` (sum)
  - Time format: `YYYY-MM-DD HH:00:00`
  - Sorted chronologically (ascending)

### Appendix C: Event Type Reference

| Event Type | Trigger | Data Fields |
|------------|---------|-------------|
| `pageview` | Page load | `title` |
| `click` | Element click | `selector`, `text`, `href` |
| `scroll` | Scroll depth change | `depth` (0-100) |
| `duration` | Page unload | `ms`, `maxScrollDepth`, `reason` |
| `custom` | Manual trigger | User-defined |

---

*End of Technical Documentation*

