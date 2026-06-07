import { supabase } from './supabaseClient.js';
import * as XLSX from 'xlsx';

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const DEFAULT_CRITERIA = [
  'การตรงต่อเวลา',
  'การรักษาเวลาในการทำกิจกรรม',
  'การให้ความร่วมมือในกิจกรรมกลุ่ม',
  'การมีส่วนร่วมและการแสดงความคิดเห็น',
  'ภาวะความเป็นผู้นำ',
  'ความรับผิดชอบต่อหน้าที่ที่ได้รับมอบหมาย'
];

const DEFAULT_ACTIVITIES = [
  'ประชุมสภานักเรียน',
  'กิจกรรมพิเศษ',
  'กิจกรรมแถว',
  'กิจกรรมควบคุมละหมาด',
  'กิจกรรมวันครู'
];

const state = {
  settings: {},
  departments: [],
  members: [],
  activities: [],
  events: [],
  eventParticipants: [],
  attendance: [],
  evaluations: [],
  evalCriteria: DEFAULT_CRITERIA.slice(),
  campaigns: [],
  certificates: [],
  currentView: 'home',
  eventCategory: 'all',
  eventSearch: '',
  memberSearch: '',
  memberDept: '',
  memberGender: '',
  admin: null,
  member: null,
  loginCandidate: null,
  importRows: [],
  charts: {
    home: null,
    profile: null
  }
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  restoreSessions();
  startBootLoader();
  await loadData();
  renderAll();
  hideBootLoader();
}

async function loadData() {
  try {
    const [settings, departments, members, activities, attendance, evaluations, events, eventParticipants, campaigns, certificates] = await Promise.all([
      safeSelect('council_settings', '*'),
      safeSelect('council_departments', '*', { order: ['id', true] }),
      safeSelect('council_members', '*', { order: ['fullname', true] }),
      safeSelect('council_activities', '*', { order: ['id', true] }),
      safeSelect('council_attendance', '*'),
      safeSelect('council_evaluation', '*'),
      safeSelect('council_events', '*', { order: ['event_date', false] }),
      safeSelect('council_event_participants', '*'),
      safeSelect('council_cert_campaigns', '*', { order: ['id', false] }),
      safeSelect('council_certificates', '*')
    ]);

    state.settings = Object.fromEntries((settings || []).map((row) => [row.key, row.value]));
    state.departments = departments || [];
    state.activities = activities?.length ? activities : DEFAULT_ACTIVITIES.map((activity_name, index) => ({
      id: index + 1,
      activity_name,
      is_active: true
    }));
    state.attendance = attendance || [];
    state.evaluations = evaluations || [];
    state.events = events || [];
    state.eventParticipants = eventParticipants || [];
    state.campaigns = campaigns || [];
    state.certificates = certificates || [];

    if (state.settings.evalCriteria) {
      try {
        const parsed = JSON.parse(state.settings.evalCriteria);
        if (Array.isArray(parsed) && parsed.length) state.evalCriteria = parsed;
      } catch {
        state.evalCriteria = DEFAULT_CRITERIA.slice();
      }
    }

    state.members = (members || []).map((member) => {
      const dept = state.departments.find((d) => String(d.id) === String(member.department_id));
      return {
        ...member,
        department_name: dept?.name_th || 'ไม่ระบุฝ่าย'
      };
    });
  } catch (error) {
    console.error(error);
    toast('danger', `โหลดข้อมูลล้มเหลว: ${error.message}`);
  }
}

async function safeSelect(table, columns, options = {}) {
  try {
    let query = supabase.from(table).select(columns);
    if (options.order) {
      const [column, ascending] = options.order;
      query = query.order(column, { ascending });
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`${table}: ${error.message}`);
      return [];
    }
    return data || [];
  } catch (error) {
    console.warn(`${table}: ${error.message}`);
    return [];
  }
}

function restoreSessions() {
  try {
    state.admin = JSON.parse(localStorage.getItem('depaz_admin_session') || 'null');
    state.member = JSON.parse(localStorage.getItem('depaz_member_session') || 'null');
  } catch {
    state.admin = null;
    state.member = null;
  }
}

function renderAll() {
  renderShell();
  renderHome();
  renderMembers();
  renderEvents();
  renderAdmin();
  renderProfile();
  populateSelects();
  showView(state.currentView);
}

function renderShell() {
  const siteName = state.settings.siteName || 'ระบบจัดการสภานักเรียน';
  const schoolName = state.settings.schoolName || 'โรงเรียนมูลนิธิอาซิซสถาน';

  document.title = `DEPAZ — ${siteName}`;
  setText('sidebarTitle', 'DEPAZ');
  setText('mobileTitle', 'DEPAZ');
  setText('heroSchoolName', schoolName);
  setText('heroTitle', siteName);
  setText('bootSchoolName', 'DEPAZ');
  setText('footerText', state.settings.footerText || '© ระบบสภานักเรียน DEPAZ');

  const adminInfo = $('sidebarAdminInfo');
  const adminName = $('sidebarAdminName');
  const adminLabel = $('sidebarAdminLabel');
  const memberBadge = $('mobileUserBadge');
  const mobileAdminLabel = $('mobileAdminTabLabel');

  adminInfo?.classList.toggle('hidden', !state.admin);
  setText(adminName, state.admin?.username || '');
  setText(adminLabel, state.admin ? 'ออกจากแอดมิน' : 'เข้าสู่ระบบแอดมิน');
  setText(mobileAdminLabel, state.admin ? 'แอดมิน' : 'เข้าสู่ระบบ');

  if (memberBadge) {
    memberBadge.classList.toggle('hidden', !state.member);
    memberBadge.textContent = state.member?.fullname || '';
  }

  ['btnAddMember', 'memberImportBar', 'btnAddEvent'].forEach((id) => {
    $(id)?.classList.toggle('hidden', !state.admin);
  });
}

function showView(view) {
  const allowed = ['home', 'events', 'members', 'profile', 'admin'];
  const next = allowed.includes(view) ? view : 'home';
  state.currentView = next;

  $$('.view-section').forEach((section) => section.classList.add('hidden'));
  $(`view-${next}`)?.classList.remove('hidden');

  $$('.snav-btn, .mnav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === next);
  });

  if (next === 'admin' && !state.admin) {
    showView('home');
    void adminLogin();
    return;
  }

  if (next === 'profile') renderProfile();
  if (next === 'admin') renderAdmin();
}

function renderHome() {
  const totalMembers = state.members.length;
  const totalDepartments = state.departments.length;
  const totalEvents = state.events.length;
  const attendancePct = averageAttendancePct();

  const stats = [
    ['สมาชิก', totalMembers, 'fa-users', 'text-pink-600'],
    ['ฝ่ายสภา', totalDepartments, 'fa-sitemap', 'text-violet-600'],
    ['กิจกรรม', totalEvents, 'fa-calendar-days', 'text-amber-600'],
    ['เข้าเฉลี่ย', `${attendancePct}%`, 'fa-chart-line', 'text-emerald-600']
  ];

  const container = $('homeStats');
  if (container) {
    container.innerHTML = stats.map(([label, value, icon, color]) => `
      <div class="stat-card">
        <div class="stat-icon ${color}"><i class="fa-solid ${icon}"></i></div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    `).join('');
  }

  const recent = $('recentEvents');
  if (recent) {
    const rows = state.events.slice(0, 5);
    recent.innerHTML = rows.length ? rows.map((event) => `
      <button class="w-full text-left px-4 py-3 hover:bg-pink-50/60 transition event-open" data-id="${event.id}">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-extrabold text-gray-800">${escapeHtml(event.title)}</p>
            <p class="text-[10px] text-gray-400 font-bold mt-0.5">${formatDate(event.event_date)} · ${escapeHtml(event.category || 'กิจกรรมสภา')}</p>
          </div>
          <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
        </div>
      </button>
    `).join('') : emptyState('ยังไม่มีกิจกรรมล่าสุด');
  }

  renderHomeChart();
}

function renderHomeChart() {
  const container = $('homeChart');
  if (!container || typeof ApexCharts === 'undefined') return;

  const rows = state.departments.map((dept) => {
    const members = state.members.filter((m) => String(m.department_id) === String(dept.id));
    const values = members.map((m) => memberAttendance(m.id).percent).filter((value) => value !== null);
    const percent = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    return { name: dept.name_th, percent, count: values.length };
  }).filter((row) => row.count > 0);

  if (!rows.length) {
    container.innerHTML = emptyState('ยังไม่มีข้อมูลการเช็คชื่อ');
    return;
  }

  state.charts.home?.destroy();
  state.charts.home = new ApexCharts(container, {
    series: [{ name: '% เข้าร่วม', data: rows.map((row) => row.percent) }],
    chart: { type: 'bar', height: Math.max(210, rows.length * 34), toolbar: { show: false }, fontFamily: 'Sarabun, sans-serif' },
    plotOptions: { bar: { horizontal: true, borderRadius: 7, distributed: true } },
    colors: ['#D81B60', '#7C3AED', '#10B981', '#F59E0B', '#3B82F6'],
    dataLabels: { enabled: true, formatter: (value) => `${value}%` },
    xaxis: { max: 100, categories: rows.map((row) => compact(row.name, 18)) },
    grid: { borderColor: '#F3F4F6' }
  });
  state.charts.home.render();
}

