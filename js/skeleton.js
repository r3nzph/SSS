/* ============================================================
   SKELETON — Dynamic Loading Placeholders
   Generates shimmer skeleton HTML for tables, cards, grids.
   Usage:
     Skeleton.showTable('inventoryTable', 8);    // 8-row skeleton
     Skeleton.showCards('umCardsContainer', 6);   // 6 card skeletons
     Skeleton.showProductGrid('posProductGrid');  // product grid
     Skeleton.hide('inventoryTable');             // remove skeletons
   ============================================================ */

const Skeleton = {

  /* ---- Generate n skeleton rows for a <tbody> ---- */
  showTable(tableBodyId, rowCount = 5) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const cols = tbody.closest('table')?.querySelectorAll('thead th')?.length || 6;
    let html = '';
    for (let i = 0; i < rowCount; i++) {
      html += '<tr class="skeleton-table-row">';
      for (let j = 0; j < cols; j++) {
        html += `<td><div class="skeleton skeleton-text" style="margin:0;width:${60 + Math.random() * 40}%"></div></td>`;
      }
      html += '</tr>';
    }
    tbody.innerHTML = html;
  },

  /* ---- Generate n skeleton cards for a card grid ---- */
  showCards(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-inline" style="padding:var(--space-md)">
            <div class="skeleton skeleton-avatar"></div>
            <div style="flex:1">
              <div class="skeleton skeleton-title" style="width:60%"></div>
              <div class="skeleton skeleton-text" style="width:40%"></div>
            </div>
          </div>
          <div style="padding:0 var(--space-md) var(--space-md)">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width:50%"></div>
          </div>
        </div>`;
    }
    container.innerHTML = html;
  },

  /* ---- Generate POS product grid skeletons ---- */
  showProductGrid(containerId, count = 12) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px 10px;text-align:center">
          <div class="skeleton skeleton-image" style="height:50px;width:60%;margin:0 auto 8px;border-radius:var(--radius-sm)"></div>
          <div class="skeleton skeleton-text" style="width:70%;margin:0 auto 4px"></div>
          <div class="skeleton skeleton-text" style="width:40%;margin:0 auto"></div>
        </div>`;
    }
    container.innerHTML = html;
  },

  /* ---- Generate toolbar skeleton (search + filter buttons) ---- */
  showToolbar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="skeleton-toolbar">
        <div class="skeleton skeleton-toolbar-search"></div>
        <div class="skeleton skeleton-toolbar-btn"></div>
        <div class="skeleton skeleton-toolbar-btn"></div>
        <div class="skeleton skeleton-toolbar-btn"></div>
        <div class="skeleton skeleton-button-sm"></div>
      </div>`;
  },

  /* ---- Generate KPI card skeletons ---- */
  showKpiGrid(containerId, count = 4) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="panel-kpi-card" style="border-color:transparent">
          <div class="skeleton skeleton-text" style="width:50%;margin-bottom:8px"></div>
          <div class="skeleton skeleton-title" style="width:30%;height:1.6rem"></div>
          <div class="skeleton skeleton-text" style="width:35%;margin-top:4px"></div>
        </div>`;
    }
    container.innerHTML = html;
  },

  /* ---- Generate chart skeleton ---- */
  showChart(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    // For canvas elements, insert skeleton alongside rather than replacing the canvas
    // (canvas.innerHTML fallback content doesn't show the skeleton properly)
    if (el.tagName === 'CANVAS') {
      el.style.opacity = '0';
      const parent = el.parentElement;
      if (parent && !parent.querySelector('.skeleton-chart')) {
        const skel = document.createElement('div');
        skel.className = 'skeleton skeleton-chart';
        const cs = getComputedStyle(el);
        skel.style.height = cs.height || '220px';
        skel.style.borderRadius = '8px';
        parent.appendChild(skel);
      }
      return;
    }
    el.innerHTML = `<div class="skeleton skeleton-chart"></div>`;
  },

  /* ---- Generate alert section skeleton ---- */
  showAlerts(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="skeleton skeleton-text" style="height:48px;width:100%;margin-bottom:8px"></div>`;
    }
    container.innerHTML = html;
  },

  /* ---- Remove all skeletons from a container ---- */
  hide(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
  },

  /* ---- Replace skeleton with actual content (fade transition) ---- */
  replace(containerId, contentHtml) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      container.innerHTML = contentHtml;
      container.style.opacity = '1';
    }, 150);
  }

};

export default Skeleton;
