import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [vessels, setVessels] = useState([]);
  const [projects, setProjects] = useState([]);

  const [newVessel, setNewVessel] = useState("");
  const [newProject, setNewProject] = useState("");

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    const v = await fetch(`${API}/vessels`).then(r => r.json());
    const p = await fetch(`${API}/projects`).then(r => r.json());
    setVessels(v);
    setProjects(p);
  };

  const createVessel = async () => {
    if (!newVessel) return;
    await fetch(`${API}/vessels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVessel })
    });
    setNewVessel("");
    loadMasterData();
  };

  const createProject = async () => {
    if (!newProject) return;
    await fetch(`${API}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProject })
    });
    setNewProject("");
    loadMasterData();
  };

  return (
    <div style={{ padding: 30, maxWidth: 900 }}>
      <h1>CTV Operations KPI</h1>

      <h2>Master data</h2>

      <div style={{ display: "flex", gap: 40 }}>
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

      <h3>Eksisterende skibe</h3>
      <ul>
        {vessels.map(v => (
          <li key={v.id}>{v.name}</li>
        ))}
      </ul>

      <h3>Eksisterende projekter</h3>
      <ul>
        {projects.map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
