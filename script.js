    /* INTERACTIVITY */
    const iconGrid = document.getElementById('iconGrid');
    const icons = document.querySelectorAll('.icon-btn');
    const panels = document.querySelectorAll('.panel');
    function showPanel(id) {
      iconGrid.classList.add('hidden');
      panels.forEach(p => p.classList.toggle('open', p.id === id));
      if (id === 'panel4') startRedirect('https://github.com', 'githubText', 'githubProgress');
      if (id === 'panel5') startRedirect('https://linkedin.com', 'linkedinText', 'linkedinProgress');
    }
    function hidePanels() { panels.forEach(p => p.classList.remove('open')); iconGrid.classList.remove('hidden'); }
    icons.forEach(icon => icon.addEventListener('click', () => showPanel(icon.dataset.panel)));
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', hidePanels));

    /* COPY EMAIL */
    document.getElementById('copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(document.getElementById('emailInput').value);
    });

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
