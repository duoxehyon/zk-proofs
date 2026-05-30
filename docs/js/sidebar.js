const sidebar   = document.getElementById('sidebar');
const overlay   = document.getElementById('overlay');
const toggleBtn = document.getElementById('toggleBtn');
const isMobile  = () => window.innerWidth <= 720;

// Restore desktop sidebar open/closed preference
if (!isMobile() && localStorage.getItem('sidebar') === 'off') {
  document.body.classList.add('sidebar-off');
}

toggleBtn?.addEventListener('click', () => {
  if (isMobile()) {
    const open = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', open);
  } else {
    const off = document.body.classList.toggle('sidebar-off');
    localStorage.setItem('sidebar', off ? 'off' : 'on');
  }
});

overlay?.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
});

// Active link + auto-open accordion if a child is active
const norm = (p) => p.replace(/\/$/, '') || '/';
const current = norm(location.pathname);

document.querySelectorAll('.sidebar-nav a').forEach(a => {
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http')) return;
  if (norm(new URL(href, location.href).pathname) === current) {
    a.classList.add('active');
    // open parent accordion if inside one
    const acc = a.closest('.nav-accordion');
    if (acc) acc.classList.add('open');
  }
});

// Accordion toggles
document.querySelectorAll('.nav-accordion').forEach(acc => {
  const key = 'acc-' + acc.dataset.key;
  const btn = acc.querySelector('.nav-accordion-btn');

  // Restore saved state (but active-child state takes priority)
  if (!acc.classList.contains('open') && localStorage.getItem(key) === 'open') {
    acc.classList.add('open');
  }

  btn?.addEventListener('click', () => {
    const isOpen = acc.classList.toggle('open');
    localStorage.setItem(key, isOpen ? 'open' : 'closed');
  });
});
