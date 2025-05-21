    /* INTERACTIVITY */
    const iconGrid = document.getElementById('iconGrid');
    const icons = document.querySelectorAll('.icon-btn');
    const panels = document.querySelectorAll('.panel');

    /* ICON HOVER TYPE EFFECT */
    icons.forEach(icon => {
      const labelEl = icon.querySelector('.icon-label');
      const text = icon.dataset.label || '';
      let interval;
      icon.addEventListener('mouseenter', () => {
        let idx = 0;
        labelEl.textContent = '';
        labelEl.classList.add('visible');
        labelEl.classList.remove('blink');
        clearInterval(interval);
        interval = setInterval(() => {
          if (idx < text.length) {
            labelEl.textContent = text.slice(0, idx + 1);
            idx++;
          } else {
            clearInterval(interval);
            labelEl.textContent = text;
            labelEl.classList.add('blink');
          }
        }, 80);
      });
      icon.addEventListener('mouseleave', () => {
        clearInterval(interval);
        labelEl.classList.remove('visible', 'blink');
        labelEl.textContent = '';
      });
    });

    function loadPanelContent(id) {
      const panel = document.getElementById(id);
      if (panel.dataset.init) return;
      const closeBtn = panel.querySelector('.close-btn');
      if (closeBtn) closeBtn.addEventListener('click', hidePanels);
      if (id === 'email') {
        panel.querySelector('#copyBtn').addEventListener('click', () => {
          navigator.clipboard.writeText(panel.querySelector('#emailInput').value);
        });
      }
      if (id === 'search') {
        const input = panel.querySelector('input');
        const resultsEl = panel.querySelector('.search-results');
        let timeouts = [];

        const addSequentially = records => {
          timeouts.forEach(t => clearTimeout(t));
          timeouts = [];
          resultsEl.innerHTML = '';
          records.forEach((rec, idx) => {
            const t = setTimeout(() => {
              const det = document.createElement('details');
              const sum = document.createElement('summary');
              sum.textContent = rec.title;
              const p = document.createElement('p');
              p.textContent = rec.description;
              det.appendChild(sum);
              det.appendChild(p);
              resultsEl.appendChild(det);
              resultsEl.scrollTop = resultsEl.scrollHeight;
            }, idx * 150);
            timeouts.push(t);
          });
        };

        const renderResults = () => {
          const q = input.value.trim().toLowerCase();
          if (!q) {
            timeouts.forEach(t => clearTimeout(t));
            resultsEl.innerHTML = '';
            return;
          }
          const matches = searchRecords.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
          );
          addSequentially(matches);
        };

        input.addEventListener('input', renderResults);
        panel.querySelector('#searchBtn').addEventListener('click', renderResults);

        let hoverInterval;
        resultsEl.addEventListener('mousemove', e => {
          const rect = resultsEl.getBoundingClientRect();
          const speed = 4;
          if (e.clientY > rect.bottom - 20) {
            clearInterval(hoverInterval);
            hoverInterval = setInterval(() => {
              resultsEl.scrollTop += speed;
            }, 16);
          } else if (e.clientY < rect.top + 20) {
            clearInterval(hoverInterval);
            hoverInterval = setInterval(() => {
              resultsEl.scrollTop -= speed;
            }, 16);
          } else {
            clearInterval(hoverInterval);
          }
        });
        resultsEl.addEventListener('mouseleave', () => clearInterval(hoverInterval));

        renderResults();
      }
      if (id === 'gis') {
        const mapEl = panel.querySelector('#map');
        const map = L.map(mapEl).setView([0, 0], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 13);
            L.marker([latitude, longitude]).addTo(map);
          });
        }
      }
      panel.dataset.init = 'true';
    }

    function showPanel(id) {
      loadPanelContent(id);
      if (id === 'github') startRedirect('https://github.com/bennyhartnett', 'githubText', 'githubProgress', 'GitHub');
      if (id === 'linkedin') startRedirect('https://www.linkedin.com/in/dev-dc/', 'linkedinText', 'linkedinProgress', 'LinkedIn');
      iconGrid.classList.add('hidden');
      panels.forEach(p => p.classList.toggle('open', p.id === id));
    }

    function hidePanels() {
      panels.forEach(p => p.classList.remove('open'));
      iconGrid.classList.remove('hidden');
    }

    icons.forEach(icon => icon.addEventListener('click', () => showPanel(icon.dataset.panel)));

    /* REDIRECT COUNTDOWN WITH PROGRESS */
    function startRedirect(url, textId, progressId, name) {
      let count = 3;
      const textEl = document.getElementById(textId);
      const progEl = document.getElementById(progressId);
      progEl.style.width = '100%';
      textEl.textContent = `Redirecting to ${name} in ${count}…`;
      const interval = setInterval(() => {
        count--;
        const pct = Math.max(0, (count / 3) * 100);
        progEl.style.width = `${pct}%`;
        if (count > 0) {
          textEl.textContent = `Redirecting to ${name} in ${count}…`;
        } else {
          clearInterval(interval);
          window.location.href = url;
        }
      }, 1000);
    }
