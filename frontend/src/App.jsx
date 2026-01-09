import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  // Master data
  const [vessels, setVessels] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newVessel, setNewVessel] = useState("");
  const [newProject, setNewProject] = useState("");

  // Daily reports
  const [reports, setReports] = useState([]);
  const [vesselId, setVesselId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");

  // Operations
  const [selectedReport, setSelectedReport] = useState(null);
  const [operations, setOperations] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("WORKING");
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadMasterData();
    loadReports();
  }, []);

  // -----------------------
  // LOADERS
  // -----------------------
  const loadMasterData = async () => {
    setVessels(await fetch(`${API}/vessels/`).then(r => r.json()));
    setProjects(await fetch(`${API}/projects/`).then(r => r.json()));
  };

  const loadReports = async () => {
    setReports(await fetch(`${API}/daily-reports/`).then(r => r.json()));
  };

  const loadOperations = async (report) => {
    setSelectedReport(report);
    const data = await fetch(`${API}/operations/${report.id}/`).then(r => r.json());
    setOperations(Array.isArray(data) ? data : []);
  };

  // -----------------------
  // CREATE
  // -----------------------
  const createVessel = async () => {
    if (!newVessel) return;
    await fetch(`${API}/vessels/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVessel })
    });
    setNewVessel("");
    loadMasterData();
  };

  const createProject = async () => {
    if (!newProject) return;
    await fetch(`${API}/projects/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProject })
    });
    setNewProject("");
    loadMasterData();
  };

  const createDailyReport = async () => {
    await fetch(`${API}/daily-reports/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_id: Number(vesselId),
        project_id: Number(projectId),
        date
      })
    });
    setDate("");
    loadReports();
  };

  const addOperation = async () => {
    if (!start || !end) return;

    await fetch(`${API}/operations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_report_id: selectedReport.id,
        start_time: start,
        end_time: end,
        status,
        downtime_reason: status === "DOWNTIME" ? reason : null
      })
    });

    setStart("");
    setEnd("");
    setReason("");
    loadOperations(selectedReport);
  };

  // -----------------------
  // UI
  // -----------------------
  return (
    <div style={{ padding: 30, maxWidth: 1100 }}>
      <h1>CTV Operations KPI</h1>

      <h2>Master data</h2>
      <div style={{ display: "flex", gap: 40 }}>
        <div>
          <h4>Opret skib</h4>
          <input value={newVessel} onChange={e => setNewVessel(e.target.value)} />
          <button onClick={createVessel}>Opret</button>
        </div>

        <div>
          <h4>Opret projekt</h4>
          <input value={newProject} onChange={e => setNewProject(e.target.value)} />
          <button onClick={createProject}>Opret</button>
        </div>
      </div>

      <hr />

      <h2>Daglig rapport</h2>
      <select value={vesselId} onChange={e => setVesselId(e.target.value)}>
        <option value="">Vælg skib</option>
        {vessels.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>

      <select value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Vælg projekt</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      <button onClick={createDailyReport} disabled={!vesselId || !projectId || !date}>
        Opret dag
      </button>

      <hr />

      <h2>Daglige rapporter</h2>
      <ul>
        {reports.map(r => (
          <li key={r.id}>
            {r.date} – {r.vessel} – {r.project}
            <button onClick={() => loadOperations(r)}>Åbn</button>
          </li>
        ))}
      </ul>

      {selectedReport && (
        <>
          <hr />
          <h3>Operationer – {selectedReport.date}</h3>

          <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} />

          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="WORKING">WORKING</option>
            <option value="DOWNTIME">DOWNTIME</option>
          </select>

          {status === "DOWNTIME" && (
            <input
              placeholder="Downtime reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          )}

          <button onClick={addOperation}>Tilføj operation</button>

          <ul>
            {operations.map(op => (
              <li key={op.id}>
                {op.start_time}–{op.end_time} | {op.status}
                {op.downtime_reason && ` (${op.downtime_reason})`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
