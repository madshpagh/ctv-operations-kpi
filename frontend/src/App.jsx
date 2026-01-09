import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  // master data
  const [vessels, setVessels] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newVessel, setNewVessel] = useState("");
  const [newProject, setNewProject] = useState("");

  // daily report
  const [vessel, setVessel] = useState("");
  const [project, setProject] = useState("");
  const [date, setDate] = useState("");
  const [reportId, setReportId] = useState(null);

  // operations
  const [operations, setOperations] = useState([]);

  // overview
  const [month, setMonth] = useState("");
  const [overview, setOverview] = useState(null);

  // load master data
  useEffect(() => {
    fetch(`${API}/vessels`).then(r => r.json()).then(setVessels);
    fetch(`${API}/projects`).then(r => r.json()).then(setProjects);
  }, []);

  // create master data
  const createVessel = async () => {
    if (!newVessel) return;
    await fetch(`${API}/vessels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVessel })
    });
    setNewVessel("");
    fetch(`${API}/vessels`).then(r => r.json()).then(setVessels);
  };

  const createProject = async () => {
    if (!newProject) return;
    await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProject })
    });
    setNewProject("");
    fetch(`${API}/projects`).then(r => r.json()).then(setProjects);
  };

  // create day
  const createDay = async () => {
    const res = await fetch(`${API}/daily-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        vessel_id: vessel,
        project_id: project
      })
    });
    const data = await res.json();
    setReportId(data.daily_report_id);
    setOperations([]);
  };

  // operations
  const addOperation = () => {
    setOperations([
      ...operations,
      {
        operation_type: "",
        status: "WORKING",
        start_time: "",
        end_time: "",
        fuel_mgo: 0,
        downtime_reason: "",
        weather_related: false
      }
    ]);
  };

  const saveOperations = async () => {
    for (const op of operations) {
      await fetch(`${API}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...op,
          daily_report_id: reportId
        })
      });
    }
    alert("Operationer gemt");
  };

  const saveDay = async () => {
    await fetch(`${API}/daily-reports/${reportId}/save`, {
      method: "POST"
    });
    alert("Dag gemt");
  };

  // overview
  const loadOverview = async () => {
    const [y, m] = month.split("-");
    const res = await fetch(
      `${API}/overview/monthly?vessel_id=${vessel}&project_id=${project}&year=${y}&month=${m}`
    );
    setOverview(await res.json());
  };

  const downloadExcel = () => {
    const [y, m] = month.split("-");
    window.open(
      `${API}/overview/monthly/excel?vessel_id=${vessel}&project_id=${project}&year=${y}&month=${m}`
    );
  };

  return (
    <div style={{ padding: 30, maxWidth: 1100 }}>
      <h1>CTV Operations KPI</h1>

      {/* MASTER DATA */}
      <h2>Master data</h2>
      <div style={{ display: "flex", gap: 30 }}>
        <div>
          <h4>Opret skib</h4>
          <input
            value={newVessel}
            onChange={e => setNewVessel(e.target.value)}
            placeholder="Skibsnavn"
          />
          <button onClick={createVessel}>Opret</button>
        </div>

        <div>
          <h4>Opret projekt</h4>
          <input
            value={newProject}
            onChange={e => setNewProject(e.target.value)}
            placeholder="Projektnavn"
          />
          <button onClick={createProject}>Opret</button>
        </div>
      </div>

      <hr />

      {/* DAILY REPORT */}
      <h2>Daglig rapport</h2>

      <select value={vessel} onChange={e => setVessel(e.target.value)}>
        <option value="">Vælg skib</option>
        {vessels.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>

      <select value={project} onChange={e => setProject(e.target.value)}>
        <option value="">Vælg projekt</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <input type="date" value={date} onChange={e => setDate(e.target.value)} />

      <button onClick={createDay} disabled={!vessel || !project || !date}>
        Opret dag
      </button>

      {/* OPERATIONS */}
      {reportId && (
        <>
          <h3>Operationer</h3>
          <button onClick={addOperation}>+ Tilføj operation</button>

          {operations.map((op, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
              <input
                placeholder="Operation type"
                onChange={e => op.operation_type = e.target.value}
              />
              <select onChange={e => op.status = e.target.value}>
                <option value="WORKING">WORKING</option>
                <option value="DOWNTIME">DOWNTIME</option>
              </select>
              <input type="time" onChange={e => op.start_time = e.target.value} />
              <input type="time" onChange={e => op.end_time = e.target.value} />
              <input
                type="number"
                placeholder="Fuel (MGO)"
                onChange={e => op.fuel_mgo = Number(e.target.value)}
              />
              <input
                placeholder="Downtime reason"
                onChange={e => op.downtime_reason = e.target.value}
              />
              <label>
                <input
                  type="checkbox"
                  onChange={e => op.weather_related = e.target.checked}
                />
                Weather
              </label>
            </div>
          ))}

          <button onClick={saveOperations}>Gem operationer</button>
          <button onClick={saveDay}>Gem dag</button>
        </>
      )}

      <hr />

      {/* OVERVIEW */}
      <h2>Måneds-overview</h2>

      <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      <button onClick={loadOverview} disabled={!month || !vessel || !project}>
        Vis overview
      </button>

      {overview && (
        <>
          <pre>{JSON.stringify(overview, null, 2)}</pre>
          <button onClick={downloadExcel}>Download Excel</button>
        </>
      )}
    </div>
  );
}
