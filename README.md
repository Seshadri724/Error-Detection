# 🔬 ErrorScope — Offline Error Visualizer

> Paste any error. Get an instant visual flowchart, call stack breakdown, severity rating, and fix guide. No API. No internet. No data sent anywhere.

![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![Offline](https://img.shields.io/badge/Works-Offline-green?style=flat-square)
![No API](https://img.shields.io/badge/API_Key-None_Required-brightgreen?style=flat-square)

---

## What It Does

ErrorScope parses raw error messages and transforms them into:

- **🗺️ Flowchart** — visual step-by-step execution path from program start → crash → fix
- **📚 Call Stack** — formatted table with file names, line numbers, and function names
- **🔧 Fix Guide** — actionable, error-specific suggestions
- **💀 Severity Gauge** — LOW → MEDIUM → HIGH → CRITICAL visual indicator
- **📍 Root Cause Pin** — highlights the exact file and line where the error originated

---

## Supported Error Types

| Type | Examples |
|---|---|
| 🐍 Python Traceback | `TypeError`, `ValueError`, `ImportError`, `AttributeError`, `KeyError` |
| 🟨 JavaScript Error | `TypeError`, `ReferenceError`, `SyntaxError`, `RangeError`, `Uncaught` |
| ☕ Java Exception | `NullPointerException`, `ClassNotFoundException`, `OutOfMemoryError` |
| 🌐 HTTP Error | `400`, `401`, `403`, `404`, `429`, `500`, `502`, `503`, `504` |
| 🗄️ SQL Error | Syntax errors, `ORA-`, MySQL/Postgres/SQLite errors, SQL Injection detection |
| ⚠️ Generic | Any unrecognized error format |

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- npm or yarn

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/errorscope.git
cd errorscope

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The app opens at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Output is in the `build/` folder — open `index.html` directly in any browser, no server needed.

---

## Project Structure

```
errorscope/
├── src/
│   └── App.jsx          ← Main component (ErrorScope)
├── public/
│   └── index.html
├── package.json
└── README.md
```

### Setting Up from Scratch

```bash
npx create-react-app errorscope
cd errorscope
# Replace src/App.js content with error-visualizer.jsx
npm start
```

---

## How to Use

### Method 1 — Paste Error Text

1. Copy any error message from your terminal, browser console, or log file
2. Paste it into the text area on the left panel
3. Click **🔬 ANALYZE**
4. Navigate tabs: **Flowchart → Call Stack → Fix Guide → Raw Error**

### Method 2 — Upload a Log File

1. Drag and drop a `.txt`, `.log`, `.err`, `.py`, `.js`, or `.java` file onto the upload zone
2. Or click the upload zone and browse for your file
3. Analysis runs automatically on upload

### Reading Results

| Badge | Meaning |
|---|---|
| 💀 CRITICAL | Immediate danger — memory errors, fatal exceptions |
| 🔴 HIGH | Needs urgent attention — import errors, null pointers |
| 🟡 MEDIUM | Common fixable errors — type errors, syntax |
| 🟢 LOW | Minor issues, warnings |

---

## Example Inputs to Try

**Python KeyError:**
```
Traceback (most recent call last):
  File "app.py", line 42, in <module>
    result = process(data)
  File "utils.py", line 18, in process
    return data["key"]
KeyError: 'key'
```

**JavaScript TypeError:**
```
Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at Dashboard (Dashboard.js:34:18)
    at renderWithHooks (react-dom.development.js:14985:18)
```

**HTTP 500:**
```
HTTP/1.1 500 Internal Server Error
```

**SQL Injection (triggers security alert 🚨):**
```
SELECT * FROM users WHERE id = 1 OR 1=1 -- 
```

---

## Tech Stack

- **React 18** — UI framework
- **Pure JavaScript** — all parsing logic, zero external dependencies
- **CSS-in-JS** — inline styles, no stylesheet needed

---

## Privacy

- 100% client-side — nothing is sent to any server
- No analytics, no tracking, no API calls
- Safe to use with sensitive production logs

---

## License

MIT — free to use, modify, and distribute.
