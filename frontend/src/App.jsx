import React, { useEffect, useState } from "react";

const API_BASE = "https://ctv-operations-kpi.onrender.com";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [vessels, setVessels] = useState([]);

  const [shipName, setShipName] = useState("");
  const [shipType, setShipType] = useState("CTV");
  const [projectName, setProjectName] = useState("");
  const [startDate, setStartDate] = useState("");

  const [selectedProject, setSelectedProject] = useState(null);
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [operationType, setOperationType] = useState("Transit");
  const [comment, setComment] = useState("");

  const [kpiMonth, setKpiMonth] = useState("");

  /* -------------------- LOAD DATA -------------------- */

  useEffect(() => {
    fetch(`${API_BASE}/projects/`)
      .then(res => res.json())
      .then(setProjects);

    fetch(`${API_BASE}/vessels/`)
      .then(res => res.json())
      .then(setVessels);
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    fetch(`${API_BASE}/projects/${selectedProject.id}/daily-reports/`)
      .then(res => res.json())
      .then(setDailyReports);
  }, [selectedProject]);

  /* -------------------- SETUP -------------------- */

  const createSetup = async () => {
    if (!shipName || !projectName || !startDate) {
      alert("Udfyld alle felter");
      return;
    }

    await fetch(`${API_BASE}/setup/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vessel_name: shipName,
        vessel_type: shipType,
        project_name: projectName,
        date: startDate
      })
    });

    setShipName("");
    setProjectName("");

    const updatedProjects = await fetch(`${API_BASE}/projects/`).then(r => r.json());
    setProjects(updatedProjects);
  };

  /* -------------------- DAILY REPORT -------------------- */

  const createDailyReport = async () => {
    await fetch(`${API_BASE}/daily-reports/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: selectedProject.id,
        vessel_id: vessels[0]?.id,
        date: startDate
      })
    });

    const reports = await fetch(
      `${API_BASE}/projects/${selectedProject.id}/daily-reports/`
    ).then(r => r.json());

    setDailyReports(reports);
  };

  /* -------------------- OPERATIONS -------------------- */

  const addOperation = async () => {
  if (!startTime || !endTime) {
    alert("Angiv start og slut tid");
    return;
  }

  await fetch(`${API_BASE}/operations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      daily_report_id: selectedReport.id,
      start_time: startTime,
      end_time: endTime,
      operation_type: operationType,
      comment: comment
    })
  });

  const updatedReports = await fetch(
    `${API_BASE}/projects/${selectedProject.id}/daily-reports/`
  ).then(r => r.json());

  setDailyReports(updatedReports);

  // 🔑 BEVAR selectedReport SIKKERT
  const refreshed = updatedReports.find(
    r => r.id === selectedReport.id
  );

  setSelectedReport(
    refreshed
      ? { ...refreshed, operations: refreshed.operations || [] }
      : selectedReport
  );

  setStartTime("");
  setEndTime("");
  setComment("");
};


  /* -------------------- KPI EXCEL -------------------- */

  const downloadKpiExcel = async () => {
    if (!kpiMonth || !selectedProject) return;

    const [year, month] = kpiMonth.split("-");

    const res = await fetch(
      `${API_BASE}/projects/${selectedProject.id}/kpi/${year}/${month}/excel`
    );

    if (!res.ok) {
      alert("Kunne ikke generere KPI");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `KPI_${selectedProject.name}_${year}-${month}.xlsx`;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  /* -------------------- UI -------------------- */

  return (
    <div style={{ padding: "20px" }}>
      <h1>CTV Operations KPI</h1>

      <h2>Opret (én gang)</h2>
      <input placeholder="Skibsnavn" value={shipName} onChange={e => setShipName(e.target.value)} />
      <select value={shipType} onChange={e => setShipType(e.target.value)}>
        <option>CTV</option>
        <option>SOV</option>
        <option>IV</option>
      </select>
      <input placeholder="Projekt" value={projectName} onChange={e => setProjectName(e.target.value)} />
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      <button onClick={createSetup}>Opret</button>

      <hr />

      <h2>Projekter</h2>
      <ul>
        {projects.map(p => (
          <li key={p.id}>
            {p.name}{" "}
            <button onClick={() => setSelectedProject(p)}>Åbn</button>
          </li>
        ))}
      </ul>

      {selectedProject && (
        <>
          <h2>Daglige rapporter</h2>
          <ul>
            {dailyReports.map(r => (
              <li key={r.id}>
                {r.date}{" "}
                <button onClick={() => setSelectedReport(r)}>Åbn</button>
              </li>
            ))}
          </ul>

          <h2>KPI (måned)</h2>
          <input type="month" value={kpiMonth} onChange={e => setKpiMonth(e.target.value)} />
          <button onClick={downloadKpiExcel}>Download KPI (Excel)</button>
        </>
      )}

      {selectedReport && (
        <>
          <hr />
          <h2>Operationer</h2>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          <select value={operationType} onChange={e => setOperationType(e.target.value)}>
            <option>Transit</option>
            <option>Push-on</option>
            <option>Fuelling</option>
            <option>Bunker</option>
            <option>Working</option>
            <option>WoW</option>
            <option>Downtime</option>
          </select>
          <input placeholder="Kommentar" value={comment} onChange={e => setComment(e.target.value)} />
          <button onClick={addOperation}>Tilføj operation</button>

          <ul>{selectedReport?.operations?.length > 0 && (
  <ul>
    {selectedReport.operations.map(op => (
      <li key={op.id}>
        {op.start_time}–{op.end_time} | {op.operation_type}
      </li>
    ))}
  </ul>
)}

        </>
      )}
    </div>
  );
}


