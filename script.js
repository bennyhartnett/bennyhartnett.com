    /* GLOBAL HOVER SCROLL */
    function enableHoverScroll(target, edge = 20, speed = 6) {
      let interval;
      const el = target === window ? document.documentElement : target;
      const move = e => {
        const rect = target === window ? {top:0,bottom:window.innerHeight} : el.getBoundingClientRect();
        if (e.clientY > rect.bottom - edge) {
          clearInterval(interval);
          interval = setInterval(() => {
            target === window ? window.scrollBy(0, speed) : (el.scrollTop += speed);
          }, 16);
        } else if (e.clientY < rect.top + edge) {
          clearInterval(interval);
          interval = setInterval(() => {
            target === window ? window.scrollBy(0, -speed) : (el.scrollTop -= speed);
          }, 16);
        } else {
          clearInterval(interval);
        }
      };
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', () => clearInterval(interval));
    }
    enableHoverScroll(window);

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
      if (id === 'github') {
        panel.querySelector('#cloneCopyBtn').addEventListener('click', () => {
          navigator.clipboard.writeText(panel.querySelector('#gitCloneInput').value);
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
            }, idx * 100);
            timeouts.push(t);
          });
        };

        const renderResults = () => {
          const q = input.value.trim().toLowerCase();
          const matches = (q
            ? searchRecords.filter(r =>
                r.title.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q)
              )
            : searchRecords);
          addSequentially(matches);
        };

        input.addEventListener('input', renderResults);
        panel.querySelector('#searchBtn').addEventListener('click', renderResults);

        enableHoverScroll(resultsEl);

        renderResults();
      }
      if (id === 'gis') {
        const mapEl = panel.querySelector('#map');
        if (window.L) {
          const map = L.map(mapEl, { attributionControl: false });
          L.control.attribution({
            prefix: '<img src="https://upload.wikimedia.org/wikipedia/en/thumb/a/a4/Flag_of_the_United_States.svg/24px-Flag_of_the_United_States.svg.png" alt="USA"> © Federal Innovations | GIS for Defense',
            position: 'bottomright'
          }).addTo(map);
          const darkLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: ''
          }).addTo(map);
          // Apply the dark styling filter once the tiles have loaded so
          // the layer container is available.
          darkLayer.on('load', function() {
            const container = darkLayer.getContainer();
            if (container) {
              container.style.filter = 'invert(0.85) brightness(0.6)';
            }
          });

          // Attempt to locate the user's position and recenter the map
          map.locate({ setView: true, maxZoom: 16 });
          map.on('locationfound', function(e) {
            L.marker(e.latlng).addTo(map);
          });
          map.on('locationerror', function() {
            map.setView([20, 0], 2); // Fallback view if location fails
          });
        } else {
          mapEl.textContent = 'Map failed to load';
        }
      }
      enableHoverScroll(panel);
      panel.dataset.init = 'true';
    }

    function showPanel(id) {
      loadPanelContent(id);
      if (id === 'github') startRedirect('https://github.com/bennyhartnett/bennyhartnett.com', 'githubText', 'githubProgress', 'GitHub');
      if (id === 'linkedin') startRedirect('https://www.linkedin.com/in/dev-dc/', 'linkedinText', 'linkedinProgress', 'LinkedIn');
      iconGrid.classList.add('hidden');
      panels.forEach(p => p.classList.toggle('open', p.id === id));
    }

    function hidePanels() {
      panels.forEach(p => p.classList.remove('open'));
      iconGrid.classList.remove('hidden');
    }

    icons.forEach(icon => icon.addEventListener('click', () => {
      const panel = icon.dataset.panel;
      if (panel === 'gis') {
        window.location.href = 'gis.html';
        return;
      }
      showPanel(panel);
    }));

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
