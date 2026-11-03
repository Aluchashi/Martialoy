window.renderSurvivalCard = function renderSurvivalCard(result) {
  const container = document.getElementById('survival-card-body');
  if (!container || !result) return;

  const passed = result.verdict === 'PASS';
  const energy = result.ledgers.map((ledger) =>
    `${ledger.used.toFixed(1)} ${ledger.unit}`
  ).join(' + ');
  const reason = result.reasons.length
    ? result.reasons.map((item) => item.text).join(' ')
    : 'No slope limit exceeded on this route.';

  container.innerHTML = `
    <div class="verdict ${passed ? 'verdict-pass' : 'verdict-fail'}">
      <span class="verdict-dot"></span>${passed ? 'PASS' : 'FAIL'}
    </div>
    <dl class="metrics">
      <div><dt>Distance</dt><dd>${(result.total_distance_m / 1000).toFixed(2)} <small>km</small></dd></div>
      <div><dt>Estimated time</dt><dd>${result.total_time_h.toFixed(2)} <small>h</small></dd></div>
      <div><dt>Rover energy</dt><dd>${energy}</dd></div>
      <div><dt>Maximum slope</dt><dd>${result.max_slope_deg.toFixed(1)}° <small>/ ${result.profile_slope_limit}° limit</small></dd></div>
    </dl>
    <p class="result-reason">${reason}</p>
    <p class="source-label">Data source: <strong>${result.data_source_mode}</strong></p>
  `;
};
