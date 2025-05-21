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
        panel.querySelector('#searchBtn').addEventListener('click', () => {
          const q = panel.querySelector('input').value;
          window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
        });
      }
      panel.dataset.init = 'true';
    }

    function showPanel(id) {
      loadPanelContent(id);
      if (id === 'github') startRedirect('https://github.com/bennyhartnett', 'githubText', 'githubProgress');
      if (id === 'linkedin') startRedirect('https://www.linkedin.com/in/dev-dc/', 'linkedinText', 'linkedinProgress');
      iconGrid.classList.add('hidden');
      panels.forEach(p => p.classList.toggle('open', p.id === id));
    }

    function hidePanels() {
      panels.forEach(p => p.classList.remove('open'));
      iconGrid.classList.remove('hidden');
    }

    icons.forEach(icon => icon.addEventListener('click', () => showPanel(icon.dataset.panel)));

    /* REDIRECT COUNTDOWN WITH PROGRESS */
    function startRedirect(url, textId, progressId) {
      let count = 3;
      const textEl = document.getElementById(textId);
      const progEl = document.getElementById(progressId);
      progEl.style.width = '100%';
      textEl.textContent = `Redirecting to ${url.replace(/^https?:\/\//, '')} in ${count}…`;
      const interval = setInterval(() => {
        count--;
        const pct = Math.max(0, (count / 3) * 100);
        progEl.style.width = `${pct}%`;
        if (count > 0) {
          textEl.textContent = `Redirecting to ${url.replace(/^https?:\/\//, '')} in ${count}…`;
        } else {
          clearInterval(interval);
          window.location.href = url;
        }
      }, 1000);
    }
