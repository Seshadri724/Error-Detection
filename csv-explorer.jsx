import { useState, useCallback, useRef, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";

// ── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#07080a",
  panel:   "#0c0e12",
  border:  "#1c1f26",
  border2: "#252932",
  amber:   "#f5a623",
  amberDim:"#f5a62355",
  green:   "#3ddc84",
  blue:    "#4dabf7",
  red:     "#ff5c5c",
  purple:  "#c084fc",
  text:    "#d4d8e0",
  muted:   "#5a6070",
  dim:     "#2a2f3a",
};

const TYPE_COLOR = { number:"#4dabf7", string:"#3ddc84", date:"#c084fc", boolean:"#f5a623", unknown:"#5a6070" };
const CHART_COLORS = ["#4dabf7","#3ddc84","#f5a623","#c084fc","#ff5c5c","#fb923c","#34d399","#a78bfa"];

// ── CSV PARSER ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // detect delimiter
  const sample = lines[0];
  const delim = [",", "\t", ";", "|"].reduce((best, d) =>
    (sample.split(d).length > sample.split(best).length ? d : best), ",");

  const parseRow = (line) => {
    const res = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === delim && !inQ) { res.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    res.push(cur.trim());
    return res;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseRow(l);
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] ?? ""; return obj; }, {});
  });
  return { headers, rows };
}

// ── TYPE INFERENCE ────────────────────────────────────────────────────────────
function inferType(values) {
  const nonEmpty = values.filter(v => v !== "" && v != null);
  if (nonEmpty.length === 0) return "unknown";
  const boolSet = new Set(["true","false","yes","no","1","0","t","f"]);
  if (nonEmpty.every(v => boolSet.has(String(v).toLowerCase()))) return "boolean";
  if (nonEmpty.every(v => !isNaN(Number(v)) && v !== "")) return "number";
  if (nonEmpty.every(v => !isNaN(Date.parse(v)) && /\d{4}|\d{2}[\/-]\d{2}/.test(v))) return "date";
  return "string";
}

// ── COLUMN STATS ──────────────────────────────────────────────────────────────
function calcStats(rows, col, type) {
  const vals = rows.map(r => r[col]);
  const nullCount = vals.filter(v => v === "" || v == null).length;
  const nonNull = vals.filter(v => v !== "" && v != null);
  const unique = new Set(nonNull).size;

  if (type === "number") {
    const nums = nonNull.map(Number).filter(n => !isNaN(n));
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = nums.length ? sum / nums.length : 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length || 1);
    return { nullCount, unique, min: Math.min(...nums), max: Math.max(...nums),
      mean: +mean.toFixed(4), median, stddev: +Math.sqrt(variance).toFixed(4), sum: +sum.toFixed(4) };
  }
  if (type === "string") {
    const freq = {};
    nonNull.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    const top = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const avgLen = nonNull.reduce((a,b) => a + String(b).length, 0) / (nonNull.length || 1);
    return { nullCount, unique, top, avgLen: +avgLen.toFixed(1) };
  }
  return { nullCount, unique };
}

// ── HISTOGRAM DATA ────────────────────────────────────────────────────────────
function buildHistogram(rows, col, bins = 12) {
  const nums = rows.map(r => Number(r[col])).filter(n => !isNaN(n));
  if (!nums.length) return [];
  const min = Math.min(...nums), max = Math.max(...nums);
  const size = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    label: `${(min + i * size).toFixed(1)}`,
    count: 0,
  }));
  nums.forEach(n => {
    const idx = Math.min(Math.floor((n - min) / size), bins - 1);
    buckets[idx].count++;
  });
  return buckets;
}

function buildFreqChart(rows, col) {
  const freq = {};
  rows.forEach(r => { const v = r[col] || "(empty)"; freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,15)
    .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0,14)+"…" : name, count }));
}

