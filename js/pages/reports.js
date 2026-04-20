/**
 * Tekora — js/pages/reports.js
 * Admin: Reports & Analytics — KPIs, bar charts, horizontal bars
 */
"use strict";

async function loadReports() {
  await loadCaches();
  try {
    const [reqSnap, pmsSnap] = await Promise.all([
      db.collection('requests').get(),
      db.collection('pms_schedules').get(),
    ]);
    const requests  = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pms       = pmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalPMS  = pms.length;
    const donePMS   = pms.filter(p => p.status === 'completed').length;
    const compRate  = totalPMS ? Math.round(donePMS / totalPMS * 100) : 0;
    const totalHours = _equipment.reduce((a, e) => a + (e.totalMRH || 0), 0);

    setHTML('report-stats', `
      <div class="stat">
        <div class="stat-accent" style="background:var(--accent)"></div>
        <div class="stat-head"><div class="stat-label">Compliance Rate</div></div>
        <div class="stat-value" style="color:var(--accent)">${compRate}%</div>
        <div class="stat-meta">${donePMS}/${totalPMS} tasks done</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--amber)"></div>
        <div class="stat-head"><div class="stat-label">Total PMS Tasks</div></div>
        <div class="stat-value">${totalPMS}</div>
        <div class="stat-meta">across all schedules</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--blue)"></div>
        <div class="stat-head"><div class="stat-label">Total Requests</div></div>
        <div class="stat-value">${requests.length}</div>
        <div class="stat-meta">${requests.filter(r => r.status === 'open').length} still open</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--purple)"></div>
        <div class="stat-head"><div class="stat-label">Total MRH</div></div>
        <div class="stat-value">${Math.round(totalHours / 1000)}k</div>
        <div class="stat-meta">${totalHours.toLocaleString()} hours</div>
      </div>`);

    // PMS completion by facility
    const platBars = _facilities.map(f => {
      const eIds  = _equipment.filter(e => e.facilityIds && e.facilityIds.includes(f.id)).map(e => e.id);
      const total = pms.filter(s => eIds.includes(s.equipmentId)).length;
      const done  = pms.filter(s => eIds.includes(s.equipmentId) && s.status === 'completed').length;
      const pct   = total ? Math.round(done / total * 100) : 0;
      const col   = pct > 75 ? 'var(--accent)' : pct > 40 ? 'var(--amber)' : 'var(--red)';
      return `
        <div class="horiz-bar-item">
          <div class="horiz-bar-label"><span>${f.name}</span><span>${done}/${total} (${pct}%)</span></div>
          <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%;background:${col}"></div></div>
        </div>`;
    }).join('');
    setHTML('report-platform-bars', platBars || emptyState('No facility data'));

    // Request status breakdown
    const statMap    = { open: 0, in_progress: 0, completed: 0 };
    requests.forEach(r => { if (r.status in statMap) statMap[r.status]++; });
    const sMax       = Math.max(...Object.values(statMap), 1);
    const sColors    = { open: 'var(--red)', in_progress: 'var(--amber)', completed: 'var(--accent)' };
    setHTML('report-status-bars', Object.entries(statMap).map(([k, v]) => `
      <div class="horiz-bar-item">
        <div class="horiz-bar-label">
          <span style="text-transform:capitalize">${k.replace('_', ' ')}</span><span>${v}</span>
        </div>
        <div class="prog-wrap">
          <div class="prog-fill" style="width:${Math.round(v / sMax * 100)}%;background:${sColors[k]}"></div>
        </div>
      </div>`).join(''));

    // Running hours bar chart
    const maxH = Math.max(..._equipment.map(e => e.totalMRH || 0), 1);
    setHTML('report-hours-bar', `
      <div class="bar-chart-wrap">
        ${_equipment.map(e => `
          <div class="bar-col">
            <div class="bar-val">${Math.round((e.totalMRH || 0) / 1000 * 10) / 10}k</div>
            <div class="bar-rect" style="height:${Math.round((e.totalMRH || 0) / maxH * 70)}px;background:var(--accent);opacity:.8"></div>
            <div class="bar-label">${(e.name || '').split(' ')[0]}</div>
          </div>`).join('')}
      </div>`);

    // Priority bar chart
    const priMap    = { high: 0, medium: 0, low: 0 };
    requests.forEach(r => { if (r.priority in priMap) priMap[r.priority]++; });
    const pMax      = Math.max(...Object.values(priMap), 1);
    const pColors   = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--blue)' };
    setHTML('report-priority-bar', `
      <div class="bar-chart-wrap">
        ${Object.entries(priMap).map(([k, v]) => `
          <div class="bar-col">
            <div class="bar-val">${v}</div>
            <div class="bar-rect" style="height:${Math.round(v / pMax * 70)}px;background:${pColors[k]}"></div>
            <div class="bar-label" style="text-transform:capitalize">${k}</div>
          </div>`).join('')}
      </div>`);

  } catch (e) { console.error(e); toast('Failed to load reports', 'error'); }
}
