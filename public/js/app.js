async function checkHealth() {
  const statusEl = document.getElementById('health-status');

  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    statusEl.textContent = `Servidor: ${data.status}`;
  } catch {
    statusEl.textContent = 'Servidor no disponible';
  }
}

checkHealth();
//Prueba de que funciona todo