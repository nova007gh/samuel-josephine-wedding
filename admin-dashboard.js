/* Dashboard categories keep every editor mounted, preserving unsaved inputs. */
(() => {
  const dashboard = document.querySelector('[data-view="admin"]');
  const list = dashboard?.querySelector('.admin-section-tabs');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[data-admin-section]')];
  const panels = [...dashboard.querySelectorAll('.admin-section-panel')];
  function select(section){
    if (!tabs.some(t => t.dataset.adminSection === section)) section = 'overview';
    tabs.forEach(t => {
      const active = t.dataset.adminSection === section;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => panel.classList.toggle('hidden', panel.id !== 'admin-panel-' + section));
    try { sessionStorage.setItem('sj_admin_section', section); } catch {}
  }
  let initial = 'overview';
  try { initial = sessionStorage.getItem('sj_admin_section') || initial; } catch {}
  select(initial);
  list.addEventListener('click', e => {
    const tab = e.target.closest('[data-admin-section]');
    if (tab && isAdmin()) select(tab.dataset.adminSection);
  });
  list.addEventListener('keydown', e => {
    const index = tabs.indexOf(e.target);
    if (index < 0 || !isAdmin()) return;
    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (e.key === 'ArrowDown') next = (index + 3) % tabs.length;
    else if (e.key === 'ArrowUp') next = (index + tabs.length - 3) % tabs.length;
    else return;
    e.preventDefault();
    select(tabs[next].dataset.adminSection);
    tabs[next].focus();
  });
})();