function renderMembers() {
  const rows = filteredMembers();
  const tbody = $('memberTbody');
  const cards = $('memberCardList');

  if (tbody) {
    tbody.innerHTML = rows.length ? rows.map((member, index) => {
      const att = memberAttendance(member.id);
      return `
        <tr class="hover:bg-pink-50/40 transition">
          <td class="px-4 py-3 text-center text-gray-400 font-bold">${index + 1}</td>
          <td class="px-4 py-3 font-extrabold text-gray-700">${escapeHtml(member.student_code || '')}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
              ${avatar(member, 'w-9 h-9')}
              <div>
                <p class="font-extrabold text-gray-800">${escapeHtml(member.fullname || '')}</p>
                <p class="text-[10px] text-gray-400 font-bold">${getGender(member.fullname)}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 font-bold text-gray-600">${escapeHtml(member.class_name || '')}</td>
          <td class="px-4 py-3"><span class="dept-badge">${escapeHtml(member.department_name)}</span></td>
          <td class="px-4 py-3 text-right ${att.className}">${att.label}</td>
          <td class="px-4 py-3 text-center">
            ${state.admin ? rowActions(member.id) : '<span class="text-[10px] text-gray-400 font-bold">ล็อค</span>'}
          </td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="py-12 text-center text-gray-400 text-xs font-bold">ยังไม่มีรายชื่อสมาชิก</td></tr>`;
  }

  if (cards) {
    cards.innerHTML = rows.length ? rows.map((member) => {
      const att = memberAttendance(member.id);
      return `
        <div class="member-card">
          ${avatar(member, 'member-avatar')}
          <div class="min-w-0 flex-1">
            <p class="font-extrabold text-sm text-gray-800 truncate">${escapeHtml(member.fullname || '')}</p>
            <p class="text-[10px] text-gray-400 font-bold">${escapeHtml(member.student_code || '')} · ${escapeHtml(member.class_name || '')}</p>
            <span class="dept-badge mt-1">${escapeHtml(member.department_name)}</span>
          </div>
          <div class="text-right">
            <p class="${att.className} text-sm">${att.label}</p>
            ${state.admin ? `<div class="mt-1 flex gap-1">${rowActions(member.id, true)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('') : emptyState('ยังไม่มีรายชื่อสมาชิก');
  }

  populateMemberFilters();
}

function filteredMembers() {
  const search = state.memberSearch.toLowerCase();
  return state.members.filter((member) => {
    const text = `${member.student_code || ''} ${member.fullname || ''} ${member.class_name || ''} ${member.department_name || ''}`.toLowerCase();
    if (search && !text.includes(search)) return false;
    if (state.memberDept && String(member.department_id) !== String(state.memberDept)) return false;
    if (state.memberGender && getGender(member.fullname) !== state.memberGender) return false;
    return true;
  });
}

function renderEvents() {
  const events = filteredEvents();
  const grid = $('eventsGrid');
  const empty = $('eventsEmpty');

  if (grid) {
    grid.innerHTML = events.map((event) => eventCard(event)).join('');
  }
  empty?.classList.toggle('hidden', events.length > 0);
  renderAdminEventsList();
}

function filteredEvents() {
  const search = state.eventSearch.toLowerCase();
  return state.events.filter((event) => {
    const text = `${event.title || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
    if (state.eventCategory !== 'all' && event.category !== state.eventCategory) return false;
    if (search && !text.includes(search)) return false;
    return true;
  });
}

function eventCard(event) {
  const dept = state.departments.find((d) => String(d.id) === String(event.department_id));
  const participants = participantsForEvent(event.id);
  const image = event.image_url || 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80';
  return `
    <article class="event-card">
      <button class="block w-full text-left event-open" data-id="${event.id}">
        <img class="event-card-img" src="${escapeAttr(image)}" alt="">
        <div class="event-card-body">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="dept-badge">${escapeHtml(event.category || 'กิจกรรมสภา')}</span>
            <span class="text-[10px] text-gray-400 font-bold">${formatDate(event.event_date)}</span>
          </div>
          <h3 class="event-card-title">${escapeHtml(event.title || '')}</h3>
          <p class="event-card-desc">${escapeHtml(event.description || 'ไม่มีรายละเอียด')}</p>
          <p class="text-[10px] text-gray-400 font-bold mt-3">
            <i class="fa-solid fa-location-dot mr-1"></i>${escapeHtml(event.location || 'ไม่ระบุสถานที่')}
            ${dept ? ` · ${escapeHtml(dept.name_th)}` : ''}
          </p>
          <p class="text-[10px] text-pink-600 font-extrabold mt-2">${participants.length} คนเข้าร่วม</p>
        </div>
      </button>
    </article>
  `;
}

function renderAdmin() {
  const stats = $('adminStats');
  if (stats) {
    stats.innerHTML = [
      ['สมาชิก', state.members.length, 'fa-users'],
      ['กิจกรรม', state.events.length, 'fa-calendar-days'],
      ['เช็คชื่อ', state.attendance.length, 'fa-clipboard-check'],
      ['ประเมิน', state.evaluations.length, 'fa-star']
    ].map(([label, value, icon]) => `
      <div class="stat-card">
        <div class="stat-icon text-pink-600"><i class="fa-solid ${icon}"></i></div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    `).join('');
  }

  renderAdminEventsList();
  renderAdminActivitiesList();
  renderAdminCriteriaList();
  renderAdminCampaignsList();
  fillSettingsForm();
}

function renderAdminEventsList() {
  const container = $('adminEventsList');
  if (!container) return;

  container.innerHTML = state.events.length ? state.events.map((event) => `
    <div class="admin-row">
      <div class="min-w-0">
        <p class="admin-row-label truncate">${escapeHtml(event.title)}</p>
        <p class="text-[10px] text-gray-400 font-bold">${formatDate(event.event_date)} · ${escapeHtml(event.category || '')}</p>
      </div>
      <div class="flex items-center gap-1">
        <button class="action-btn-sm bg-pink-50 text-pink-700 event-edit" data-id="${event.id}">แก้</button>
        <button class="btn-del-row event-delete" data-id="${event.id}">ลบ</button>
      </div>
    </div>
  `).join('') : emptyState('ยังไม่มีกิจกรรม');
}

function renderAdminActivitiesList() {
  const container = $('adminActivitiesList');
  if (!container) return;
  container.innerHTML = state.activities.map((activity) => `
    <div class="admin-row">
      <span class="admin-row-label">${escapeHtml(activity.activity_name)}</span>
      <button class="btn-del-row activity-delete" data-id="${activity.id}">ลบ</button>
    </div>
  `).join('');
}

function renderAdminCriteriaList() {
  const container = $('adminCriteriaList');
  if (!container) return;
  container.innerHTML = state.evalCriteria.map((name, index) => `
    <div class="admin-row">
      <span class="admin-row-label">${escapeHtml(name)}</span>
      <button class="btn-del-row criteria-delete" data-index="${index}">ลบ</button>
    </div>
  `).join('');
}

function renderAdminCampaignsList() {
  const container = $('adminCampaignsList');
  if (!container) return;
  container.innerHTML = state.campaigns.length ? state.campaigns.map((c) => `
    <div class="admin-row">
      <div class="min-w-0">
        <p class="admin-row-label truncate">${escapeHtml(c.name)}</p>
        <p class="text-[10px] text-gray-400 font-bold">${c.type === 'activity' ? 'การเข้าร่วมกิจกรรม' : 'การปฏิบัติหน้าที่'}</p>
      </div>
      <div class="flex items-center gap-1">
        <button class="action-btn-sm bg-pink-50 text-pink-700 campaign-edit" data-id="${c.id}">แก้</button>
        <button class="btn-del-row campaign-delete" data-id="${c.id}">ลบ</button>
      </div>
    </div>
  `).join('') : emptyState('ยังไม่มีแคมเปญเกียรติบัตร');
}

function openCampaignModal(id = null) {
  if (!state.admin) return;
  const c = id ? state.campaigns.find((x) => String(x.id) === String(id)) : null;
  setValue('campaignId', c?.id || '');
  setValue('campaignName', c?.name || '');
  setValue('campaignType', c?.type || 'activity');
  setValue('campaignDesc', c?.description || '');
  setValue('campaignTemplateUrl', c?.template_url || '');
  setText('campaignModalTitle', c ? 'แก้ไขแคมเปญ' : 'เพิ่มแคมเปญเกียรติบัตร');
  $('campaignTemplatePreview').src = c?.template_url || '';
  $('campaignTemplatePreview').classList.toggle('hidden', !c?.template_url);
  showModal('campaignModal');
}

function closeCampaignModal() { hideModal('campaignModal'); }

async function submitCampaign(event) {
  event.preventDefault();
  if (!state.admin) return;
  const id = $('campaignId')?.value || null;
  const payload = {
    name: $('campaignName')?.value.trim(),
    type: $('campaignType')?.value,
    description: $('campaignDesc')?.value.trim(),
    template_url: $('campaignTemplateUrl')?.value.trim()
  };
  if (!payload.name) return toast('warning', 'กรุณากรอกชื่อแคมเปญ');
  const result = id
    ? await supabase.from('council_cert_campaigns').update(payload).eq('id', id)
    : await supabase.from('council_cert_campaigns').insert(payload);
  if (result.error) return toast('danger', result.error.message);
  closeCampaignModal();
  toast('success', 'บันทึกแคมเปญแล้ว');
  await reloadAndRender();
}

async function deleteCampaignById(id) {
  if (!state.admin || !confirm('ยืนยันลบแคมเปญนี้? เกียรติบัตรที่ออกไปแล้วจะถูกลบด้วย')) return;
  const { error } = await supabase.from('council_cert_campaigns').delete().eq('id', id);
  if (error) return toast('danger', error.message);
  toast('success', 'ลบแคมเปญแล้ว');
  await reloadAndRender();
}

async function uploadCertTemplate(file) {
  const ext = file.name.split('.').pop();
  const fileName = `template_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('cert-templates').upload(fileName, file, { upsert: true });
  if (error) return toast('danger', `อัปโหลดไม่สำเร็จ: ${error.message}`);
  const { data } = supabase.storage.from('cert-templates').getPublicUrl(fileName);
  setValue('campaignTemplateUrl', data.publicUrl);
  $('campaignTemplatePreview').src = data.publicUrl;
  $('campaignTemplatePreview').classList.remove('hidden');
  toast('success', 'อัปโหลด template แล้ว');
}

// ── Admin Issue Certificates ────────────────────────────────────────

function openAdminCertModal() {
  if (!state.admin) return toast('warning', 'กรุณาเข้าสู่ระบบแอดมินก่อน');
  if (!state.campaigns.length) return toast('warning', 'กรุณาเพิ่มแคมเปญเกียรติบัตรในหน้าตั้งค่าก่อน');
  const select = $('certCampaignSelect');
  if (select) {
    select.innerHTML = state.campaigns.map((c) =>
      `<option value="${c.id}">${escapeHtml(c.name)} · ${c.type === 'activity' ? 'กิจกรรม' : 'หน้าที่'}</option>`
    ).join('');
  }
  setValue('certFilterMode', 'manual');
  renderCertMemberPicker();
  showModal('adminCertModal');
}

function renderCertMemberPicker() {
  const mode = $('certFilterMode')?.value || 'manual';
  const threshold = Number($('certAttThreshold')?.value || 0);
  const evalLevel = $('certEvalLevel')?.value || '';
  $('certAttRow')?.classList.toggle('hidden', mode !== 'attendance');
  $('certAttRow')?.classList.toggle('flex', mode === 'attendance');
  $('certEvalRow')?.classList.toggle('hidden', mode !== 'evaluation');
  $('certEvalRow')?.classList.toggle('flex', mode === 'evaluation');

  const alreadyIssued = new Set(
    state.certificates
      .filter((c) => String(c.campaign_id) === String($('certCampaignSelect')?.value))
      .map((c) => String(c.member_id))
  );

  let members = state.members;
  if (mode === 'attendance') {
    members = members.filter((m) => {
      const att = memberAttendance(m.id);
      return att.percent !== null && att.percent >= threshold;
    });
  } else if (mode === 'evaluation') {
    const levels = { 'ดีมาก': 4, 'ดี': 3, 'พอใช้': 2, 'ไม่ผ่าน': 1 };
    const minLevel = levels[evalLevel] || 0;
    members = members.filter((m) => {
      const evals = state.evaluations.filter((e) => String(e.member_id) === String(m.id));
      return evals.some((e) => (levels[e.level] || 0) >= minLevel);
    });
  }

  const container = $('certMemberPicker');
  if (!container) return;
  container.innerHTML = members.map((m) => {
    const hasAlready = alreadyIssued.has(String(m.id));
    return `
      <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer ${hasAlready ? 'opacity-50' : ''}">
        <input type="checkbox" class="cert-member-check accent-pink-600" value="${m.id}" ${mode !== 'manual' ? 'checked' : ''} ${hasAlready ? 'disabled' : ''}>
        ${avatar(m, 'w-7 h-7')}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(m.fullname)}</p>
          <p class="text-[10px] text-gray-400">${escapeHtml(m.class_name || '')} · ${escapeHtml(m.department_name)}</p>
        </div>
        ${hasAlready ? '<span class="text-[10px] text-emerald-600 font-bold shrink-0">ออกแล้ว</span>' : ''}
      </label>
    `;
  }).join('') || emptyState('ไม่พบสมาชิกที่ตรงเงื่อนไข');

  const count = container.querySelectorAll('input:checked:not(:disabled)').length;
  setText('certSelectedCount', count);
  setText('certSelectedCount2', count);
}

async function issueCertificates() {
  if (!state.admin) return;
  const campaignId = Number($('certCampaignSelect')?.value);
  if (!campaignId) return toast('warning', 'กรุณาเลือกแคมเปญ');
  const checked = $$('#certMemberPicker .cert-member-check:checked:not(:disabled)');
  if (!checked.length) return toast('warning', 'ยังไม่ได้เลือกสมาชิก');
  const rows = checked.map((input) => ({ member_id: Number(input.value), campaign_id: campaignId }));
  const { error } = await supabase.from('council_certificates').upsert(rows, { onConflict: 'member_id,campaign_id' });
  if (error) return toast('danger', error.message);
  hideModal('adminCertModal');
  toast('success', `ออกเกียรติบัตร ${rows.length} ใบแล้ว`);
  await reloadAndRender();
}

function renderProfile() {
  const guest = $('profileGuest');
  const dashboard = $('profileDashboard');
  const member = currentMember();

  guest?.classList.toggle('hidden', !!member);
  dashboard?.classList.toggle('hidden', !member);

  if (!member) return;

  setText('profileDept', member.department_name || 'ฝ่ายสภา');
  setText('profileName', member.fullname || '');
  setText('profileClass', member.class_name || '');
  setText('profileCode', member.student_code || '');
  setText('profileStatus', member.status === 'inactive' ? 'พักสถานะ' : 'สมาชิกสภา');

  const photo = $('profilePhoto');
  const initial = $('profileInitial');
  if (photo && initial) {
    photo.classList.toggle('hidden', !member.image_url);
    initial.classList.toggle('hidden', !!member.image_url);
    photo.src = member.image_url || '';
    initial.textContent = initials(member.fullname);
  }

  const att = memberAttendance(member.id);
  const participantEvents = eventsForMember(member.id);
  const evaluated = state.evaluations.filter((row) => String(row.member_id) === String(member.id)).length;

  $('profileStats').innerHTML = [
    ['เข้าเฉลี่ย', att.label],
    ['กิจกรรม', participantEvents.length],
    ['ประเมิน', evaluated]
  ].map(([label, value]) => `
    <div class="stat-card">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');

  renderProfileChart(att.percent || 0);
  renderProfileHistory(member.id);
  renderProfileEvents(participantEvents);
  renderProfileCerts(member.id);
}

function renderProfileCerts(memberId) {
  const container = $('profileCerts');
  const empty = $('profileCertsEmpty');
  if (!container) return;
  const myCerts = state.certificates.filter((c) => String(c.member_id) === String(memberId));
  if (!myCerts.length) {
    container.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  container.innerHTML = myCerts.map((c) => {
    const campaign = state.campaigns.find((x) => String(x.id) === String(c.campaign_id));
    if (!campaign) return '';
    return `
      <button class="cert-gallery-card cert-open" data-member-id="${memberId}" data-campaign-id="${campaign.id}">
        <div class="cert-gallery-thumb" style="${campaign.template_url ? `background-image:url('${escapeAttr(campaign.template_url)}')` : ''}">
          <i class="fa-solid fa-award text-2xl text-pink-300 ${campaign.template_url ? 'hidden' : ''}"></i>
        </div>
        <div class="cert-gallery-info">
          <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(campaign.name)}</p>
          <p class="text-[10px] text-gray-400">${campaign.type === 'activity' ? 'การเข้าร่วมกิจกรรม' : 'การปฏิบัติหน้าที่'} · ${formatDate(c.issued_at)}</p>
        </div>
      </button>
    `;
  }).join('');
}

function renderProfileChart(percent) {
  const container = $('profileChart');
  if (!container || typeof ApexCharts === 'undefined') return;
  state.charts.profile?.destroy();
  state.charts.profile = new ApexCharts(container, {
    series: [Math.round(percent)],
    chart: { type: 'radialBar', height: 220, toolbar: { show: false } },
    colors: ['#D81B60'],
    plotOptions: { radialBar: { hollow: { size: '62%' }, dataLabels: { name: { show: false }, value: { formatter: (v) => `${v}%` } } } }
  });
  state.charts.profile.render();
}

function renderProfileHistory(memberId) {
  const rows = state.attendance
    .filter((row) => String(row.member_id) === String(memberId))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const container = $('profileHistory');
  if (!container) return;
  container.innerHTML = rows.length ? rows.map((row) => {
    const activity = state.activities.find((a) => String(a.id) === String(row.activity_id));
    const present = row.status === 'present';
    return `
      <div class="px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-extrabold text-gray-800">${escapeHtml(activity?.activity_name || 'กิจกรรม')}</p>
          <p class="text-[10px] text-gray-400 font-bold">${formatDate(row.date)} ${row.remark ? `· ${escapeHtml(row.remark)}` : ''}</p>
        </div>
        <span class="text-[10px] font-extrabold ${present ? 'text-emerald-600' : 'text-rose-600'}">${present ? 'เข้าร่วม' : 'ไม่เข้าร่วม'}</span>
      </div>
    `;
  }).join('') : emptyState('ยังไม่มีประวัติการเข้าร่วม');
}

function renderProfileEvents(events) {
  const container = $('profileEvents');
  const empty = $('profileEventsEmpty');
  if (!container) return;
  container.innerHTML = events.map((event) => `
    <button class="w-full text-left px-4 py-3 hover:bg-pink-50/50 event-open" data-id="${event.id}">
      <p class="text-xs font-extrabold text-gray-800">${escapeHtml(event.title)}</p>
      <p class="text-[10px] text-gray-400 font-bold">${formatDate(event.event_date)} · ${escapeHtml(event.category || '')}</p>
    </button>
  `).join('');
  empty?.classList.toggle('hidden', events.length > 0);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-view]');
    if (routeButton) showView(routeButton.dataset.view);

    const openEventButton = event.target.closest('.event-open');
    if (openEventButton) openEventDetail(openEventButton.dataset.id);

    const editMember = event.target.closest('.member-edit');
    if (editMember) openMemberModal(editMember.dataset.id);

    const deleteMember = event.target.closest('.member-delete');
    if (deleteMember) void deleteMemberById(deleteMember.dataset.id);

    const editEvent = event.target.closest('.event-edit');
    if (editEvent) openEventModal(editEvent.dataset.id);

    const deleteEvent = event.target.closest('.event-delete');
    if (deleteEvent) void deleteEventById(deleteEvent.dataset.id);

    const deleteActivity = event.target.closest('.activity-delete');
    if (deleteActivity) void deleteActivityById(deleteActivity.dataset.id);

    const deleteCriteria = event.target.closest('.criteria-delete');
    if (deleteCriteria) void deleteCriteriaByIndex(Number(deleteCriteria.dataset.index));

    const editCampaign = event.target.closest('.campaign-edit');
    if (editCampaign) openCampaignModal(editCampaign.dataset.id);

    const deleteCampaign = event.target.closest('.campaign-delete');
    if (deleteCampaign) void deleteCampaignById(deleteCampaign.dataset.id);

    const openCert = event.target.closest('.cert-open');
    if (openCert) {
      const m = state.members.find((x) => String(x.id) === String(openCert.dataset.memberId));
      const campaign = state.campaigns.find((x) => String(x.id) === String(openCert.dataset.campaignId));
      if (m && campaign) {
        const cert = state.certificates.find((c) => String(c.member_id) === String(m.id) && String(c.campaign_id) === String(campaign.id));
        if (cert?.file_url) {
          window.open(cert.file_url, '_blank');
        } else {
          renderCertSheet(m, campaign.type, campaign);
          $('certPrintArea')?.classList.remove('hidden');
        }
      }
    }
  });

  $('sidebarAdminBtn')?.addEventListener('click', () => state.admin ? adminLogout() : adminLogin());
  $('mobileAdminTab')?.addEventListener('click', (event) => {
    if (!state.admin) {
      event.preventDefault();
      void adminLogin();
    }
  });
  $('mobileMemberBtn')?.addEventListener('click', () => showView('profile'));

  $('memberSearch')?.addEventListener('input', (event) => {
    state.memberSearch = event.target.value.trim();
    renderMembers();
  });
  $('memberDeptFilter')?.addEventListener('change', (event) => {
    state.memberDept = event.target.value;
    renderMembers();
  });
  $('memberGenderFilter')?.addEventListener('change', (event) => {
    state.memberGender = event.target.value;
    renderMembers();
  });

  $('eventSearch')?.addEventListener('input', (event) => {
    state.eventSearch = event.target.value.trim();
    renderEvents();
  });
  $('eventFilters')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-cat]');
    if (!chip) return;
    state.eventCategory = chip.dataset.cat;
    $$('#eventFilters [data-cat]').forEach((button) => button.classList.toggle('active', button === chip));
    renderEvents();
  });

  $('btnAddMember')?.addEventListener('click', () => openMemberModal());
  $('btnAddMemberAdmin')?.addEventListener('click', () => openMemberModal());
  $('btnAddEvent')?.addEventListener('click', () => openEventModal());
  $('btnAddEventAdmin')?.addEventListener('click', () => openEventModal());
  $('btnAttendanceAdmin')?.addEventListener('click', openAttendanceModal);
  $('btnEvaluationAdmin')?.addEventListener('click', openEvaluationModal);
  $('btnAdminLogout2')?.addEventListener('click', adminLogout);

  $('memberModalClose')?.addEventListener('click', closeMemberModal);
  $('memberModalCancel')?.addEventListener('click', closeMemberModal);
  $('memberModal')?.addEventListener('click', (event) => event.target.id === 'memberModal' && closeMemberModal());
  $('memberForm')?.addEventListener('submit', submitMember);
  $('btnLookupStudent')?.addEventListener('click', lookupStudent);
  $('studentCodeInput')?.addEventListener('blur', lookupStudent);

  $('eventModalClose')?.addEventListener('click', closeEventModal);
  $('eventModalCancel')?.addEventListener('click', closeEventModal);
  $('eventModal')?.addEventListener('click', (event) => event.target.id === 'eventModal' && closeEventModal());
  $('eventForm')?.addEventListener('submit', submitEvent);
  $('eventDetailClose')?.addEventListener('click', closeEventDetail);
  $('eventDetailModal')?.addEventListener('click', (event) => event.target.id === 'eventDetailModal' && closeEventDetail());

  $('attModalClose')?.addEventListener('click', closeAttendanceModal);
  $('attModalCancel')?.addEventListener('click', closeAttendanceModal);
  $('attendanceModal')?.addEventListener('click', (event) => event.target.id === 'attendanceModal' && closeAttendanceModal());
  $('attendanceForm')?.addEventListener('submit', submitAttendance);
  $('attDeptFilter')?.addEventListener('change', renderAttendanceMemberList);
  $('btnCheckAll')?.addEventListener('click', () => $$('#attendanceMemberList .att-status[data-status="present"]').forEach((button) => selectAttendance(button)));
  $('btnUncheckAll')?.addEventListener('click', () => $$('#attendanceMemberList .att-status[data-status="absent"]').forEach((button) => selectAttendance(button)));
  $('attendanceMemberList')?.addEventListener('click', (event) => {
    const button = event.target.closest('.att-status');
    if (button) selectAttendance(button);
  });

  $('evalModalClose')?.addEventListener('click', closeEvaluationModal);
  $('evalModalCancel')?.addEventListener('click', closeEvaluationModal);
  $('evaluationModal')?.addEventListener('click', (event) => event.target.id === 'evaluationModal' && closeEvaluationModal());
  $('evaluationForm')?.addEventListener('submit', submitEvaluation);
  $('evalDeptFilter')?.addEventListener('change', renderEvaluationMemberList);
  $('evaluationMemberList')?.addEventListener('click', (event) => {
    const button = event.target.closest('.eval-status');
    if (button) selectEvaluation(button);
  });

  $('memberLoginCode')?.addEventListener('blur', previewMemberByCode);
  $('memberLoginCode')?.addEventListener('input', () => {
    if (!$('memberLoginCode').value.trim()) hideMemberLoginPreview();
  });
  $('btnMemberLoginNext')?.addEventListener('click', startMemberLogin);
  $('btnMemberLoginSubmit')?.addEventListener('click', submitMemberLogin);
  $('btnMemberSetPass')?.addEventListener('click', submitMemberPasswordSetup);
  $('btnMemberLogout')?.addEventListener('click', memberLogout);
  $('togglePassVis')?.addEventListener('click', togglePasswordVisibility);
  $('btnDownloadCert')?.addEventListener('click', renderCertificate);

  $('toggleSettings')?.addEventListener('click', () => togglePanel('settingsPanel', 'settingsChevron'));
  $('toggleTelegram')?.addEventListener('click', () => togglePanel('telegramPanel', 'telegramChevron'));
  $('btnSaveSystem')?.addEventListener('click', saveSystemSettings);
  $('btnSaveTelegram')?.addEventListener('click', saveTelegramSettings);
  $('btnAddActivity')?.addEventListener('click', addActivity);
  $('btnAddCriteria')?.addEventListener('click', addCriteria);
  $('btnExportMembersExcel')?.addEventListener('click', exportMembers);
  $('btnExportExcelAdmin')?.addEventListener('click', exportMembers);
  $('btnExportAttAdmin')?.addEventListener('click', exportAttendance);
  $('btnCertAdmin')?.addEventListener('click', openAdminCertModal);
  $('adminCertModalClose')?.addEventListener('click', () => hideModal('adminCertModal'));
  $('adminCertModalCancel')?.addEventListener('click', () => hideModal('adminCertModal'));
  $('adminCertModal')?.addEventListener('click', (event) => event.target.id === 'adminCertModal' && hideModal('adminCertModal'));
  $('btnIssueCerts')?.addEventListener('click', issueCertificates);
  $('certFilterMode')?.addEventListener('change', renderCertMemberPicker);
  $('certCampaignSelect')?.addEventListener('change', renderCertMemberPicker);
  $('certAttThreshold')?.addEventListener('input', renderCertMemberPicker);
  $('certEvalLevel')?.addEventListener('change', renderCertMemberPicker);
  $('certMemberPicker')?.addEventListener('change', (event) => {
    if (event.target.classList.contains('cert-member-check')) {
      const count = $$('#certMemberPicker .cert-member-check:checked:not(:disabled)').length;
      setText('certSelectedCount', count);
      setText('certSelectedCount2', count);
    }
  });

  $('btnAddCampaign')?.addEventListener('click', () => openCampaignModal());
  $('campaignModalClose')?.addEventListener('click', closeCampaignModal);
  $('campaignModalCancel')?.addEventListener('click', closeCampaignModal);
  $('campaignModal')?.addEventListener('click', (event) => event.target.id === 'campaignModal' && closeCampaignModal());
  $('campaignForm')?.addEventListener('submit', submitCampaign);
  $('campaignTemplateFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) void uploadCertTemplate(file);
    event.target.value = '';
  });

  $('importFileInput')?.addEventListener('change', handleImportFile);
  $('importFileInputAdmin')?.addEventListener('change', handleImportFile);
  $('importModalClose')?.addEventListener('click', closeImportModal);
  $('importModalCancel')?.addEventListener('click', closeImportModal);
  $('importModalConfirm')?.addEventListener('click', confirmImport);
}

function openMemberModal(id = null) {
  if (!state.admin) return toast('warning', 'กรุณาเข้าสู่ระบบแอดมินก่อน');
  const member = id ? state.members.find((m) => String(m.id) === String(id)) : null;
  $('memberForm')?.reset();
  setValue('memberId', member?.id || '');
  setValue('studentCodeInput', member?.student_code || '');
  setValue('fullnameInput', member?.fullname || '');
  setValue('classNameInput', member?.class_name || '');
  setValue('departmentInput', member?.department_id || '');
  setText('memberModalTitle', member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก');
  updateStudentPhoto(member?.image_url || '', member?.student_code || '');
  showModal('memberModal');
}

function closeMemberModal() {
  hideModal('memberModal');
}

async function lookupStudent() {
  const code = $('studentCodeInput')?.value.trim();
  if (!code) return;

  const existing = state.members.find((member) => String(member.student_code) === String(code) && String(member.id) !== String($('memberId')?.value));
  if (existing) {
    setText('studentInfoText', `มีในสภาแล้ว: ${existing.fullname}`);
    updateStudentPhoto(existing.image_url, code);
    return;
  }

  setText('studentInfoText', 'กำลังค้นประวัติ...');
  const { data, error } = await supabase.from('school_students').select('*').eq('student_code', code).maybeSingle();
  if (!error && data) {
    setValue('fullnameInput', data.fullname || '');
    setValue('classNameInput', data.class_name || '');
    updateStudentPhoto(data.image_url || studentImageUrl(code), code);
    setText('studentInfoText', `พบข้อมูล: ${data.fullname}`);
    return;
  }

  updateStudentPhoto(studentImageUrl(code), code);
  setText('studentInfoText', 'ไม่พบในทะเบียน สามารถกรอกเองได้');
}

async function submitMember(event) {
  event.preventDefault();
  if (!state.admin) return;

  const id = $('memberId')?.value || null;
  const student_code = $('studentCodeInput')?.value.trim();
  const payload = {
    student_code,
    fullname: $('fullnameInput')?.value.trim(),
    class_name: $('classNameInput')?.value.trim(),
    department_id: Number($('departmentInput')?.value),
    image_url: studentImageUrl(student_code),
    status: 'active'
  };

  const result = id
    ? await supabase.from('council_members').update(payload).eq('id', id)
    : await supabase.from('council_members').insert(payload);

  if (result.error) return toast('danger', result.error.message);

  closeMemberModal();
  toast('success', 'บันทึกสมาชิกเรียบร้อย');
  await reloadAndRender();
}

async function deleteMemberById(id) {
  if (!state.admin || !confirm('ยืนยันลบสมาชิกนี้?')) return;
  const { error } = await supabase.from('council_members').delete().eq('id', id);
  if (error) return toast('danger', error.message);
  toast('success', 'ลบสมาชิกเรียบร้อย');
  await reloadAndRender();
}

function openEventModal(id = null) {
  if (!state.admin) return toast('warning', 'กรุณาเข้าสู่ระบบแอดมินก่อน');
  const event = id ? state.events.find((row) => String(row.id) === String(id)) : null;
  $('eventForm')?.reset();
  setValue('eventId', event?.id || '');
  setValue('evTitle', event?.title || '');
  setValue('evCategory', event?.category || 'กิจกรรมสภา');
  setValue('evDate', event?.event_date || today());
  setValue('evLocation', event?.location || '');
  setValue('evDept', event?.department_id || '');
  setValue('evDesc', event?.description || '');
  setValue('evImage', event?.image_url || '');
  setText('eventModalTitle', event ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม');
  renderParticipantPicker(event?.id);
  showModal('eventModal');
}

function closeEventModal() {
  hideModal('eventModal');
}

async function submitEvent(event) {
  event.preventDefault();
  if (!state.admin) return;

  const id = $('eventId')?.value || null;
  const payload = {
    title: $('evTitle')?.value.trim(),
    category: $('evCategory')?.value,
    event_date: $('evDate')?.value,
    location: $('evLocation')?.value.trim(),
    department_id: $('evDept')?.value ? Number($('evDept').value) : null,
    description: $('evDesc')?.value.trim(),
    image_url: $('evImage')?.value.trim(),
    status: 'published'
  };

  const result = id
    ? await supabase.from('council_events').update(payload).eq('id', id).select().single()
    : await supabase.from('council_events').insert(payload).select().single();

  if (result.error) return toast('danger', `${result.error.message} — ถ้ายังไม่ได้รัน migration_v2.sql ให้รันก่อน`);

  const eventId = id || result.data.id;
  await supabase.from('council_event_participants').delete().eq('event_id', eventId);
  const participants = $$('#evParticipants input:checked').map((input) => ({
    event_id: Number(eventId),
    member_id: Number(input.value),
    role: 'participant'
  }));
  if (participants.length) {
    const { error } = await supabase.from('council_event_participants').insert(participants);
    if (error) return toast('danger', error.message);
  }

  closeEventModal();
  toast('success', 'บันทึกกิจกรรมเรียบร้อย');
  await reloadAndRender();
}

async function deleteEventById(id) {
  if (!state.admin || !confirm('ยืนยันลบกิจกรรมนี้?')) return;
  const { error } = await supabase.from('council_events').delete().eq('id', id);
  if (error) return toast('danger', error.message);
  toast('success', 'ลบกิจกรรมเรียบร้อย');
  await reloadAndRender();
}

function openEventDetail(id) {
  const event = state.events.find((row) => String(row.id) === String(id));
  if (!event) return;
  const dept = state.departments.find((row) => String(row.id) === String(event.department_id));
  const participants = participantsForEvent(id);
  const image = event.image_url || 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80';

  $('eventDetailContent').innerHTML = `
    <img src="${escapeAttr(image)}" class="w-full h-56 object-cover" alt="">
    <div class="p-5">
      <div class="flex flex-wrap gap-2 mb-3">
        <span class="dept-badge">${escapeHtml(event.category || 'กิจกรรมสภา')}</span>
        <span class="dept-badge">${formatDate(event.event_date)}</span>
      </div>
      <h3 class="text-xl font-black text-gray-900 mb-2">${escapeHtml(event.title || '')}</h3>
      <p class="text-sm text-gray-600 font-semibold leading-7">${escapeHtml(event.description || 'ไม่มีรายละเอียด')}</p>
      <div class="mt-4 text-xs text-gray-500 font-bold space-y-1">
        <p><i class="fa-solid fa-location-dot w-4 text-pink-500"></i>${escapeHtml(event.location || 'ไม่ระบุสถานที่')}</p>
        <p><i class="fa-solid fa-sitemap w-4 text-pink-500"></i>${escapeHtml(dept?.name_th || 'ไม่ระบุฝ่าย')}</p>
        <p><i class="fa-solid fa-users w-4 text-pink-500"></i>${participants.length} คนเข้าร่วม</p>
      </div>
      <div class="mt-4 max-h-36 overflow-y-auto space-y-1">
        ${participants.length ? participants.map((member) => `<div class="text-[11px] font-bold text-gray-600 bg-gray-50 rounded-lg px-3 py-2">${escapeHtml(member.fullname)} · ${escapeHtml(member.class_name || '')}</div>`).join('') : '<p class="text-xs text-gray-400 font-bold">ยังไม่ได้ระบุผู้เข้าร่วม</p>'}
      </div>
    </div>
  `;
  showModal('eventDetailModal');
}

function closeEventDetail() {
  hideModal('eventDetailModal');
}

function openAttendanceModal() {
  if (!state.admin) return toast('warning', 'กรุณาเข้าสู่ระบบแอดมินก่อน');
  setValue('attDateInput', $('attDateInput')?.value || today());
  renderAttendanceMemberList();
  showModal('attendanceModal');
}

function closeAttendanceModal() {
  hideModal('attendanceModal');
}

function renderAttendanceMemberList() {
  const dept = $('attDeptFilter')?.value || '';
  const members = state.members.filter((member) => !dept || String(member.department_id) === String(dept));
  const container = $('attendanceMemberList');
  if (!container) return;
  container.innerHTML = members.map((member) => `
    <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div class="flex items-center gap-3">
        ${avatar(member, 'w-9 h-9')}
        <div>
          <p class="text-xs font-extrabold text-gray-800">${escapeHtml(member.fullname)}</p>
          <p class="text-[10px] text-gray-400 font-bold">${escapeHtml(member.class_name || '')} · ${escapeHtml(member.department_name)}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="att-status action-btn-sm bg-gray-100 text-gray-600" data-member-id="${member.id}" data-status="present">เข้าร่วม</button>
        <button type="button" class="att-status action-btn-sm bg-gray-100 text-gray-600" data-member-id="${member.id}" data-status="absent">ไม่เข้า</button>
        <input class="att-remark input-field py-1 text-xs w-36" data-member-id="${member.id}" placeholder="หมายเหตุ">
      </div>
    </div>
  `).join('');
}

function selectAttendance(button) {
  const memberId = button.dataset.memberId;
  $$(`.att-status[data-member-id="${memberId}"]`).forEach((item) => {
    item.classList.remove('bg-emerald-600', 'bg-rose-600', 'text-white');
    item.classList.add('bg-gray-100', 'text-gray-600');
  });
  button.classList.remove('bg-gray-100', 'text-gray-600');
  button.classList.add(button.dataset.status === 'present' ? 'bg-emerald-600' : 'bg-rose-600', 'text-white');
}

async function submitAttendance(event) {
  event.preventDefault();
  if (!state.admin) return;
  const rows = $$('#attendanceMemberList .att-status.text-white').map((button) => {
    const memberId = Number(button.dataset.memberId);
    return {
      member_id: memberId,
      date: $('attDateInput').value,
      activity_id: Number($('attActivitySelect').value),
      status: button.dataset.status,
      remark: $(`attendanceMemberList`)?.querySelector(`.att-remark[data-member-id="${memberId}"]`)?.value.trim() || ''
    };
  });
  if (!rows.length) return toast('warning', 'ยังไม่ได้เลือกสถานะสมาชิก');
  const { error } = await supabase.from('council_attendance').upsert(rows, { onConflict: 'member_id,date,activity_id' });
  if (error) return toast('danger', error.message);
  closeAttendanceModal();
  toast('success', 'บันทึกเช็คชื่อเรียบร้อย');
  await reloadAndRender();
}

function openEvaluationModal() {
  if (!state.admin) return toast('warning', 'กรุณาเข้าสู่ระบบแอดมินก่อน');
  renderEvaluationMemberList();
  showModal('evaluationModal');
}

function closeEvaluationModal() {
  hideModal('evaluationModal');
}

function renderEvaluationMemberList() {
  const dept = $('evalDeptFilter')?.value || '';
  const members = state.members.filter((member) => !dept || String(member.department_id) === String(dept));
  const container = $('evaluationMemberList');
  if (!container) return;
  container.innerHTML = members.map((member) => `
    <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div class="flex items-center gap-3">
        ${avatar(member, 'w-9 h-9')}
        <div>
          <p class="text-xs font-extrabold text-gray-800">${escapeHtml(member.fullname)}</p>
          <p class="text-[10px] text-gray-400 font-bold">${escapeHtml(member.class_name || '')} · ${escapeHtml(member.department_name)}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        ${['ดีมาก', 'ดี', 'พอใช้', 'ไม่ผ่าน'].map((level) => `<button type="button" class="eval-status action-btn-sm bg-gray-100 text-gray-600" data-member-id="${member.id}" data-level="${level}">${level}</button>`).join('')}
        <input class="eval-remark input-field py-1 text-xs w-36" data-member-id="${member.id}" placeholder="หมายเหตุ">
      </div>
    </div>
  `).join('');
}

function selectEvaluation(button) {
  const memberId = button.dataset.memberId;
  $$(`.eval-status[data-member-id="${memberId}"]`).forEach((item) => {
    item.classList.remove('bg-emerald-600', 'bg-teal-600', 'bg-amber-500', 'bg-rose-600', 'text-white');
    item.classList.add('bg-gray-100', 'text-gray-600');
  });
  const cls = { 'ดีมาก': 'bg-emerald-600', 'ดี': 'bg-teal-600', 'พอใช้': 'bg-amber-500', 'ไม่ผ่าน': 'bg-rose-600' }[button.dataset.level];
  button.classList.remove('bg-gray-100', 'text-gray-600');
  button.classList.add(cls, 'text-white');
}

async function submitEvaluation(event) {
  event.preventDefault();
  if (!state.admin) return;
  const criteria = $('evalCriteriaSelect').value;
  const rows = $$('#evaluationMemberList .eval-status.text-white').map((button) => {
    const memberId = Number(button.dataset.memberId);
    return {
      member_id: memberId,
      criteria,
      level: button.dataset.level,
      remark: $('evaluationMemberList')?.querySelector(`.eval-remark[data-member-id="${memberId}"]`)?.value.trim() || ''
    };
  });
  if (!rows.length) return toast('warning', 'ยังไม่ได้เลือกระดับประเมิน');
  const { error } = await supabase.from('council_evaluation').upsert(rows, { onConflict: 'member_id,criteria' });
  if (error) return toast('danger', error.message);
  closeEvaluationModal();
  toast('success', 'บันทึกประเมินเรียบร้อย');
  await reloadAndRender();
}

async function adminLogin() {
  const result = await Swal.fire({
    title: 'เข้าสู่ระบบแอดมิน',
    html: '<input id="adminUser" class="swal2-input" placeholder="Username"><input id="adminPass" type="password" class="swal2-input" placeholder="Password">',
    showCancelButton: true,
    confirmButtonText: 'เข้าสู่ระบบ',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => ({
      username: document.getElementById('adminUser').value.trim(),
      password: document.getElementById('adminPass').value
    })
  });
  if (!result.value) return;
  const { username, password } = result.value;
  const { data, error } = await supabase.from('council_admin').select('*').eq('username', username).eq('password', password).maybeSingle();
  if (error || !data) return toast('danger', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  state.admin = { id: data.id, username: data.username };
  localStorage.setItem('depaz_admin_session', JSON.stringify(state.admin));
  toast('success', 'เข้าสู่ระบบแอดมินแล้ว');
  renderAll();
  showView('admin');
}

function adminLogout() {
  state.admin = null;
  localStorage.removeItem('depaz_admin_session');
  toast('info', 'ออกจากระบบแอดมินแล้ว');
  renderAll();
  showView('home');
}

async function startMemberLogin() {
  const code = $('memberLoginCode')?.value.trim();
  if (!code) return toast('warning', 'กรุณากรอกรหัสนักเรียน');
  const member = state.members.find((row) => String(row.student_code) === String(code));
  if (!member) return toast('danger', 'ไม่พบรหัสนี้ในรายชื่อสมาชิกสภา');
  state.loginCandidate = member;
  const hasPassword = !!member.password;
  $('memberPasswordRow')?.classList.toggle('hidden', !hasPassword);
  $('memberNewPassRow')?.classList.toggle('hidden', hasPassword);
  $('btnMemberLoginNext')?.classList.add('hidden');
  $('btnMemberLoginSubmit')?.classList.toggle('hidden', !hasPassword);
  $('btnMemberSetPass')?.classList.toggle('hidden', hasPassword);
}

async function submitMemberLogin() {
  const password = $('memberLoginPass')?.value || '';
  if (!state.loginCandidate || password !== state.loginCandidate.password) return toast('danger', 'รหัสผ่านไม่ถูกต้อง');
  loginAsMember(state.loginCandidate);
}

async function submitMemberPasswordSetup() {
  const password = $('memberNewPass')?.value || '';
  if (!state.loginCandidate || password.length < 4) return toast('warning', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  const { error } = await supabase.from('council_members').update({ password }).eq('id', state.loginCandidate.id);
  if (error) return toast('danger', `${error.message} — ถ้ายังไม่มีคอลัมน์ password ให้รัน migration_v2.sql`);
  state.loginCandidate.password = password;
  loginAsMember(state.loginCandidate);
}

function loginAsMember(member) {
  state.member = { id: member.id, student_code: member.student_code, fullname: member.fullname };
  localStorage.setItem('depaz_member_session', JSON.stringify(state.member));
  resetMemberLoginForm();
  toast('success', 'เข้าสู่พื้นที่ส่วนตัวแล้ว');
  renderAll();
  showView('profile');
}

function memberLogout() {
  state.member = null;
  localStorage.removeItem('depaz_member_session');
  resetMemberLoginForm();
  renderAll();
}

function resetMemberLoginForm() {
  state.loginCandidate = null;
  $('memberLoginCode').value = '';
  $('memberLoginPass').value = '';
  $('memberNewPass').value = '';
  $('memberPasswordRow')?.classList.add('hidden');
  $('memberNewPassRow')?.classList.add('hidden');
  $('btnMemberLoginNext')?.classList.remove('hidden');
  $('btnMemberLoginSubmit')?.classList.add('hidden');
  $('btnMemberSetPass')?.classList.add('hidden');
  hideMemberLoginPreview();
}

function hideMemberLoginPreview() {
  $('memberLoginPreview')?.classList.add('hidden');
}

function previewMemberByCode() {
  const code = $('memberLoginCode')?.value.trim();
  if (!code) return hideMemberLoginPreview();
  const member = state.members.find((m) => String(m.student_code) === String(code));
  if (!member) return hideMemberLoginPreview();
  const preview = $('memberLoginPreview');
  const img = $('memberLoginPreviewImg');
  const name = $('memberLoginPreviewName');
  const cls = $('memberLoginPreviewClass');
  if (!preview) return;
  if (img) {
    img.src = member.image_url || '';
    img.onerror = () => { img.src = ''; img.classList.add('bg-pink-100'); };
  }
  if (name) name.textContent = member.fullname || '';
  if (cls) cls.textContent = member.class_name || '';
  preview.classList.remove('hidden');
}

function togglePasswordVisibility() {
  const input = $('memberLoginPass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function renderCertificate() {
  const member = currentMember();
  if (!member) return;
  renderCertSheet(member, 'activity');
  $('certPrintArea')?.classList.remove('hidden');
}


function renderCertSheet(member, type, campaign = null) {
  const schoolName = state.settings.schoolName || 'โรงเรียนมูลนิธิอาซิซสถาน';
  const templateUrl = campaign?.template_url || '';
  const att = memberAttendance(member.id);
  const evaluations = state.evaluations.filter((e) => String(e.member_id) === String(member.id));
  const events = eventsForMember(member.id);

  let certSubtitle, bodyText, listHtml;

  if (type === 'activity') {
    certSubtitle = 'เกียรติบัตรการเข้าร่วมกิจกรรมสภานักเรียน';
    bodyText = 'ได้เข้าร่วมกิจกรรมสภานักเรียน ดังต่อไปนี้';
    listHtml = events.length
      ? events.map((e) => `<div>• ${escapeHtml(e.title)} <span style="color:#9CA3AF;font-size:0.85em">(${formatDate(e.event_date)})</span></div>`).join('')
      : '<div>• ยังไม่มีรายการกิจกรรมที่บันทึกไว้</div>';
  } else {
    certSubtitle = 'เกียรติบัตรการปฏิบัติหน้าที่สภานักเรียน';
    bodyText = 'ได้ปฏิบัติหน้าที่สมาชิกสภานักเรียนด้วยความรับผิดชอบ';
    const evalRows = evaluations.length
      ? evaluations.map((e) => `<div>• ${escapeHtml(e.criteria)}: <strong>${escapeHtml(e.level)}</strong>${e.remark ? ` — ${escapeHtml(e.remark)}` : ''}</div>`).join('')
      : '<div>• ยังไม่มีข้อมูลการประเมิน</div>';
    listHtml = `
      <div style="margin-bottom:0.5rem"><strong>อัตราการเข้าร่วมกิจกรรม:</strong> ${att.label}</div>
      <div style="margin-bottom:0.5rem"><strong>ผลการประเมินสมรรถนะ:</strong></div>
      ${evalRows}
    `;
  }

  const bgStyle = templateUrl
    ? `style="background-image:url('${escapeAttr(templateUrl)}');background-size:cover;background-position:center;"`
    : '';

  $('certSheet').innerHTML = `
    <div class="cert-sheet-inner" ${bgStyle}>
      <div class="cert-title">CERTIFICATE</div>
      <div class="cert-subtitle">${certSubtitle}</div>
      <div class="cert-body">
        ขอรับรองว่า
        <span class="cert-name">${escapeHtml(member.fullname)}</span>
        ชั้น ${escapeHtml(member.class_name || '-')} · รหัส ${escapeHtml(member.student_code || '-')} · ${escapeHtml(member.department_name || '')}
        <br>${bodyText}
      </div>
      <div class="cert-list">${listHtml}</div>
      <div class="cert-sigs">
        <div class="cert-sig"><div class="cert-sig-line"></div><div class="cert-sig-name">ฝ่ายกิจการนักเรียน</div><div class="cert-sig-title">ผู้รับรอง</div></div>
        <div class="cert-sig"><div class="cert-sig-line"></div><div class="cert-sig-name">${escapeHtml(schoolName)}</div><div class="cert-sig-title">หน่วยงาน</div></div>
      </div>
      <div class="cert-seal"><i class="fa-solid fa-award"></i></div>
    </div>
  `;
}

window.closeCertificate = function closeCertificate() {
  $('certPrintArea')?.classList.add('hidden');
};

async function saveSystemSettings() {
  const rows = [
    ['siteName', $('settingSiteName')?.value.trim()],
    ['footerText', $('settingFooter')?.value.trim()],
    ['logoUrl', $('settingLogoUrl')?.value.trim()],
    ['schoolName', $('settingSchoolName')?.value.trim()]
  ].map(([key, value]) => ({ key, value: value || '' }));
  const { error } = await supabase.from('council_settings').upsert(rows, { onConflict: 'key' });
  if (error) return toast('danger', error.message);
  toast('success', 'บันทึกตั้งค่าระบบแล้ว');
  await reloadAndRender();
}

async function saveTelegramSettings() {
  const { error } = await supabase.from('council_settings').upsert({ key: 'telegramChatId', value: $('settingTelegramChatId')?.value.trim() || '' }, { onConflict: 'key' });
  if (error) return toast('danger', error.message);
  toast('success', 'บันทึก Telegram แล้ว');
  await reloadAndRender();
}

async function addActivity() {
  const input = $('newActivityInput');
  const name = input?.value.trim();
  if (!name) return;
  const { error } = await supabase.from('council_activities').insert({ activity_name: name, is_active: true });
  if (error) return toast('danger', error.message);
  input.value = '';
  toast('success', 'เพิ่มประเภทกิจกรรมแล้ว');
  await reloadAndRender();
}

async function deleteActivityById(id) {
  const { error } = await supabase.from('council_activities').delete().eq('id', id);
  if (error) return toast('danger', error.message);
  await reloadAndRender();
}

async function addCriteria() {
  const input = $('newCriteriaInput');
  const name = input?.value.trim();
  if (!name) return;
  state.evalCriteria.push(name);
  input.value = '';
  await saveCriteria();
}

async function deleteCriteriaByIndex(index) {
  state.evalCriteria.splice(index, 1);
  await saveCriteria();
}

async function saveCriteria() {
  const { error } = await supabase.from('council_settings').upsert({ key: 'evalCriteria', value: JSON.stringify(state.evalCriteria) }, { onConflict: 'key' });
  if (error) return toast('danger', error.message);
  toast('success', 'บันทึกเกณฑ์ประเมินแล้ว');
  await reloadAndRender();
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const data = new Uint8Array(loadEvent.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    state.importRows = rows.map(normalizeImportRow).filter((row) => row.student_code && row.fullname);
    renderImportPreview();
    showModal('importModal');
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function normalizeImportRow(row) {
  const student_code = String(row.student_code || row.code || row['รหัส'] || row['รหัสนักเรียน'] || '').trim();
  const fullname = String(row.fullname || row.name || row['ชื่อ-นามสกุล'] || row['ชื่อ'] || '').trim();
  const class_name = String(row.class_name || row.class || row['ชั้น'] || '').trim();
  const deptText = String(row.department_id || row.department || row['ฝ่าย'] || '').trim();
  const dept = state.departments.find((d) => String(d.id) === deptText || d.name_th === deptText);
  return {
    student_code,
    fullname,
    class_name,
    department_id: dept?.id || (Number(deptText) || null),
    image_url: studentImageUrl(student_code),
    status: 'active'
  };
}

function renderImportPreview() {
  setText('importCount', state.importRows.length);
  $('importPreviewBody').innerHTML = state.importRows.slice(0, 50).map((row) => {
    const dept = state.departments.find((d) => String(d.id) === String(row.department_id));
    return `
      <tr>
        <td class="px-3 py-2 font-bold">${escapeHtml(row.student_code)}</td>
        <td class="px-3 py-2">${escapeHtml(row.fullname)}</td>
        <td class="px-3 py-2">${escapeHtml(row.class_name)}</td>
        <td class="px-3 py-2">${escapeHtml(dept?.name_th || row.department_id || '')}</td>
      </tr>
    `;
  }).join('');
}

async function confirmImport() {
  if (!state.importRows.length) return;
  const { error } = await supabase.from('council_members').upsert(state.importRows, { onConflict: 'student_code' });
  if (error) return toast('danger', error.message);
  closeImportModal();
  toast('success', `นำเข้า ${state.importRows.length} รายการแล้ว`);
  await reloadAndRender();
}

function closeImportModal() {
  state.importRows = [];
  hideModal('importModal');
}

function exportMembers() {
  const rows = state.members.map((member, index) => ({
    '#': index + 1,
    'รหัสนักเรียน': member.student_code,
    'ชื่อ-นามสกุล': member.fullname,
    'ชั้น': member.class_name,
    'ฝ่าย': member.department_name,
    'เพศ': getGender(member.fullname),
    '% เข้าร่วม': memberAttendance(member.id).label
  }));
  writeWorkbook(rows, `DEPAZ_members_${today()}.xlsx`, 'members');
}

function exportAttendance() {
  const rows = state.attendance.map((row) => {
    const member = state.members.find((m) => String(m.id) === String(row.member_id));
    const activity = state.activities.find((a) => String(a.id) === String(row.activity_id));
    return {
      วันที่: row.date,
      รหัส: member?.student_code || '',
      สมาชิก: member?.fullname || row.member_id,
      กิจกรรม: activity?.activity_name || row.activity_id,
      สถานะ: row.status === 'present' ? 'เข้าร่วม' : 'ไม่เข้าร่วม',
      หมายเหตุ: row.remark || ''
    };
  });
  writeWorkbook(rows, `DEPAZ_attendance_${today()}.xlsx`, 'attendance');
}

function writeWorkbook(rows, filename, sheetName) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function populateSelects() {
  populateMemberFilters();
  fillSelect('departmentInput', state.departments, 'id', 'name_th', '- เลือกฝ่าย -');
  fillSelect('evDept', state.departments, 'id', 'name_th', 'ไม่ระบุ');
  fillSelect('attDeptFilter', state.departments, 'id', 'name_th', 'ทุกฝ่าย');
  fillSelect('evalDeptFilter', state.departments, 'id', 'name_th', 'ทุกฝ่าย');
  fillSelect('attActivitySelect', state.activities, 'id', 'activity_name');
  const evalSelect = $('evalCriteriaSelect');
  if (evalSelect) evalSelect.innerHTML = state.evalCriteria.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join('');
}

function populateMemberFilters() {
  const select = $('memberDeptFilter');
  if (!select) return;
  const current = select.value || state.memberDept;
  fillSelect('memberDeptFilter', state.departments, 'id', 'name_th', 'ทุกฝ่าย');
  select.value = current;
}

function fillSettingsForm() {
  setValue('settingSiteName', state.settings.siteName || '');
  setValue('settingFooter', state.settings.footerText || '');
  setValue('settingLogoUrl', state.settings.logoUrl || '');
  setValue('settingSchoolName', state.settings.schoolName || 'โรงเรียนมูลนิธิอาซิซสถาน');
  setValue('settingTelegramChatId', state.settings.telegramChatId || '');
}

function renderParticipantPicker(eventId) {
  const selected = new Set(state.eventParticipants.filter((row) => String(row.event_id) === String(eventId)).map((row) => String(row.member_id)));
  const container = $('evParticipants');
  if (!container) return;
  container.innerHTML = state.members.map((member) => `
    <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white text-xs font-bold text-gray-600">
      <input type="checkbox" value="${member.id}" ${selected.has(String(member.id)) ? 'checked' : ''}>
      <span>${escapeHtml(member.fullname)} <span class="text-gray-400">(${escapeHtml(member.class_name || '')})</span></span>
    </label>
  `).join('');
}

function fillSelect(id, rows, valueKey, labelKey, placeholder = '') {
  const select = $(id);
  if (!select) return;
  select.innerHTML = `${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}${rows.map((row) => `<option value="${escapeAttr(row[valueKey])}">${escapeHtml(row[labelKey])}</option>`).join('')}`;
}

function memberAttendance(memberId) {
  const rows = state.attendance.filter((row) => String(row.member_id) === String(memberId));
  if (!rows.length) return { percent: null, label: '-', className: 'att-pct-none' };
  const present = rows.filter((row) => row.status === 'present').length;
  const percent = (present / rows.length) * 100;
  return {
    percent,
    label: `${Math.round(percent)}%`,
    className: percent >= 80 ? 'att-pct-high' : percent >= 50 ? 'att-pct-mid' : 'att-pct-low'
  };
}

function averageAttendancePct() {
  const values = state.members.map((member) => memberAttendance(member.id).percent).filter((value) => value !== null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

function participantsForEvent(eventId) {
  const ids = new Set(state.eventParticipants.filter((row) => String(row.event_id) === String(eventId)).map((row) => String(row.member_id)));
  return state.members.filter((member) => ids.has(String(member.id)));
}

function eventsForMember(memberId) {
  const ids = new Set(state.eventParticipants.filter((row) => String(row.member_id) === String(memberId)).map((row) => String(row.event_id)));
  return state.events.filter((event) => ids.has(String(event.id)));
}

function currentMember() {
  if (!state.member) return null;
  return state.members.find((member) => String(member.id) === String(state.member.id)) || null;
}

function rowActions(id, compactMode = false) {
  const labelEdit = compactMode ? '<i class="fa-solid fa-pen"></i>' : '<i class="fa-solid fa-pen mr-1"></i>แก้';
  const labelDelete = compactMode ? '<i class="fa-solid fa-trash"></i>' : '<i class="fa-solid fa-trash mr-1"></i>ลบ';
  return `
    <button class="action-btn-sm bg-pink-50 text-pink-700 member-edit" data-id="${id}">${labelEdit}</button>
    <button class="action-btn-sm bg-rose-50 text-rose-700 member-delete" data-id="${id}">${labelDelete}</button>
  `;
}

function avatar(member, className) {
  if (member.image_url) return `<img src="${escapeAttr(member.image_url)}" class="${className} rounded-full object-cover border border-white shadow-sm" alt="">`;
  return `<div class="${className} member-avatar-initials rounded-full">${escapeHtml(initials(member.fullname))}</div>`;
}

function updateStudentPhoto(imageUrl, code) {
  const img = $('studentImagePreview');
  const ph = $('studentImagePlaceholder');
  const src = imageUrl || (code ? studentImageUrl(code) : '');
  if (!img || !ph) return;
  img.src = src;
  img.classList.toggle('hidden', !src);
  ph.classList.toggle('hidden', !!src);
}

function showModal(id) {
  $(id)?.classList.remove('hidden');
  $(id)?.classList.add('flex');
}

function hideModal(id) {
  $(id)?.classList.add('hidden');
  $(id)?.classList.remove('flex');
}

function togglePanel(panelId, chevronId) {
  const panel = $(panelId);
  panel?.classList.toggle('hidden');
  $(chevronId)?.classList.toggle('rotate-180');
}

async function reloadAndRender() {
  await loadData();
  renderAll();
}

function startBootLoader() {
  const bar = $('bootBar');
  const label = $('bootLabel');
  if (bar) bar.style.width = '35%';
  setText(label, 'กำลังโหลดข้อมูล...');
}

function hideBootLoader() {
  const bar = $('bootBar');
  if (bar) bar.style.width = '100%';
  setText('bootLabel', 'พร้อมใช้งาน');
  setTimeout(() => $('bootSplash')?.classList.add('hidden'), 180);
}

function toast(type, message) {
  const container = $('alertContainer');
  if (!container) return;
  const icons = { success: 'fa-circle-check', danger: 'fa-triangle-exclamation', warning: 'fa-circle-exclamation', info: 'fa-circle-info' };
  const node = document.createElement('div');
  node.className = `toast-alert t-${type}`;
  node.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function setText(target, value) {
  const node = typeof target === 'string' ? $(target) : target;
  if (node) node.textContent = value;
}

function setValue(id, value) {
  const node = $(id);
  if (node) node.value = value ?? '';
}

function emptyState(text) {
  return `<div class="py-8 text-center text-xs text-gray-400 font-bold">${escapeHtml(text)}</div>`;
}

function getGender(fullname = '') {
  const name = fullname.trim();
  if (/^(ด\.ญ\.|น\.ส\.|นางสาว|เด็กหญิง)/.test(name)) return 'หญิง';
  if (/^(ด\.ช\.|นาย|เด็กชาย)/.test(name)) return 'ชาย';
  return 'ไม่ระบุ';
}

function initials(name = '') {
  return name.replace(/^(ด\.ญ\.|น\.ส\.|ด\.ช\.|นาย|เด็กชาย|เด็กหญิง|นางสาว)/, '').trim().charAt(0) || '?';
}

function compact(text = '', max = 16) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function studentImageUrl(code) {
  return code ? `https://azizstan.net/student_image/${code}.jpg` : '';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}
