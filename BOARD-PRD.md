# BIHAR SENTINEL -- Board Product Requirements Document (PRD)

**Platform Name:** BIHAR SENTINEL
**Tagline:** Maritime Intelligence. Threat Awareness. Fleet Protection.
**Document Version:** 1.1
**Date:** 2026-02-28
**Classification:** BOARD CONFIDENTIAL
**Author:** Board Representative Agent
**Status:** APPROVED FOR DEVELOPMENT

---

## 0. Platform Identity & Access Control

### 0.1 Branding

| Element | Specification |
|---------|--------------|
| **Platform Name** | BIHAR SENTINEL |
| **Logo** | BIHAR corporate logo (BB monogram with anchor & palm tree, circular border) -- file: `assets/logo.png` |
| **Logo Usage** | White/silver on dark backgrounds (#0f172a). Header left-aligned. Login page centered. |
| **Color Palette** | Primary: Slate dark (#0f172a, #1e293b). Accent: Silver/white (#c0c0c0, #f8fafc). Alert: Red (#ef4444). Warning: Amber (#f59e0b). Safe: Green (#22c55e). |
| **Typography** | Inter (400-700) for UI. Monospace for coordinates, timestamps, IMO numbers. |
| **Favicon** | Cropped BB monogram from logo, 32x32px and 180x180px (apple-touch-icon) |
| **Document Headers** | All generated notices, reports, and PDFs carry the BIHAR SENTINEL logo + "CONFIDENTIAL" watermark |

### 0.2 Authentication & Access Control

BIHAR SENTINEL is a **private, password-protected platform**. No public access.

#### 0.2.1 Authentication Requirements

| Requirement | Specification |
|-------------|--------------|
| **Login Page** | Full-screen dark background with centered BIHAR logo, "SENTINEL" text below, email + password fields |
| **Authentication Method** | Email + password (Phase 1). Optional 2FA via TOTP/authenticator app (Phase 2). |
| **Session Duration** | 24 hours (configurable). Auto-logout after 4 hours of inactivity. |
| **Password Policy** | Minimum 12 characters, must include uppercase, lowercase, number, special character |
| **Failed Attempts** | Account locked after 5 failed attempts. Unlock via admin or 30-minute cooldown. |
| **Password Reset** | Email-based reset link (expires in 1 hour) |
| **HTTPS Required** | All traffic over TLS 1.3. HTTP redirects to HTTPS. HSTS header enabled. |

#### 0.2.2 User Roles

| Role | Access Level | Description |
|------|-------------|-------------|
| **Admin** | Full | Manage users, configure insurers/policies, update JWC zones, manage all settings |
| **DPA (Designated Person Ashore)** | Full operational | View all data, approve/send insurer notices, manage alerts, export reports. Cannot manage users. |
| **Operations** | Standard | View fleet tracking, threat center, vessel details. Can create draft notices but cannot send. |
| **Board / Read-Only** | View only | View dashboards, reports, risk scores. Cannot modify data or send notices. |
| **Master (Vessel)** | Vessel-specific | View own vessel data, report incidents, confirm crew status. Future: mobile-optimized view. |

#### 0.2.3 Login Page Design

```
+----------------------------------------------------------+
|                                                          |
|                     (dark background)                    |
|                                                          |
|                    ┌──────────────┐                      |
|                    │              │                      |
|                    │  [BB LOGO]   │                      |
|                    │  (silver on  │                      |
|                    │   dark)      │                      |
|                    │              │                      |
|                    └──────────────┘                      |
|                                                          |
|                    S E N T I N E L                        |
|                Maritime Intelligence                     |
|                                                          |
|              ┌────────────────────────┐                  |
|              │  Email                 │                  |
|              └────────────────────────┘                  |
|              ┌────────────────────────┐                  |
|              │  Password         [👁] │                  |
|              └────────────────────────┘                  |
|                                                          |
|              ┌────────────────────────┐                  |
|              │      SIGN IN           │                  |
|              └────────────────────────┘                  |
|                                                          |
|              Forgot password?                            |
|                                                          |
|         ─────────────────────────────                    |
|         BIHAR Shipping | Confidential                    |
|         Unauthorized access prohibited                   |
+----------------------------------------------------------+
```

#### 0.2.4 Session Security

| Feature | Specification |
|---------|--------------|
| **JWT Tokens** | Signed with RS256. Access token (15 min) + refresh token (24h). |
| **Secure Cookies** | HttpOnly, Secure, SameSite=Strict |
| **IP Binding** | Optional: bind session to originating IP (configurable by admin) |
| **Audit Log** | All logins, logouts, failed attempts, and notice actions logged with timestamp + IP |
| **Concurrent Sessions** | Max 3 concurrent sessions per user. New login terminates oldest session. |
| **API Authentication** | Backend API endpoints require valid JWT in Authorization header |

#### 0.2.5 Implementation Approach (Phase 1)

For Phase 1, use a lightweight Node.js authentication system:
- **bcrypt** for password hashing (cost factor 12)
- **jsonwebtoken** for JWT generation/verification
- **SQLite** user table (id, email, password_hash, role, created_at, last_login, locked_until, failed_attempts)
- Login page served as static HTML (same dark theme as main app)
- Protected routes check JWT middleware before serving app content

Phase 2 considerations: OAuth2/SSO integration if BIHAR uses corporate identity provider (Azure AD, Google Workspace, etc.)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Data Source Specifications](#3-data-source-specifications)
4. [Architecture Requirements](#4-architecture-requirements)
5. [Feature Specifications](#5-feature-specifications)
6. [Conflict Zone Monitoring Terminal](#6-conflict-zone-monitoring-terminal-specification)
7. [Risk Scoring Algorithm](#7-risk-scoring-algorithm)
8. [Priority Roadmap](#8-priority-roadmap)
9. [Success Criteria](#9-success-criteria)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### What the Board Is Getting

The BIHAR SENTINEL will be transformed from a **demonstration prototype with simulated data** into a **production-grade maritime operations and security intelligence platform** that surpasses commercial offerings from Dryad Global and Ambrey Intelligence.

The board will receive three capabilities:

1. **Real-time vessel tracking** using live AIS data -- actual positions, speeds, courses, and ETAs for all 23 BIHAR vessels, updated within 5 minutes of transmission.

2. **Verified factual data** -- vessel specifications from maritime registries, real weather from meteorological APIs, and clearly sourced market data. All simulation and random data generation will be eliminated.

3. **A Conflict Zone Monitoring Terminal (CZMT)** -- a Bloomberg-terminal-style security intelligence dashboard providing real-time threat awareness for vessels transiting the Persian Gulf, Red Sea, Gulf of Aden, and Arabian Sea. This is the flagship feature and the board's highest priority.

### Why This Must Be Better Than Dryad and Ambrey

The board directive is explicit: "Build me something MUCH BETTER than Dryad Global and Ambrey."

| Capability | Dryad Global | Ambrey Intelligence | BIHAR CZMT (This Build) |
|------------|-------------|---------------------|------------------------|
| AIS Tracking | SAT-AIS + terrestrial | Via partners (Pole Star, Iridium) | Direct AIS feed, fleet-specific dashboard |
| Threat Intel | Secure Voyager Hub, NAVTEX/EGC parsing | MRI Platform, MARSEC events | Multi-source fusion (UKMTO + MARAD + IMB + ACLED + OSINT) |
| Fleet Correlation | Generic industry alerts | Generic route risk assessments | **Auto-correlated with OUR 23 vessels in real-time** |
| Proximity Alerts | Passive -- user reads reports | Passive -- user reads reports | **Active -- automatic 4-tier alerts (WATCH/WARNING/CRITICAL/DANGER)** |
| Risk Scoring | Analyst-written assessments | Route-based risk ratings | **Dynamic per-vessel scoring updated every AIS cycle (0-100 scale)** |
| Insurance Impact | Not included | Not included | **JWC zone tracking with estimated AWRP per vessel per day** |
| AIS Gap Detection | Not fleet-specific | Pole Star covert tracking (separate) | **Integrated AIS dark detection in conflict zones with alerting** |
| Predictive Analysis | 15yr historical data | Historical MARSEC events | **Heatmap clustering from ACLED + UKMTO + IMB, 6/12/24mo views** |
| Fleet Management | Not included (security only) | Not included (security only) | **Fully integrated -- tracking, specs, weather, commercial, security on ONE platform** |
| Historical Data | 15 years | Multi-year | **ACLED dataset (2015-present) + UKMTO + IMB combined** |
| Cyber Risk | Cyber Voyager module | Limited | Phase 3 consideration |
| Cost | $15,000-50,000+/year subscription | $10,000-30,000+/year subscription | **Data feed costs ~$1,000-5,000/month; platform owned by BIHAR** |

**Key competitive advantages:**
1. Fleet-specific intelligence -- not generic industry reports, but threats correlated to OUR 23 vessels
2. Integrated platform -- fleet management + threat intel on same screen (Dryad and Ambrey are security-only)
3. Real-time proximity alerts -- push notifications when threats occur near BIHAR vessels, not passive reports
4. Dynamic risk scoring -- per-vessel scores update every AIS cycle, not weekly analyst assessments
5. Insurance impact tracking -- JWC zone entry/exit logging with premium impact estimates
6. Owned platform -- BIHAR owns and controls the platform, not renting a vendor's view

### Fleet Overview

| Category | Count | Types | DWT Range | Key Trade Areas |
|----------|-------|-------|-----------|-----------------|
| Small Oil Tankers | 8 | Bunker tankers | 7,200-7,450 | Persian Gulf, SE Asia, Med, South Africa |
| LPG Carriers | 2 | Pressurized gas | 27,710 | Persian Gulf, India |
| Chemical Tankers | 4 | IMO II/III | 19,900-49,800 | Persian Gulf, East Asia, Med |
| LR2 Tankers | 4 | Long Range 2 | 110,500-111,000 | Global trades (AG-Europe, AG-Asia) |
| Aframax Crude | 5 | Crude carriers | 105,300-109,250 | Persian Gulf, Red Sea |
| **Total** | **23** | | **~$487M fleet value** | |

### Critical Risk Exposure

At any given time, an estimated **12-16 BIHAR vessels** operate in or transit through high-risk conflict zones:

- **Persian Gulf / Strait of Hormuz:** Small tankers (Fujairah, Jeddah trades), LPG carriers (Jebel Ali), chemical tankers (Jubail), crude carriers (Ras Tanura, Shoaiba, Yanbu)
- **Red Sea / Bab el-Mandeb:** LR2 tankers transiting to/from Suez, crude carriers (Yanbu, Shoaiba), small tankers (Jeddah)
- **Gulf of Aden / Arabian Sea:** LPG carriers (India trades), chemical tankers (Singapore routes via Indian Ocean)

**Current threat environment (as of February 2026):** BIMCO confirmed that Houthi forces resumed Red Sea attacks in July 2025 after a ceasefire period. US MARAD advisory 2025-012 remains in effect covering Red Sea, Bab el-Mandeb, Gulf of Aden, Arabian Sea, Persian Gulf, and Somali Basin. Multiple attack types are active: anti-ship ballistic missiles (ASBM), one-way attack UAVs, unmanned surface vessels (USV/explosive boats), GPS jamming/spoofing, and naval mines.

This exposure makes the Conflict Zone Terminal a **life-safety and asset-protection necessity**.

---

## 2. Current State Assessment

### What Exists Today

The application is a **single HTML file** (`index.htm`, ~1,000 lines) containing:

- **Hardcoded vessel data:** All 23 vessels with IMO numbers, MMSI, positions, specifications, charter details, PSC records, and port call history embedded as a JavaScript array
- **Simulated position updates:** A `setInterval` loop every 5 seconds moves vessels along computed great-circle routes with random departures when they "arrive" at destinations
- **Simulated market data:** Charter rates, scrap prices, and newbuild prices fluctuate randomly every 30 seconds
- **Leaflet.js map:** Dark-themed with vessel markers color-coded by type (tanker=amber, LPG=teal, chemical=blue, crude=red)
- **Vessel detail modal:** Tabs for Overview, Valuation, NB Cycle, AIS, PSC, Ports, Specs
- **Market Intelligence modal:** Charter rates, scrap values, S&P alerts
- **Newbuild modal:** Yard comparisons, cycle analysis
- **No backend server** -- everything runs client-side
- **No security/threat awareness** -- zero conflict zone features

### What Is Unacceptable

| Issue | Board Assessment | Action Required |
|-------|-----------------|-----------------|
| All positions are simulated via `Math.random()` and `setInterval` | **UNACCEPTABLE** | Replace with live AIS data |
| Vessel specs may be inaccurate (hardcoded, unverified) | **UNACCEPTABLE** | Verify against maritime registries |
| Weather data is hardcoded strings | **UNACCEPTABLE** | Replace with real weather API |
| Market data randomly fluctuates | **UNACCEPTABLE** | Label as INDICATIVE or source from real feeds |
| No conflict zone awareness whatsoever | **CRITICAL DEFICIENCY** | Build CZMT (flagship feature) |
| No AIS gap detection | **CRITICAL DEFICIENCY** | Implement dark vessel alerting |
| No security incident tracking | **CRITICAL DEFICIENCY** | Build threat intelligence pipeline |
| No proximity alerting | **CRITICAL DEFICIENCY** | Build alert engine |
| No JWC zone tracking | **HIGH PRIORITY** | Implement zone geofencing |
| Single HTML file, no backend | **STRUCTURAL PROBLEM** | Architect properly |
| No authentication | **SECURITY RISK** | Add access control |

---

## 3. Data Source Specifications

### 3.1 AIS Data Providers

#### 3.1.1 Datalastic (RECOMMENDED for Phase 1 -- Rapid Prototyping)

**Provider:** Datalastic (datalastic.com)
**Headquarters:** Netherlands
**API Documentation:** datalastic.com/api-reference/
**Why Recommended:** Self-service API key in 5 minutes, affordable, clean REST API

| Aspect | Details |
|--------|---------|
| **API Type** | RESTful HTTP, JSON responses |
| **Authentication** | API key (query parameter `api-key`) |
| **Key Endpoints** | `GET /api/v2/vessel_pro` (vessel position by IMO/MMSI), `GET /api/v2/vessel_find` (search), `GET /api/v2/port_info` (port data) |
| **Data Fields** | IMO, MMSI, ship_name, ship_type, lat, lon, speed, course, heading, draught, destination, eta, nav_status, last_position_UTC, flag, length, width, dwt, grt, year_built |
| **Update Frequency** | Terrestrial: near real-time (seconds when in range). Satellite: 1-6 hours for deep ocean positions. |
| **Pricing** | **Trial: EUR 9 (one-time, limited credits).** **Starter: EUR 199/month (20,000 API requests).** **Business: EUR 679/month (unlimited requests).** |
| **Rate Limits** | Starter: 20,000 requests/month = ~28 requests/hour per vessel if polling 23 vessels = poll every ~2 minutes. Business tier: unlimited. |
| **Free/Trial** | EUR 9 trial available -- sufficient for development and testing |
| **Onboarding** | Self-service: sign up, pay, receive API key within 5 minutes. No sales call required. |

**Cost Calculation for BIHAR:**
- 23 vessels polled every 5 minutes = 23 x 12 x 24 = 6,624 requests/day = ~199,000/month
- **Starter tier (20K/month) is insufficient for 5-min polling. Business tier (EUR 679/month, unlimited) is required.**
- If polling every 15 minutes during development: 23 x 4 x 24 = 2,208/day = ~66,000/month -- still needs Business tier
- **Recommendation: Start with EUR 9 trial for development, upgrade to Business (EUR 679/month) for production**

**Integration Code Pattern:**
```javascript
// Datalastic vessel position query
async function getVesselPosition(imo) {
  const response = await fetch(
    `https://api.datalastic.com/api/v2/vessel_pro?api-key=${API_KEY}&imo=${imo}`
  );
  const data = await response.json();
  return {
    lat: data.data.lat,
    lon: data.data.lon,
    speed: data.data.speed,
    course: data.data.course,
    heading: data.data.heading,
    draught: data.data.draught,
    destination: data.data.destination,
    eta: data.data.eta,
    navStatus: data.data.nav_status,
    lastUpdate: data.data.last_position_UTC
  };
}
```

#### 3.1.2 MarineTraffic / Kpler (RECOMMENDED for Phase 2-3 -- Production)

**Provider:** MarineTraffic (now owned by Kpler)
**Background:** Kpler acquired MarineTraffic and FleetMon in 2023, then acquired Spire Maritime in April 2025. This creates a single provider with the world's largest combined terrestrial + satellite AIS network.
**API Documentation:** servicedocs.marinetraffic.com
**Headquarters:** Athens, Greece (MarineTraffic) / Paris, France (Kpler)

| Aspect | Details |
|--------|---------|
| **API Type** | RESTful HTTP, XML/JSON responses |
| **Authentication** | API key per service endpoint |
| **Key Services** | PS01 (Vessel Historical Track), PS02 (Fleet Vessel Positions), PS06 (Vessels in Area), PS07 (Single Vessel Position), EV01 (Port Calls), VD01 (Vessel Particulars), VI06 (Voyage Info/ETA), VI07 (Voyage Forecast) |
| **Data Fields** | LAT, LON, SPEED, COURSE, HEADING, DRAUGHT, TIMESTAMP, STATUS, DESTINATION, ETA, MMSI, IMO, SHIP_NAME, SHIP_TYPE, FLAG, LENGTH, WIDTH, GRT, DWT, YEAR_BUILT, plus voyage forecast, port call history |
| **Update Frequency** | Terrestrial: 2-10 seconds in coastal range. **Satellite: With Spire acquisition, now has proprietary 100+ nanosatellite constellation with median revisit ~60-90 minutes** -- best deep-ocean coverage available. |
| **Pricing** | **Credit-based system. Enterprise fleet plans: custom pricing via sales.** Typical enterprise fleet monitoring for 23 vessels: estimated $1,000-3,000/month. **Contact Kpler sales for BIHAR-specific quote.** |
| **Advantages over Datalastic** | Superior satellite coverage (via Spire constellation), voyage forecast/ETA prediction, port call history API, vessel particulars database, global coastal receiver network |
| **Onboarding** | Requires sales engagement. Typical: 1-2 week evaluation period, then contract. |

**Phase 2 Migration Plan:**
1. Develop against Datalastic in Phase 1
2. Build provider-agnostic AIS adapter layer (so swapping providers requires only a new adapter, no frontend changes)
3. Engage Kpler/MarineTraffic sales during Phase 1 development
4. Migrate to MarineTraffic in Phase 2 for production-grade coverage

#### 3.1.3 AISHub (Supplementary Free Tier)

**Provider:** AISHub (aishub.net)
**Type:** Community-based AIS data sharing network

| Aspect | Details |
|--------|---------|
| **API Type** | HTTP API, XML/JSON. Also raw NMEA AIS sentence feeds. |
| **Authentication** | API key (free if contributing AIS data; paid membership otherwise) |
| **Data** | Terrestrial AIS only -- no satellite. Coverage depends on community receiver locations. |
| **Pricing** | **Free** (with data sharing contribution) or ~$100-200/year membership |
| **Limitations** | No satellite coverage. Gaps in Persian Gulf, deep Arabian Sea. No vessel particulars. No ETA. No port calls. |
| **Use Case** | Supplementary feed to validate/cross-reference primary provider data. NOT suitable as primary source. |

#### 3.1.4 AIS Provider Strategy Summary

```
PHASE 1 (Development, Weeks 1-3):
  Primary: Datalastic (EUR 9 trial -> EUR 679/mo Business)
  Polling: Every 15 minutes during dev, 5 minutes for demo
  Supplementary: AISHub (free) for cross-validation

PHASE 2 (Production MVP, Weeks 4-7):
  Primary: Datalastic Business (EUR 679/mo) -- continue until MarineTraffic onboarded
  Begin: MarineTraffic/Kpler sales engagement

PHASE 3 (Full Production, Weeks 8-12):
  Primary: MarineTraffic/Kpler (enterprise plan, ~$1,000-3,000/mo)
  Benefits: Satellite coverage via Spire, voyage forecasts, port call history
  Fallback: Datalastic remains as backup provider
```

**CRITICAL ARCHITECTURAL REQUIREMENT:** Build a **provider-agnostic AIS adapter layer** so the frontend never knows which provider is being used. Interface:

```typescript
interface AISProvider {
  getVesselPosition(imo: string): Promise<VesselPosition>;
  getFleetPositions(imos: string[]): Promise<VesselPosition[]>;
  getVesselParticulars(imo: string): Promise<VesselParticulars>;
  getPortCalls(imo: string, limit: number): Promise<PortCall[]>;
  getVoyageInfo(imo: string): Promise<VoyageInfo>;
}

interface VesselPosition {
  imo: string;
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  sog: number;        // Speed Over Ground (knots)
  cog: number;        // Course Over Ground (degrees)
  heading: number;    // True heading (degrees)
  draught: number;    // Current draught (meters)
  navStatus: string;  // Navigation status
  destination: string;
  eta: string;        // AIS-reported ETA
  lastUpdate: Date;   // UTC timestamp of AIS message
  source: string;     // 'terrestrial' | 'satellite'
}
```

---

### 3.2 Vessel Registry and Particulars Data

Vessel specifications must be verified against authoritative sources before go-live.

#### 3.2.1 Equasis (FREE -- Primary Verification Source)

**Provider:** Equasis (equasis.org)
**Operated by:** European Maritime Safety Agency (EMSA) + French Maritime Administration
**Cost:** **FREE** -- publicly funded safety database

| Data Available | Details |
|----------------|---------|
| Ship identification | IMO, Name, Call Sign, MMSI, Flag, Status |
| Classification | Class society, class notation, survey status |
| PSC inspections | Full Port State Control inspection history with deficiencies |
| Company details | Registered owner, ship manager, ISM company |
| ISM/ISPS | Safety management compliance status |
| P&I Club | Protection & Indemnity club membership |

**Use:** Cross-reference every BIHAR vessel against Equasis before go-live. No API available -- manual lookup or controlled scraping (check terms).

#### 3.2.2 MarineTraffic VD01 (Vessel Particulars API)

If using MarineTraffic in Phase 2+, the VD01 service provides vessel particulars via API:
- IMO, MMSI, Ship Name, Ship Type, Flag, Gross Tonnage, DWT, Length, Beam, Year Built, Builder, Classification

#### 3.2.3 Verification Checklist

For each of the 23 BIHAR vessels, complete before production deployment:

```
VESSEL VERIFICATION CHECKLIST:
[ ] IMO number confirmed in Equasis
[ ] MMSI confirmed in ITU MARS database or Equasis
[ ] DWT/GT/NT match class society records
[ ] LOA/Beam/Draft confirmed
[ ] Build year and builder confirmed
[ ] Classification society and class notation current
[ ] Flag state confirmed
[ ] P&I Club membership current
[ ] ISM Document of Compliance valid
[ ] ISPS certificate valid

STATUS TRACKING:
  VERIFIED    = Confirmed against authoritative source
  UNVERIFIED  = From internal records, not independently confirmed
  DISCREPANCY = Internal records differ from registry -- needs resolution
```

Any field that cannot be independently verified must display a "UNVERIFIED" badge in the UI.

---

### 3.3 Weather Data Providers

#### 3.3.1 OpenWeatherMap (RECOMMENDED -- Phase 1+)

**Provider:** OpenWeatherMap (openweathermap.org)
**Why Recommended:** Generous free tier, reliable, well-documented

| Aspect | Details |
|--------|---------|
| **API Type** | RESTful, JSON |
| **Key Endpoint** | `GET /data/2.5/weather?lat={lat}&lon={lon}&appid={key}&units=metric` |
| **Data Fields** | Temperature (air), humidity, pressure, wind speed/direction/gust, visibility, weather condition/description, cloud cover |
| **Update Frequency** | ~10 minutes |
| **Free Tier** | **1,000 calls/day** -- sufficient for 23 vessels polled every 60 minutes (552 calls/day) |
| **Paid** | Professional: $40/month for 50,000 calls/day |
| **Limitation** | No wave/swell data. For marine-specific weather, supplement with Stormglass. |

#### 3.3.2 Stormglass (Phase 2 -- Marine Weather Supplement)

**Provider:** Storm Glass (stormglass.io)
**Focus:** Marine and coastal weather

| Aspect | Details |
|--------|---------|
| **Data Fields** | Wave height, wave direction, wave period, swell height/direction/period, wind wave height, sea level pressure, water temperature, current speed/direction |
| **Pricing** | Free: 10 requests/day. Standard: $19/month (500/day). Professional: $49/month (2,000/day). |
| **Recommendation** | Standard tier ($19/month) for wave/swell data -- important for vessel safety in Arabian Sea and Indian Ocean |

---

### 3.4 Maritime Security Data Sources

These are the feeds that power the Conflict Zone Monitoring Terminal.

#### 3.4.1 UKMTO -- United Kingdom Maritime Trade Operations

**URL:** ukmto.org
**Operated by:** Royal Navy, Northwood HQ, UK
**Experience:** 25+ years of maritime security operations

| Aspect | Details |
|--------|---------|
| **What It Provides** | Security alerts and advisories for Indian Ocean, Arabian Sea, Red Sea, Persian Gulf, Gulf of Aden. Operates the Single Information Framework (SIF) for maritime threat awareness. Runs the Voluntary Reporting Scheme (VRS) for vessels in the region. |
| **Key Pages** | `ukmto.org/indian-ocean/recent-incidents` -- list of recent security incidents with dates, positions, descriptions |
| **Alert Distribution** | Email alerts to VRS-registered vessels and subscribers. Published on website. Broadcast via NAVTEX and SafetyNET. |
| **API Availability** | **NO public API.** Data must be obtained via: (1) email subscription parsing, (2) web scraping of Recent Incidents page, (3) manual entry from NAVTEX/SafetyNET broadcasts |
| **Data Quality** | **HIGHEST** -- authoritative, verified, official UK government source |
| **Cost** | **FREE** |
| **Update Frequency** | As-needed. Multiple advisories per day during active threat periods. |
| **Priority** | **CRITICAL** -- primary authority for BIHAR's operating areas |

**Integration Architecture:**
```
UKMTO Data Ingestion Pipeline:
1. Email Parser: Subscribe ops@bihar.com to UKMTO alerts
   -> Incoming email -> parse subject/body for incident data
   -> Extract: date, time, position, incident type, description
   -> Geocode position if not lat/lon
   -> Create incident record in database

2. Web Scraper: Poll ukmto.org/indian-ocean/recent-incidents every 15 minutes
   -> Parse HTML for new incidents not in database
   -> Extract structured data
   -> Create incident records
   -> Mark source as "UKMTO"

3. Manual Entry: Admin interface for incidents received via radio/phone/NAVTEX
```

#### 3.4.2 US MARAD MSCI -- Maritime Security Communications with Industry

**URL:** maritime.dot.gov/msci/
**Operated by:** US Department of Transportation, Maritime Administration

| Aspect | Details |
|--------|---------|
| **What It Provides** | Maritime advisories for US-flagged and US-interest vessels. Advisories cover specific geographic threat areas with detailed guidance. |
| **Current Active Advisory** | **2025-012**: Covers Red Sea, Bab el-Mandeb Strait, Gulf of Aden, Arabian Sea, Persian Gulf, and Somali Basin. Specifically addresses Houthi/Ansar Allah attacks on commercial shipping. |
| **Data Format** | Published as numbered advisories on website. Available via email subscription. RSS feed available. |
| **API Availability** | **No API.** RSS feed + email subscription + web scraping. |
| **Cost** | **FREE** |
| **Priority** | **HIGH** -- particularly for the 22 Marshall Islands-flagged BIHAR vessels (US-associated flag state) |

**Integration:** RSS feed parser polling every 30 minutes for new advisories. Parse advisory text for geographic scope, threat type, and recommended actions.

#### 3.4.3 CENTCOM / NAVCENT (US Central Command)

**URL:** centcom.mil
**Twitter/X:** @CENTCOM

| Aspect | Details |
|--------|---------|
| **What It Provides** | Official US military incident reports, strike reports, threat updates for Persian Gulf, Red Sea, Arabian Sea |
| **Data Format** | Press releases, social media posts |
| **Integration** | RSS from centcom.mil + X API for @CENTCOM account |
| **Cost** | **FREE** |
| **Priority** | HIGH -- fastest official source for US military actions against Houthi forces |

#### 3.4.4 IMB Piracy Reporting Centre

**URL:** icc-ccs.org/map/ (Live Piracy Map)
**Operated by:** International Chamber of Commerce, International Maritime Bureau
**Location:** 24-hour Piracy Reporting Centre, Kuala Lumpur, Malaysia

| Aspect | Details |
|--------|---------|
| **What It Provides** | Global piracy and armed robbery incident reports. Live 2026 incidents with coordinates on interactive map. Weekly and quarterly reports. |
| **Data Per Incident** | Date, time, position (lat/lon), vessel type/name, incident type (boarding, attempted attack, fired upon, hijacked), weapon type, narration |
| **API Availability** | **No public API.** Live piracy map at icc-ccs.org/map/ can be scraped for incident markers with coordinates. Weekly reports provide structured incident tables. |
| **Cost** | Public reports are free. Full data feed requires ICC/IMB membership -- estimated $2,000-5,000/year. |
| **Priority** | **CRITICAL** -- authoritative global source for piracy incidents with coordinates |

**Integration:**
```
IMB Piracy Data Ingestion:
1. Live Map Scraper: Poll icc-ccs.org/map/ every 30 minutes
   -> Extract incident markers (lat, lon, date, type, description)
   -> Deduplicate against existing database entries
   -> Create incident records with source = "IMB"

2. Weekly Report Parser: Download weekly IMB report
   -> Parse incident table for new events
   -> Cross-reference with map data
```

#### 3.4.5 ACLED -- Armed Conflict Location & Event Data (RECOMMENDED for Heatmap)

**URL:** acleddata.com
**Operated by:** ACLED (academic research organization)

| Aspect | Details |
|--------|---------|
| **What It Provides** | Structured conflict event data with precise coordinates. Covers all armed conflict events globally including Yemen/Houthi military operations, naval incidents, drone/missile attacks. |
| **Data Fields** | event_date, event_type, sub_event_type, actor1, actor2, country, admin1, admin2, latitude, longitude, fatalities, notes, source, source_scale |
| **API Availability** | **YES -- RESTful API with free tier.** Filter by country (Yemen), event type (battles, explosions/remote violence), date range. |
| **API Endpoint** | `GET https://api.acleddata.com/acled/read?...` with filters |
| **Cost** | **FREE tier available** -- sufficient for weekly data pulls. Rate-limited. |
| **Data Quality** | Excellent -- academic rigor, coded by trained analysts, peer-reviewed methodology |
| **Historical Depth** | Data from 2015 to present -- excellent for historical heatmap |
| **Update Frequency** | **Weekly** (events coded and published every week) |
| **Priority** | **HIGH** -- best structured data source for historical attack heatmap |

**Why ACLED is critical:** ACLED provides the ONLY free, structured, geocoded dataset of Houthi attacks over multiple years. This is essential for the historical heatmap feature showing attack density patterns over 6/12/24 months.

**Integration:**
```javascript
// ACLED API query for Houthi maritime events
async function getACLEDIncidents(startDate, endDate) {
  const params = new URLSearchParams({
    key: ACLED_API_KEY,
    email: ACLED_EMAIL,
    country: 'Yemen',
    event_type: 'Explosions/Remote violence',
    event_date: `${startDate}|${endDate}`,
    event_date_where: 'BETWEEN',
    fields: 'event_date|event_type|sub_event_type|actor1|latitude|longitude|notes|fatalities',
    limit: 5000
  });
  const response = await fetch(`https://api.acleddata.com/acled/read?${params}`);
  return await response.json();
}
```

#### 3.4.6 JMIC -- Joint Maritime Information Centre

**Operated by:** Combined Maritime Forces (CMF) + UKMTO + EU MSCHOA + Singapore IFC + Royal Netherlands Navy + US Navy Fifth Fleet

| Aspect | Details |
|--------|---------|
| **What It Provides** | Fused maritime domain awareness -- combines OSINT, military intelligence, AIS analysis, and statistical trending from multiple national and multinational naval forces |
| **Access** | Not directly accessible as a data feed. Information flows through UKMTO and MSCHOA outputs. |
| **Relevance** | Understand that UKMTO advisories already incorporate JMIC analysis. No separate integration needed. |

#### 3.4.7 EU MSCHOA (Maritime Security Centre - Horn of Africa)

**URL:** mschoa.org
**Operated by:** EU Naval Force (EUNAVFOR)

| Aspect | Details |
|--------|---------|
| **What It Provides** | Vessel registration for Gulf of Aden transit, security advisories, IRTC corridor recommendations, naval patrol updates |
| **Integration** | Email subscription. BIHAR vessels transiting Gulf of Aden should be registered with MSCHOA. |
| **Cost** | **FREE** |

#### 3.4.8 BIMCO Security Advisories

**Provider:** BIMCO (Baltic and International Maritime Council)
**Relevance:** Confirmed Houthi resumed Red Sea attacks July 2025. Publishes security advisories for members.
**Access:** BIMCO membership required. Advisories available to members.

#### 3.4.9 OSINT Social Media Feeds

**X/Twitter Monitoring (via X API v2):**

| Account | Focus | Reliability | Priority |
|---------|-------|-------------|----------|
| @CENTCOM | US military operations | Official -- highest | CRITICAL |
| @ABORASYASEEN | Houthi military claims | First-party (propaganda) -- verify | HIGH |
| @YemenMilitary | Yemen Armed Forces | First-party claims | HIGH |
| @MT_fincantieri | MarineTraffic alerts | Industry -- verified | MEDIUM |
| @ABORASYASEEN | Houthi operations | First to report attacks | HIGH |

**X API v2 Pricing:** Basic tier: $100/month for 10,000 tweet reads/month. Filter for maritime security keywords.

**Integration:**
```
X/Twitter OSINT Pipeline:
1. Monitor accounts: @CENTCOM, @ABORASYASEEN, @YemenMilitary
2. Keyword filter: "Houthi" | "Red Sea" | "missile" | "drone" | "vessel" |
   "tanker" | "attack" | "Gulf of Aden" | "Bab el-Mandeb" | "Strait of Hormuz"
3. New matching tweet -> parse for incident details
4. Tag as source: "OSINT-X" with verified: false
5. Cross-reference against UKMTO/CENTCOM official reports
6. Upgrade to verified: true when corroborated
```

**IMPORTANT:** All OSINT data MUST be tagged as "UNVERIFIED" in the UI until corroborated by an official source (UKMTO, CENTCOM, MARAD, IMB). Display with amber "UNVERIFIED" badge.

#### 3.4.10 JWC (Joint War Committee) Listed Areas

**Provider:** Lloyd's Market Association Joint War Committee
**Published via:** Lloyd's Market Association circulars (LMAJWC circulars)

| Aspect | Details |
|--------|---------|
| **What It Provides** | Geographic areas designated high-risk for war, strikes, terrorism, and related perils. Vessels entering JWC areas incur Additional War Risk Premium (AWRP). |
| **Current JWC Areas (BIHAR-relevant)** | Persian Gulf (Iran waters), Gulf of Oman, Arabian Sea (Yemen extended range), Red Sea (south of ~15N), Bab el-Mandeb, Gulf of Aden, Somali coast |
| **Financial Impact** | **Each transit through a JWC zone triggers AWRP, typically 0.01%-0.5% of hull insured value.** For a $70M LR2 tanker, this could be $7,000-$350,000 per transit. Rates fluctuate with threat level. |
| **Data Format** | Zone boundaries published as geographic coordinates in LMA circulars. Updated as threat levels change. |
| **Integration** | Define zone boundaries as GeoJSON polygons. Check vessel position against polygons. Log entry/exit. Calculate estimated premium impact. |
| **Cost** | Zone definitions are publicly available from LMA circulars. |
| **Priority** | **CRITICAL** -- direct financial impact on BIHAR operations |

---

### 3.5 Data Source Cost Summary

| Data Source | Phase 1 Cost | Phase 2 Cost | Phase 3 Cost |
|-------------|-------------|-------------|-------------|
| Datalastic AIS | EUR 9 (trial) | EUR 679/mo | EUR 679/mo (backup) |
| MarineTraffic/Kpler | $0 | $1,000-3,000/mo | $1,000-3,000/mo |
| OpenWeatherMap | $0 (free tier) | $0 (free tier) | $40/mo |
| Stormglass | $0 | $19/mo | $49/mo |
| UKMTO | $0 | $0 | $0 |
| MARAD MSCI | $0 | $0 | $0 |
| CENTCOM | $0 | $0 | $0 |
| IMB | $0 (public) | $200-500/mo (feed) | $200-500/mo |
| ACLED | $0 (free tier) | $0 | $0 |
| X API | $0 | $100/mo | $100/mo |
| Dryad/Ambrey | $0 | $0 | $500-2,500/mo (optional) |
| **TOTAL** | **~EUR 9** | **~$2,000-4,300/mo** | **~$2,500-6,900/mo** |

The board has stated willingness to pay reasonable subscription costs. At $2,000-7,000/month, this platform costs a fraction of what Dryad Global (~$15,000-50,000/year) or Ambrey (~$10,000-30,000/year) charge, while providing superior fleet-specific intelligence.

---

## 4. Architecture Requirements

### 4.1 Current Architecture (Must Change)

```
CURRENT STATE (Unacceptable):

  [Browser]
      |
      +-- index.htm (single file, ~1000 lines)
            |-- Hardcoded vessel array (JS)
            |-- setInterval simulation engine
            |-- All CSS inline
            |-- All JS inline
            |-- Leaflet.js (CDN)
            |-- No backend
            |-- No API calls
            |-- No database
            |-- No authentication
```

### 4.2 Target Architecture

```
TARGET ARCHITECTURE:

[Frontend - Browser/PWA]
    |
    |-- WebSocket (real-time: positions, threats, alerts)
    |-- REST API (vessel details, history, config, admin)
    |
[Backend Server (Node.js/Express or Python/FastAPI)]
    |
    |-- AIS Data Service --------------------------------+
    |     |-- Datalastic adapter (Phase 1)               |
    |     |-- MarineTraffic adapter (Phase 2+)           |
    |     |-- Provider fallback logic                    |
    |     |-- Position cache (in-memory, 5-min TTL)      |
    |     |-- AIS gap detector                           |
    |     |-- Position history logger                    |
    |                                                    |
    |-- Threat Intelligence Service --------------------+|
    |     |-- UKMTO scraper/email parser                ||
    |     |-- MARAD RSS parser                          ||
    |     |-- CENTCOM RSS parser                        ||
    |     |-- IMB piracy map scraper                    ||
    |     |-- ACLED API adapter                         ||
    |     |-- X/Twitter OSINT monitor                   ||
    |     |-- Incident normalizer & deduplicator        ||
    |     |-- Threat event database                     ||
    |                                                    |
    |-- Proximity Alert Engine -------------------------+|
    |     |-- Vessel position + incident correlation    ||
    |     |-- 4-tier alert calculation (100/50/25/10nm) ||
    |     |-- Alert deduplication & cooldown            ||
    |     |-- Notification dispatcher (push/email/SMS)  ||
    |                                                    |
    |-- Risk Scoring Engine ----------------------------+|
    |     |-- Per-vessel risk calculation               ||
    |     |-- Corridor threat level calculation          ||
    |     |-- JWC zone geofencing                       ||
    |     |-- Risk history tracking                     ||
    |                                                    |
    |-- Weather Service --------------------------------+|
    |     |-- OpenWeatherMap adapter                     |
    |     |-- Stormglass adapter (Phase 2)              |
    |     |-- Weather cache (30-min TTL)                |
    |                                                    |
    |-- Vessel Registry Service ------------------------+
    |     |-- Verified vessel specifications             |
    |     |-- Static data (from registry verification)   |
    |                                                    |
    |-- Data Persistence -------------------------------+
          |-- SQLite (Phase 1) / PostgreSQL (Phase 2+)
          |-- Tables: incidents, vessel_positions,
          |   alerts, jwc_zones, corridor_status,
          |   risk_scores, ais_gaps, config
```

### 4.3 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Frontend** | HTML/CSS/JS (current stack, modularized) | Works well, keep it simple. Split into modules. No framework required unless team prefers one. |
| **Map** | Leaflet.js + Leaflet.heat (heatmap) | Already integrated. Add plugins for heatmap and GeoJSON overlays. |
| **Backend** | Node.js with Express.js (RECOMMENDED) or Python with FastAPI | Node.js: same language as frontend, excellent WebSocket support, async I/O for API polling. Python: if team prefers, FastAPI is equally capable. |
| **Real-time** | WebSocket (via `ws` or Socket.io) | Push position updates, threat events, and alerts to all connected clients |
| **Database** | SQLite (Phase 1) -> PostgreSQL (Phase 2+) | SQLite for zero-config development. Migrate to PostgreSQL for production multi-user. |
| **Caching** | In-memory (node-cache or Map) | Cache AIS positions (5-min TTL), weather (30-min TTL) to reduce API costs |
| **Scheduling** | node-cron | Schedule AIS polling, feed scraping, weather updates, risk recalculation |
| **HTTP Client** | axios or node-fetch | For calling AIS, weather, and security data APIs |
| **Email Parsing** | mailparser + IMAP client | For parsing UKMTO email alerts |
| **RSS Parsing** | rss-parser (npm) | For MARAD, CENTCOM, news RSS feeds |
| **Web Scraping** | cheerio (npm) | For parsing UKMTO and IMB web pages |
| **GeoJSON** | turf.js | For point-in-polygon (JWC zones), distance calculations, geospatial operations |
| **Push Notifications** | web-push (npm) | Browser push notifications for alerts |
| **Deployment** | Docker container | Portable, reproducible, easy to deploy on any server |

### 4.4 Data Flow Timing

```
EVERY 5 MINUTES (AIS cycle):
  [Scheduler] -> Poll AIS provider for 23 vessels
  -> Cache new positions
  -> Store position history
  -> Check AIS gaps (flag if >30 min in conflict zone)
  -> Compare each vessel vs JWC zone polygons
  -> Compare each vessel vs active incidents (proximity check)
  -> Recalculate risk score per vessel
  -> Update corridor threat levels
  -> Push updates to all WebSocket clients

EVERY 15 MINUTES (threat feed cycle):
  [Scheduler] -> Scrape UKMTO Recent Incidents page
  -> Parse MARAD RSS feed
  -> Parse CENTCOM RSS feed
  -> Scrape IMB piracy map
  -> Check X API for keyword matches
  -> Normalize and deduplicate new incidents
  -> Store in incident database
  -> Run proximity check against all BIHAR vessels
  -> Generate alerts if thresholds breached
  -> Push new threat events to WebSocket clients

EVERY 30 MINUTES (weather cycle):
  [Scheduler] -> Fetch weather for each vessel's position
  -> Cache results (30-min TTL)
  -> Check for severe weather (Beaufort 8+)
  -> Push weather updates to clients

WEEKLY (historical data):
  [Scheduler] -> Pull ACLED conflict data for Yemen/region
  -> Update historical incident database
  -> Regenerate heatmap data

ON EVENT (real-time):
  [Email received from UKMTO] -> Parse immediately
  -> Create incident -> Run proximity -> Alert if needed -> Push to clients
```

---

## 5. Feature Specifications

### 5.1 FEAT-001: Real-Time Vessel Position Tracking

**Priority:** P0 -- MUST HAVE (Phase 1)
**Replaces:** Simulated `setInterval` position engine

#### Description
Display actual, live positions of all 23 BIHAR vessels on the map using AIS data from a real provider.

#### Data Requirements Per Vessel

| Field | Source | Display Location | Update Frequency |
|-------|--------|-----------------|-----------------|
| Latitude/Longitude | AIS API | Map marker position | 5 min |
| Speed Over Ground (SOG) | AIS API | Marker tooltip + detail panel | 5 min |
| Course Over Ground (COG) | AIS API | Marker rotation + detail panel | 5 min |
| True Heading (HDG) | AIS API | Marker rotation (preferred over COG) | 5 min |
| Navigation Status | AIS API | Detail panel, vessel card | 5 min |
| Draught | AIS API | Detail panel (AIS tab) | 5 min |
| AIS Destination | AIS API | Vessel card, detail panel | 5 min |
| AIS-reported ETA | AIS API | Detail panel | 5 min |
| Last AIS Timestamp | AIS API | Signal freshness indicator | 5 min |
| Calculated ETA | Computed (distance/speed) | Detail panel (if AIS ETA unavailable) | 5 min |
| Distance Remaining | Computed (haversine to destination) | Detail panel, voyage progress bar | 5 min |
| Voyage Progress % | Computed | Detail panel progress bar | 5 min |

#### Acceptance Criteria

```
AC-001: All 23 vessel positions are sourced from live AIS provider
        (Datalastic or MarineTraffic), not from hardcoded data or simulation.
        VERIFICATION: Check browser network tab -- must show API calls to AIS provider
        through backend proxy, not reading from local JS array.

AC-002: Position updates occur at maximum 5-minute intervals.
        VERIFICATION: Log timestamps of position updates. Gap between consecutive
        updates for same vessel must be <= 5 minutes (when system is healthy).

AC-003: Each vessel marker tooltip shows: name, SOG, COG, destination, ETA.
        VERIFICATION: Hover over each marker -- verify all fields are populated
        from AIS data, not static strings.

AC-004: Vessel markers are rotated to show heading.
        VERIFICATION: Compare marker rotation angle with AIS heading value.
        Use custom SVG/CSS marker with rotation transform.

AC-005: Marker animates smoothly between position updates (CSS transition or
        Leaflet animation, not teleporting).
        VERIFICATION: Watch marker during position update -- should glide to new position.

AC-006: "Last Updated" timestamp visible per vessel showing AIS data age.
        VERIFICATION: Vessel card and detail panel show "Updated: 3 min ago" style text.

AC-007: Visual warning when AIS data is stale (> 30 minutes):
        marker gets dimmed opacity (0.6) and amber pulsing border.
        VERIFICATION: Simulate stale data -- marker visually changes.

AC-008: Critical warning when AIS data very stale (> 6 hours):
        marker gets red border and "AIS LOST" text label.
        VERIFICATION: Simulate old timestamp -- marker shows critical indicator.

AC-009: "LIVE" header indicator reflects actual connection status:
        GREEN dot = WebSocket connected and data flowing
        AMBER dot = WebSocket connected but no update in >10 minutes
        RED dot = WebSocket disconnected
        VERIFICATION: Disconnect WebSocket -- indicator turns red within 10 seconds.

AC-010: Voyage progress bar shows calculated % based on haversine distance.
        VERIFICATION: Check math -- progress = (total_distance - remaining_distance) / total_distance * 100.
```

### 5.2 FEAT-002: Verified Vessel Specifications

**Priority:** P0 -- MUST HAVE (Phase 1)

#### Acceptance Criteria

```
AC-011: Every vessel's IMO verified against Equasis or MarineTraffic.
AC-012: DWT, GT, NT, LOA, Beam, Draft are verified values.
AC-013: Builder, build year, flag, class society verified.
AC-014: Unverified fields show "UNVERIFIED" amber badge.
AC-015: Detail panel shows data source attribution per section.
AC-016: P&I Club and ISM/ISPS status shown if available.
```

### 5.3 FEAT-003: Real Weather Data

**Priority:** P1 -- SHOULD HAVE (Phase 1)

#### Acceptance Criteria

```
AC-017: Weather fetched from OpenWeatherMap using vessel lat/lon.
AC-018: Weather updates every 30 minutes per vessel.
AC-019: Display: temperature, wind speed/direction, visibility, conditions.
AC-020: Weather icons are real (from API condition codes), not hardcoded.
AC-021: Severe weather (Beaufort 8+, visibility < 1nm) triggers amber warning badge.
```

### 5.4 FEAT-004: Market Data Integrity

**Priority:** P1 -- SHOULD HAVE (Phase 1)

#### Acceptance Criteria

```
AC-022: Every market data point shows source attribution.
AC-023: Data not from real-time verified source labeled "INDICATIVE" in amber.
AC-024: Random Math.random() fluctuation in setInterval REMOVED from all market data.
AC-025: Vessel valuation methodology documented and shown to user.
AC-026: Scrap value shows source and date.
AC-027: Charter rate shows spot vs period and reference date.
```

### 5.5 FEAT-005: AIS Signal Monitoring

**Priority:** P0 -- MUST HAVE (Phase 1, ties into CZMT)

#### Acceptance Criteria

```
AC-028: "Time Since Last AIS Signal" tracked and displayed for every vessel.
AC-029: Signal freshness color coding:
        GREEN: < 15 min
        AMBER: 15-60 min
        RED: > 60 min
        BLACK: > 6 hours
AC-030: Vessel in JWC zone with AIS gap > 30 min triggers HIGH alert.
AC-031: Any vessel with AIS gap > 6 hours triggers CRITICAL alert.
AC-032: AIS gap history logged per vessel (start time, end time, last known position).
AC-033: Dashboard stat bar shows count of vessels with active AIS gaps.
```

### 5.6 FEAT-006: Port Call History

**Priority:** P2 -- NICE TO HAVE (Phase 3)

#### Acceptance Criteria

```
AC-034: If AIS provider supports port call history API (MarineTraffic EV01),
        display real port calls with actual arrival/departure times.
AC-035: If real port call data is NOT available, the "Ports" tab is hidden
        rather than showing fabricated data.
AC-036: When shown, port calls include: port name, country, arrive datetime,
        depart datetime, duration.
```

---

## 6. Conflict Zone Monitoring Terminal (CZMT) Specification

### 6.1 Overview

The CZMT is the flagship feature. It provides a Bloomberg-terminal-style maritime threat intelligence dashboard that is superior to commercial offerings from Dryad Global (Secure Voyager Hub) and Ambrey Intelligence (MRI Platform).

**Access:** New header button "THREAT CENTER" with red alert badge showing count of active warnings. Clicking opens the CZMT as a full-screen overlay (or dedicated route if SPA).

### 6.2 Terminal Layout Specification (Bloomberg-Style)

The CZMT uses a dark theme, dense information layout with multiple panels.

```
+=====================================================================+
|  [BIHAR SENTINEL Logo]  [Fleet]  [>>> THREAT CENTER (3) <<<]  [Market] |
+=====================================================================+
| CORRIDOR STATUS BAR (full width, always visible)                     |
| +----------+ +----------+ +----------+ +----------+ +----------+   |
| | HORMUZ   | | BAB EL-  | | GULF OF  | | SUEZ     | | ARABIAN  |   |
| | [AMBER]  | | MANDEB   | | ADEN     | | APPROACH | | SEA      |   |
| | 2 events | | [RED]    | | [AMBER]  | | [GREEN]  | | [RED]    |   |
| | 0 BIHAR  | | 5 events | | 1 event  | | 0 events | | 3 events |   |
| +----------+ | 2 BIHAR  | | 0 BIHAR  | | 1 BIHAR  | | 1 BIHAR  |   |
|              +----------+ +----------+ +----------+ +----------+   |
+======================+===============================================+
| ALERT BANNER         |  (flashing red/amber when active alert)       |
| "CRITICAL: Al Jabirah| is 23nm from missile incident in Arabian Sea"|
+======================+===============================================+
|                      |                                               |
|  THREAT MAP          |  EVENT FEED (scrolling ticker)                |
|  (60% width)         |  (40% width, top section)                    |
|                      |                                               |
|  [Leaflet map with:  |  +--- LIVE THREAT FEED ----+                 |
|   - Dark base tiles  |  | 14:32 UTC [MISSILE]     |                 |
|   - BIHAR vessel     |  | Red Sea, 13.4N 42.9E    |                 |
|     markers          |  | MV EXAMPLE targeted     |                 |
|   - Incident markers |  | Source: UKMTO           |                 |
|     (color by type): |  | BIHAR: None within 50nm |                 |
|     missile = RED    |  | [VIEW ON MAP]           |                 |
|     drone = ORANGE   |  |                         |                 |
|     mine = YELLOW    |  | 12:15 UTC [DRONE]       |                 |
|     boarding = PURPLE|  | Bab el-Mandeb           |                 |
|     GPS jam = CYAN   |  | USV intercepted         |                 |
|   - JWC zone overlay |  | Source: CENTCOM         |                 |
|     (red dashed      |  | BIHAR: Al Jabirah 82nm  |                 |
|      boundary, semi- |  | [VIEW ON MAP]           |                 |
|      transparent     |  |                         |                 |
|      red fill)       |  | 08:41 UTC [ADVISORY]    |                 |
|   - IRTC corridor    |  | UKMTO updated guidance  |                 |
|     (green dashed)   |  | Source: UKMTO           |                 |
|   - Risk heatmap     |  | [VIEW FULL TEXT]        |                 |
|     (toggleable)     |  +-------------------------+                 |
|   - Proximity rings  |                                               |
|     (25/50/100nm)    |  VESSEL RISK STATUS                          |
|  ]                   |  (40% width, bottom section)                 |
|                      |                                               |
|  Layer controls:     |  +--- RISK CARDS ----------+                 |
|  [x] Incidents       |  | Al Jabirah    [78] RED  |                 |
|  [x] JWC Zones       |  | LPG | Arabian Sea       |                 |
|  [x] Heatmap (6mo)   |  | JWC: YES | AIS: 3m ago  |                 |
|  [x] IRTC/TSS        |  | Nearest: 82nm (missile) |                 |
|  [x] Proximity rings |  +-------------------------+                 |
|                      |  | Al Shaffiah   [65] ORG  |                 |
|                      |  | Chem | Indian Ocean      |                 |
|                      |  | JWC: NO | AIS: 5m ago   |                 |
|                      |  | Nearest: 145nm (drone)  |                 |
|                      |  +-------------------------+                 |
|                      |  | Lunaria       [52] AMB  |                 |
|                      |  | LR2 | Mediterranean      |                 |
|                      |  | JWC: NO | AIS: 2m ago   |                 |
|                      |  | Approaching Suez        |                 |
|                      |  +-------------------------+                 |
|                      |  | ... (scrollable) ...    |                 |
+======================+===============================================+
| BOTTOM BAR                                                           |
| JWC Exposure: 8/23 vessels | Heatmap: [6mo] [12mo] [24mo]         |
| Est. AWRP: $12,400/day fleet-wide | [EXPORT REPORT]  [SETTINGS]   |
+=====================================================================+
```

### 6.3 Mobile Layout (Responsive)

On screens < 768px:
1. Corridor Status Bar becomes horizontally scrollable strip at top
2. Alert Banner below corridor bar (full width, collapsible)
3. Threat Map takes full screen
4. Bottom sheet (swipe up) contains: Event Feed and Vessel Risk Cards in tabs
5. Tapping a vessel marker on map shows its risk card inline

### 6.4 Threat Map Specification

#### 6.4.1 Map Layers (All Toggleable)

| Layer | Description | Visual Style | Default |
|-------|-------------|-------------|---------|
| **Base Map** | Dark tile layer | Current slate/navy Leaflet tiles | Always ON |
| **BIHAR Vessels** | 23 vessel position markers | Existing color scheme + heading rotation | Always ON |
| **Incident Markers** | Individual attack/incident points | See 6.4.2 below | ON |
| **JWC Zone Overlay** | Joint War Committee listed areas | Semi-transparent red fill (rgba(239,68,68,0.08)), dashed red border (2px), label text "JWC LISTED AREA" | ON |
| **IRTC Corridor** | Gulf of Aden recommended transit | Dashed green line (3px), label "IRTC" | ON |
| **TSS Hormuz** | Traffic Separation Scheme at Hormuz | Dashed blue lines with direction arrows | ON |
| **Risk Heatmap** | Density overlay from historical incidents | Canvas heatmap: green-yellow-orange-red gradient. Configurable time period. | OFF (toggle) |
| **Proximity Rings** | Distance circles around BIHAR vessels in risk zones | Concentric dashed circles at 25nm (red), 50nm (orange), 100nm (amber) from each BIHAR vessel currently in a JWC zone | OFF (toggle) |

#### 6.4.2 Incident Marker Specification

| Incident Type | Marker Color | Marker Shape | Icon |
|---------------|-------------|-------------|------|
| Missile (ASBM/ASCM) | Red (#ef4444) | Triangle (pointing up) | Explosion symbol |
| Drone (UAV) | Orange (#f97316) | Diamond | Propeller symbol |
| USV (explosive boat) | Red (#dc2626) | Circle | Boat symbol |
| Mine/Waterborne IED | Yellow (#eab308) | Circle with X | Mine symbol |
| Boarding/Attempted | Purple (#a855f7) | Square | Ladder symbol |
| Piracy (robbery/hijack) | Purple (#7c3aed) | Square filled | Skull symbol |
| GPS Jamming/Spoofing | Cyan (#06b6d4) | Hexagon | Signal symbol |
| Naval Activity | Blue (#3b82f6) | Star | Military symbol |
| Advisory (UKMTO/MARAD) | Amber (#f59e0b) | Info circle | "i" symbol |

**Marker Size:** Proportional to recency:
- Last 24 hours: 24px (large, prominent)
- 1-7 days: 18px (medium)
- 7-30 days: 12px (small)
- 30+ days: 8px (very small, faded 50% opacity)

**Marker Popup (on click):**
```
+--------------------------------------------+
| INCIDENT REPORT                    [CLOSE] |
|--------------------------------------------|
| Type:     Anti-ship ballistic missile       |
| Date:     2026-02-26 14:32 UTC             |
| Position: 13.42N, 42.87E                   |
| Target:   MV EXAMPLE (Bulk Carrier, Panama)|
| Result:   Near miss, no damage reported     |
| Weapon:   ASBM (Houthi/Ansar Allah)        |
|--------------------------------------------|
| Source:   UKMTO Advisory #2026-047         |
| Verified: YES                               |
|--------------------------------------------|
| NEAREST BIHAR VESSELS:                      |
| 1. Al Jabirah  - 82nm NW  [WATCH]         |
| 2. Al Shaffiah - 145nm E  [CLEAR]         |
| 3. Al Mahfoza  - 210nm N  [CLEAR]         |
+--------------------------------------------+
```

### 6.5 Corridor Safety Status Specification

#### 6.5.1 Corridor Geographic Definitions

| Corridor ID | Name | Bounding Box (approx) | Key Features |
|-------------|------|----------------------|--------------|
| `HORMUZ` | Strait of Hormuz | 25.5N-27.0N, 55.0E-57.5E | TSS inbound/outbound lanes, Omani waters, Iranian waters |
| `BAB_EL_MANDEB` | Bab el-Mandeb Strait | 12.0N-13.5N, 42.5E-44.0E | Narrowest point, Yemen coast, Djibouti coast, Perim Island |
| `GULF_OF_ADEN` | Gulf of Aden | 11.0N-15.5N, 43.0E-51.0E | IRTC corridor, approach to Bab el-Mandeb, Somali coast |
| `SUEZ_APPROACH` | Suez Canal Approach | 28.0N-31.5N, 32.0E-34.5E | Gulf of Suez, canal entrance, waiting anchorages |
| `ARABIAN_SEA` | Arabian Sea (Extended) | 10.0N-25.0N, 55.0E-68.0E | Main shipping lanes, Houthi extended strike range (>2000km demonstrated) |
| `SOMALI_BASIN` | Somali Basin | 0.0-11.0N, 43.0E-55.0E | Piracy risk area, offshore Somalia |

Each corridor is defined as a GeoJSON polygon stored in configuration.

#### 6.5.2 Status Calculation Logic

```
For each corridor, calculate status based on:

INPUT: All incidents in corridor from last 7 days
       Active UKMTO/MARAD advisories mentioning corridor
       Number of BIHAR vessels currently in corridor

LOGIC:
  IF active_military_operation OR active_UKMTO_warning("do not transit"):
    status = BLACK ("Do Not Transit")
  ELSE IF incident_count_7d >= 3 OR active_UKMTO_warning("heightened risk"):
    status = RED ("High Risk")
  ELSE IF incident_count_7d >= 1 OR active_advisory:
    status = AMBER ("Elevated Risk")
  ELSE:
    status = GREEN ("Normal")

TREND (vs previous 7-day period):
  IF incident_count_7d > incident_count_prev_7d: trend = "INCREASING" (up arrow)
  ELSE IF incident_count_7d < incident_count_prev_7d: trend = "DECREASING" (down arrow)
  ELSE: trend = "STABLE" (dash)
```

#### 6.5.3 Corridor Status Card UI

```
+------------------------------------+
| STRAIT OF HORMUZ          [AMBER]  |
| 2 incidents (7 days)    trend: ->  |
| BIHAR vessels in zone: 3           |
| (Al Barrah, Lilac, Andes)         |
| Last incident: Drone, 3 days ago   |
| [EXPAND DETAILS]                   |
+------------------------------------+
```

Expanded view shows:
- List of recent incidents in corridor (last 30 days)
- List of BIHAR vessels currently in or approaching corridor
- Active advisories applicable to corridor
- Historical incident count chart (bar chart, weekly for last 12 weeks)

### 6.6 Live Threat Feed Specification

#### 6.6.1 Feed Entry Format

Each entry in the scrolling feed:

```
[TIMESTAMP] [TYPE BADGE] [REGION BADGE]
[Title/Description - 1-2 lines]
Source: [SOURCE] | Verified: [YES/NO]
BIHAR Proximity: [vessel_name] [distance]nm [direction] | [ALERT_LEVEL] or "No BIHAR vessels within 200nm"
[VIEW ON MAP]  [FULL DETAILS]
---separator---
```

Example rendered entry:
```
14:32 UTC  [MISSILE]  [RED SEA]
Anti-ship ballistic missile fired at MV EXAMPLE (bulk carrier)
near 13.42N 42.87E. Near miss, vessel proceeding.
Source: UKMTO Advisory #2026-047 | Verified: YES
BIHAR: Al Jabirah 82nm NW [WATCH]
[VIEW ON MAP]  [FULL DETAILS]
```

#### 6.6.2 Feed Behavior

- New events slide in from top with a brief amber flash highlight (0.5s)
- Auto-scrolls to show newest events unless user has scrolled up (reading history)
- Shows last 50 events by default
- "Load More" button at bottom for history (infinite scroll)
- Events older than 30 days accessible via "Archive" link
- CRITICAL events get persistent red background until acknowledged
- UNVERIFIED events show amber "UNVERIFIED" badge that changes to green "VERIFIED" when corroborated

#### 6.6.3 Feed Filtering

Filters (toggle buttons above feed):
- By type: ALL | MISSILE | DRONE | USV | MINE | BOARDING | ADVISORY
- By source: ALL | UKMTO | CENTCOM | MARAD | IMB | OSINT
- By relevance: ALL | NEAR BIHAR (within 200nm of any BIHAR vessel)
- By time: 24H | 7D | 30D

### 6.7 Vessel Risk Status Panel

#### 6.7.1 Risk Card Layout

```
+--------------------------------------------------+
| [MARKER_ICON] AL JABIRAH              [78] [RED] |
| LPG Carrier | 27,710 DWT | Marshall Islands      |
|--------------------------------------------------|
| Position:  Arabian Sea (21.82N, 65.46E)          |
| Speed:     14.2 kts | Course: 068                |
| JWC Zone:  YES (entered 6h ago)                  |
| AIS:       LIVE (3 min ago) [GREEN DOT]          |
| Nearest Threat: 82nm NW (MISSILE, 6h ago)        |
| Corridor:  ARABIAN SEA [RED]                     |
| Est. AWRP: $3,500/day                            |
|                                                  |
| RISK BREAKDOWN:                                  |
| Proximity: [||||||||--] 80  (30% wt)            |
| Corridor:  [||||||||--] 80  (25% wt)            |
| JWC Zone:  [||||||||||] 100 (15% wt)            |
| AIS Health:[----------] 0   (15% wt)            |
| Vuln:      [||||||----] 60  (10% wt)            |
| Historical:[||||||----] 60  (5% wt)             |
| = COMPOSITE: 78 / 100                            |
+--------------------------------------------------+
```

#### 6.7.2 Risk Card Sorting and Filtering

- **Default sort:** Risk score descending (highest risk first)
- **Filters:**
  - By risk level: ALL | CRITICAL (76-100) | HIGH (51-75) | MODERATE (26-50) | LOW (0-25)
  - By vessel type: ALL | Tanker | LPG | Chemical | Crude
  - By corridor: ALL | [specific corridor]
  - By JWC status: ALL | IN JWC | NOT IN JWC
- **Default view:** Only vessels with risk score > 0 (vessels in completely safe waters like Antwerp or Sines are hidden unless "ALL" selected)

### 6.8 Proximity Alert Engine

#### 6.8.1 Alert Tiers

| Tier | Distance | Name | Visual | Audio | Push | Email | SMS |
|------|----------|------|--------|-------|------|-------|-----|
| **WATCH** | 100nm | Watch Zone | Amber banner | None | No | No | No |
| **WARNING** | 50nm | Warning Zone | Orange banner, pulse | Chime | Yes | Yes | No |
| **CRITICAL** | 25nm | Critical Zone | Red banner, flash | Alert tone | Yes | Yes | Optional |
| **DANGER** | 10nm | Danger Zone | Red flashing, full-screen | Alarm | Yes | Yes | Yes |

#### 6.8.2 Alert Calculation (runs every AIS cycle)

```
FOR each BIHAR vessel V:
  FOR each active incident I (< 24 hours old, not resolved):
    distance = haversine(V.lat, V.lon, I.lat, I.lon) in nautical miles

    IF distance <= 10:
      alert_level = DANGER
    ELSE IF distance <= 25:
      alert_level = CRITICAL
    ELSE IF distance <= 50:
      alert_level = WARNING
    ELSE IF distance <= 100:
      alert_level = WATCH
    ELSE:
      alert_level = NONE

    IF alert_level != NONE AND (no existing alert for V+I pair OR escalation):
      create_alert(vessel=V, incident=I, level=alert_level, distance=distance)
      dispatch_notification(alert)
```

#### 6.8.3 Alert Deduplication and Cooldown

- Same vessel + same incident: only one active alert. If distance changes tier, update alert.
- Same vessel + different incidents in same area (< 10nm apart, < 1h): group as single event.
- Alert cooldown: after an alert is acknowledged, do not re-alert for same vessel+incident unless distance decreases to a higher tier.
- Resolved incidents: clear all associated alerts when incident marked RESOLVED.

#### 6.8.4 Alert Banner (Top of CZMT)

When an active CRITICAL or DANGER alert exists:

```
+=====================================================================+
| [FLASHING RED] CRITICAL: Al Jabirah is 23nm from missile incident   |
|                in Arabian Sea (13.42N, 42.87E) -- 2 hours ago       |
|                [VIEW ON MAP]  [ACKNOWLEDGE]  [DETAILS]              |
+=====================================================================+
```

- Banner flashes red/dark red at 1Hz for DANGER, steady red for CRITICAL
- Multiple active alerts rotate in banner (5s per alert) or stack
- Acknowledged alerts move to feed but banner clears
- DANGER alerts cannot be dismissed without acknowledgment

### 6.9 JWC War Risk Zone Tracking

#### 6.9.1 Zone Definition Storage

JWC zones stored as GeoJSON in a configuration file:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "JWC_PERSIAN_GULF",
        "name": "Persian Gulf (Iran waters)",
        "last_updated": "2026-01-15",
        "source": "LMA JWC Circular 2026/001"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[...coordinate pairs...]]]
      }
    }
  ]
}
```

**Note:** Actual coordinate boundaries must be obtained from the latest LMA JWC circular. The configuration file MUST be updatable without code changes (admin interface or config file reload).

#### 6.9.2 Zone Tracking Features

| Feature | Description | Implementation |
|---------|-------------|---------------|
| **Real-time zone check** | Every AIS update, check if vessel position is inside any JWC polygon | turf.js `booleanPointInPolygon()` |
| **Entry/exit logging** | Record timestamp when vessel enters and exits JWC zone | Database table: jwc_zone_events(vessel_imo, zone_id, event_type, timestamp, position) |
| **Time-in-zone tracking** | Cumulative time each vessel has spent in JWC zones | Computed from entry/exit log |
| **Zone count display** | Dashboard shows "X of 23 vessels currently in JWC areas" | Stats bar widget |
| **Map overlay** | JWC zones rendered as semi-transparent red polygons on map | Leaflet GeoJSON layer |
| **Insurance impact** | Estimated AWRP per vessel per day | Configurable rate input (from BIHAR insurance broker) |

#### 6.9.3 Insurance Premium Impact Calculator

```
AWRP Estimation:

INPUT:
  - Vessel hull insured value (from vessel registry)
  - AWRP rate (% of hull value, per transit or per day)
    [NOTE: Rate must be manually configured by BIHAR based on
     actual terms from their war risk underwriter/P&I club.
     Typical range: 0.01% - 0.50% per transit]
  - Time in zone (from entry/exit log)

DISPLAY:
  Per vessel: "Estimated AWRP: $X,XXX for current transit"
  Fleet-wide: "Estimated AWRP: $XX,XXX/day for all vessels in JWC zones"

ADMIN CONFIG:
  - AWRP rate per zone (may differ by zone)
  - Hull insured value per vessel
  - Calculation method: per-transit flat rate OR per-day in zone
```

### 6.10 Historical Attack Heatmap

#### 6.10.1 Data Sources for Heatmap

| Source | Date Range | Event Types | Coordinates |
|--------|-----------|-------------|-------------|
| ACLED | 2015-present | All armed conflict events in Yemen region with maritime relevance | Yes (lat/lon) |
| UKMTO (scraped) | As accumulated | All maritime security incidents | Yes |
| IMB (scraped) | As accumulated | Piracy and armed robbery | Yes |
| Manual entries | As entered | All types | Yes |

#### 6.10.2 Heatmap Implementation

- **Library:** Leaflet.heat plugin (L.heatLayer)
- **Data:** Array of [lat, lon, intensity] points from incident database
- **Intensity weighting:** More recent incidents have higher intensity. Missile/drone attacks weighted higher than advisories.
- **Configuration:**
  - Time period selector: 30 days | 90 days | 6 months | 12 months | 24 months
  - Incident type filter: All | Missile/Drone | Piracy | All Kinetic
  - Radius: 50nm per point (configurable)
  - Color gradient: transparent -> yellow -> orange -> red
  - Max zoom level for rendering
- **Toggle:** On/Off via layer control checkbox. OFF by default (can be visually overwhelming).

#### 6.10.3 Heatmap Use Cases

The board uses the heatmap to:
1. Identify attack clustering patterns (e.g., "attacks concentrated along specific shipping lane")
2. Validate rerouting decisions (e.g., "Cape of Good Hope route avoids all hotspots")
3. Brief insurance underwriters on risk exposure with visual evidence
4. Track temporal trends (compare 6mo vs 12mo to see if threat area is expanding or contracting)

### 6.11 AIS Dark Detection

#### 6.11.1 Definition

"AIS Dark" = a vessel whose AIS signal has not been received for an unexpectedly long period, particularly concerning in conflict zones where it may indicate:
- Vessel distress (communications failure)
- Deliberate AIS shut-off (sanctions evasion, security precaution in hostile waters)
- Satellite coverage gap (less concerning but should be flagged)
- Equipment malfunction

#### 6.11.2 Detection Logic

```
FOR each BIHAR vessel V:
  time_since_last_ais = NOW - V.last_ais_timestamp

  IF V is in JWC zone:
    IF time_since_last_ais > 30 minutes:
      alert(level=HIGH, message="AIS gap detected for {V.name} in {zone_name}")
      flag vessel marker with "AIS GAP" warning
    IF time_since_last_ais > 2 hours:
      alert(level=CRITICAL, message="AIS DARK: {V.name} in {zone_name}, last seen at {position}")
  ELSE:
    IF time_since_last_ais > 6 hours:
      alert(level=HIGH, message="AIS signal lost for {V.name}, last seen at {position}")
    IF time_since_last_ais > 24 hours:
      alert(level=CRITICAL, message="AIS DARK 24h+: {V.name}, last seen at {position}")
```

#### 6.11.3 AIS Dark Display

On the map:
- Vessel marker changes: border becomes dashed, opacity reduced to 0.5
- Pulsing amber ring around marker (for > 30 min gap in JWC zone)
- "LAST KNOWN" label appears below vessel name
- Position shown is last known position with timestamp

On the vessel risk card:
- AIS status changes to "DARK" with red badge
- "Last seen: [position], [time] ago" displayed prominently
- Gap duration shown and counting up in real-time

### 6.12 Communication Status Panel

For each vessel in the Threat Center view:

| Field | Source | Visual |
|-------|--------|--------|
| Last AIS signal timestamp | AIS provider | "3 min ago" (green), "47 min ago" (amber), "6h ago" (red) |
| AIS reception type | AIS provider metadata | "Terrestrial" / "Satellite" / "Unknown" |
| Signal gaps (last 7 days) | Computed from position history | "2 gaps, total 45 min" |
| AIS status | Computed | GREEN dot "Live" / AMBER dot "Stale" / RED dot "Dark" |
| Estimated reachability | Inference from AIS + position | "Reachable" / "Limited" / "Unreachable" |

### 6.13 Report Export

**Feature:** Generate PDF threat report for board meetings.

**Report Contents:**
1. Executive summary: fleet risk overview, corridor status, active threats
2. Vessel risk table: all 23 vessels with risk scores, positions, JWC status
3. Incident summary: last 30 days, categorized by type and corridor
4. Heatmap image: current 6-month heatmap rendered as static image
5. JWC zone exposure: time-in-zone per vessel, estimated AWRP
6. Alert history: all alerts generated in period with outcomes

**Format:** PDF, generated server-side or via browser print-to-PDF of a dedicated report view.

**Frequency:** On-demand via "EXPORT REPORT" button. Optionally, automated weekly email to board distribution list.

### 6.14 Automated Insurer Notice Generation

#### 6.14.1 Overview and Legal Context

Maritime war risk insurance policies contain **strict notification obligations**. Failure to provide timely notice to war risk underwriters can result in **denial of coverage, policy voidance, or significant premium penalties**. Given the current Iran/Arabian Gulf conflict environment and ongoing Houthi attacks in the Red Sea, this is not theoretical -- it is an **active, daily compliance requirement** for BIHAR.

The CZMT will automatically generate, pre-fill, and queue insurer notices based on vessel movements and threat events, ensuring BIHAR never misses a notification deadline.

**Regulatory/contractual basis:**
- Institute War and Strikes Clauses (Cargo & Hull) -- notification obligations
- JWC Listed Areas circulars -- trigger for Additional War Risk Premium (AWRP) notification
- Individual war risk policy terms (BIHAR-specific, entered by admin)
- P&I Club war risk extensions -- separate notification requirements
- Sanctions compliance reporting (OFAC/EU/UK sanctions on Iran-related activity)

#### 6.14.2 Notice Types and Auto-Generation Triggers

| Notice Type | Trigger | Deadline | Recipients | Priority |
|-------------|---------|----------|------------|----------|
| **Breach of Trading Warranty (BTW)** | Vessel position enters JWC listed area without prior approval | IMMEDIATELY upon entry (some policies: 48-72h advance notice required) | War risk underwriter, H&M insurer, P&I club | CRITICAL |
| **7-Day Advance Notice of Entry** | Vessel ETA to JWC zone boundary < 7 days (based on current course and speed) | 7 days before expected entry | War risk underwriter | HIGH |
| **AWRP Declaration** | Vessel enters JWC zone (after BTW/advance notice has been sent) | Within 24h of entry | War risk underwriter, broker | HIGH |
| **Zone Exit Confirmation** | Vessel position exits JWC zone boundary | Within 24h of exit | War risk underwriter, broker (triggers AWRP period closure) | MEDIUM |
| **Voyage Declaration** | Vessel departs for a destination that will transit a JWC zone | Upon departure | War risk underwriter | HIGH |
| **Incident Proximity Alert Notice** | BIHAR vessel within 50nm of a confirmed attack/incident | Within 1 hour of detection | War risk underwriter, H&M insurer, P&I club, DPA (Designated Person Ashore) | CRITICAL |
| **AIS Dark Notice** | Vessel AIS signal lost for > 60 min in JWC zone | Within 2 hours of detection | War risk underwriter, H&M insurer, P&I club, DPA, flag state | CRITICAL |
| **Claims Notification (First Advice)** | BIHAR vessel confirmed hit, damaged, or directly involved in attack | IMMEDIATELY | War risk underwriter, H&M insurer, P&I club, legal counsel, DPA, flag state, class society | CRITICAL |
| **Held Covered Notice** | Vessel enters area/situation NOT covered by standard terms but seeking "held covered" extension | Before or immediately upon entry | War risk underwriter via broker | HIGH |
| **Sanctions Exposure Notice** | Vessel enters Iranian territorial waters, STS zone, or interacts with sanctioned entity | IMMEDIATELY | Compliance officer, legal counsel, P&I club, sanctions screening provider | CRITICAL |
| **Monthly JWC Exposure Summary** | End of calendar month | 5th business day of following month | War risk underwriter, broker, CFO, board | LOW |
| **War Risk Policy Renewal Data Pack** | 60 days before policy renewal | 60 days pre-renewal | Broker, CFO | MEDIUM |

#### 6.14.3 Notice Content Templates

Each notice type has a pre-approved template. The system auto-fills vessel details, positions, and timestamps. The operator reviews and sends (or configures auto-send for non-critical notices).

**Template: Breach of Trading Warranty / 7-Day Advance Notice**

```
TO:       [War Risk Underwriter Name] via [Broker Name]
FROM:     BIHAR Shipping -- Fleet Operations
DATE:     [Auto: UTC timestamp]
RE:       WAR RISK NOTIFICATION -- [7-DAY ADVANCE NOTICE / BREACH OF WARRANTY]
POLICY:   [Policy Number from admin config]
VESSEL:   [Vessel Name], IMO [IMO Number], Flag [Flag State]

Dear Sirs,

We hereby notify you that the above-named vessel [is expected to enter / has entered]
the Joint War Committee Listed Area described as:

  Zone:         [JWC Zone Name, e.g., "Persian Gulf (Iran waters)"]
  Circular:     [LMA JWC Circular reference, e.g., "JH2026/001"]

Vessel Details:
  Current Position:    [Lat]°N, [Lng]°E (as of [timestamp] UTC)
  Speed:               [SOG] knots
  Course:              [COG]°
  Destination:         [Destination port]
  ETA to zone entry:   [Calculated ETA / "Already entered at [timestamp]"]
  Expected zone exit:  [Calculated ETA to exit, if available]

Cargo:    [From vessel registry or manual input]
Voyage:   [Departure port] → [Destination port]

We request [confirmation of cover / held covered terms] for this transit.

Please confirm Additional War Risk Premium (AWRP) applicable.

Yours faithfully,
[Auto: Designated Person Ashore name from config]
BIHAR Shipping
[Auto: contact details from config]
```

**Template: Incident Proximity Notice**

```
TO:       [War Risk Underwriter], [H&M Insurer], [P&I Club]
FROM:     BIHAR Shipping -- Fleet Operations (URGENT)
DATE:     [Auto: UTC timestamp]
RE:       SECURITY INCIDENT -- VESSEL PROXIMITY ALERT
POLICY:   [Policy Number]
VESSEL:   [Vessel Name], IMO [IMO Number]

URGENT NOTICE

A security incident has been reported in proximity to our vessel:

INCIDENT DETAILS:
  Type:        [Missile strike / Drone attack / Mine / etc.]
  Time:        [Incident timestamp] UTC
  Position:    [Incident Lat]°N, [Incident Lng]°E
  Source:      [UKMTO / CENTCOM / IMB / etc.]
  Description: [Brief incident description]

OUR VESSEL STATUS:
  Vessel:      [Vessel Name], IMO [IMO Number]
  Position:    [Vessel Lat]°N, [Vessel Lng]°E (as of [timestamp])
  Distance:    [X] nautical miles from incident
  Speed:       [SOG] knots
  Course:      [COG]° ([towards / away from / parallel to] incident area)
  Status:      [No damage / Evasive action taken / Damage sustained]
  AIS:         [Active / Dark since (timestamp)]

CREW STATUS:    [All safe / Casualties reported / Unknown]

ACTION TAKEN:   [Vessel has altered course to [new course] /
                 Vessel maintaining current route per master's assessment /
                 Vessel proceeding to safe port [port name]]

We will provide updates as the situation develops.

Yours faithfully,
[DPA Name]
BIHAR Shipping
```

**Template: Claims First Advice**

```
TO:       [War Risk Underwriter], [H&M Insurer], [P&I Club], [Legal Counsel]
FROM:     BIHAR Shipping -- CLAIMS NOTIFICATION (FIRST ADVICE)
DATE:     [Auto: UTC timestamp]
RE:       WAR RISK CLAIM -- FIRST ADVICE OF LOSS/DAMAGE
POLICY:   [Policy Number(s)]
VESSEL:   [Vessel Name], IMO [IMO Number]

FIRST ADVICE OF POTENTIAL CLAIM

This notice constitutes first advice of a potential claim under the
above-referenced war risk policy.

INCIDENT:
  Date/Time:     [Timestamp] UTC
  Position:      [Lat]°N, [Lng]°E
  Type:          [Missile hit / Drone strike / Mine detonation / etc.]
  Description:   [Auto-populated from incident database + manual additions]

VESSEL STATUS:
  Structural:    [No visible damage / Hull breach / Fire / Flooding / etc.]
  Propulsion:    [Operational / Impaired / Disabled]
  Navigation:    [Operational / Impaired / Disabled]
  AIS:           [Transmitting / Offline]

CREW:
  Total crew:    [Number]
  Status:        [All accounted for / Injuries reported / Fatalities / Unknown]
  Medical needs: [None / [Description]]

CARGO:
  Type:          [Cargo description]
  Status:        [Intact / Contaminated / Lost / Unknown]
  Quantity:       [MT]

IMMEDIATE ACTIONS TAKEN:
  1. [Action taken]
  2. [Action taken]
  3. [Action taken]

ESTIMATED DAMAGE:  [Preliminary estimate if available / "To be assessed"]

We will appoint surveyors and provide a detailed report as soon as practicable.
Please confirm claim reference number.

Yours faithfully,
[DPA Name], Designated Person Ashore
[Master Name], Master of [Vessel Name] (if available)
BIHAR Shipping
```

#### 6.14.4 Notice Generation Workflow

```
                    ┌─────────────────────────────┐
                    │     TRIGGER EVENT            │
                    │  (JWC entry, incident,       │
                    │   AIS dark, etc.)            │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  TEMPLATE SELECTION          │
                    │  System selects appropriate  │
                    │  template based on trigger   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  AUTO-FILL                   │
                    │  - Vessel details (registry) │
                    │  - Position (AIS)            │
                    │  - Incident details (DB)     │
                    │  - Policy numbers (config)   │
                    │  - Recipient list (config)   │
                    │  - DPA details (config)      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  REVIEW QUEUE                │
                    │  Notice appears in CZMT      │
                    │  "NOTICES" panel with:       │
                    │  - URGENT badge (if critical)│
                    │  - Pre-filled content        │
                    │  - Edit capability           │
                    │  - Manual fields to complete │
                    │    (crew status, cargo, etc.)│
                    └──────────────┬──────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │                   │
              ┌──────────▼──────┐  ┌─────────▼─────────┐
              │  AUTO-SEND      │  │  MANUAL REVIEW     │
              │  (if configured │  │  Operator reviews, │
              │  for this type) │  │  edits, and clicks │
              │                 │  │  "SEND"            │
              └────────┬────────┘  └─────────┬─────────┘
                       │                     │
              ┌────────▼─────────────────────▼─────────┐
              │  DISPATCH                               │
              │  - Email to all configured recipients   │
              │  - PDF attachment generated             │
              │  - CC to BIHAR compliance inbox         │
              │  - Logged in notice history database    │
              │  - Confirmation displayed in CZMT       │
              └─────────────────────────────────────────┘
```

#### 6.14.5 Notice Configuration (Admin Panel)

The system requires the following admin-configurable data:

```
INSURER CONFIGURATION:
┌─────────────────────────────────────────────────────────────┐
│ War Risk Underwriter                                         │
│   Name:           [e.g., "Talbot Underwriting Ltd"]          │
│   Contact Email:  [e.g., claims@talbot.com]                  │
│   Broker:         [e.g., "Marsh JLT Specialty"]              │
│   Broker Email:   [e.g., marine.claims@marsh.com]            │
│   Policy Number:  [e.g., "WR-2026-BIHAR-001"]               │
│   Policy Period:  [2026-01-01 to 2026-12-31]                │
│   AWRP Rate:      [e.g., 0.025% per transit]                │
│   Notice Period:  [e.g., 7 days advance for JWC entry]      │
│   Automatic Termination: [Yes/No, trigger conditions]        │
├─────────────────────────────────────────────────────────────┤
│ H&M Insurer                                                  │
│   Name:           [...]                                      │
│   Contact Email:  [...]                                      │
│   Policy Number:  [...]                                      │
├─────────────────────────────────────────────────────────────┤
│ P&I Club                                                     │
│   Name:           [e.g., "Gard P&I"]                         │
│   Contact Email:  [...]                                      │
│   Entry Number:   [...]                                      │
├─────────────────────────────────────────────────────────────┤
│ DPA (Designated Person Ashore)                               │
│   Name:           [...]                                      │
│   Email:          [...]                                      │
│   Phone:          [...]                                      │
│   Backup DPA:     [...]                                      │
├─────────────────────────────────────────────────────────────┤
│ Legal Counsel     [...]                                      │
│ Compliance Officer [...]                                     │
│ Flag State Contact [...]                                     │
│ Class Society      [...]                                     │
└─────────────────────────────────────────────────────────────┘

AUTO-SEND RULES:
  - Monthly JWC Summary:        AUTO-SEND (no review needed)
  - Zone Exit Confirmation:     AUTO-SEND (no review needed)
  - 7-Day Advance Notice:       AUTO-SEND with notification to DPA
  - Breach of Trading Warranty:  REQUIRE REVIEW (DPA must approve)
  - AWRP Declaration:           AUTO-SEND with notification to DPA
  - Incident Proximity:         REQUIRE REVIEW (DPA must approve)
  - AIS Dark Notice:            REQUIRE REVIEW (DPA must approve)
  - Claims First Advice:        REQUIRE REVIEW (DPA + legal must approve)
  - Sanctions Exposure:         REQUIRE REVIEW (compliance + legal must approve)
```

#### 6.14.6 Notice Dashboard in CZMT

A dedicated **"NOTICES"** tab/panel within the Threat Center:

```
+------------------------------------------------------------------+
| INSURER NOTICES                                    [+ New Notice] |
+------------------------------------------------------------------+
| PENDING REVIEW (3)                                                |
| ┌──────────────────────────────────────────────────────────────┐ |
| │ ⚠️  BREACH OF WARRANTY -- Al Jabirah                         │ |
| │ Generated: 14:32 UTC | Due: IMMEDIATELY                      │ |
| │ Vessel entered JWC_PERSIAN_GULF at 14:28 UTC                  │ |
| │ [REVIEW & SEND]  [EDIT]  [DISMISS WITH REASON]                │ |
| └──────────────────────────────────────────────────────────────┘ |
| ┌──────────────────────────────────────────────────────────────┐ |
| │ 🔔 7-DAY ADVANCE NOTICE -- Lunaria                           │ |
| │ Generated: 12:00 UTC | Due: Before 2026-03-07                 │ |
| │ ETA to JWC_RED_SEA: 6 days 14 hours at current speed         │ |
| │ [REVIEW & SEND]  [EDIT]  [SNOOZE 24H]                        │ |
| └──────────────────────────────────────────────────────────────┘ |
| ┌──────────────────────────────────────────────────────────────┐ |
| │ 🚨 INCIDENT PROXIMITY -- Desert Rose                         │ |
| │ Generated: 09:15 UTC | Due: WITHIN 1 HOUR                    │ |
| │ Vessel 34nm from confirmed missile strike in Arabian Sea      │ |
| │ [REVIEW & SEND]  [EDIT]                                       │ |
| └──────────────────────────────────────────────────────────────┘ |
+------------------------------------------------------------------+
| SENT TODAY (5)                                                    |
| ✅ 08:00 Zone Exit -- Al Barrah exited JWC_RED_SEA (auto-sent)  |
| ✅ 07:45 AWRP Declaration -- Galbot entered JWC_PERSIAN_GULF    |
| ✅ 06:30 Zone Exit -- Miraj exited JWC_GULF_OF_ADEN (auto-sent) |
| ✅ 06:12 7-Day Notice -- Al Shaffiah approaching JWC_RED_SEA    |
| ✅ 00:01 Monthly Summary -- January 2026 JWC Exposure Report    |
+------------------------------------------------------------------+
| NOTICE HISTORY  [Filter: All | This Week | This Month]           |
| [EXPORT NOTICE LOG AS CSV]  [EXPORT ALL NOTICES AS PDF BUNDLE]   |
+------------------------------------------------------------------+
```

#### 6.14.7 Compliance Audit Trail

Every notice action is logged immutably:

```sql
CREATE TABLE insurer_notices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    notice_type     TEXT NOT NULL,       -- 'BTW', '7DAY', 'AWRP', 'EXIT', 'PROXIMITY', 'DARK', 'CLAIM', 'HELD_COVERED', 'SANCTIONS', 'MONTHLY', 'RENEWAL'
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    trigger_event   TEXT NOT NULL,       -- Description of what triggered the notice
    trigger_timestamp TEXT NOT NULL,     -- When the triggering event occurred
    generated_at    TEXT NOT NULL,       -- When the notice was generated
    due_by          TEXT,                -- Deadline for sending
    status          TEXT NOT NULL,       -- 'PENDING', 'REVIEWED', 'SENT', 'DISMISSED', 'EXPIRED'
    reviewed_by     TEXT,                -- Username of reviewer
    reviewed_at     TEXT,
    sent_at         TEXT,
    sent_to         TEXT,                -- JSON array of recipient emails
    notice_content  TEXT NOT NULL,       -- Full notice text as generated/edited
    pdf_path        TEXT,                -- Path to generated PDF
    dismiss_reason  TEXT,                -- If dismissed, why
    policy_ref      TEXT,                -- Applicable policy number
    zone_id         TEXT,                -- JWC zone if applicable
    incident_id     INTEGER,             -- Link to incident if applicable
    FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE INDEX idx_notices_status ON insurer_notices(status);
CREATE INDEX idx_notices_vessel ON insurer_notices(vessel_imo);
CREATE INDEX idx_notices_type ON insurer_notices(notice_type);
CREATE INDEX idx_notices_date ON insurer_notices(generated_at);
```

#### 6.14.8 Sanctions Screening Integration

Given the Iran/Arabian Gulf conflict, BIHAR vessels may encounter sanctions-related situations:

- **Iranian territorial waters transit** (even innocent passage may require notification)
- **Ship-to-ship (STS) transfer zones** near Iran -- potential sanctions exposure
- **AIS manipulation** -- vessels spoofing positions to disguise Iran-origin cargo
- **Sanctioned entity interaction** -- if another vessel in proximity is on OFAC/EU sanctions lists

**Automated checks:**
1. When a BIHAR vessel enters Iranian EEZ (12nm territorial + 200nm EEZ), generate SANCTIONS EXPOSURE notice
2. When a vessel's AIS shows approach to known STS zones (configurable coordinates), generate alert
3. Cross-reference nearby vessels (within 5nm) against sanctions lists (manual input or future API integration with sanctions screening providers like Refinitiv World-Check, Pole Star PurpleTRAC)

#### 6.14.9 Iran/Arabian Gulf Specific Rules

Given the **current active conflict** between Iran and regional actors, the following Iran-specific rules are hardcoded:

| Rule | Trigger | Notice | Auto-Send |
|------|---------|--------|-----------|
| Iran EEZ approach | Vessel within 50nm of Iranian EEZ boundary | 7-Day Advance to war risk underwriter | No -- manual review |
| Iran EEZ entry | Vessel enters Iranian EEZ | BTW + Sanctions Notice | No -- manual review required |
| Strait of Hormuz transit | Vessel enters Hormuz TSS | AWRP Declaration | Yes (auto-send) |
| Hormuz exit | Vessel exits Hormuz TSS | Zone Exit Confirmation | Yes (auto-send) |
| IRGC naval activity | OSINT/CENTCOM reports IRGC naval movements near BIHAR vessel | Incident Proximity Notice | No -- manual review |
| GPS jamming detected | Vessel reports position anomaly in Persian Gulf | Technical Incident Notice to underwriter + flag state | No -- manual review |
| Iranian drone/missile | Confirmed attack in Persian Gulf within 100nm of BIHAR vessel | CRITICAL proximity notice + potential Claims First Advice | No -- manual review |

#### 6.14.10 Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-INS-001 | System generates BTW notice within 60 seconds of vessel entering JWC zone |
| AC-INS-002 | System generates 7-Day Advance Notice when vessel ETA to JWC boundary < 7 days |
| AC-INS-003 | All notice templates include correct vessel details auto-filled from registry and AIS |
| AC-INS-004 | Notices in PENDING status display in CZMT with countdown timer to deadline |
| AC-INS-005 | AUTO-SEND notices dispatch email within 5 minutes of trigger with PDF attachment |
| AC-INS-006 | MANUAL REVIEW notices require DPA click to send; cannot be auto-dispatched |
| AC-INS-007 | All notice actions logged in audit trail with immutable timestamps |
| AC-INS-008 | Monthly JWC Exposure Summary auto-generates on 1st of month with previous month data |
| AC-INS-009 | Notice history exportable as CSV and PDF bundle for policy renewal/audit |
| AC-INS-010 | Overdue notices (past deadline, still PENDING) trigger escalation alert to DPA + backup DPA |
| AC-INS-011 | Iran EEZ proximity (50nm) triggers advance notice regardless of JWC zone status |
| AC-INS-012 | Claims First Advice template generates within 120 seconds of operator confirming vessel involvement in incident |

**Frequency:** On-demand via "EXPORT REPORT" button. Optionally, automated weekly email to board distribution list.

---

## 7. Risk Scoring Algorithm

### 7.1 Overview

Each BIHAR vessel receives a **Risk Score from 0 to 100**, recalculated every AIS update cycle (5 minutes). The score is a weighted composite of six risk factors.

### 7.2 Factor Weights and Calculation

#### Factor 1: Proximity to Recent Incidents (Weight: 30%)

```
Considers all incidents within 200nm of vessel, less than 7 days old.

distance_to_nearest = haversine(vessel, nearest_incident) in nm
count_within_200nm = number of incidents within 200nm

IF no incidents within 200nm in last 7 days:
  proximity_score = 0
ELSE:
  IF distance_to_nearest <= 10nm:  base = 100  (DANGER zone)
  ELIF distance_to_nearest <= 25nm: base = 85
  ELIF distance_to_nearest <= 50nm: base = 70
  ELIF distance_to_nearest <= 75nm: base = 55
  ELIF distance_to_nearest <= 100nm: base = 40
  ELIF distance_to_nearest <= 150nm: base = 25
  ELIF distance_to_nearest <= 200nm: base = 15

  // Additional incidents increase score
  bonus = min(15, (count_within_200nm - 1) * 5)

  proximity_score = min(100, base + bonus)
```

#### Factor 2: Current Corridor Threat Level (Weight: 25%)

```
Determined by which corridor the vessel is currently in or approaching.

IF vessel is inside a defined corridor:
  IF corridor_status == BLACK: corridor_score = 100
  ELIF corridor_status == RED: corridor_score = 80
  ELIF corridor_status == AMBER: corridor_score = 50
  ELIF corridor_status == GREEN: corridor_score = 15
ELIF vessel is within 50nm of corridor entry point:
  corridor_score = corridor_value * 0.5  (approaching -- half weight)
ELSE:
  corridor_score = 0
```

#### Factor 3: JWC Listed Area Presence (Weight: 15%)

```
Binary with approach consideration.

IF vessel position is inside any JWC polygon:
  jwc_score = 100
ELIF vessel is within 50nm of JWC boundary (approaching):
  jwc_score = 50
ELSE:
  jwc_score = 0
```

#### Factor 4: AIS Signal Health (Weight: 15%)

```
Based on freshness of last AIS position update.

time_since_ais = minutes since last AIS update

IF time_since_ais < 5:    ais_score = 0   (healthy)
ELIF time_since_ais < 15:  ais_score = 10
ELIF time_since_ais < 30:  ais_score = 30
ELIF time_since_ais < 60:  ais_score = 50
ELIF time_since_ais < 360: ais_score = 80  (6 hours)
ELSE:                       ais_score = 100 (vessel dark)

// Amplify if vessel is in conflict zone
IF vessel is in JWC zone AND time_since_ais > 30:
  ais_score = min(100, ais_score * 1.5)
```

#### Factor 5: Vessel Type Vulnerability (Weight: 10%)

```
Static score based on vessel characteristics.
Factors: speed capability, size (target profile), cargo value, freeboard.

VESSEL TYPE VULNERABILITY TABLE:
  Small Tanker (7K DWT):    40  (small, maneuverable, low-value target)
  LPG Carrier (27K DWT):    60  (pressurized gas cargo, medium profile)
  Chemical Tanker (20K):     50  (hazardous cargo, medium profile)
  Chemical Tanker (50K):     55  (larger target, hazardous cargo)
  LR2 Tanker (110K DWT):    55  (large target but high freeboard, modern vessels)
  Aframax Crude (105K DWT): 65  (large target, high-value cargo, older vessels 2002-2004)
```

#### Factor 6: Historical Incident Pattern (Weight: 5%)

```
Trend analysis of incidents in vessel's current 100nm radius.

this_week = incident count within 100nm, last 7 days
prev_week = incident count within 100nm, 8-14 days ago

IF this_week > prev_week: trend = "INCREASING" -> historical_score = 80
ELIF this_week == prev_week AND this_week > 0: trend = "STABLE" -> historical_score = 50
ELIF this_week < prev_week: trend = "DECREASING" -> historical_score = 25
ELIF this_week == 0: trend = "NONE" -> historical_score = 0
```

### 7.3 Composite Score Calculation

```
risk_score = round(
  (proximity_score   * 0.30) +
  (corridor_score    * 0.25) +
  (jwc_score         * 0.15) +
  (ais_score         * 0.15) +
  (vulnerability     * 0.10) +
  (historical_score  * 0.05)
)
```

### 7.4 Risk Level Classification

| Score Range | Level | Color | Badge | Board Action |
|-------------|-------|-------|-------|-------------|
| 0-25 | LOW | Green (#22c55e) | Green badge | No action required |
| 26-50 | MODERATE | Amber (#f59e0b) | Amber badge | Monitor |
| 51-75 | HIGH | Orange (#f97316) | Orange badge | Active monitoring, consider rerouting |
| 76-100 | CRITICAL | Red (#ef4444) | Red badge | Board awareness, immediate action may be required |

### 7.5 Risk Score Display

- Numerical score shown as "78/100" with color-coded badge
- Trend arrow: up/down/stable comparing current score to 24 hours ago
- Risk breakdown chart (horizontal bar per factor) available on click/hover
- Dashboard shows fleet risk distribution: "3 CRITICAL | 5 HIGH | 8 MODERATE | 7 LOW"

---

## 8. Priority Roadmap

### Phase 1: Foundation -- Replace Simulation with Reality (Weeks 1-3)

**Goal:** Real AIS data, real weather, verified specs, backend architecture, AIS gap detection.

| # | Task | Priority | Est. Days | Dependencies |
|---|------|----------|-----------|-------------|
| 1.1 | Set up Node.js/Express backend server with basic project structure | P0 | 2 | None |
| 1.2 | Implement AIS provider adapter interface (provider-agnostic) | P0 | 2 | 1.1 |
| 1.3 | Implement Datalastic adapter (first provider) | P0 | 2 | 1.2 |
| 1.4 | Backend AIS polling scheduler (every 5 min for 23 vessels) | P0 | 1 | 1.3 |
| 1.5 | WebSocket server: push position updates to frontend clients | P0 | 2 | 1.1 |
| 1.6 | Frontend: replace simulated position engine with WebSocket data | P0 | 2 | 1.5 |
| 1.7 | Frontend: update vessel markers with real AIS data (SOG, COG, heading rotation) | P0 | 2 | 1.6 |
| 1.8 | AIS signal freshness tracking + visual indicators (green/amber/red/black) | P0 | 2 | 1.6 |
| 1.9 | AIS gap detection and logging | P0 | 1 | 1.8 |
| 1.10 | Verify all 23 vessel specs against Equasis/MarineTraffic | P0 | 2 | None (parallel) |
| 1.11 | Update vessel data with verified specs, mark unverified fields | P0 | 1 | 1.10 |
| 1.12 | Integrate OpenWeatherMap for real weather per vessel position | P1 | 1 | 1.1 |
| 1.13 | Remove Math.random() market data fluctuation; label as INDICATIVE | P1 | 0.5 | None |
| 1.14 | SQLite database setup for position history and future incident storage | P0 | 1 | 1.1 |
| 1.15 | Frontend: "Last Updated" timestamps, connection status indicator | P0 | 1 | 1.6 |

**Phase 1 Deliverable:** Map shows real vessel positions from live AIS data. Weather is real. All simulation removed. AIS gaps detected. Backend server operational with WebSocket.

**Phase 1 Exit Criteria:**
- [ ] All 23 vessels showing AIS-sourced positions on map
- [ ] No simulation code remaining in codebase
- [ ] AIS gap > 30 minutes produces a logged warning
- [ ] Weather data comes from OpenWeatherMap API
- [ ] Market data labeled INDICATIVE where not from verified source
- [ ] WebSocket connection indicator functional (green/amber/red)

---

### Phase 2: Conflict Zone Monitoring Terminal MVP (Weeks 4-7)

**Goal:** Deliver the core CZMT with threat map, corridor status, risk scoring, live feed, JWC tracking, proximity alerts.

| # | Task | Priority | Est. Days | Dependencies |
|---|------|----------|-----------|-------------|
| 2.1 | Incident database schema and data model (SQLite) | P0 | 1 | Phase 1 |
| 2.2 | Define JWC zone polygons as GeoJSON (from LMA circulars) | P0 | 2 | None |
| 2.3 | Define corridor boundaries as GeoJSON | P0 | 1 | None |
| 2.4 | JWC zone overlay on map (Leaflet GeoJSON layer) | P0 | 1 | 2.2 |
| 2.5 | Vessel-in-JWC-zone detection (turf.js point-in-polygon) | P0 | 1 | 2.2, Phase 1 |
| 2.6 | JWC entry/exit logging | P0 | 1 | 2.5 |
| 2.7 | UKMTO web scraper (Recent Incidents page) | P0 | 3 | 2.1 |
| 2.8 | MARAD MSCI RSS feed parser | P0 | 1 | 2.1 |
| 2.9 | CENTCOM RSS feed parser | P0 | 1 | 2.1 |
| 2.10 | Manual incident entry admin interface | P0 | 2 | 2.1 |
| 2.11 | Incident normalizer (standardize events from all sources, dedup) | P0 | 2 | 2.7-2.10 |
| 2.12 | Threat map: incident markers on map with popups | P0 | 2 | 2.11 |
| 2.13 | Threat map: marker styling by type and recency | P0 | 1 | 2.12 |
| 2.14 | Corridor safety status calculation engine | P0 | 2 | 2.11, 2.3 |
| 2.15 | Corridor status bar UI (top of CZMT) | P0 | 2 | 2.14 |
| 2.16 | Risk scoring engine (all 6 factors) | P0 | 3 | 2.5, 2.11, 2.14, Phase 1 |
| 2.17 | Vessel risk status panel UI (right bottom of CZMT) | P0 | 2 | 2.16 |
| 2.18 | Live threat feed panel UI (right top of CZMT) | P0 | 2 | 2.11 |
| 2.19 | Proximity alert engine (4-tier: WATCH/WARNING/CRITICAL/DANGER) | P0 | 3 | Phase 1, 2.11 |
| 2.20 | Alert banner UI (flashing for active alerts) | P0 | 1 | 2.19 |
| 2.21 | Dashboard alert notifications (in-app) | P0 | 1 | 2.19 |
| 2.22 | CZMT full layout assembly and responsive design | P0 | 3 | 2.4-2.21 |
| 2.23 | IRTC/TSS corridor lines on map | P1 | 1 | None |
| 2.24 | Proximity rings (25/50/100nm) around vessels in risk zones | P1 | 1 | Phase 1, 2.5 |
| 2.25 | AIS dark detection with conflict-zone-aware alerting | P0 | 2 | Phase 1, 2.5, 2.19 |

**Phase 2 Deliverable:** Full Conflict Zone Monitoring Terminal with live threat map, corridor status (5 corridors), vessel risk scores (0-100, 6 factors), threat feed, JWC tracking, proximity alerts (4 tiers), and AIS dark detection. Data from UKMTO, MARAD, CENTCOM, and manual entry.

**Phase 2 Exit Criteria:**
- [ ] CZMT accessible via header button
- [ ] Threat map shows incident markers from at least 2 automated sources
- [ ] All 5 corridors show GREEN/AMBER/RED status
- [ ] Risk scores calculated for all 23 vessels
- [ ] Proximity alerts trigger when test incident placed near BIHAR vessel
- [ ] JWC zone overlay visible on map
- [ ] JWC entry/exit logged in database
- [ ] Live threat feed updating with new incidents
- [ ] AIS dark detection alerts for vessels in JWC zones

---

### Phase 3: Intelligence Enhancement (Weeks 8-12)

**Goal:** Add OSINT feeds, historical heatmap, push notifications, premium data, insurance calculations, reporting.

| # | Task | Priority | Est. Days | Dependencies |
|---|------|----------|-----------|-------------|
| 3.1 | ACLED API integration for historical conflict data | P1 | 2 | Phase 2 |
| 3.2 | Historical incident heatmap (Leaflet.heat) with time period selector | P1 | 3 | 3.1 |
| 3.3 | IMB piracy map scraper | P1 | 2 | Phase 2 |
| 3.4 | X API v2 integration for OSINT monitoring | P1 | 3 | Phase 2 |
| 3.5 | Telegram channel monitoring (if applicable) | P2 | 2 | Phase 2 |
| 3.6 | Push notifications (Web Push API) for alerts | P1 | 2 | Phase 2 |
| 3.7 | Email alert notifications | P1 | 2 | Phase 2 |
| 3.8 | SMS alert notifications (optional, via Twilio or similar) | P2 | 1 | Phase 2 |
| 3.9 | Upgrade AIS to MarineTraffic/Kpler (enterprise) | P1 | 2 | Kpler sales contract |
| 3.10 | MarineTraffic adapter implementation | P1 | 2 | 3.9 |
| 3.11 | Real port call history (MarineTraffic EV01) | P2 | 2 | 3.10 |
| 3.12 | Voyage forecast/ETA prediction (MarineTraffic VI07) | P2 | 2 | 3.10 |
| 3.13 | Stormglass wave/swell data integration | P2 | 1 | Phase 1 |
| 3.14 | Insurance AWRP impact calculator | P1 | 2 | Phase 2 |
| 3.15 | PDF threat report generator for board meetings | P1 | 3 | Phase 2 |
| 3.16 | Automated weekly report email to board | P2 | 1 | 3.15 |
| 3.17 | Incident archive and search (> 30 days old) | P2 | 2 | Phase 2 |
| 3.18 | Corridor historical trend charts (weekly incident bars) | P2 | 2 | Phase 2 |
| 3.19 | Authentication and access control | P1 | 2 | Phase 1 |
| 3.20 | Audit log for all alerts, acknowledgments, and user actions | P2 | 2 | Phase 2 |
| 3.21 | Dryad Global API integration (optional premium intel) | P3 | 3 | Budget approval |
| 3.22 | Performance optimization and load testing | P1 | 2 | All phases |

**Phase 3 Deliverable:** Fully operational maritime threat intelligence platform with multi-source data (UKMTO + MARAD + CENTCOM + IMB + ACLED + OSINT), historical heatmap, push/email notifications, insurance impact tracking, and board reporting.

**Phase 3 Exit Criteria:**
- [ ] Historical heatmap renders ACLED + UKMTO + IMB data for 6/12/24 month views
- [ ] Push notifications working for CRITICAL and DANGER alerts
- [ ] Email notifications delivered for WARNING and above
- [ ] AWRP calculator shows estimated premium impact per vessel
- [ ] PDF report generates on demand with all CZMT data
- [ ] OSINT feed (X API) contributing to threat feed (tagged UNVERIFIED)
- [ ] Authentication required to access dashboard
- [ ] MarineTraffic providing production-grade AIS data

---

## 9. Success Criteria

### 9.1 Board Acceptance Criteria

| # | Criterion | Measurement | Target | Phase |
|---|-----------|-------------|--------|-------|
| 1 | Real position data | All 23 vessels show AIS-sourced positions | 100% | 1 |
| 2 | Position freshness | Average age of displayed position data | < 10 min coastal, < 2h satellite | 1 |
| 3 | Data accuracy | Vessel specs verified against registries | 100% verified | 1 |
| 4 | Threat detection latency | Time from incident to dashboard display | < 30 min (official), < 15 min (OSINT) | 2 |
| 5 | Proximity alert reliability | False negative rate (missed alerts within 50nm) | 0% -- zero missed alerts | 2 |
| 6 | Alert precision | False positive rate | < 20% | 2 |
| 7 | Risk score validity | Board assessment: scores reflect reality | Qualitative quarterly review | 2 |
| 8 | JWC tracking accuracy | Entry/exit detection accuracy | 100% -- every entry/exit logged | 2 |
| 9 | Corridor status accuracy | Status matches UKMTO/MSCHOA guidance | Board validation monthly | 2 |
| 10 | System uptime | Availability | 99.5% (< 3.6h downtime/month) | 3 |
| 11 | Beat Dryad/Ambrey | Board confirms platform superiority | Qualitative board assessment | 3 |
| 12 | Notification delivery | Push/email alerts delivered within SLA | CRITICAL: < 2 min, HIGH: < 5 min | 3 |

### 9.2 Performance Requirements

| Metric | Target |
|--------|--------|
| Page load time (initial) | < 3 seconds |
| Map render time | < 2 seconds |
| CZMT panel load time | < 1 second |
| WebSocket reconnection | < 5 seconds after disconnect |
| Backend API response | < 500ms for position queries |
| Concurrent users | 10+ simultaneous dashboard users |
| Mobile responsiveness | Fully functional on iPad and iPhone |
| Heatmap render time | < 3 seconds for 12-month dataset |

### 9.3 Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| No API keys in frontend code | All API calls proxied through backend server |
| Dashboard access authenticated | Basic auth (Phase 1) -> SSO/OAuth (Phase 3) |
| HTTPS only | TLS certificate on deployment server |
| Vessel position data protected | No public endpoints -- authentication required |
| Audit trail | All alerts and user actions logged with timestamp |
| API key rotation | Backend supports rotating provider API keys without downtime |

---

## 10. Appendices

### Appendix A: BIHAR Fleet Vessel Registry

All data below is from the current application. **Every field must be verified against maritime registries before production deployment.**

| # | Name | IMO | MMSI | Type | DWT | Built | Builder | Class | Flag | Charterer |
|---|------|-----|------|------|-----|-------|---------|-------|------|-----------|
| 1 | Israa | 9325960 | 538005890 | Oil Tanker | 7,319 | 2011 | Jiangsu Eastern | LR | Marshall Is. | PETCO Malaysia |
| 2 | Al Zarandi | 9325958 | 538005889 | Oil Tanker | 7,303 | 2010 | Jiangsu Eastern | LR | Marshall Is. | Bihar Bunkers |
| 3 | Galbot | 9555084 | 255806230 | Oil Tanker | 7,281 | 2010 | Cochin Shipyard | BV | Portugal | Sacor Bunkers |
| 4 | Al Safa | 9501643 | 538003456 | Oil Tanker | 7,324 | 2009 | STX Shipbuilding | DNV | Marshall Is. | Amsol |
| 5 | Andes | 9411719 | 538002345 | Oil Tanker | 7,364 | 2007 | Shin Kurushima | NK | Marshall Is. | Intl Supply |
| 6 | Miraj | 9394741 | 538002890 | Oil Tanker | 7,450 | 2007 | Shin Kurushima | NK | Marshall Is. | Waad Energy |
| 7 | Daisy | 9516545 | 538004567 | Oil Tanker | 7,280 | 2009 | Jiangsu Eastern | LR | Marshall Is. | Intl Supply |
| 8 | Lilac | 9411721 | 538002346 | Oil Tanker | 7,373 | 2009 | Shin Kurushima | NK | Marshall Is. | Intl Supply |
| 9 | Al Barrah | 9332030 | 538001234 | LPG Carrier | 27,710 | 2007 | Hyundai Mipo | LR | Marshall Is. | ENOC UAE |
| 10 | Al Jabirah | 9332042 | 538001235 | LPG Carrier | 27,710 | 2007 | Hyundai Mipo | LR | Marshall Is. | Indian Oil Corp |
| 11 | Al Shaffiah | 9358620 | 538003789 | Chemical Tanker | 19,907 | 2006 | Shin Kurushima | NK | Marshall Is. | Aramco Trading |
| 12 | Al Mahboobah | 9340415 | 538003790 | Chemical Tanker | 19,982 | 2006 | Shin Kurushima | NK | Marshall Is. | Aramco Trading |
| 13 | Dianella | 9901087 | 538009001 | Product/Chemical | 49,803 | 2021 | Hyundai Mipo | LR | Marshall Is. | PETCO |
| 14 | Liatris | 9901099 | 538009002 | Product/Chemical | 49,803 | 2021 | Hyundai Mipo | LR | Marshall Is. | ISTC (Sabic) |
| 15 | Angelonia | 9901051 | 538009003 | LR2 Tanker | 110,521 | 2021 | Hyundai Heavy | LR | Marshall Is. | Aramco Trading |
| 16 | Lunaria | 9901063 | 538009004 | LR2 Tanker | 110,521 | 2021 | Hyundai Heavy | LR | Marshall Is. | Aramco Trading |
| 17 | Bouvardia | 9935595 | 538009005 | LR2 Tanker | 111,075 | 2022 | Hyundai Heavy | LR | Marshall Is. | Aramco Trading |
| 18 | Ixora | 9940459 | 538009006 | LR2 Tanker | 111,006 | 2022 | Hyundai Heavy | LR | Marshall Is. | Aramco Trading |
| 19 | Al Habibah | 9290294 | 538001890 | Aframax | 105,946 | 2004 | Daewoo | DNV | Marshall Is. | Utility Ops |
| 20 | Al Mahfoza | 9271365 | 538001567 | Aframax | 105,433 | 2003 | Daewoo | DNV | Marshall Is. | Utility Ops |
| 21 | Daffodil | 9239927 | 538001234 | Aframax | 105,357 | 2002 | Daewoo | DNV | Marshall Is. | Utility Ops |
| 22 | Desert Rose | 9239939 | 538001235 | Aframax | 105,328 | 2002 | Daewoo | DNV | Marshall Is. | Utility Ops |
| 23 | Encelia | 9240172 | 538001456 | Aframax | 109,250 | 2003 | Samsung Heavy | LR | Marshall Is. | Utility Ops |

### Appendix B: Incident Database Schema

```sql
CREATE TABLE incidents (
    id              TEXT PRIMARY KEY,          -- UUID
    timestamp       DATETIME NOT NULL,         -- UTC time of incident
    lat             REAL NOT NULL,             -- Latitude (-90 to 90)
    lon             REAL NOT NULL,             -- Longitude (-180 to 180)
    type            TEXT NOT NULL,             -- missile | drone | usv | mine | boarding |
                                               -- suspicious_approach | gps_jamming |
                                               -- naval_activity | advisory | piracy | other
    severity        INTEGER NOT NULL,          -- 1 (lowest) to 5 (highest)
    title           TEXT NOT NULL,             -- Brief description (< 120 chars)
    description     TEXT,                      -- Full narrative
    source          TEXT NOT NULL,             -- UKMTO | MARAD | CENTCOM | IMB | ACLED |
                                               -- OSINT_X | OSINT_TELEGRAM | ANALYST | MANUAL
    source_ref      TEXT,                      -- Advisory number, URL, tweet ID, etc.
    verified        BOOLEAN DEFAULT FALSE,     -- Has incident been corroborated?
    target_vessel   TEXT,                      -- Name of targeted vessel (if known)
    target_imo      TEXT,                      -- IMO of targeted vessel (if known)
    target_type     TEXT,                      -- Type of targeted vessel (if known)
    target_flag     TEXT,                      -- Flag of targeted vessel (if known)
    result          TEXT,                      -- hit_damage | hit_no_damage | near_miss |
                                               -- intercept | attempted | boarding_successful |
                                               -- hijack | advisory_only | unknown
    weapon_type     TEXT,                      -- ASBM | ASCM | UAV | USV | RPG | small_arms |
                                               -- mine | unknown
    attributed_to   TEXT,                      -- Houthi/Ansar Allah | Somali pirates |
                                               -- Iran IRGC | Unknown
    corridor        TEXT,                      -- HORMUZ | BAB_EL_MANDEB | GULF_OF_ADEN |
                                               -- SUEZ_APPROACH | ARABIAN_SEA | SOMALI_BASIN |
                                               -- OTHER | NONE
    expiry_hours    INTEGER DEFAULT 168,       -- Hours until incident ages out of active feed (default 7 days)
    status          TEXT DEFAULT 'active',     -- active | monitoring | resolved | archived
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by      TEXT DEFAULT 'system'      -- system | user:email
);

CREATE TABLE incident_updates (
    id              TEXT PRIMARY KEY,
    incident_id     TEXT NOT NULL REFERENCES incidents(id),
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    note            TEXT NOT NULL,
    source          TEXT,
    updated_by      TEXT DEFAULT 'system'
);

CREATE TABLE proximity_alerts (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    incident_id     TEXT NOT NULL REFERENCES incidents(id),
    alert_level     TEXT NOT NULL,             -- WATCH | WARNING | CRITICAL | DANGER
    distance_nm     REAL NOT NULL,
    bearing         REAL,                      -- Degrees from vessel to incident
    vessel_lat      REAL NOT NULL,
    vessel_lon      REAL NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    status          TEXT DEFAULT 'active'      -- active | acknowledged | escalated | cleared
);

CREATE TABLE jwc_zone_events (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    zone_id         TEXT NOT NULL,             -- JWC_PERSIAN_GULF | JWC_RED_SEA | etc.
    event_type      TEXT NOT NULL,             -- entry | exit
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    lat             REAL NOT NULL,
    lon             REAL NOT NULL
);

CREATE TABLE vessel_positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_imo      TEXT NOT NULL,
    lat             REAL NOT NULL,
    lon             REAL NOT NULL,
    sog             REAL,
    cog             REAL,
    heading         REAL,
    draught         REAL,
    nav_status      TEXT,
    destination     TEXT,
    eta             TEXT,
    ais_timestamp   DATETIME NOT NULL,         -- When vessel transmitted this position
    received_at     DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When we received it
    source          TEXT                        -- datalastic | marinetraffic | aishub
);

CREATE TABLE ais_gaps (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    gap_start       DATETIME NOT NULL,         -- Last known AIS timestamp before gap
    gap_end         DATETIME,                  -- First AIS timestamp after gap (NULL if ongoing)
    last_known_lat  REAL NOT NULL,
    last_known_lon  REAL NOT NULL,
    in_jwc_zone     BOOLEAN DEFAULT FALSE,
    zone_id         TEXT,
    alert_generated BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER                    -- Computed when gap ends
);

CREATE TABLE risk_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_imo      TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    composite_score INTEGER NOT NULL,          -- 0-100
    proximity_score INTEGER,
    corridor_score  INTEGER,
    jwc_score       INTEGER,
    ais_score       INTEGER,
    vulnerability   INTEGER,
    historical_score INTEGER,
    risk_level      TEXT                        -- LOW | MODERATE | HIGH | CRITICAL
);

CREATE TABLE corridor_status (
    corridor_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL,              -- GREEN | AMBER | RED | BLACK
    incident_count_7d INTEGER DEFAULT 0,
    incident_count_prev_7d INTEGER DEFAULT 0,
    trend           TEXT,                       -- INCREASING | STABLE | DECREASING
    bihar_vessels_count INTEGER DEFAULT 0,
    last_incident_date DATETIME,
    last_incident_type TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_incidents_timestamp ON incidents(timestamp);
CREATE INDEX idx_incidents_corridor ON incidents(corridor);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_positions_imo ON vessel_positions(vessel_imo);
CREATE INDEX idx_positions_time ON vessel_positions(ais_timestamp);
CREATE INDEX idx_alerts_vessel ON proximity_alerts(vessel_imo);
CREATE INDEX idx_alerts_status ON proximity_alerts(status);
CREATE INDEX idx_jwc_vessel ON jwc_zone_events(vessel_imo);
CREATE INDEX idx_risk_vessel ON risk_scores(vessel_imo);
CREATE INDEX idx_gaps_vessel ON ais_gaps(vessel_imo);
```

### Appendix C: Alert Rules Reference

| Rule ID | Condition | Level | Message Template | Notification Channels |
|---------|-----------|-------|-----------------|----------------------|
| ALR-001 | Vessel enters JWC zone | MEDIUM | "{vessel} entered JWC Listed Area ({zone})" | Dashboard |
| ALR-002 | Vessel within 100nm of incident (<24h) | WATCH | "{vessel} is {distance}nm from {type} incident" | Dashboard |
| ALR-003 | Vessel within 50nm of incident (<24h) | WARNING | "WARNING: {vessel} {distance}nm from {type} at {position}" | Dashboard + Push + Email |
| ALR-004 | Vessel within 25nm of incident (<24h) | CRITICAL | "CRITICAL: {vessel} {distance}nm from active {type}" | Dashboard + Push + Email |
| ALR-005 | Vessel within 10nm of incident (<24h) | DANGER | "DANGER: {vessel} {distance}nm from {type} -- IMMEDIATE RISK" | Dashboard + Push + Email + SMS |
| ALR-006 | AIS gap >30min, vessel in JWC zone | HIGH | "{vessel} AIS lost for {duration} in {zone}" | Dashboard + Push + Email |
| ALR-007 | AIS gap >6h, any vessel | CRITICAL | "AIS DARK: {vessel} last seen {position} {duration} ago" | Dashboard + Push + Email |
| ALR-008 | Corridor status -> RED or BLACK | HIGH | "Corridor {name} now {status}" | Dashboard + Push |
| ALR-009 | New incident in monitored corridor | MEDIUM | "New {type} in {corridor}: {title}" | Dashboard |
| ALR-010 | Vessel speed <3kts in risk zone (not port) | MEDIUM | "{vessel} speed {speed}kts in {zone}" | Dashboard |
| ALR-011 | Vessel course change >90deg in risk zone | LOW | "{vessel} major course change in {zone}" | Dashboard |
| ALR-012 | Severe weather (Beaufort 8+) at vessel | MEDIUM | "Severe weather at {vessel}: {conditions}" | Dashboard |
| ALR-013 | Vessel exits JWC zone | LOW | "{vessel} exited JWC area ({zone}). Time in zone: {duration}" | Dashboard |

### Appendix D: Glossary

| Term | Definition |
|------|-----------|
| ACLED | Armed Conflict Location & Event Data project |
| AIS | Automatic Identification System -- transponder system transmitting vessel position, speed, course |
| ASBM | Anti-Ship Ballistic Missile |
| ASCM | Anti-Ship Cruise Missile |
| AWRP | Additional War Risk Premium -- insurance surcharge for JWC-listed areas |
| BIMCO | Baltic and International Maritime Council |
| BMP | Best Management Practices (anti-piracy guidelines) |
| COG | Course Over Ground -- direction of travel relative to true north |
| CZMT | Conflict Zone Monitoring Terminal (this platform's flagship feature) |
| DWT | Deadweight Tonnage -- carrying capacity of a vessel |
| EUNAVFOR | European Union Naval Force |
| GT | Gross Tonnage -- volumetric measure of vessel internal space |
| HDG | Heading -- direction the vessel bow points |
| IMB | International Maritime Bureau (ICC) |
| IMO | International Maritime Organization (also: IMO number = unique vessel identifier) |
| IRTC | Internationally Recommended Transit Corridor (Gulf of Aden) |
| JMIC | Joint Maritime Information Centre |
| JWC | Joint War Committee -- Lloyd's Market Association body defining war risk areas |
| LDT | Light Displacement Tonnage -- weight of empty vessel (for scrap value) |
| LMA | Lloyd's Market Association |
| LOA | Length Overall -- total vessel length |
| LR2 | Long Range 2 tanker (80,000-119,999 DWT) |
| MARAD | US Maritime Administration |
| MMSI | Maritime Mobile Service Identity -- 9-digit radio ID number |
| MSCHOA | Maritime Security Centre - Horn of Africa |
| MSCI | Maritime Security Communications with Industry (MARAD program) |
| NAVTEX | Navigational Telex -- maritime radio broadcast system |
| NT | Net Tonnage -- volumetric measure of cargo capacity |
| OSINT | Open Source Intelligence |
| PSC | Port State Control -- inspection regime for vessel safety |
| SIF | Single Information Framework (UKMTO) |
| SOG | Speed Over Ground -- actual speed over seabed |
| TSS | Traffic Separation Scheme -- designated shipping lane |
| UAV | Unmanned Aerial Vehicle (drone) |
| UKMTO | United Kingdom Maritime Trade Operations |
| USV | Unmanned Surface Vessel (explosive boat) |
| VRS | Voluntary Reporting Scheme (UKMTO) |

---

**END OF DOCUMENT**

**Distribution:** Board of Directors, Development Team (QA Agent, Code Agent, UI/UX Agent)
**Next Action:** Development team to begin Phase 1 implementation immediately.
**Review Cycle:** Board review at end of each phase (Week 3, Week 7, Week 12).
**Escalation:** Any deviation from P0 requirements must be escalated to Board Representative.

**This PRD is the single source of truth. All agents (QA, Code, UI/UX) follow this document.**
