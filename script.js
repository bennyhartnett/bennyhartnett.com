    /* INTERACTIVITY */
    const iconGrid = document.getElementById('iconGrid');
    const icons = document.querySelectorAll('.icon-btn');
    const panels = document.querySelectorAll('.panel');

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
