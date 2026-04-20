/**
 * Tekora — js/pages/dashboard.js
 * Dashboard page: stat tiles, recent requests, PMS progress, charts
 */
"use strict";

async function loadDashboard() {
  await loadCaches();
  try {
    const [reqs, pmsSnap] = await Promise.all([
      db.collection('requests').orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('pms_schedules').where('scheduledDate', '==', today()).get(),
    ]);
    const requests  = reqs.docs.map(d => ({ id: d.id, ...d.data() }));
    const todayPMS  = pmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const donePMS   = todayPMS.filter(p => p.status === 'completed');
    const pct       = todayPMS.length ? Math.round(donePMS.length / todayPMS.length * 100) : 0;
    const openCount = requests.filter(r => r.status === 'open').length;
    const totalHours = _equipment.reduce((a, e) => a + (e.currentMRH || e.totalMRH || 0), 0);

    setHTML('dash-stats', `
      <div class="stat">
        <div class="stat-accent" style="background:var(--accent)"></div>
        <div class="stat-head">
          <div class="stat-label">Facilities</div>
          <div class="stat-icon" style="background:var(--accent-dim);color:var(--accent)">
            ${icon('icon-facilities', '15px')}
          </div>
        </div>
        <div class="stat-value">${_facilities.filter(f => f.state !== 'Decommissioned').length}</div>
        <div class="stat-meta">${_facilities.length} total registered</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--blue)"></div>
        <div class="stat-head">
          <div class="stat-label">Equipment</div>
          <div class="stat-icon" style="background:var(--blue-dim);color:var(--blue)">
            ${icon('icon-equipment', '15px')}
          </div>
        </div>
        <div class="stat-value">${_equipment.length}</div>
        <div class="stat-meta">${totalHours.toLocaleString()} total MRH</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--red)"></div>
        <div class="stat-head">
          <div class="stat-label">Open Requests</div>
          <div class="stat-icon" style="background:var(--red-dim);color:var(--red)">
            ${icon('icon-alert', '15px')}
          </div>
        </div>
        <div class="stat-value">${openCount}</div>
        <div class="stat-meta">${requests.filter(r => r.status === 'in_progress').length} in progress</div>
      </div>
      <div class="stat">
        <div class="stat-accent" style="background:var(--amber)"></div>
        <div class="stat-head">
          <div class="stat-label">PMS Today</div>
          <div class="stat-icon" style="background:var(--amber-dim);color:var(--amber)">
            ${icon('icon-pms', '15px')}
          </div>
        </div>
        <div class="stat-value">${donePMS.length}<span style="font-size:16px;font-weight:400;color:var(--text3)">/${todayPMS.length}</span></div>
        <div class="stat-meta">${pct}% complete</div>
      </div>
    `);

    const recentHTML = requests.slice(0, 5).map(r => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div class="td-primary" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.code || r.title || 'Untitled'}</div>
          <div class="td-secondary">${getFacilityName(r.facilityId)} · ${getEquipName(r.equipmentId)}</div>
        </div>
        ${priorityBadge(r.priority)}
      </div>`).join('');
    setHTML('dash-recent-reqs', recentHTML || emptyState('No requests yet'));

    const progColor = pct === 100 ? 'var(--accent)' : pct > 50 ? 'var(--amber)' : 'var(--red)';
    let pmsHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;font-weight:600">${donePMS.length} / ${todayPMS.length} tasks complete</span>
        <span class="mono" style="color:${progColor};font-size:12px;font-weight:700">${pct}%</span>
      </div>
      <div class="prog-wrap" style="margin-bottom:14px">
        <div class="prog-fill" style="width:${pct}%;background:${progColor}"></div>
      </div>`;
    pmsHTML += todayPMS.slice(0, 4).map(p => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="width:7px;height:7px;border-radius:50%;background:${p.status === 'completed' ? 'var(--accent)' : 'var(--surface3)'}"></div>
        <div style="flex:1;font-size:12px;font-weight:500">${getActivityName(p.activityId)}</div>
        ${statusBadge(p.status)}
      </div>`).join('');
    setHTML('dash-pms-summary', pmsHTML || emptyState('No PMS scheduled today'));

    // Running hours bar chart
    const mList = _equipment.slice(0, 6);
    const maxH  = Math.max(...mList.map(m => m.currentMRH || m.totalMRH || 0), 1);
    setHTML('dash-hours-chart', `
      <div class="bar-chart-wrap">
        ${mList.map(m => `
          <div class="bar-col">
            <div class="bar-val">${(m.currentMRH || 0).toLocaleString()}</div>
            <div class="bar-rect" style="height:${Math.round((m.currentMRH || 0) / maxH * 70)}px;background:var(--accent);opacity:.75"></div>
            <div class="bar-label">${(m.name || '').split(' ')[0]}</div>
          </div>`).join('')}
      </div>`);

    // Priority bar chart
    const priMap = { high: 0, medium: 0, low: 0 };
    requests.forEach(r => { if (r.priority in priMap) priMap[r.priority]++; });
    const maxP = Math.max(...Object.values(priMap), 1);
    const priColors = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--blue)' };
    setHTML('dash-priority-chart', `
      <div class="bar-chart-wrap">
        ${Object.entries(priMap).map(([k, v]) => `
          <div class="bar-col">
            <div class="bar-val">${v}</div>
            <div class="bar-rect" style="height:${Math.round(v / maxP * 70)}px;background:${priColors[k]}"></div>
            <div class="bar-label" style="text-transform:capitalize">${k}</div>
          </div>`).join('')}
      </div>`);

  } catch (e) { console.error(e); toast('Failed to load dashboard', 'error'); }
}
