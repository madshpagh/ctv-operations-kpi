import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [operations, setOperations] = useState([]);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("WORKING");
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetch(`${API}/daily-reports`).then(r => r.json()).then(setReports);
  }, []);

const loadOperations = async (report) => {
  setSelectedReport(report);
  const res = await fetch(`${API}/operations/${report.id}/`);
  const data = await res.json();
  setOperations(Array.isArray(data) ? data : []);
};
  
  const addOperation = async () => {
    if (!start || !end) return;

    await fetch(`${API}/operations`, {
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

  return (
    <div style={{ padding: 30 }}>
      <h1>CTV Operations KPI</h1>

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

