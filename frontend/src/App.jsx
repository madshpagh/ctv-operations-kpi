const [newVessel, setNewVessel] = useState("");
const [newProject, setNewProject] = useState("");

import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [vessels, setVessels] = useState([]);
  const [projects, setProjects] = useState([]);
  const [vessel, setVessel] = useState("");
  const [project, setProject] = useState("");
  const [date, setDate] = useState("");
  const [reportId, setReportId] = useState(null);
  const [operations, setOperations] = useState([]);
  const [overview, setOverview] = useState(null);
  const [month, setMonth] = useState("");

  useEffect(() => {
    fetch(`${API}/vessels`).then(r => r.json()).then(setVessels);
    fetch(`${API}/projects`).then(r => r.json()).then(setProjects);
  }, []);

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

  const addOperation = () => {
    setOperations([...operations, {
      operation_type: "",
      status: "WORKING",
      start_time: "",
      end_time: "",
      fuel_mgo: 0,
      downtime_reason: "",
      weather_related: false
    }]);
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
    await fetch(`${API}/daily-reports/${reportId}/save`, { method: "POST" });
    alert("Dag gemt");
  };

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
    <div style={{ padding: 30, maxWidth: 1000 }}>
      <h1>CTV Operations KPI</h1>

      <h2>Daglig rapport</h2>

      <select onChange={e => setVessel(e.target.value)}>
        <option value="">Vælg skib</option>
        {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>

      <select onChange={e => setProject(e.target.value)}>
        <option value="">Vælg projekt</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <input type="date" onChange={e => setDate(e.target.value)} />

      <button onClick={createDay} disabled={!date || !vessel || !project}>
        Opret dag
      </button>

      {reportId && (
        <>
          <h3>Operationer</h3>
          <button onClick={addOperation}>+ Tilføj operation</button>

          {operations.map((op, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
              <input
                placeholder="Type"
                onChange={e => op.operation_type = e.target.value}
              />
              <select onChange={e => op.status = e.target.value}>
                <option value="WORKING">WORKING</option>
                <option value="DOWNTIME">DOWNTIME</option>
              </select>
              <input type="time" onChange={e => op.start_time = e.target.value} />
              <input type="time" onChange={e => op.end_time = e.target.value} />
              <input type="number" placeholder="Fuel"
                onChange={e => op.fuel_mgo = +e.target.value} />
              <input placeholder="Downtime reason"
                onChange={e => op.downtime_reason = e.target.value} />
              <label>
                <input type="checkbox"
                  onChange={e => op.weather_related = e.target.checked} />
                Weather
              </label>
            </div>
          ))}

          <button onClick={saveOperations}>Gem operationer</button>
          <button onClick={saveDay}>Gem dag</button>
        </>
      )}

      <hr />

      <h2>Måneds-overview</h2>

      <input type="month" onChange={e => setMonth(e.target.value)} />
      <button onClick={loadOverview}>Vis overview</button>

      {overview && (
        <div>
          <pre>{JSON.stringify(overview, null, 2)}</pre>
          <button onClick={downloadExcel}>Download Excel</button>
        </div>
      )}
    </div>
  );
}

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



