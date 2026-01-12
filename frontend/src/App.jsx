import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

const OPERATION_TYPES = [
  "Transit",
  "Push-on",
  "Fuling",
  "Bunker",
  "Working",
  "WoW",
  "Downtime"
];

export default function App() {
  // =====================
  // SETUP (one-click)
  // =====================
  const [vesselName, setVesselName] = useState("");
  const [vesselType, setVesselType] = useState("CTV");
  const [projectName, setProjectName] = useState("");

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [kpiMonth, setKpiMonth] = React.useState("");

  // =====================
  // DAILY REPORTS
  // =====================
  const [reports, setReports] = useState([]);
  const [date, setDate] = useState("");

  <h2>KPI (måned)</h2>

<label>
  Vælg måned:&nbsp;
  <input
    type="month"
    value={kpiMonth}
    onChange={(e) => setKpiMonth(e.target.value)}
  />
</label>

<button
  disabled={!selectedProject || !kpiMonth}
  onClick={downloadKpiExcel}
  style={{ marginLeft: "10px" }}
>
  Download KPI (Excel)
</button>

  // =====================
  // OPERATIONS
  // =====================
  const [selectedReport, setSelectedReport] = useState(null);
  const [operations, setOperations] = useState([]);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [operationType, setOperationType] = useState("Transit");
  const [comment, setComment] = useState("");

  // =====================
  // LOAD PROJECTS
  // =====================
  useEffect(() => {
    fetch(`${API}/projects/`)
      .then(r => r.json())
      .then(setProjects);
  }, []);

  // =====================
  // LOAD REPORTS BY PROJECT
  // =====================
  const loadReports = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedReport(null);
    const data = await fetch(
      `${API}/projects/${projectId}/daily-reports/`
    ).then(r => r.json());
    setReports(data);
  };

  // =====================
  // LOAD OPERATIONS
  // =====================
  const loadOperations = async (report) => {
    setSelectedReport(report);
    const data = await fetch(
      `${API}/operations/${report.id}/`
    ).then(r => r.json());
    setOperations(Array.isArray(data) ? data : []);
  };

  // =====================
  // CREATE SETUP
  // =====================
  const createSetup = async () => {
    if (!vesselName || !projectName) return;

    const res = await fetch(`${API}/setup/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_name: vesselName,
        vessel_type: vesselType,
        project_name: projectName
      })
    });

    const data = await res.json();

    await fetch(`${API}/daily-reports/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_id: data.vessel_id,
        project_id: data.project_id,
        date
      })
    });

    setVesselName("");
    setProjectName("");
    setDate("");

    fetch(`${API}/projects/`)
      .then(r => r.json())
      .then(setProjects);

    loadReports(data.project_id);
  };

  // =====================
  // ADD OPERATION
  // =====================
  const addOperation = async () => {
    if (!start || !end || !selectedReport) return;

    await fetch(`${API}/operations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_report_id: selectedReport.id,
        start_time: start,
        end_time: end,
        operation_type: operationType,
        comment
      })
    });

    setStart("");
    setEnd("");
    setComment("");

    loadOperations(selectedReport);
  };

  // =====================
  // UI
  // =====================
  return (
    <div style={{ padding: 30, maxWidth: 1200 }}>
      <h1>CTV Operations KPI</h1>

      {/* SETUP */}
      <h2>Opret (én gang)</h2>
      <input
        placeholder="Skibsnavn"
        value={vesselName}
        onChange={e => setVesselName(e.target.value)}
      />

      <select value={vesselType} onChange={e => setVesselType(e.target.value)}>
        <option value="CTV">CTV</option>
        <option value="SOV">SOV</option>
        <option value="IV">IV</option>
      </select>

      <input
        placeholder="Projekt"
        value={projectName}
        onChange={e => setProjectName(e.target.value)}
      />

      <input type="date" value={date} onChange={e => setDate(e.target.value)} />

      <button onClick={createSetup}>Opret</button>

      <hr />

      {/* PROJECTS */}
      <h2>Projekter</h2>
      <ul>
        {projects.map(p => (
          <li key={p.id}>
            {p.name}
            <button onClick={() => loadReports(p.id)}>Åbn</button>
          </li>
        ))}
      </ul>

      {/* REPORTS */}
      {selectedProject && (
        <>
          <h2>Daglige rapporter</h2>
          <ul>
            {reports.map(r => (
              <li key={r.id}>
                {r.date} – {r.vessel} ({r.vessel_type})
                <button onClick={() => loadOperations(r)}>Åbn</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* OPERATIONS */}
      {selectedReport && (
        <>
          <hr />
          <h2>Operationer</h2>

          <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} />

          <select
            value={operationType}
            onChange={e => setOperationType(e.target.value)}
          >
            {OPERATION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input
            placeholder="Kommentar"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          <button onClick={addOperation}>Tilføj operation</button>

          <ul>
            {operations.map(op => (
              <li key={op.id}>
                {op.start_time}-{op.end_time} | {op.operation_type}
                {op.comment && ` – ${op.comment}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

<button
  onClick={() => {
    if (!selectedProject || !kpiMonth) return;
    const [year, month] = kpiMonth.split("-");
    window.open(
      `${API}/projects/${selectedProject}/kpi/${year}/${month}/excel/`,
      "_blank"
    );
  }}
>
  Download Excel
</button>