// ── TINY COMPONENTS ───────────────────────────────────────────────────────────
const Tag = ({ children, color = C.muted }) => (
  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4,
    background: color + "22", color, border: `1px solid ${color}44`,
    fontFamily: "monospace", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const Stat = ({ label, value, color = C.text }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</span>
    <span style={{ fontSize: 15, fontFamily: "monospace", color, fontWeight: 700 }}>{value}</span>
  </div>
);

const Panel = ({ children, style = {} }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, ...style }}>
    {children}
  </div>
);

const PanelHead = ({ children, accent = C.amber }) => (
  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`,
    display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ width: 3, height: 14, borderRadius: 2, background: accent }} />
    <span style={{ fontSize: 11, fontFamily: "monospace", color: C.muted,
      textTransform: "uppercase", letterSpacing: 2 }}>{children}</span>
  </div>
);

// ── CHART VIEW ────────────────────────────────────────────────────────────────
function ColChart({ rows, col, type }) {
  if (type === "number") {
    const data = buildHistogram(rows, col);
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.muted }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: C.muted }} />
          <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 6,
            fontFamily: "monospace", fontSize: 11 }} />
          <Bar dataKey="count" radius={[3,3,0,0]}>
            {data.map((_, i) => <Cell key={i} fill={C.blue} fillOpacity={0.7 + 0.3 * (i / data.length)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const data = buildFreqChart(rows, col);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: C.muted }} width={80} />
        <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 6,
          fontFamily: "monospace", fontSize: 11 }} />
        <Bar dataKey="count" radius={[0,3,3,0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── CORRELATION CHART ─────────────────────────────────────────────────────────
function ScatterPlot({ rows, xCol, yCol }) {
  const data = rows.slice(0, 400).map(r => ({
    x: Number(r[xCol]), y: Number(r[yCol])
  })).filter(d => !isNaN(d.x) && !isNaN(d.y));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
        <XAxis dataKey="x" name={xCol} tick={{ fontSize: 9, fill: C.muted }} label={{ value: xCol, position: "insideBottom", fill: C.muted, fontSize: 10, offset: -4 }} />
        <YAxis dataKey="y" name={yCol} tick={{ fontSize: 9, fill: C.muted }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: C.panel,
          border: `1px solid ${C.border2}`, borderRadius: 6, fontFamily: "monospace", fontSize: 11 }} />
        <Scatter data={data} fill={C.blue} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function CSVExplorer() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState("table");
  const [selectedCol, setSelectedCol] = useState(null);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filters, setFilters] = useState({});
  const [scatterX, setScatterX] = useState(null);
  const [scatterY, setScatterY] = useState(null);
  const [page, setPage] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const PAGE_SIZE = 50;

  const loadCSV = useCallback((text, name) => {
    const { headers, rows } = parseCSV(text);
    if (!headers.length) return;
    const types = Object.fromEntries(headers.map(h => [h, inferType(rows.map(r => r[h]))]));
    const stats = Object.fromEntries(headers.map(h => [h, calcStats(rows, h, types[h])]));
    const numCols = headers.filter(h => types[h] === "number");
    setData({ headers, rows, types, stats });
    setFileName(name);
    setSelectedCol(headers[0]);
    setScatterX(numCols[0] || null);
    setScatterY(numCols[1] || null);
    setPage(0);
    setSearch("");
    setFilters({});
    setSortCol(null);
    setActiveTab("table");
  }, []);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = e => loadCSV(e.target.result, file.name);
    reader.readAsText(file);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // filtered + sorted rows
  const processed = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    Object.entries(filters).forEach(([col, val]) => {
      if (val) rows = rows.filter(r => String(r[col]).toLowerCase().includes(val.toLowerCase()));
    });
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortCol], vb = b[sortCol];
        const na = Number(va), nb = Number(vb);
        const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, filters, sortCol, sortDir]);

  const pageRows = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(processed.length / PAGE_SIZE);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  const exportFiltered = () => {
    if (!data) return;
    const lines = [data.headers.join(","),
      ...processed.map(r => data.headers.map(h => `"${String(r[h]).replace(/"/g,'""')}"`).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `filtered_${fileName}`; a.click();
  };

  const numCols = data ? data.headers.filter(h => data.types[h] === "number") : [];
  const TABS = [
    { id: "table",   label: "⊞ Table" },
    { id: "profile", label: "◈ Profile" },
    { id: "chart",   label: "▲ Charts" },
    { id: "scatter", label: "⊕ Scatter" },
  ];

  // ── LANDING ─────────────────────────────────────────────────────────────────
  if (!data) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: "monospace", gap: 40,
      backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 50%, #0d1117 0%, ${C.bg} 100%)` }}>

      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: C.muted, marginBottom: 12, textTransform: "uppercase" }}>
          ── offline · zero deps · instant ──
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, color: "#fff",
          textShadow: `0 0 60px ${C.amber}55` }}>
          data<span style={{ color: C.amber }}>scope</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, letterSpacing: 2 }}>
          CSV Explorer · Profiler · Visualizer
        </div>
      </div>

      {/* Drop Zone */}
      <div onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current.click()}
        style={{
          width: 440, padding: "48px 40px", borderRadius: 14, cursor: "pointer",
          border: `2px dashed ${dragOver ? C.amber : C.border2}`,
          background: dragOver ? `${C.amber}08` : C.panel,
          boxShadow: dragOver ? `0 0 50px ${C.amber}22` : "none",
          textAlign: "center", transition: "all 0.25s ease",
        }}>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display:"none" }}
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        <div style={{ fontSize: 36, marginBottom: 16 }}>⬆</div>
        <div style={{ color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          Drop your CSV here
        </div>
        <div style={{ color: C.muted, fontSize: 12 }}>or click to browse — .csv · .tsv · .txt</div>
        <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {["Auto type detection","Column profiling","Charts & scatter","Filter & export"].map(f => (
            <Tag key={f} color={C.amber}>{f}</Tag>
          ))}
        </div>
      </div>

      {/* Sample loader */}
      <button onClick={() => {
        const sample = `id,name,age,salary,department,joined,active
1,Alice Chen,31,95000,Engineering,2021-03-15,true
2,Bob Smith,44,72000,Marketing,2018-07-22,true
3,Carol Wu,28,88000,Engineering,2022-01-10,true
4,Dave Kim,52,115000,Executive,2015-06-01,false
5,Eve Patel,36,82000,Design,2020-09-14,true
6,Frank Lee,29,91000,Engineering,2022-11-03,true
7,Grace Ng,47,68000,Marketing,2017-04-30,true
8,Henry Fox,33,79000,Design,2019-12-20,false
9,Iris Moon,25,86000,Engineering,2023-02-08,true
10,Jack Roy,41,104000,Executive,2016-08-17,true
11,Kate Ward,30,93000,Engineering,2021-07-29,true
12,Liam Park,38,76000,Marketing,2019-03-11,false
13,Mia Tang,27,84000,Design,2022-05-18,true
14,Noah Kim,45,112000,Executive,2014-11-25,true
15,Olivia Zo,32,89000,Engineering,2020-08-06,true`;
        loadCSV(sample, "sample_employees.csv");
      }} style={{ background:"none", border:`1px solid ${C.border2}`, color:C.muted,
        padding:"8px 20px", borderRadius:6, cursor:"pointer", fontSize:11, letterSpacing:1.5,
        fontFamily:"monospace", transition:"all 0.2s" }}
        onMouseOver={e=>{e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.color=C.amber;}}
        onMouseOut={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.muted;}}>
        LOAD SAMPLE DATA →
      </button>
    </div>
  );

  // ── MAIN UI ─────────────────────────────────────────────────────────────────
  const st = selectedCol && data.stats[selectedCol];
  const ty = selectedCol && data.types[selectedCol];

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      background:C.bg, fontFamily:"monospace", color:C.text, overflow:"hidden" }}>

      {/* TOPBAR */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
        borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
        <span style={{ fontSize:16, fontWeight:900, color:C.amber, letterSpacing:-0.5 }}>
          data<span style={{color:"#fff"}}>scope</span>
        </span>
        <div style={{ width:1, height:18, background:C.border }} />
        <span style={{ fontSize:11, color:C.muted }}>{fileName}</span>
        <div style={{ display:"flex", gap:6, marginLeft:4 }}>
          <Tag color={C.green}>{data.rows.length.toLocaleString()} rows</Tag>
          <Tag color={C.blue}>{data.headers.length} cols</Tag>
          <Tag color={C.purple}>{processed.length !== data.rows.length ? `${processed.length} filtered` : "no filter"}</Tag>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button onClick={exportFiltered} style={{ padding:"5px 14px", borderRadius:5,
            background:"none", border:`1px solid ${C.border2}`, color:C.muted,
            fontSize:10, cursor:"pointer", letterSpacing:1 }}>⬇ EXPORT</button>
          <button onClick={()=>{setData(null);setFileName("");}} style={{ padding:"5px 14px", borderRadius:5,
            background:"none", border:`1px solid ${C.border2}`, color:C.muted,
            fontSize:10, cursor:"pointer", letterSpacing:1 }}>✕ CLOSE</button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* LEFT SIDEBAR — column list */}
        <div style={{ width:180, borderRight:`1px solid ${C.border}`, overflowY:"auto",
          background:"#090b0e", flexShrink:0 }}>
          <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}`,
            fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase" }}>
            Columns
          </div>
          {data.headers.map(h => (
            <div key={h} onClick={()=>setSelectedCol(h)}
              style={{ padding:"8px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8,
                background: selectedCol===h ? `${C.amber}12` : "transparent",
                borderLeft: selectedCol===h ? `2px solid ${C.amber}` : "2px solid transparent",
                transition:"all 0.15s" }}>
              <span style={{ fontSize:9, color: TYPE_COLOR[data.types[h]], minWidth:14, textAlign:"center",
                fontWeight:700 }}>
                {data.types[h]==="number"?"#":data.types[h]==="string"?"A":data.types[h]==="date"?"D":data.types[h]==="boolean"?"B":"?"}
              </span>
              <span style={{ fontSize:11, color: selectedCol===h ? C.amber : C.text,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h}</span>
            </div>
          ))}
        </div>

        {/* CENTER — main content */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* TABS + search */}
          <div style={{ display:"flex", alignItems:"center", gap:0, padding:"0 16px",
            borderBottom:`1px solid ${C.border}`, background:C.panel, flexShrink:0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                padding:"11px 16px", background:"none", border:"none", cursor:"pointer",
                fontSize:11, letterSpacing:1, fontFamily:"monospace",
                color: activeTab===t.id ? C.amber : C.muted,
                borderBottom: activeTab===t.id ? `2px solid ${C.amber}` : "2px solid transparent",
                marginBottom:-1, transition:"all 0.15s",
              }}>{t.label}</button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
                placeholder="search all columns…"
                style={{ padding:"5px 12px", background:C.bg, border:`1px solid ${C.border2}`,
                  borderRadius:5, color:C.text, fontFamily:"monospace", fontSize:11,
                  outline:"none", width:200, color: search ? C.amber : C.muted }} />
            </div>
          </div>

          {/* TAB CONTENT */}
          <div style={{ flex:1, overflow:"auto" }}>

            {/* ── TABLE ── */}
            {activeTab==="table" && (
              <div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#090b0e", position:"sticky", top:0, zIndex:10 }}>
                      <th style={{ padding:"8px 10px", color:C.muted, fontWeight:400,
                        borderBottom:`1px solid ${C.border}`, fontSize:9, width:40, textAlign:"right" }}>#</th>
                      {data.headers.map(h => (
                        <th key={h} onClick={()=>handleSort(h)}
                          style={{ padding:"8px 12px", textAlign:"left", cursor:"pointer",
                            borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap",
                            color: sortCol===h ? C.amber : C.muted,
                            fontWeight: sortCol===h ? 700 : 400,
                            background: selectedCol===h ? `${C.amber}08` : "transparent" }}>
                          <span style={{ fontSize:9, color:TYPE_COLOR[data.types[h]], marginRight:5 }}>
                            {data.types[h]==="number"?"#":data.types[h]==="string"?"A":data.types[h]==="date"?"D":"B"}
                          </span>
                          {h}
                          {sortCol===h && <span style={{ marginLeft:4 }}>{sortDir==="asc"?"↑":"↓"}</span>}
                        </th>
                      ))}
                    </tr>
                    {/* filter row */}
                    <tr style={{ background:"#07090c" }}>
                      <td style={{ borderBottom:`1px solid ${C.border}` }} />
                      {data.headers.map(h => (
                        <td key={h} style={{ padding:"4px 8px", borderBottom:`1px solid ${C.border}` }}>
                          <input value={filters[h]||""} onChange={e=>{setFilters(f=>({...f,[h]:e.target.value}));setPage(0);}}
                            placeholder="filter…"
                            style={{ width:"100%", background:"none", border:`1px solid ${filters[h]?C.amber:C.border}`,
                              borderRadius:3, color:filters[h]?C.amber:C.muted, fontFamily:"monospace",
                              fontSize:10, padding:"2px 6px", outline:"none", boxSizing:"border-box" }} />
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom:`1px solid ${C.border}08`,
                        background: ri%2===0 ? "transparent" : "#0a0c0f" }}
                        onMouseOver={e=>e.currentTarget.style.background=`${C.amber}08`}
                        onMouseOut={e=>e.currentTarget.style.background=ri%2===0?"transparent":"#0a0c0f"}>
                        <td style={{ padding:"6px 10px", color:C.muted, fontSize:9,
                          textAlign:"right", userSelect:"none" }}>{page*PAGE_SIZE+ri+1}</td>
                        {data.headers.map(h => (
                          <td key={h} style={{ padding:"6px 12px", maxWidth:200,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            color: data.types[h]==="number" ? C.blue
                              : data.types[h]==="boolean" ? (row[h]==="true"||row[h]==="1"?C.green:C.red)
                              : C.text,
                            background: selectedCol===h ? `${C.amber}05` : "transparent" }}>
                            {row[h]===""
                              ? <span style={{color:C.dim}}>NULL</span>
                              : row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* pagination */}
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                  borderTop:`1px solid ${C.border}`, color:C.muted, fontSize:11 }}>
                  <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                    style={{ padding:"4px 12px", background:"none", border:`1px solid ${C.border2}`,
                      borderRadius:4, color:page===0?C.dim:C.muted, cursor:page===0?"default":"pointer",
                      fontFamily:"monospace", fontSize:10 }}>← PREV</button>
                  <span>Page {page+1} of {totalPages} — {processed.length.toLocaleString()} rows</span>
                  <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                    style={{ padding:"4px 12px", background:"none", border:`1px solid ${C.border2}`,
                      borderRadius:4, color:page>=totalPages-1?C.dim:C.muted,
                      cursor:page>=totalPages-1?"default":"pointer", fontFamily:"monospace", fontSize:10 }}>
                    NEXT →</button>
                </div>
              </div>
            )}

            {/* ── PROFILE ── */}
            {activeTab==="profile" && selectedCol && st && (
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
                {/* column header */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:22, fontWeight:900, color:C.amber }}>{selectedCol}</span>
                  <Tag color={TYPE_COLOR[ty]}>{ty}</Tag>
                  <Tag color={st.nullCount>0?C.red:C.green}>
                    {st.nullCount} nulls ({((st.nullCount/data.rows.length)*100).toFixed(1)}%)
                  </Tag>
                  <Tag color={C.purple}>{st.unique} unique</Tag>
                </div>

                {/* null bar */}
                <div>
                  <div style={{ fontSize:9, color:C.muted, letterSpacing:2, marginBottom:6, textTransform:"uppercase" }}>
                    Fill Rate
                  </div>
                  <div style={{ height:8, background:C.dim, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${((data.rows.length-st.nullCount)/data.rows.length*100)}%`,
                      background:`linear-gradient(90deg, ${C.green}, ${C.blue})`, borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:4 }}>
                    {(((data.rows.length-st.nullCount)/data.rows.length)*100).toFixed(1)}% filled
                  </div>
                </div>

                {/* stats grid */}
                {ty==="number" && (
                  <Panel>
                    <PanelHead accent={C.blue}>Numeric Statistics</PanelHead>
                    <div style={{ padding:16, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
                      <Stat label="Min"    value={st.min}    color={C.blue} />
                      <Stat label="Max"    value={st.max}    color={C.blue} />
                      <Stat label="Mean"   value={st.mean}   color={C.amber} />
                      <Stat label="Median" value={st.median} color={C.amber} />
                      <Stat label="Std Dev" value={st.stddev} color={C.purple} />
                      <Stat label="Sum"    value={st.sum}    color={C.green} />
                      <Stat label="Unique" value={st.unique} color={C.text} />
                      <Stat label="Nulls"  value={st.nullCount} color={st.nullCount>0?C.red:C.green} />
                    </div>
                  </Panel>
                )}

                {ty==="string" && st.top && (
                  <Panel>
                    <PanelHead accent={C.green}>Top Values</PanelHead>
                    <div style={{ padding:16 }}>
                      {st.top.map(([val, cnt], i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                          <span style={{ color:C.muted, fontSize:10, minWidth:16 }}>#{i+1}</span>
                          <span style={{ color:C.text, flex:1, fontSize:12,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val}</span>
                          <span style={{ color:C.green, fontSize:11 }}>{cnt}</span>
                          <div style={{ width:80, height:6, background:C.dim, borderRadius:3 }}>
                            <div style={{ height:"100%", borderRadius:3, background:CHART_COLORS[i],
                              width:`${(cnt/st.top[0][1])*100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop:8, fontSize:10, color:C.muted }}>
                        Avg length: {st.avgLen} chars · {st.unique} unique values
                      </div>
                    </div>
                  </Panel>
                )}

                {/* distribution chart */}
                <Panel>
                  <PanelHead accent={C.purple}>Distribution</PanelHead>
                  <div style={{ padding:"8px 16px 16px" }}>
                    <ColChart rows={data.rows} col={selectedCol} type={ty} />
                  </div>
                </Panel>
              </div>
            )}

            {/* ── CHARTS ── */}
            {activeTab==="chart" && (
              <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {data.headers.map((h, i) => (
                  <Panel key={h} style={{ cursor:"pointer" }} onClick={()=>{setSelectedCol(h);setActiveTab("profile");}}>
                    <PanelHead accent={CHART_COLORS[i%CHART_COLORS.length]}>
                      {h}
                      <span style={{ marginLeft:8, color:TYPE_COLOR[data.types[h]], fontSize:9 }}>
                        [{data.types[h]}]
                      </span>
                    </PanelHead>
                    <div style={{ padding:"8px 12px 12px" }}>
                      <ColChart rows={data.rows} col={h} type={data.types[h]} />
                    </div>
                  </Panel>
                ))}
              </div>
            )}

            {/* ── SCATTER ── */}
            {activeTab==="scatter" && (
              <div style={{ padding:20 }}>
                {numCols.length < 2
                  ? <div style={{ color:C.muted, textAlign:"center", padding:60, fontSize:13 }}>
                      Need at least 2 numeric columns for scatter plot.
                    </div>
                  : <>
                    <div style={{ display:"flex", gap:16, marginBottom:16, alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ color:C.muted, fontSize:11 }}>X axis:</span>
                        <select value={scatterX||""} onChange={e=>setScatterX(e.target.value)}
                          style={{ background:C.panel, border:`1px solid ${C.border2}`, color:C.text,
                            padding:"5px 10px", borderRadius:5, fontFamily:"monospace", fontSize:11 }}>
                          {numCols.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ color:C.muted, fontSize:11 }}>Y axis:</span>
                        <select value={scatterY||""} onChange={e=>setScatterY(e.target.value)}
                          style={{ background:C.panel, border:`1px solid ${C.border2}`, color:C.text,
                            padding:"5px 10px", borderRadius:5, fontFamily:"monospace", fontSize:11 }}>
                          {numCols.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <Tag color={C.muted}>{Math.min(processed.length,400)} points plotted</Tag>
                    </div>
                    {scatterX && scatterY && (
                      <Panel>
                        <PanelHead accent={C.blue}>{scatterX} vs {scatterY}</PanelHead>
                        <div style={{ padding:"8px 16px 16px" }}>
                          <ScatterPlot rows={processed} xCol={scatterX} yCol={scatterY} />
                        </div>
                      </Panel>
                    )}

                    {/* all num col correlations mini-grid */}
                    {numCols.length > 2 && (
                      <div style={{ marginTop:16 }}>
                        <div style={{ fontSize:9, color:C.muted, letterSpacing:2,
                          textTransform:"uppercase", marginBottom:12 }}>Other Numeric Pairs</div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                          {numCols.flatMap((a,i) => numCols.slice(i+1).map(b => (
                            a===scatterX&&b===scatterY ? null :
                            <Panel key={`${a}-${b}`} style={{ cursor:"pointer" }}
                              onClick={()=>{setScatterX(a);setScatterY(b);}}>
                              <PanelHead accent={C.purple}>{a} × {b}</PanelHead>
                              <div style={{ padding:"4px 8px 10px" }}>
                                <ScatterPlot rows={processed} xCol={a} yCol={b} />
                              </div>
                            </Panel>
                          ))).filter(Boolean)}
                        </div>
                      </div>
                    )}
                  </>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR — quick stats for selected col */}
        {selectedCol && (
          <div style={{ width:180, borderLeft:`1px solid ${C.border}`, background:"#090b0e",
            flexShrink:0, padding:14, overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase" }}>
              Selected
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.amber, wordBreak:"break-all" }}>{selectedCol}</div>
              <Tag color={TYPE_COLOR[data.types[selectedCol]]}>{data.types[selectedCol]}</Tag>
            </div>
            {st && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <Stat label="Rows"   value={data.rows.length} />
                <Stat label="Nulls"  value={st.nullCount} color={st.nullCount>0?C.red:C.green} />
                <Stat label="Unique" value={st.unique} color={C.purple} />
                {data.types[selectedCol]==="number" && <>
                  <Stat label="Min"    value={st.min}    color={C.blue} />
                  <Stat label="Max"    value={st.max}    color={C.blue} />
                  <Stat label="Mean"   value={st.mean}   color={C.amber} />
                  <Stat label="Std"    value={st.stddev} color={C.purple} />
                </>}
              </div>
            )}
            <button onClick={()=>setActiveTab("profile")}
              style={{ marginTop:"auto", padding:"7px", borderRadius:5, background:"none",
                border:`1px solid ${C.border2}`, color:C.muted, fontFamily:"monospace",
                fontSize:9, cursor:"pointer", letterSpacing:1.5, textTransform:"uppercase",
                transition:"all 0.15s" }}
              onMouseOver={e=>{e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.color=C.amber;}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.muted;}}>
              FULL PROFILE →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
