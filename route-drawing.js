(() => {
  const PROFILE_KEY = 'martian-map-profile';
  const ROUTE_KEY = 'martian-map-route-points';
  const svgNamespace = 'http://www.w3.org/2000/svg';

  function readProfile() {
    return localStorage.getItem(PROFILE_KEY) === 'human' ? 'human' : 'rover';
  }

  function readPoints() {
    try {
      const points = JSON.parse(localStorage.getItem(ROUTE_KEY) || '[]');
      return Array.isArray(points) ? points.filter((point) => Array.isArray(point) && point.length === 2) : [];
    } catch {
      return [];
    }
  }

  function initRoutePage() {
    const overlay = document.getElementById('route-overlay');
    if (!overlay) return;
    let points = readPoints();
    let draggingIndex = -1;

    const toSvgPoint = (event) => {
      const bounds = overlay.getBoundingClientRect();
      return [
        Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
        Math.max(0, Math.min(600, ((event.clientY - bounds.top) / bounds.height) * 600))
      ];
    };

    const render = () => {
      overlay.replaceChildren();
      if (points.length > 1) {
        const line = document.createElementNS(svgNamespace, 'polyline');
        line.setAttribute('points', points.map((point) => point.join(',')).join(' '));
        line.setAttribute('class', 'route-line');
        overlay.append(line);
      }
      points.forEach((point, index) => {
        const marker = document.createElementNS(svgNamespace, 'circle');
        marker.setAttribute('cx', point[0]);
        marker.setAttribute('cy', point[1]);
        marker.setAttribute('r', '11');
        marker.setAttribute('class', `route-marker${index === 0 ? ' route-start' : ''}`);
        marker.dataset.index = index;
        overlay.append(marker);
      });
      const pointCount = document.getElementById('route-point-count');
      if (pointCount) pointCount.textContent = `${points.length} route point${points.length === 1 ? '' : 's'}`;
      localStorage.setItem(ROUTE_KEY, JSON.stringify(points));
    };

    overlay.addEventListener('pointerdown', (event) => {
      const marker = event.target.closest('circle[data-index]');
      if (marker) {
        draggingIndex = Number(marker.dataset.index);
        overlay.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    });
    overlay.addEventListener('pointermove', (event) => {
      if (draggingIndex < 0) return;
      points[draggingIndex] = toSvgPoint(event);
      render();
    });
    overlay.addEventListener('pointerup', () => { draggingIndex = -1; });
    overlay.addEventListener('pointercancel', () => { draggingIndex = -1; });
    overlay.addEventListener('click', (event) => {
      if (event.target.closest('circle[data-index]')) return;
      points.push(toSvgPoint(event));
      render();
    });

    document.getElementById('undo-route')?.addEventListener('click', () => {
      points.pop();
      render();
    });
    document.getElementById('clear-route')?.addEventListener('click', () => {
      points = [];
      render();
    });
    document.querySelectorAll('[data-profile]').forEach((button) => {
      button.addEventListener('click', () => {
        localStorage.setItem(PROFILE_KEY, button.dataset.profile);
        document.querySelectorAll('[data-profile]').forEach((option) => {
          option.classList.toggle('selected', option === button);
        });
      });
    });
    document.querySelectorAll('[data-profile]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.profile === readProfile());
    });
    render();
  }

  function initSummaryPages() {
    const profile = readProfile();
    const points = readPoints().length;
    const profileName = profile === 'human' ? 'Human astronaut' : 'Rover';
    ['selected-profile', 'survival-profile'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = profileName;
    });
    ['selected-points', 'survival-points'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(points);
    });
    const roverLedger = document.getElementById('rover-ledger');
    const humanLedgers = ['human-ledger', 'metabolic-ledger'].map((id) => document.getElementById(id));
    if (roverLedger) roverLedger.hidden = profile === 'human';
    humanLedgers.forEach((ledger) => { if (ledger) ledger.hidden = profile !== 'human'; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initRoutePage();
    initSummaryPages();
  });
})();
