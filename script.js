// --- 1. CONFIG & STATE ---
const API_URL = 'https://script.google.com/macros/s/AKfycbzhCtD1L2XnMYW_Lz3dayQwA-8OyvIiHYoH7yFvWKjbfx7SBHp3Ugos9Xw9QADP17B-sg/exec';

let dbUsers = [], allTasks = [], allAtt = [], allMsgs = [], allMeets = [], allReqs = [], allNotes = [], allTimeLogs = [], allProjects = [];
let currentUser = null, curSubmitId = null, myTaskCounter = 0;
let masterTimerInterval = null, masterSeconds = 0;
let masterSessionStart = null;
let isClockedIn = false;
let showArchiveInbox = false, mockNewProjTasks = [];
let timers = {};
let taskSeconds = {};
let taskStartedAt = {};
let autoRefreshInterval = null;
let TEAM_DASH_FILTER = 'all';
let focusUserEmail = null;
const LATE_HOUR = 16;

let showArchiveCc = false;
let showArchiveNote = false;
let showArchiveMeet = false;

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        refreshMasterDisplay();
    }
});

function fmtHMS(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds) || 0);
    let h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = totalSeconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function refreshMasterDisplay() {
    if (!isClockedIn || !masterSessionStart) return;
    let liveSec = masterSeconds + Math.floor((Date.now() - masterSessionStart) / 1000);
    let el = document.getElementById("masterTimerDisplay");
    if(el) el.innerText = fmtHMS(liveSec);
}

function parseFileLinks(fileStr) {
    if(!fileStr || fileStr === "ไม่มีไฟล์" || fileStr === "-") return '<span class="text-slate-400">ไม่มีไฟล์แนบ</span>';
    let parts = fileStr.split("||");
    return parts.map(p => {
        try {
            let obj = JSON.parse(p);
            if(obj.error) return `<span class="text-rose-500">❌ ${obj.name} (อัปโหลดล้มเหลว)</span>`;
            
            // เข้ารหัส URL ป้องกัน Error 404 เวลาเบราว์เซอร์อ่าน Path ภาษาไทย
            let safeUrl = encodeURI(obj.url); 
            
            return `<a href="${safeUrl}" target="_blank" class="text-blue-600 hover:underline block break-all">📎 ${obj.name}</a>`;
        } catch(e) {
            let safeUrl = encodeURI(p);
            return `<a href="${safeUrl}" target="_blank" class="text-blue-600 hover:underline block break-all">📎 ${p}</a>`;
        }
    }).join('');
}

function isLate(deadlineStr) {
    if (!deadlineStr || deadlineStr === '-') return false;
    let d = new Date(deadlineStr);
    if (isNaN(d)) return false;
    d.setHours(LATE_HOUR, 0, 0, 0);
    return new Date() > d;
}
function fmtHM(totalSeconds) {
    totalSeconds = parseInt(totalSeconds) || 0;
    let h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60);
    return `${h} ชม ${m} นาที`;
}
function todayStr() { return new Date().toLocaleDateString('en-CA'); }
function yesterdayStr() { let d = new Date(); d.setDate(d.getDate()-1); return d.toLocaleDateString('en-CA'); }

function fmtDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    let d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    try {
        return d.toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) {
        return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

function hoursRemainingStr(deadlineStr) {
    if (!deadlineStr || deadlineStr === '-') return '';
    let d = new Date(deadlineStr);
    if (isNaN(d)) return '';
    d.setHours(LATE_HOUR, 0, 0, 0);
    let diffMs = d - new Date();
    let diffH = Math.round(diffMs / (1000*60*60));
    if (diffH >= 0) return `<span class="text-emerald-600 font-bold">⏳ เหลือเวลาทำงาน ${diffH} ชม.</span>`;
    return `<span class="text-rose-600 font-bold">⚠️ เลยกำหนด ${Math.abs(diffH)} ชม.</span>`;
}

// งานที่ "ส่งไปแล้ว" ใช้ผลตัดสินที่ backend ล็อกไว้ตอนส่งจริง (lateVerdict) ไม่คำนวณสดอีก
function lateStatusStr(t) {
    let activeStatuses = ['กำลังทำ', 'ยังไม่เริ่มทำ'];
    if (activeStatuses.includes(t.status)) return hoursRemainingStr(t.deadline);
    if (t.lateVerdict === 'late') return `<span class="text-rose-600 font-bold">⚠️ ส่งช้ากว่ากำหนด</span>`;
    if (t.lateVerdict === 'ontime') return `<span class="text-emerald-600 font-bold">✅ ส่งทันเวลา</span>`;
    return `<span class="text-slate-400">ไม่ทราบ (งานเก่าก่อนอัปเดตระบบ)</span>`;
}

function cln(v) { return (v === undefined || v === null) ? '' : v.toString().trim(); }

function toast(msg, type='info') {
    let existing = document.getElementById('wbToast');
    if(existing) existing.remove();
    let colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-rose-600' };
    let el = document.createElement('div');
    el.id = 'wbToast';
    el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${colors[type]||colors.info} text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl z-[2000] transition-opacity duration-300`;
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(()=>el.remove(), 300); }, 2500);
}

// --- TEXT FORMATTING HELPERS ---
function toggleMsgText(el) {
    el.classList.toggle('expanded');
    let btn = el.nextElementSibling;
    if (btn && btn.classList.contains('msg-toggle-btn')) {
        btn.innerText = el.classList.contains('expanded') ? '▲ ย่อข้อความ' : '▼ อ่านเพิ่มเติม';
    }
}

function escapeHtml(str) {
    return (str || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function linkify(escapedText) {
    const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
    return escapedText.replace(urlRegex, function(match) {
        let trail = '';
        let clean = match;
        let m = match.match(/[.,)\]]+$/);
        if (m) { trail = m[0]; clean = match.slice(0, -trail.length); }
        let href = clean.startsWith('http') ? clean : 'https://' + clean;
        return `<a href="${href}" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">${clean}</a>${trail}`;
    });
}

function formatMsgText(text) {
    if (!text) return '';
    let t = text.toString().replace(/\r\n/g, '\n');
    let escaped = escapeHtml(t);
    let linked = linkify(escaped);
    return linked.replace(/\n/g, '<br>');
}

function wrapLongText(text, uid) {
    let formatted = formatMsgText(text);
    return `<div class="msg-text-box" id="${uid}">${formatted}</div><span class="msg-toggle-btn" onclick="toggleMsgText(document.getElementById('${uid}'))">▼ อ่านเพิ่มเติม</span>`;
}

// --- 2. API & DATA FETCHING ---
async function initApp() {
    let savedUser = localStorage.getItem('devUser');
    let savedDb = localStorage.getItem('devDbUsers');
    if (savedUser && savedDb && !currentUser) {
        currentUser = JSON.parse(savedUser);
        dbUsers = JSON.parse(savedDb);

        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("appContainer").classList.remove("hidden");
        document.getElementById("userEmailDisplay").innerText = currentUser.email;
        setupUI();
        setupDropdowns();
    }

    if (!currentUser) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        return;
    }

    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.querySelector('#loadingOverlay h2').innerText = "กำลังบันทึกข้อมูล...";

    try {
        let res = await fetch(API_URL + "?action=loadAll");
        let responseData = await res.json();

        if(responseData.status === 'success') {
            mapAllData(responseData);
        } else {
            console.error("API ส่ง Error:", responseData);
        }
    } catch (e) {
        console.error("โหลดข้อมูลล้มเหลว:", e);
        toast("เกิดปัญหาในการดึงข้อมูลจาก Sheets", "error");
    }

    document.getElementById('loadingOverlay').classList.add('hidden');
    renderData();

    if(currentUser.role !== 'BOSS' && currentUser.role !== 'ADMIN') {
        resumeAttendanceState();
    }

    if(autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(silentRefresh, 30000);
}

function mapAllData(responseData) {
    allAtt   = responseData.attendance.map(r => ({ id: r[0], email: cln(r[1]), name: r[2], action: cln(r[3]), time: r[4] }));
    allTasks = responseData.tasks.map(r => ({ id: r[0], project: cln(r[1]), name: r[2], email: cln(r[3]), deadline: r[4], dept: cln(r[5]), file: r[6], cc: r[7], tag: r[8], status: cln(r[9]), feedback: r[10], timeSpent: parseInt(r[11]) || 0, taskDesc: r[12] || "", submittedAt: r[13] || "", lateVerdict: r[14] || "", editedAt: r[15] || "" }));
    allMsgs  = responseData.messages.map(r => ({ id: r[0], email: cln(r[1]), name: r[2], text: r[3], file: r[4], reply: r[5], to: cln(r[6]) || 'ALL' }));
    allMeets = responseData.meetings.map(r => ({ date: r[0], email: cln(r[1]), type: cln(r[2]), name: r[3], note: r[4] }));
    allReqs  = responseData.reqs.map(r => ({ id: r[0], email: cln(r[1]), name: r[2], topic: r[3], date: r[4], loc: r[5], status: cln(r[6]), remark: r[7], duration: r[8] || '', to: cln(r[9]) || 'ALL' }));
    allNotes = responseData.notes.map(r => ({ id: r[0], email: cln(r[1]), name: r[2], topic: r[3], dept: cln(r[4]), status: cln(r[5]), sentAt: r[6] || '', desc: r[7] || '', link: r[8] || '' }));
    allTimeLogs = (responseData.timelogs || []).map(r => ({ id: r[0], email: cln(r[1]), name: r[2], taskId: r[3], taskName: r[4], project: r[5], date: r[6], seconds: parseInt(r[7]) || 0 }));
    allProjects = (responseData.projects || []).map(r => ({ projId: r[0], projName: cln(r[1]), projNameEn: r[7] || '', deadline: r[2], dept: cln(r[3]), ownerEmail: r[4], ownerName: r[5], createdAt: r[6] }));
}

async function sendToSheets(payload, showLoading = true) {
    if(showLoading) {
        document.getElementById('loadingOverlay').classList.remove('hidden');
        document.querySelector('#loadingOverlay h2').innerText = "กำลังบันทึกข้อมูล...";
    }
    try {
        let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        let data = await res.json();
        if (data.status !== 'success') toast("ระบบบันทึกไม่สำเร็จ: " + (data.message || "ไม่ทราบสาเหตุ"), "error");
    } catch (e) {
        console.error("Fetch Error:", e);
        toast("บันทึกไม่สำเร็จ! ตรวจสอบเน็ตเวิร์ก", "error");
    } finally {
        if(showLoading) document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

// --- 3. AUTHENTICATION & SETUP ---
async function handleSecureLogin() {
    const e = document.getElementById("loginEmail").value.trim().toLowerCase();
    const p = document.getElementById("loginPassword").value.trim();
    if (!e || !p) return alert("กรุณากรอกอีเมลและรหัสผ่าน");

    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.querySelector('#loadingOverlay h2').innerText = "กำลังตรวจสอบบัญชี...";

    try {
        let res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', email: e, password: p }) });
        let data = await res.json();

        if (data.status === 'success') {
            currentUser = data.user;
            dbUsers = data.allUsersSafe.map(u => ({ email: cln(u[0]), role: cln(u[2]), name: u[3], dept: cln(u[4]) }));

            localStorage.setItem('devUser', JSON.stringify(currentUser));
            localStorage.setItem('devDbUsers', JSON.stringify(dbUsers));

            document.getElementById("loginScreen").classList.add("hidden");
            document.getElementById("appContainer").classList.remove("hidden");
            document.getElementById("userEmailDisplay").innerText = currentUser.email;

            setupUI();
            setupDropdowns();

            await initApp();

            if(currentUser.role !== 'BOSS' && currentUser.role !== 'ADMIN' && !isClockedIn) {
                masterClockIn();
            }
        } else {
            alert(data.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง!");
            document.getElementById('loadingOverlay').classList.add('hidden');
        }
    } catch (err) {
        console.error(err);
        alert("ไม่สามารถติดต่อระบบ Login ได้");
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

function handleLogout() {
    localStorage.removeItem('devUser');
    localStorage.removeItem('devDbUsers');

    if(currentUser && currentUser.role !== 'BOSS' && currentUser.role !== 'ADMIN') masterClockOut();
    currentUser = null;
    if(masterTimerInterval) clearInterval(masterTimerInterval);
    if(autoRefreshInterval) clearInterval(autoRefreshInterval);
    document.getElementById("appContainer").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";
}

// ข้อ 8 (รอบล่าสุด): ข้ามการ re-render เวลากำลังพิมพ์อยู่ในช่อง input/textarea กันฟีดแบกเด้งหาย
async function silentRefresh() {
    if(!currentUser) return;
    let typing = document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT');
    try {
        let res = await fetch(API_URL + "?action=loadAll");
        let responseData = await res.json();
        if(responseData.status === 'success') {
            mapAllData(responseData);
            if(!typing) {
                renderData();
                updateNotiBadges();
            }
        }
    } catch(e) { console.error("silentRefresh ล้มเหลว:", e); }
}
function manualRefresh() {
    let btn = document.getElementById('btnManualRefresh');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1"></i> กำลังรีเฟรช...'; }
    silentRefresh().finally(() => {
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> รีเฟรชข้อมูล'; }
    });
}

function setupUI() {
    document.getElementById("bossPanel").classList.add("hidden");
    document.getElementById("staffPanel").classList.add("hidden");
    document.getElementById("headReviewSection").classList.add("hidden");
    document.getElementById("teamDashboardPage").classList.add("hidden");

    let b = document.getElementById("roleBadge");
    if(currentUser.role === "BOSS" || currentUser.role === "ADMIN") {
        b.innerText = "ผู้บริหาร";
        document.getElementById("bossPanel").classList.remove("hidden");
    } else {
        b.innerText = currentUser.role==="HEAD" ? `หัวหน้าฝ่าย (${currentUser.dept})` : `คณะทำงาน (${currentUser.dept})`;
        document.getElementById("staffPanel").classList.remove("hidden");
        if(currentUser.role === "HEAD") {
            document.getElementById("headReviewSection").classList.remove("hidden");
            document.getElementById("headDeptName").innerText = currentUser.dept;
        }
    }
    let noteCard = document.getElementById("noteCardBox");
    if(noteCard) { noteCard.classList.toggle("hidden", currentUser.role !== "HEAD"); }
    if(document.getElementById("noteDept")) document.getElementById("noteDept").value = currentUser.dept;
}

function setupDropdowns() {
    let html = '<option value="">-- ไม่ระบุ --</option>';
    dbUsers.filter(u => u.email !== currentUser.email).forEach(u => {
        html += `<option value="${u.email}">${u.name}</option>`;
    });
    document.getElementById("ccToSelect").innerHTML = html;

    let assignHtml = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
    let staffList = dbUsers.filter(u => u.role !== 'BOSS' && u.role !== 'ADMIN');
    staffList.forEach(u => {
        assignHtml += `<option value="${u.email}" data-dept="${u.dept}">${u.name} (${u.dept})</option>`;
    });
    document.getElementById("cpAssignee").innerHTML = assignHtml;

    populateBossSelectors();
}

function populateBossSelectors() {
    let bosses = dbUsers.filter(u => u.role === 'BOSS' || u.role === 'ADMIN');
    let opts = '<option value="ALL">📨 ส่งถึงผู้บริหารทั้งสองท่าน</option>' + bosses.map(b => `<option value="${b.email}">👑 ${b.name}</option>`).join('');
    ['popQuestionToBoss','reqMeetToBoss'].forEach(id => { let el = document.getElementById(id); if(el) el.innerHTML = opts; });
}

// --- 4. RENDER UI ZONE ---
function renderData() {
    if(currentUser.role === "BOSS" || currentUser.role === "ADMIN") {
        renderBossAttendance(); renderBossTasks(); renderBossBoxes(); renderProjectBars();
        renderTeamKpis(); renderTeamMemberGrid(); renderMeetKpis();
    } else {
        if(currentUser.role === "HEAD") renderHeadTasks();
        renderPeerReviewSection();
        renderStaffTasks(); renderMySubmittedTasks(); renderProjectBars(); checkLessonPerm(); updateNotiBadges();
    }
}

function getLatestMeet(email, type) {
    let list = allMeets.filter(m => m.email === email && m.type === type);
    if(list.length === 0) return null;
    list.sort((a,b) => new Date(b.date) - new Date(a.date));
    return list[0];
}

function renderBossAttendance() {
    let histHTML = '';
    dbUsers.filter(u => u.role !== "BOSS" && u.role !== "ADMIN").forEach(u => {
        let gf = getLatestMeet(u.email, "Good Friday");
        let kr = getLatestMeet(u.email, "Kosenrufu");
        let cellGf = gf ? `<span class="text-emerald-600 font-bold">✅ เข้า</span> <span class="text-[9px] text-slate-400">(${fmtDate(gf.date)})</span> <span class="text-blue-500 hover:underline cursor-pointer text-[9px]" onclick='alert("ถอดบทเรียน Good Friday (" + ${JSON.stringify(gf.date)} + "):\\n" + ${JSON.stringify(gf.note)})'>อ่าน</span>` : `<span class="text-rose-500 font-bold">❌ ขาด/ลา</span>`;
        let cellKr = kr ? `<span class="text-emerald-600 font-bold">✅ เข้า</span> <span class="text-[9px] text-slate-400">(${fmtDate(kr.date)})</span> <span class="text-blue-500 hover:underline cursor-pointer text-[9px]" onclick='alert("ถอดบทเรียน Kosenrufu (" + ${JSON.stringify(kr.date)} + "):\\n" + ${JSON.stringify(kr.note)})'>อ่าน</span>` : `<span class="text-rose-500 font-bold">❌ ขาด/ลา</span>`;
        histHTML += `<tr class="border-b"><td class="p-3 font-bold text-slate-700">${u.name}</td><td class="p-3 text-center">${cellGf}</td><td class="p-3 text-center">${cellKr}</td></tr>`;
    });
    document.getElementById("orgMeetHistoryTableBody").innerHTML = histHTML || `<tr><td colspan="3" class="text-center p-4 text-slate-400">ไม่มีข้อมูล</td></tr>`;
}

// ข้อ 6 (รอบล่าสุด): ทำให้ปุ่มดูประวัติย้อนหลังใช้งานได้จริง (เดิมเรียก toggleView ที่ไม่เคยมีฟังก์ชัน)
function toggleView(view) {
    if(view === 'bossArchive') {
        showArchiveInbox = !showArchiveInbox;
        let btn = document.getElementById('btnBossArchive');
        if(btn) btn.innerHTML = showArchiveInbox
            ? '<i class="fas fa-inbox mr-1"></i> กลับไปดูงานที่รอตรวจ'
            : '<i class="fas fa-archive mr-1"></i> ดูประวัติย้อนหลัง';
        renderBossTasks();
    }
}

function renderBossTasks() {
    let tb = document.getElementById("bossTasksTableBody");
    let tasks = showArchiveInbox
      ? allTasks.filter(t => t.status === 'เสร็จสิ้น' || t.status === 'ส่งกลับแก้ไข' || t.status === 'รับทราบแล้ว')
      : allTasks.filter(t =>
          t.status === 'รอผู้บริหารตรวจ' ||
          t.status === `ส่งถึง: ${currentUser.email}` ||
          (t.status.indexOf('แจ้งให้ทราบ:') === 0 && (t.status.indexOf('รอผู้บริหารตรวจ') > -1 || t.status.indexOf(currentUser.email) > -1))
        );

    if (tasks.length === 0) { tb.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-400">${showArchiveInbox ? 'ไม่มีประวัติงานเก่า' : 'ยอดเยี่ยม! ไม่มีงานค้างตรวจ'}</td></tr>`; return; }

    let html = '';
    tasks.forEach((t, i) => {
        let isFyi = t.status.indexOf('แจ้งให้ทราบ:') === 0;
        let ccList = t.cc ? t.cc.split(',').map(e => e.trim()).filter(Boolean) : [];
        let ccNames = ccList.map(email => (dbUsers.find(u => u.email === email)?.name) || email).join(', ');
        html += `
        <tr class="border-b border-rose-100">
            <td class="p-3 font-bold text-xs text-slate-800">${isFyi ? '📢 ' : ''}${t.name} <span class="block text-[9px] text-slate-400 font-normal mt-1">📂 ${t.project}</span></td>
            <td class="p-3 text-[10px] text-slate-600 font-bold">${t.email} <span class="block text-[9px] text-slate-400 font-normal mt-1">ฝ่าย: ${t.dept}</span></td>
            <td class="p-3 text-center text-[9px] text-slate-500">${ccNames || '-'}</td>
            <td class="p-3 text-center text-[10px] font-mono text-slate-500">${fmtDate(t.deadline)}<br>${lateStatusStr(t)}</td>
            <td class="p-3 text-center text-[10px]">${t.tag}</td>
            <td class="p-3 text-center"><button onclick="document.getElementById('bAct_${i}').classList.toggle('hidden')" class="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-slate-200 transition">${isFyi ? '📢 ดูรายละเอียด' : (showArchiveInbox ? 'ดูรายละเอียด' : 'ตรวจงาน')}</button></td>
        </tr>
        <tr id="bAct_${i}" class="hidden bg-slate-50">
            <td colspan="6" class="p-4 space-y-3 border-b border-slate-200 shadow-inner">
                <div class="text-[11px] font-bold text-slate-700 space-y-1"><i class="fas fa-paperclip text-blue-500 mr-1"></i> ไฟล์แนบ: ${parseFileLinks(t.file)}</div>
                <div class="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 inline-block px-3 py-1.5 rounded-lg">⏱️ เวลาที่ใช้ทำงานทั้งหมด: ${fmtHM(t.timeSpent)}</div>
                ${t.taskDesc ? `<div class="text-[11px] bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-600"><b>📝 คำอธิบายงาน:</b> ${t.taskDesc}</div>` : ''}
                ${t.feedback ? `<div class="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-700 p-2.5 rounded-lg"><b>💬 ความเห็น/ฟีดแบกจากหัวหน้าฝ่าย:</b> ${t.feedback}</div>` : ''}
                ${showArchiveInbox ? `
                    <div class="text-[11px] font-bold ${t.status==='เสร็จสิ้น' ? 'text-emerald-600' : (t.status==='รับทราบแล้ว' ? 'text-sky-600' : 'text-rose-600')}">📌 สถานะสุดท้าย: ${t.status}</div>
                    <div class="flex justify-end">
                        <button onclick="deleteTaskConfirm('${t.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">🗑️ ลบงานนี้ออกจากระบบ</button>
                    </div>
                ` : isFyi ? `
                    <div class="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-100 inline-block px-3 py-1.5 rounded-lg">📢 งานนี้ส่งมาเพื่อแจ้งให้ทราบเท่านั้น ไม่ต้องตรวจ</div>
                    <div class="flex justify-end space-x-2">
                        <button onclick="deleteTaskConfirm('${t.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">🗑️ ลบ</button>
                        <button onclick="ackTaskFyi('${t.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">✅ รับทราบแล้ว</button>
                    </div>
                ` : `
                    <textarea id="fb_${t.id}" class="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500" placeholder="พิมพ์ฟีดแบกตอบกลับ (ถ้ามี)..."></textarea>
                    <div class="flex justify-end space-x-2">
                        <button onclick="deleteTaskConfirm('${t.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">🗑️ ลบ</button>
                        <button onclick="doReview('${t.id}','ส่งกลับแก้ไข')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">ตีกลับให้แก้ไข</button>
                        <button onclick="doReview('${t.id}','เสร็จสิ้น')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">อนุมัติผ่าน (เสร็จสิ้น)</button>
                    </div>
                `}
            </td>
        </tr>`;
    });
    tb.innerHTML = html;
}

function toggleArchiveBox(type) {
    if(type === 'cc') { showArchiveCc = !showArchiveCc; renderBossBoxes(); }
    if(type === 'note') { showArchiveNote = !showArchiveNote; renderBossBoxes(); }
    if(type === 'meet') { showArchiveMeet = !showArchiveMeet; renderBossBoxes(); }
}

function renderBossBoxes() {
    let ccs = allTasks.filter(t => t.cc && t.cc.includes(currentUser.email));
    if(!showArchiveCc) ccs = ccs.filter(t => t.status !== 'เสร็จสิ้น');
    let ccHtml = '';
    ccs.forEach(t => {
        ccHtml += `<div class="bg-white p-3 border border-cyan-200 rounded-xl hover:shadow-sm transition"><span class="font-bold text-[11px] text-sky-600 block mb-1">${t.name}</span><div class="text-[10px] text-slate-500 font-mono">ส่งจาก: ${t.email}<br>กำหนดส่ง: ${fmtDate(t.deadline)} | <span class="font-bold text-slate-700">สถานะ: ${t.status}</span></div></div>`;
    });
    document.getElementById("bossCcBox").innerHTML = ccHtml || `<div class="text-center text-xs text-slate-400 py-6">ไม่มีรายการสำเนาถึงคุณ${showArchiveCc?'':' (ที่ยังไม่เสร็จ)'}</div>`;

    let notes = allNotes.filter(n => showArchiveNote ? n.status === "รับทราบแล้ว" : n.status === "ยังไม่รับทราบ");
    let noteHtml = '';
    notes.forEach(n => {
        let btn = showArchiveNote ? `<div class="text-emerald-600 text-[9px] mt-1 font-bold">✅ รับทราบแล้ว</div>` : `<button onclick="ackNote('${n.id}')" class="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">กดเพื่อรับทราบ</button>`;
        let timeStr = n.sentAt ? `<span class="text-[9px] text-slate-400 block">🕒 ส่งเมื่อ: ${new Date(n.sentAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</span>` : '';
        noteHtml += `<div class="bg-white p-3 border border-purple-200 rounded-xl"><span class="font-bold text-[11px] text-purple-800 block mb-1">${n.topic}</span>${n.desc ? `<div class="text-[10px] text-slate-600 my-1">${wrapLongText(n.desc, 'ndesc_'+n.id)}</div>` : ''}${n.link ? `<a href="${n.link}" target="_blank" class="text-purple-600 hover:underline text-[10px] block mt-1">🔗 เปิดลิงก์แนบ</a>` : ''}<p class="text-[10px] text-slate-600">จาก: ${n.name} <span class="text-slate-400">(${n.dept})</span></p>${timeStr}${btn}</div>`;
    });
    document.getElementById("bossNotesBox").innerHTML = noteHtml || `<div class="text-center text-xs text-slate-400 py-6">ไม่มีบันทึกข้อความ${showArchiveNote?'เก่า':'ใหม่'}</div>`;

    let msgs = allMsgs.filter(m => !m.reply && (!m.to || m.to === 'ALL' || m.to === currentUser.email));
    let msgHtml = '';
    msgs.forEach(m => {
        let toLabel = (m.to && m.to !== 'ALL') ? ` <span class="text-[9px] text-amber-500">(ถึงคุณโดยเฉพาะ)</span>` : ` <span class="text-[9px] text-slate-400">(ถึงผู้บริหารทั้งสองท่าน)</span>`;
        msgHtml += `<div class="bg-white p-3 border border-amber-200 rounded-xl"><span class="font-bold text-[11px] text-amber-800 block mb-1">${m.name} <span class="font-normal text-[9px] text-amber-600">(${m.email})</span>${toLabel}</span><div class="text-[11px] text-slate-700 my-2 bg-amber-50 p-2 rounded border border-amber-100">${wrapLongText(m.text, 'qtxt_'+m.id)}</div><input type="text" id="ans_${m.id}" placeholder="พิมพ์ข้อความตอบกลับ..." class="w-full p-2 text-[10px] border border-amber-300 rounded-lg mb-2 outline-none focus:border-amber-500"><div class="flex gap-2"><button onclick="replyMsg('${m.id}')" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">ตอบกลับ</button><button onclick="bounceMsg('${m.id}')" title="กรณีถามผิดคน/ไม่ใช่เรื่องของเรา" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">🔄 ตีกลับ</button></div></div>`;
    });
    document.getElementById("bossQuestionBox").innerHTML = msgHtml || `<div class="text-center text-xs text-slate-400 py-6">ไม่มีคำถามจากทีม</div>`;

    let reqs = allReqs.filter(r => (!r.to || r.to === 'ALL' || r.to === currentUser.email));
    if(!showArchiveMeet) reqs = reqs.filter(r => r.status === "รอตอบ" || r.status === "รับนัด" || r.status === "ขอแก้ไขเวลา");
    let reqHtml = '';
    reqs.forEach(r => {
        let toLabel = (r.to && r.to !== 'ALL') ? ` <span class="text-[9px] text-amber-500">(ถึงคุณโดยเฉพาะ)</span>` : ` <span class="text-[9px] text-slate-400">(ถึงผู้บริหารทั้งสองท่าน)</span>`;
        let durLabel = r.duration ? ` (~${r.duration} นาที)` : '';

        let actionArea = '';
        if(r.status === "รอตอบ") {
            actionArea = `<input type="text" id="rmk_${r.id}" placeholder="ระบุหมายเหตุ (ถ้ามี)..." class="w-full p-2 text-[10px] border border-indigo-300 rounded-lg mb-2 outline-none focus:border-indigo-500"><div class="flex space-x-2"><button onclick="replyMeet('${r.id}','รับนัด')" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">รับนัด</button><button onclick="replyMeet('${r.id}','ปฏิเสธ')" class="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">ปฏิเสธ</button></div>`;
        } else if(r.status === "รับนัด") {
            actionArea = `<div class="text-[10px] font-bold text-emerald-600">สถานะ: รับนัด ${r.remark?`(${r.remark})`:''}</div><button onclick="openMeetingEditModal('${r.id}')" class="mt-2 text-[10px] font-bold text-indigo-600 hover:underline"><i class="fas fa-edit mr-1"></i> ขอแก้ไขเวลา/สถานที่</button>`;
        } else if(r.status === "ขอแก้ไขเวลา") {
            actionArea = `<div class="text-[10px] font-bold text-amber-600">⏳ รอผู้ขอนัดยืนยันเวลาใหม่ ${r.remark?`(${r.remark})`:''}</div>`;
        } else {
            actionArea = `<div class="text-[10px] font-bold ${r.status==='รับนัด'?'text-emerald-600':'text-rose-600'}">สถานะ: ${r.status} ${r.remark?`(${r.remark})`:''}</div>`;
        }

        reqHtml += `<div class="bg-white p-3 border border-indigo-200 rounded-xl"><span class="font-bold text-[11px] text-indigo-800 block mb-1">${r.topic}${toLabel}</span><div class="text-[10px] text-slate-500 font-bold mb-1">👤 ผู้นัด: ${r.name} <span class="font-normal text-slate-400">(${r.email})</span></div><div class="text-[10px] text-slate-600 my-2 bg-indigo-50 p-2 rounded border border-indigo-100"><b class="text-slate-800">เวลา:</b> ${new Date(r.date).toLocaleString('th-TH')}${durLabel}<br><b class="text-slate-800">สถานที่:</b> ${wrapLongText(r.loc, 'loc_'+r.id)}</div>${actionArea}</div>`;
    });
    document.getElementById("bossMeetingsBox").innerHTML = reqHtml || `<div class="text-center text-xs text-slate-400 py-6">ไม่มีคำขอนัดหมาย${showArchiveMeet?'เก่า':''}</div>`;
}

function renderMeetKpis() {
    let now = new Date();
    let mine = allReqs.filter(r => !r.to || r.to === 'ALL' || r.to === currentUser.email);
    let done = mine.filter(r => r.status === 'รับนัด' && new Date(r.date) < now).length;
    let soon = mine.filter(r => r.status === 'รับนัด' && new Date(r.date) >= now && (new Date(r.date) - now) <= 24*60*60*1000).length;
    let elD = document.getElementById('kpiMeetDone'); if(elD) elD.innerText = done;
    let elS = document.getElementById('kpiMeetSoon'); if(elS) elS.innerText = soon;
}

// ข้อ 2+3 (รอบล่าสุด): กรอง dropdown เฉพาะโครงการของตนเอง + เพิ่มปุ่มแก้ไข/ลบโครงการ
function renderProjectBars() {
    let pMap = {};
    (allProjects || []).forEach(p => {
        pMap[p.projName] = { total: 0, done: 0, late: false, dl: p.deadline, dept: p.dept };
    });
    allTasks.forEach(t => {
        let p = t.project; if(!p || p.includes("ทั่วไป")) return;
        if(!pMap[p]) { pMap[p] = { total: 0, done: 0, late: false, dl: t.deadline }; }
        pMap[p].total++;
        if(t.status.includes('เสร็จ')) pMap[p].done++;
        else if(isLate(t.deadline)) pMap[p].late = true;
    });

    let bossBox = document.getElementById("bossProjectProgressSummary");
    if(bossBox && (currentUser.role === "BOSS" || currentUser.role === "ADMIN")) {
        let pHtml = ""; let totalP = 0, onT = 0, pctSum = 0;
        for(let k in pMap) {
            totalP++;
            let pct = pMap[k].total > 0 ? Math.floor((pMap[k].done/pMap[k].total)*100) : 0;
            pctSum += pct;
            if(!pMap[k].late) onT++;
            pHtml += `<div class="mb-3"><div class="flex justify-between text-[11px] font-bold mb-1 text-slate-700"><span>${k} <span class="text-[9px] text-slate-400 font-normal">(${pMap[k].done}/${pMap[k].total} งาน)</span></span><span class="${pct===100?'text-emerald-600':''}">${pct}%</span></div><div class="w-full bg-white h-2 rounded-full overflow-hidden border border-emerald-200"><div class="${pMap[k].late?'bg-rose-500':'bg-indigo-500'} h-full transition-all" style="width:${pct}%"></div></div></div>`;
        }
        let avgPct = totalP > 0 ? Math.round(pctSum / totalP) : 0;
        let statHtml = `<div class="grid grid-cols-3 gap-2 text-center text-xs mb-4">
            <div class="bg-white border border-indigo-100 p-3 rounded-xl shadow-sm"><span class="block font-bold text-2xl text-indigo-600">${totalP}</span><span class="text-[10px] text-slate-500">โครงการทั้งหมด</span></div>
            <div class="bg-white border border-emerald-100 p-3 rounded-xl shadow-sm"><span class="block font-bold text-2xl text-emerald-600">${onT}</span><span class="text-[10px] text-slate-500">On-Time</span></div>
            <div class="bg-white border border-amber-100 p-3 rounded-xl shadow-sm"><span class="block font-bold text-2xl text-amber-600">${avgPct}%</span><span class="text-[10px] text-slate-500">ก้าวหน้าเฉลี่ย</span></div>
        </div>`;
        bossBox.innerHTML = totalP > 0 ? statHtml + pHtml : `<div class="text-center text-xs text-slate-400 py-6">ยังไม่มีข้อมูลโครงการ</div>`;
    }

    let vBox = document.getElementById("staffProjectVault");
    if(vBox && currentUser.role !== "BOSS" && currentUser.role !== "ADMIN") {
        let myProjectKeys = [];
        let vHtml = "";
        for(let k in pMap) {
            let projMeta = allProjects.find(p => p.projName === k);
            let iAmOwner = projMeta && projMeta.ownerEmail === currentUser.email;
            let iHaveTaskHere = allTasks.some(t => t.project === k && t.email === currentUser.email);
            let sameDept = pMap[k].dept === currentUser.dept;
            if(!iAmOwner && !iHaveTaskHere && !sameDept) continue;
            myProjectKeys.push(k);

            let pct = pMap[k].total > 0 ? Math.floor((pMap[k].done / pMap[k].total)*100) : 0;
            let stat = pMap[k].late ? '<span class="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-lg text-[9px] font-bold">LATE 🔴</span>' : '<span class="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[9px] font-bold">ON-TIME ✅</span>';
            let canManage = iAmOwner || (currentUser.role === 'HEAD' && sameDept);
            let manageBtns = canManage && projMeta ? `<div class="flex gap-1 mt-2" onclick="event.stopPropagation()">
                <button onclick="editProject('${projMeta.projId}')" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-bold py-1 rounded">✏️ แก้ไข</button>
                <button onclick="deleteProject('${projMeta.projId}')" class="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-bold py-1 rounded">🗑️ ลบ</button>
            </div>` : '';
            vHtml += `<div class="border border-amber-200 bg-white p-4 rounded-xl hover:bg-amber-50 cursor-pointer shadow-sm transition" onclick="showProjDetails('${k}')"><div class="flex justify-between mb-3"><h3 class="font-bold text-xs text-slate-800">🏆 ${k} <span class="text-[10px] text-slate-400 font-mono ml-1">(DL: ${fmtDate(pMap[k].dl)})</span></h3>${stat}</div><div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="${pMap[k].late?'bg-rose-500':'bg-indigo-500'} h-full transition-all" style="width:${pct}%"></div></div>${manageBtns}</div>`;
        }
        vBox.innerHTML = vHtml || `<div class="text-center text-xs text-slate-400 py-6">ไม่มีโครงการในคลัง</div>`;

        let sel = document.getElementById("activeProjectSelect");
        if(sel) {
            let oldVal = sel.value;
            sel.innerHTML = '<option value="งานทั่วไป">เพิ่มชิ้นงานด้วยตนเอง</option>';
            myProjectKeys.forEach(k => sel.innerHTML += `<option value="${k}">🏆 ${k}</option>`);
            if(myProjectKeys.includes(oldVal) || oldVal === "งานทั่วไป") sel.value = oldVal;
        }
    }
}

// --- 4.1 TEAM DASHBOARD ---
function openTeamDashboard() {
    document.getElementById('bossPanel').classList.add('hidden');
    document.getElementById('teamDashboardPage').classList.remove('hidden');
    renderTeamKpis();
    renderTeamMemberGrid();
}
function closeTeamDashboard() {
    document.getElementById('teamDashboardPage').classList.add('hidden');
    document.getElementById('bossPanel').classList.remove('hidden');
}
function filterTeamDash(f) {
    TEAM_DASH_FILTER = f;
    document.querySelectorAll('.teamFilterBtn').forEach(b => b.classList.toggle('active-filter', b.dataset.filter === f));
    renderTeamMemberGrid();
}
function renderTeamKpis() {
    let subtasks = allTasks.filter(t => t.project && !t.project.includes('ทั่วไป'));
    let total = subtasks.length;
    let late = subtasks.filter(t => !t.status.includes('เสร็จ') && isLate(t.deadline)).length;
    let onTime = total - late;
    let elTotal = document.getElementById('kpiTotalTasks'); if(elTotal) elTotal.innerText = total;
    let elOn = document.getElementById('kpiOnTimeCount'); if(elOn) elOn.innerText = onTime;
    let elOnP = document.getElementById('kpiOnTimePct'); if(elOnP) elOnP.innerText = total ? `(${Math.round(onTime/total*100)}%)` : '(0%)';
    let elLate = document.getElementById('kpiLateCount'); if(elLate) elLate.innerText = late;
    let elLateP = document.getElementById('kpiLatePct'); if(elLateP) elLateP.innerText = total ? `(${Math.round(late/total*100)}%)` : '(0%)';
    let staffList = dbUsers.filter(u => u.role !== 'BOSS' && u.role !== 'ADMIN');
    let idle = staffList.filter(u => !allTasks.some(t => t.email === u.email && t.status === 'กำลังทำ')).length;
    let elIdle = document.getElementById('kpiIdleCount'); if(elIdle) elIdle.innerText = idle;
}
function getUserOnlineStatus(email) {
    let logs = allAtt.filter(a => a.email === email);
    if(!logs.length) return { label: '⚫ ไม่มีข้อมูลลงเวลา' };
    logs.sort((a,b) => new Date(b.time) - new Date(a.time));
    let last = logs[0];
    let dDays = Math.ceil(Math.abs(new Date() - new Date(last.time)) / (1000*60*60*24));
    if(dDays > 3) return { label: '⚫ ไม่ได้ใช้งานเกิน 3 วัน' };
    return last.action === 'ClockIn' ? { label: '🟢 Online' } : { label: '🔴 Offline' };
}
function renderTeamMemberGrid() {
    let grid = document.getElementById('teamMemberGrid');
    if(!grid) return;
    let staffList = dbUsers.filter(u => u.role !== 'BOSS' && u.role !== 'ADMIN');
    let html = '';
    staffList.forEach(u => {
        let myTasks = allTasks.filter(t => t.email === u.email && t.status === 'กำลังทำ');
        let lateTasks = myTasks.filter(t => isLate(t.deadline));
        let statusKey = lateTasks.length > 0 ? 'late' : (myTasks.length > 0 ? 'working' : 'idle');
        if(TEAM_DASH_FILTER !== 'all' && TEAM_DASH_FILTER !== statusKey) return;

        let badgeClass = statusKey === 'late' ? 'bg-rose-100 text-rose-700' : (statusKey === 'working' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700');
        let badgeLabel = statusKey === 'late' ? '🔴 ล่าช้า' : (statusKey === 'working' ? '🟢 กำลังทำงาน' : '🟡 ว่างงาน');
        let onlineStatus = getUserOnlineStatus(u.email);

        let currentTaskHtml;
        if(myTasks.length > 0) {
            let sorted = [...myTasks].sort((a,b) => isLate(b.deadline) - isLate(a.deadline));
            let t = sorted[0];
            let late = isLate(t.deadline);
            currentTaskHtml = `<div class="bg-slate-50 rounded-lg p-2.5">
                <p class="text-[10px] text-slate-400 font-bold uppercase">กำลังทำ (${myTasks.length} งาน)</p>
                <p class="text-xs font-bold text-slate-700 truncate">${t.name}</p>
                <div class="flex justify-between mt-1">
                    <span class="text-[10px] text-slate-400 truncate">📂 ${t.project}</span>
                    <span class="text-[10px] font-bold ${late ? 'text-rose-600' : 'text-emerald-600'}">${late ? 'ล่าช้า' : 'ทันกำหนด'}</span>
                </div>
            </div>`;
        } else {
            currentTaskHtml = `<div class="bg-slate-50 rounded-lg p-2.5 text-center text-[11px] text-slate-400">ไม่มีงานที่กำลังทำอยู่</div>`;
        }

        let initial = (u.name || '?').charAt(0);
        html += `<div class="team-member-card bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">${initial}</div>
                    <div>
                        <p class="font-bold text-sm text-slate-800">${u.name}</p>
                        <p class="text-[10px] text-slate-400">${u.dept}</p>
                    </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${badgeClass}">${badgeLabel}</span>
            </div>
            ${currentTaskHtml}
            <div class="flex justify-between items-center pt-2 border-t border-slate-100">
                <span class="text-[10px] text-slate-400">${onlineStatus.label}</span>
                <button onclick="openUserTaskModal('${u.email}')" class="text-[10px] font-bold text-indigo-600 hover:underline">ดูงานทั้งหมด →</button>
            </div>
        </div>`;
    });
    grid.innerHTML = html || `<div class="col-span-full text-center text-xs text-slate-400 py-10">ไม่มีคณะทำงานตรงตามตัวกรองนี้</div>`;
}

// --- 5. EVENT HANDLERS & ACTION LOGIC ---
function doReview(id, stat) {
    let fb = document.getElementById('fb_'+id)?.value || '';
    let task = allTasks.find(x => x.id === id);
    if(task) {
        task.status = stat;
        task.feedback = fb;
        if(stat === 'เสร็จสิ้น') notifyHeadOfApproval(task, fb);
    }
    renderData();
    sendToSheets({action: "reviewTask", taskId: id, status: stat, feedback: fb}, false);
}

// ข้อ 7 (FYI flow): ผู้บริหาร/หัวหน้ากด "รับทราบแล้ว" สำหรับงานที่ส่งมาแบบ FYI
function ackTaskFyi(taskId) {
    let task = allTasks.find(x => x.id === taskId);
    if(task) task.status = 'รับทราบแล้ว';
    renderData();
    sendToSheets({action: "reviewTask", taskId: taskId, status: 'รับทราบแล้ว', feedback: ''}, false);
    toast("รับทราบเรียบร้อยแล้ว ✅", "success");
}

function notifyHeadOfApproval(task, feedback) {
    let head = dbUsers.find(u => u.role === 'HEAD' && u.dept === task.dept);
    if(!head) return;
    let newId = "M_" + Date.now();
    let noticeText = `✅ งาน "${task.name}" (โครงการ: ${task.project}) ผ่านการอนุมัติจากผู้บริหาร ${currentUser.name} แล้ว` + (feedback ? ` — ความเห็นเพิ่มเติม: ${feedback}` : '');
    allMsgs.push({ id: newId, email: head.email, name: head.name, text: '[ระบบแจ้งเตือน] งานผ่านการอนุมัติแล้ว', file: '', reply: noticeText, to: currentUser.email });
    sendToSheets({ action: "askQuestion", msgId: newId, email: head.email, name: head.name, text: '[ระบบแจ้งเตือน] งานผ่านการอนุมัติแล้ว', to: currentUser.email }, false);
    sendToSheets({ action: "replyMsg", msgId: newId, reply: noticeText }, false);
}

function doHeadReview(id) {
    let select = document.getElementById('headActSelect_'+id);
    let action = select.value;
    let fb = document.getElementById('fb_'+id)?.value || '';
    let task = allTasks.find(x => x.id === id);

    if(!task) return;

    if(action === 'ตีกลับ') {
        task.status = 'ส่งกลับแก้ไข';
        task.feedback = fb;
    } else if(action === 'จัดเก็บ') {
        task.status = 'เสร็จสิ้น';
        task.feedback = fb;
    } else if(action.startsWith('ส่งผู้บริหาร_')) {
        let bossEmail = action.split('_')[1];
        task.status = `ส่งถึง: ${bossEmail}`;
        task.feedback = fb;
    }
    renderData();
    sendToSheets({action: "reviewTask", taskId: id, status: task.status, feedback: fb}, false);
}

function ackNote(id) {
    let note = allNotes.find(x => x.id === id);
    if(note) note.status = "รับทราบแล้ว";
    renderData();
    sendToSheets({action: "ackNote", noteId: id}, false);
}
function replyMsg(id) {
    let ans = document.getElementById('ans_'+id).value;
    if(ans) {
        let msg = allMsgs.find(x => x.id === id);
        if(msg) msg.reply = ans;
        renderData();
        sendToSheets({action: "replyMsg", msgId: id, reply: ans}, false);
    }
}
function bounceMsg(id) {
    let extra = document.getElementById('ans_'+id).value;
    let reason = prompt("เหตุผลที่ตีกลับ (เช่น ไม่ใช่เรื่องของแผนกเรา / กรุณาส่งให้คนอื่น):", extra || "");
    if(reason === null) return;
    let bounced = "🔄 [ตีกลับ - กรุณาตรวจสอบผู้รับ] " + (reason || "เรื่องนี้ไม่ใช่เรื่องของผม/ดิฉัน กรุณาส่งคำถามนี้ใหม่ให้ถูกคน");
    let msg = allMsgs.find(x => x.id === id);
    if(msg) msg.reply = bounced;
    renderData();
    sendToSheets({action: "replyMsg", msgId: id, reply: bounced}, false);
}
function replyMeet(id, stat) {
    let rmk = document.getElementById('rmk_'+id)?.value || '';
    if(stat === 'ปฏิเสธ' && !rmk) rmk = 'ขอนัดใหม่ในโอกาสถัดไป';
    let req = allReqs.find(x => x.id === id);
    if(req) { req.status = stat; req.remark = rmk; }
    renderData();
    sendToSheets({action: "replyMeet", reqId: id, status: stat, remark: rmk}, false);
}

function openMeetingEditModal(reqId) {
    let r = allReqs.find(x => x.id === reqId);
    if(!r) return;
    document.getElementById('meEditRowId').value = reqId;
    document.getElementById('meEditOriginalInfo').innerText = `เดิม: ${r.topic} — ${new Date(r.date).toLocaleString('th-TH')} @ ${r.loc}`;
    document.getElementById('meEditNewTime').value = '';
    document.getElementById('meEditNewLoc').value = '';
    document.getElementById('meEditReason').value = '';
    openModal('meetingEditModal');
}
function submitMeetingEditRequest() {
    let reqId = document.getElementById('meEditRowId').value;
    let newTime = document.getElementById('meEditNewTime').value;
    let newLoc = document.getElementById('meEditNewLoc').value;
    let reason = document.getElementById('meEditReason').value;
    if(!newTime) return alert('กรุณาระบุเวลาที่ต้องการขอแก้ไข');
    let r = allReqs.find(x => x.id === reqId);
    if(!r) return;
    r.status = 'ขอแก้ไขเวลา';
    r._editNewDate = newTime;
    r._editNewLoc = newLoc || r.loc;
    let remarkTxt = `ผู้บริหารขอเปลี่ยนเวลาเป็น ${new Date(newTime).toLocaleString('th-TH')}${newLoc ? (' @ ' + newLoc) : ''}${reason ? (' | เหตุผล: ' + reason) : ''}`;
    r.remark = remarkTxt;
    closeModal('meetingEditModal');
    renderData();
    sendToSheets({ action: 'replyMeet', reqId: reqId, status: 'ขอแก้ไขเวลา', remark: remarkTxt }, false);
}
function confirmMeetingNewTime(reqId) {
    let r = allReqs.find(x => x.id === reqId);
    if(!r) return;
    r.status = 'รับนัด';
    if(r._editNewDate) r.date = r._editNewDate;
    if(r._editNewLoc) r.loc = r._editNewLoc;
    r.remark = 'ผู้ขอนัดยืนยันเวลาใหม่แล้ว';
    renderData();
    sendToSheets({ action: 'replyMeet', reqId: reqId, status: 'รับนัด', remark: 'ผู้ขอนัดยืนยันเวลาใหม่แล้ว' }, false);
    toast('ยืนยันเวลานัดหมายใหม่เรียบร้อยแล้ว ✅', 'success');
}

function addTaskIntoList() {
    let t = document.getElementById("newTaskNameInput").value || document.getElementById("activeSubTaskSelect").value;
    let dl = document.getElementById("newTaskDeadlineInput").value;
    let p = document.getElementById("activeProjectSelect").value;

    if(!t) return alert("กรุณาระบุชื่องาน หรือเลือกงานจากเช็คลิสต์");
    let newTaskId = "T_" + Date.now();

    allTasks.push({ id: newTaskId, project: p, name: t, email: currentUser.email, deadline: dl || "-", dept: currentUser.dept, file: "", cc: "", tag: "", status: "ยังไม่เริ่มทำ", feedback: "", timeSpent: 0, taskDesc: "", submittedAt: "", lateVerdict: "", editedAt: "" });

    document.getElementById("newTaskNameInput").value = "";
    renderData();
    sendToSheets({ action: "createTask", taskId: newTaskId, taskName: t, project: p, email: currentUser.email, deadline: dl || "-", dept: currentUser.dept, desc: "" }, false);
}

// ข้อ 3 (รอบล่าสุด): ใครแก้ไข/ลบงานย่อยได้บ้าง
function canManageTask(t) {
    if(currentUser.role === 'BOSS' || currentUser.role === 'ADMIN') return true;
    if(currentUser.role === 'HEAD' && t.dept === currentUser.dept) return true;
    return t.email === currentUser.email && (t.status === 'ยังไม่เริ่มทำ' || t.status === 'กำลังทำ');
}

function editProject(projId) {
    let p = allProjects.find(x => x.projId === projId);
    if(!p) return;
    let newName = prompt("แก้ไขชื่อโครงการ:", p.projName);
    if(newName === null) return;
    let newDeadline = prompt("แก้ไขกำหนดส่ง (YYYY-MM-DD):", p.deadline !== '-' ? p.deadline : '');
    if(newDeadline === null) return;
    p.projName = newName; p.deadline = newDeadline || '-';
    renderData();
    sendToSheets({ action: "editProject", projId: projId, projName: newName, deadline: p.deadline, projNameEn: p.projNameEn }, false);
    toast("แก้ไขโครงการเรียบร้อยแล้ว ✅", "success");
}
function deleteProject(projId) {
    let p = allProjects.find(x => x.projId === projId);
    if(!p) return;
    if(!confirm(`ยืนยันลบโครงการ "${p.projName}"? (งานย่อยที่มีอยู่จะไม่ถูกลบ แต่จะไม่ผูกกับโครงการหลักอีกต่อไป)`)) return;
    allProjects = allProjects.filter(x => x.projId !== projId);
    renderData();
    sendToSheets({ action: "deleteProject", projId: projId }, false);
    toast("ลบโครงการเรียบร้อยแล้ว ✅", "success");
}
function editTask(taskId) {
    let t = allTasks.find(x => x.id === taskId);
    if(!t || !canManageTask(t)) return alert("คุณไม่มีสิทธิ์แก้ไขงานนี้");
    let newName = prompt("แก้ไขชื่องาน:", t.name);
    if(newName === null) return;
    let newDeadline = prompt("แก้ไขกำหนดส่ง (YYYY-MM-DD):", t.deadline !== '-' ? t.deadline : '');
    if(newDeadline === null) return;
    t.name = newName; t.deadline = newDeadline || '-';
    renderData();
    sendToSheets({ action: "editTask", taskId: taskId, taskName: newName, deadline: t.deadline }, false);
    toast("แก้ไขงานเรียบร้อยแล้ว ✅ ระบบบันทึกเวลาที่แก้ไขไว้แล้ว", "success");
}
function deleteTaskConfirm(taskId) {
    let t = allTasks.find(x => x.id === taskId);
    if(!t || !canManageTask(t)) return alert("คุณไม่มีสิทธิ์ลบงานนี้");
    if(!confirm(`ยืนยันลบงาน "${t.name}"? ลบแล้วกู้คืนไม่ได้`)) return;
    allTasks = allTasks.filter(x => x.id !== taskId);
    renderData();
    sendToSheets({ action: "deleteTask", taskId: taskId }, false);
    toast("ลบงานเรียบร้อยแล้ว ✅", "success");
}

// ข้อ 7 (FYI flow): เช็ค checkbox แล้วแนบ prefix "แจ้งให้ทราบ:" ไว้ที่ roleToSubmit
async function finalizeTaskSubmission() {
    let files = Array.from(document.getElementById("taskFileInput").files);
    let linkVal = document.getElementById("taskLinkInput").value.trim();
    let tag = document.getElementById("taskTag").value;
    let dl = document.getElementById("modalTaskDeadline").value;
    if(isLate(dl)) { tag += " (LATE 🔴)"; }

    let roleToSubmit = document.getElementById("submitToRole").value;

    let bossPicker = document.getElementById("bossPickerSelect");
    if(currentUser.role === 'HEAD' && bossPicker && bossPicker.value) {
        roleToSubmit = bossPicker.value;
    }

    let peerSelect = document.getElementById("peerReviewerSelect");
    let peerTarget = (peerSelect && peerSelect.value) ? peerSelect.value : '';
    let normalFlowIfDone = (currentUser.role === 'HEAD') ? 'รอผู้บริหารตรวจ' : 'รอหัวหน้าตรวจ';
    if(peerTarget) {
        roleToSubmit = `รอตรวจจาก: ${peerTarget} :: ถัดไป: ${normalFlowIfDone}`;
    }

    let isFyiOnly = document.getElementById("fyiOnlyCheckbox")?.checked || false;
    if(isFyiOnly) {
        roleToSubmit = 'แจ้งให้ทราบ: ' + roleToSubmit;
    }

    let spentSec = taskSeconds[curSubmitId] || 0;

    let ccSelect = document.getElementById("ccToSelect");
    let selectedCCs = Array.from(ccSelect.selectedOptions).map(opt => opt.value).filter(val => val !== "");
    let ccString = selectedCCs.join(",");

    if(files.length === 0 && !linkVal) {
        if(!confirm("ยังไม่ได้แนบไฟล์หรือลิงก์ผลงาน ต้องการส่งเลยหรือไม่?")) return;
    }

    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.querySelector('#loadingOverlay h2').innerText = "กำลังอัปโหลดไฟล์...";

    let filesPayload = [];
for (let f of files) {
    let base64 = await new Promise((res, rej) => {
        let reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(f);
    });
    
    // แปลงชื่อไฟล์ภาษาไทยจาก Mac (NFD) ให้เป็นมาตรฐาน (NFC)
    let safeFileName = f.name.normalize('NFC'); 
    
    filesPayload.push({ name: safeFileName, mimeType: f.type || 'application/octet-stream', base64: base64 });
}

    let task = allTasks.find(x => x.id === curSubmitId);
    let submittedAtNow = new Date().toISOString();
    if(task) { task.status = roleToSubmit; task.tag = tag; task.timeSpent = spentSec; task.cc = ccString; task.submittedAt = submittedAtNow; }

    closeModal('submitTaskModal');
    renderData();

    let submitDesc = document.getElementById("taskSubmitDesc")?.value || "";
    await sendToSheets({
        action: "submitTaskFile",
        taskId: curSubmitId,
        files: filesPayload,
        link: linkVal,
        desc: submitDesc,
        cc: ccString, tag: tag, roleToSubmit: roleToSubmit, timeSpent: spentSec,
        name: currentUser.name, email: currentUser.email, dept: currentUser.dept
    }, false);

    document.getElementById('loadingOverlay').classList.add('hidden');
    toast(isFyiOnly ? "ส่งแจ้งให้ทราบเรียบร้อยแล้ว 📢" : "ส่งงานเรียบร้อยแล้ว ✅", "success");
}

// ข้อ 7 (FYI flow): เพิ่ม link ไปกับบันทึกข้อความ
function submitStaffAction(act) {
    if(act === 'askQuestion') {
        let txt = document.getElementById("popQuestionText").value;
        if(!txt) return alert("กรุณาพิมพ์คำถาม");
        let toBoss = document.getElementById("popQuestionToBoss").value;
        let newId = "M_"+Date.now();
        allMsgs.push({id: newId, email: currentUser.email, name: currentUser.name, text: txt, file: "", reply: "", to: toBoss});
        closeModal('staffQuestionModal');
        document.getElementById("popQuestionText").value = "";
        sendToSheets({action: "askQuestion", msgId: newId, email: currentUser.email, name: currentUser.name, text: txt, to: toBoss}, false);
        toast("ส่งคำถามเรียบร้อยแล้ว ✅", "success");
    } else if (act === 'reqMeeting') {
        let topic = document.getElementById("reqMeetTopic").value;
        let date = document.getElementById("reqMeetDate").value;
        let duration = document.getElementById("reqMeetDuration").value;
        let toBoss = document.getElementById("reqMeetToBoss").value;
        if(!topic || !date) return alert("ระบุหัวข้อและเวลาให้ครบถ้วน");
        let newId = "R_"+Date.now();
        allReqs.push({id: newId, email: currentUser.email, name: currentUser.name, topic: topic, date: date, loc: document.getElementById("reqMeetLoc").value, status: "รอตอบ", remark: "", duration: duration, to: toBoss});
        closeModal('meetingRequestModal');
        sendToSheets({action: "reqMeeting", reqId: newId, email: currentUser.email, name: currentUser.name, topic: topic, date: date, loc: document.getElementById("reqMeetLoc").value, duration: duration, to: toBoss}, false);
        toast("ส่งคำขอนัดหมายเรียบร้อยแล้ว ✅", "success");
    } else if (act === 'sendNote') {
        let topic = document.getElementById("noteTopic").value;
        let desc = document.getElementById("noteDesc").value;
        let link = document.getElementById("noteLink")?.value || '';
        if(!topic) return alert("ระบุหัวข้อบันทึก");
        let newId = "N_"+Date.now();
        let sentAt = new Date().toISOString();
        allNotes.push({id: newId, email: currentUser.email, name: currentUser.name, topic: topic, dept: currentUser.dept, status: "ยังไม่รับทราบ", sentAt: sentAt, desc: desc, link: link});
        closeModal('sendNoteModal');
        sendToSheets({action: "sendNote", noteId: newId, email: currentUser.email, name: currentUser.name, topic: topic, dept: document.getElementById("noteDept").value, sentAt: sentAt, desc: desc, link: link}, false);
        toast("ส่งบันทึกข้อความเรียบร้อยแล้ว ✅", "success");
    }
}

function toggleCustomMeet() {
    let val = document.getElementById("meetNameSelect").value;
    let customInput = document.getElementById("meetCustomName");
    if(val === "อื่นๆ") customInput.classList.remove("hidden");
    else customInput.classList.add("hidden");
}

function calculateEndTime() {
    let start = document.getElementById("reqMeetDate").value;
    let dur = parseInt(document.getElementById("reqMeetDuration").value) || 0;
    let display = document.getElementById("reqMeetEndDisplay");
    if(start && dur > 0) {
        let d = new Date(start);
        d.setMinutes(d.getMinutes() + dur);
        display.innerText = "เวลาสิ้นสุดโดยประมาณ: " + d.toLocaleString('th-TH', {dateStyle: 'medium', timeStyle: 'short'});
    } else {
        display.innerText = "เวลาสิ้นสุดโดยประมาณ: -";
    }
}

function submitMeetingLessonForm() {
    let note = document.getElementById("meetNote").value;
    let type = document.getElementById("meetNameSelect").value;
    if(type === "อื่นๆ") type = document.getElementById("meetCustomName").value || "ไม่มีชื่อการประชุม";
    let dateVal = document.getElementById("meetDateInput").value;

    if(!note) return alert("กรุณาพิมพ์เนื้อหาถอดบทเรียน");
    if(!dateVal) return alert("กรุณาระบุวันที่ประชุม");

    allMeets.push({date: dateVal, email: currentUser.email, type: type, name: currentUser.name, note: note});
    sendToSheets({ action: "submitLesson", email: currentUser.email, name: currentUser.name, type: type, date: dateVal, note: note }, false);
    document.getElementById("meetNote").value = "";
    toast("ส่งถอดบทเรียนเรียบร้อยแล้ว ✅", "success");
}

function submitNewProject() {
    let existingProj = document.getElementById("cpExistingProject").value;
    if(!mockNewProjTasks.length) return alert("โปรดเพิ่มงานย่อยอย่างน้อย 1 งาน");
    let isBoss = (currentUser.role === 'BOSS' || currentUser.role === 'ADMIN');

    if(existingProj) {
        let proj = allProjects.find(x => x.projName === existingProj);
        let masterDl = proj ? proj.deadline : "-";
        mockNewProjTasks.forEach(st => {
            allTasks.push({id: "T_" + Date.now() + Math.random(), project: existingProj, name: st.t, email: st.a, deadline: st.dl !== '-' ? st.dl : masterDl, dept: st.aDept || currentUser.dept, file: "", cc: "", tag: "โครงการหลัก", status: "ยังไม่เริ่มทำ", feedback: "", timeSpent: 0, taskDesc: st.desc || "", submittedAt: "", lateVerdict: "", editedAt: ""});
        });
        renderData();
        sendToSheets({ action: "addSubTasksToProject", projName: existingProj, dept: currentUser.dept, subTasks: mockNewProjTasks }, false);
    } else {
        let p = document.getElementById("cpName").value;
        let pEn = document.getElementById("cpNameEn").value;
        let dl = document.getElementById("cpDeadline").value;
        if(!p) return alert("โปรดระบุชื่อโครงการ");
        let projId = "P_" + Date.now();
        let projDept = isBoss ? 'มอบหมายโดยผู้บริหาร' : currentUser.dept;
        allProjects.push({ projId: projId, projName: p, projNameEn: pEn, deadline: dl || "-", dept: projDept, ownerEmail: currentUser.email, ownerName: currentUser.name, createdAt: new Date().toISOString() });
        mockNewProjTasks.forEach(st => {
            allTasks.push({id: "T_" + Date.now() + Math.random(), project: p, name: st.t, email: st.a, deadline: st.dl !== '-' ? st.dl : (dl || "-"), dept: st.aDept || currentUser.dept, file: "", cc: "", tag: "โครงการหลัก", status: "ยังไม่เริ่มทำ", feedback: "", timeSpent: 0, taskDesc: st.desc || "", submittedAt: "", lateVerdict: "", editedAt: ""});
        });
        renderData();
        sendToSheets({ action: "createMasterProject", projId: projId, projName: p, projNameEn: pEn, deadline: dl || "-", dept: projDept, ownerEmail: currentUser.email, ownerName: currentUser.name, subTasks: mockNewProjTasks }, false);
    }
    closeModal('createProjectModal');
    toast("บันทึกโครงการเรียบร้อยแล้ว ✅", "success");
}

// ข้อ 6+7 (รอบล่าสุด): renderHeadTasks รองรับงาน FYI ด้วย
function renderHeadTasks() {
    let tb = document.getElementById("headTasksTableBody");
    let tasks = allTasks.filter(t => t.dept === currentUser.dept && t.email !== currentUser.email &&
        (t.status === 'รอหัวหน้าตรวจ' || t.status.indexOf('แจ้งให้ทราบ: รอหัวหน้าตรวจ') === 0));

    if (tasks.length === 0) { tb.innerHTML = `<tr><td colspan="3" class="text-center p-6 text-slate-400">ไม่มีงานรอตรวจจากทีม</td></tr>`; return; }

    let bossOptions = dbUsers.filter(u => u.role === 'BOSS' || u.role === 'ADMIN').map(b => `<option value="ส่งผู้บริหาร_${b.email}">👑 อนุมัติส่งถึง: ${b.name}</option>`).join('');

    let html = '';
    tasks.forEach((t, i) => {
        let isFyi = t.status.indexOf('แจ้งให้ทราบ:') === 0;
        html += `
        <tr class="border-b border-slate-100">
            <td class="p-3 font-bold text-xs text-slate-800">${isFyi ? '📢 ' : ''}${t.name} <span class="text-slate-400 font-normal block text-[9px] mt-1">ผู้ส่ง: ${t.email}</span></td>
            <td class="p-3 text-center text-[10px] font-mono text-slate-500">${fmtDate(t.deadline)}<br>${lateStatusStr(t)}</td>
            <td class="p-3 text-center"><button onclick="document.getElementById('hAct_${i}').classList.toggle('hidden')" class="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-slate-200 transition">พิจารณา</button></td>
        </tr>
        <tr id="hAct_${i}" class="hidden bg-slate-50">
            <td colspan="3" class="p-4 space-y-3 border-b border-slate-200 shadow-inner">
                <div class="text-[11px] font-bold text-slate-700 space-y-1"><i class="fas fa-paperclip text-blue-500 mr-1"></i> ไฟล์แนบ: ${parseFileLinks(t.file)}</div>
                <div class="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 inline-block px-3 py-1.5 rounded-lg">⏱️ เวลาที่ใช้ทำงานทั้งหมด: ${fmtHM(t.timeSpent)}</div>
                ${t.taskDesc ? `<div class="text-[11px] bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-600"><b>📝 คำอธิบายงาน:</b> ${t.taskDesc}</div>` : ''}
                ${isFyi ? `
                    <div class="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-100 inline-block px-3 py-1.5 rounded-lg">📢 งานนี้ส่งมาเพื่อแจ้งให้ทราบเท่านั้น ไม่ต้องตรวจ</div>
                    <div class="flex justify-end">
                        <button onclick="ackTaskFyi('${t.id}')" class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">✅ รับทราบแล้ว</button>
                    </div>
                ` : `
                    <textarea id="fb_${t.id}" class="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500" placeholder="ฟีดแบกถึงทีมงาน (ถ้ามี)..."></textarea>
                    <div class="flex gap-2">
                        <select id="headActSelect_${t.id}" class="flex-1 p-2 text-xs border border-slate-300 rounded-lg outline-none">
                            <option value="จัดเก็บ">🗂️ ตรวจแล้วจัดเก็บ (จบที่หัวหน้า)</option>
                            ${bossOptions}
                            <option value="ตีกลับ">🔴 ตีกลับให้แก้ไข</option>
                        </select>
                        <button onclick="doHeadReview('${t.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow-sm transition">บันทึกผล</button>
                    </div>
                `}
            </td>
        </tr>`;
    });
    tb.innerHTML = html;
}

function renderPeerReviewSection() {
    let section = document.getElementById('peerReviewSection');
    let tb = document.getElementById('peerReviewTableBody');
    if(!section || !tb) return;

    let tasks = allTasks.filter(t => t.status && t.status.startsWith(`รอตรวจจาก: ${currentUser.email} ::`));
    if(tasks.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');

    let html = '';
    tasks.forEach((t, i) => {
        let nextFlow = t.status.split(':: ถัดไป:')[1]?.trim() || 'รอหัวหน้าตรวจ';
        html += `
        <tr class="border-b border-slate-100">
            <td class="p-3 font-bold text-xs text-slate-800">${t.name} <span class="text-slate-400 font-normal block text-[9px] mt-1">ผู้ส่ง: ${t.email}</span>${t.taskDesc ? `<span class="block text-[9px] text-indigo-500 mt-1">📝 ${t.taskDesc}</span>` : ''}</td>
            <td class="p-3 text-center text-[10px] font-mono text-slate-500">${fmtDate(t.deadline)}<br>${lateStatusStr(t)}</td>
            <td class="p-3 text-center"><button onclick="document.getElementById('pAct_${i}').classList.toggle('hidden')" class="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-slate-200 transition">พิจารณา</button></td>
        </tr>
        <tr id="pAct_${i}" class="hidden bg-slate-50">
            <td colspan="3" class="p-4 space-y-3 border-b border-slate-200 shadow-inner">
                <div class="text-[11px] font-bold text-slate-700 space-y-1"><i class="fas fa-paperclip text-blue-500 mr-1"></i> ไฟล์แนบ: ${parseFileLinks(t.file)}</div>
                <textarea id="pfb_${t.id}" class="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-fuchsia-500" placeholder="ความเห็นก่อนส่งต่อ (ถ้ามี)..."></textarea>
                <div class="flex justify-end space-x-2">
                    <button onclick="doPeerReview('${t.id}','ส่งกลับแก้ไข')" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">ตีกลับให้แก้ไข</button>
                    <button onclick="doPeerReview('${t.id}','${nextFlow}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">✅ ตรวจแล้ว ส่งต่อตามปกติ</button>
                </div>
            </td>
        </tr>`;
    });
    tb.innerHTML = html;
}

function doPeerReview(taskId, newStatus) {
    let fb = document.getElementById('pfb_'+taskId)?.value || '';
    let task = allTasks.find(x => x.id === taskId);
    if(task) { task.status = newStatus; if(fb) task.feedback = (task.feedback ? task.feedback + ' | ' : '') + `[${currentUser.name} ช่วยตรวจ]: ${fb}`; }
    renderData();
    sendToSheets({action: "reviewTask", taskId: taskId, status: newStatus, feedback: task ? task.feedback : fb}, false);
}

// ข้อ 3 (รอบล่าสุด): เพิ่มปุ่มแก้ไข/ลบ งานย่อยของตัวเองในตารางภารกิจวันนี้
function renderStaffTasks() {
    let tb = document.getElementById("myTaskTableBody");
    let tasks = allTasks.filter(t => t.email === currentUser.email && (t.status === 'กำลังทำ' || t.status === 'ยังไม่เริ่มทำ'));

    if (tasks.length === 0) { tb.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400 text-xs">ยอดเยี่ยม! ไม่มีภารกิจค้างทำ</td></tr>`; }
    else {
        let html = '';
        tasks.forEach(t => {
            if(taskSeconds[t.id] === undefined) taskSeconds[t.id] = t.timeSpent || 0;
            let dispSec = taskSeconds[t.id];
            html += `<tr id="tr_${t.id}" class="border-b border-blue-100"><td class="p-3 font-bold text-xs text-slate-800 tr-task">${t.name} <span class="block text-[10px] text-slate-400 font-normal mt-1">${t.project}</span>${t.taskDesc ? `<span class="block text-[9px] text-indigo-500 font-normal mt-1">📝 ${t.taskDesc}</span>` : ''}</td><td class="p-3 text-center text-[10px] font-mono text-slate-500 tr-dl">${fmtDate(t.deadline)}<br>${hoursRemainingStr(t.deadline)}</td><td class="p-3 text-center text-[11px] font-bold text-slate-700" id="tm_${t.id}">${formatMMSS(dispSec)}</td><td class="p-3 text-center space-x-1"><button onclick="startTimer('${t.id}'); markTaskWorking('${t.id}')" id="btnS_${t.id}" class="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold shadow-sm transition">▶️ เริ่มทำ</button><button onclick="pauseTimer('${t.id}')" id="btnP_${t.id}" class="hidden bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-bold transition">⏸️ พัก</button></td><td class="p-3 text-center space-x-1"><button onclick="openSubmitModal('${t.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">🚀 ส่ง</button><button onclick="editTask('${t.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1.5 rounded-lg text-[9px] font-bold">✏️</button><button onclick="deleteTaskConfirm('${t.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1.5 rounded-lg text-[9px] font-bold">🗑️</button></td></tr>`;
        });
        tb.innerHTML = html;
        tasks.forEach(t => {
            if(timers[t.id]) {
                let bS = document.getElementById('btnS_'+t.id), bP = document.getElementById('btnP_'+t.id);
                if(bS) bS.classList.add('hidden');
                if(bP) bP.classList.remove('hidden');
            }
        });
    }
}

// ข้อ 5 (รอบล่าสุด): กดดูรายละเอียดไฟล์/ลิงก์ของงานที่ส่งไปแล้ว
function renderMySubmittedTasks() {
    let tb = document.getElementById("mySubmittedTableBody");
    if(!tb || !currentUser) return;
    let tasks = allTasks.filter(t => t.email === currentUser.email && t.status !== 'ยังไม่เริ่มทำ' && t.status !== 'กำลังทำ');
    tasks.sort((a,b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    if (tasks.length === 0) { tb.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-slate-400">ยังไม่มีงานที่ส่งไป</td></tr>`; return; }

    function statusLabel(s) {
        if(s === 'เสร็จสิ้น') return `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold">✅ เสร็จสิ้น</span>`;
        if(s === 'ส่งกลับแก้ไข') return `<span class="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-bold">🔴 ตีกลับให้แก้ไข</span>`;
        if(s === 'รับทราบแล้ว') return `<span class="bg-sky-100 text-sky-700 px-2 py-1 rounded-lg font-bold">👍 รับทราบแล้ว</span>`;
        if(s.indexOf('แจ้งให้ทราบ:') === 0) return `<span class="bg-sky-50 text-sky-600 px-2 py-1 rounded-lg font-bold">📢 รอรับทราบ</span>`;
        if(s.startsWith('รอตรวจจาก:')) return `<span class="bg-fuchsia-100 text-fuchsia-700 px-2 py-1 rounded-lg font-bold">🙋 รอเพื่อนร่วมงานตรวจก่อน</span>`;
        if(s.startsWith('ส่งถึง:') || s === 'รอผู้บริหารตรวจ') return `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold">👑 รอผู้บริหารตรวจ</span>`;
        if(s === 'รอหัวหน้าตรวจ') return `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold">🧑‍💼 รอหัวหน้าฝ่ายตรวจ</span>`;
        return `<span class="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-bold">⏳ ${s}</span>`;
    }

    let html = '';
    tasks.forEach((t, i) => {
        html += `<tr class="border-b border-slate-100">
            <td class="p-3 font-bold text-slate-800">${t.name}<span class="block text-[9px] text-slate-400 font-normal mt-1">📂 ${t.project}</span></td>
            <td class="p-3 text-center font-mono text-slate-500">${fmtDate(t.deadline)}</td>
            <td class="p-3 text-center">${statusLabel(t.status)}</td>
            <td class="p-3 text-center"><button onclick="document.getElementById('mySub_${i}').classList.toggle('hidden')" class="bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-slate-200">ดูรายละเอียด</button></td>
        </tr>
        <tr id="mySub_${i}" class="hidden bg-slate-50">
            <td colspan="4" class="p-4 space-y-2 border-b border-slate-200">
                <div class="text-[11px] font-bold text-slate-700"><i class="fas fa-paperclip text-blue-500 mr-1"></i> ไฟล์/ลิงก์ที่ส่ง: ${parseFileLinks(t.file)}</div>
                ${t.taskDesc ? `<div class="text-[11px] bg-white border border-slate-200 p-2 rounded-lg text-slate-600"><b>📝 คำอธิบาย:</b> ${t.taskDesc}</div>` : ''}
                ${t.feedback ? `<div class="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-700 p-2 rounded-lg"><b>💬 ฟีดแบก:</b> ${t.feedback}</div>` : ''}
            </td>
        </tr>`;
    });
    tb.innerHTML = html;
}

function markTaskWorking(id) {
    let t = allTasks.find(x => x.id === id);
    if(t && t.status === 'ยังไม่เริ่มทำ') {
        t.status = 'กำลังทำ';
        sendToSheets({action: "reviewTask", taskId: id, status: 'กำลังทำ', feedback: t.feedback || ''}, false);
        renderData();
    }
}

function showProjDetails(pName) {
    if(currentUser.role !== "BOSS" && currentUser.role !== "ADMIN") {
        let projMeta = allProjects.find(p => p.projName === pName);
        let iAmOwner = projMeta && projMeta.ownerEmail === currentUser.email;
        let iHaveTaskHere = allTasks.some(t => t.project === pName && t.email === currentUser.email);
        let sameDept = projMeta && projMeta.dept === currentUser.dept;
        if(!iAmOwner && !iHaveTaskHere && !sameDept) { alert("คุณไม่มีสิทธิ์ดูโครงการนี้"); return; }
    }
    document.getElementById("selectedProjTitle").innerText = pName;
    let list = document.getElementById("checklistItemsList");
    let html = '';
    allTasks.filter(t => t.project === pName).forEach(t => {
        let late = !t.status.includes('เสร็จ') && isLate(t.deadline);
        let timeStr = t.timeSpent ? ` <span class="text-indigo-500">⏱️ ${fmtHM(t.timeSpent)}</span>` : '';
        let hrs = lateStatusStr(t);
        html += `<div class="bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div class="font-bold text-xs text-slate-700">⚪ ${t.name} <span class="font-normal text-[10px] text-slate-400 block mt-1">รับผิดชอบ: ${t.email} | กำหนดส่ง: ${fmtDate(t.deadline)} ${hrs}${timeStr}</span></div><span class="text-[9px] font-bold px-2 py-1 rounded-lg ${late ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">${late ? 'LATE 🔴' : t.status}</span></div>`;
    });
    list.innerHTML = html;
    document.getElementById("projectChecklistBox").classList.remove("hidden");
}

function updateSubTaskDropdown() {
    let p = document.getElementById("activeProjectSelect").value;
    let sub = document.getElementById("activeSubTaskSelect");

    sub.innerHTML = '<option value="">-- ระบุชื่องานเองด้านล่าง --</option>';

    if(p !== "งานทั่วไป") {
        let projectTasks = allTasks.filter(t => t.project === p);
        let uniqueTaskNames = [...new Set(projectTasks.map(t => t.name))];
        uniqueTaskNames.forEach(taskName => {
            sub.innerHTML += `<option value="${taskName}">${taskName}</option>`;
        });
    }
}

// ข้อ 5+6 (รอบล่าสุด): ประวัติงานของผู้ใช้ เพิ่มปุ่มดูรายละเอียดไฟล์/ลิงก์ในทุกแถว
function openUserTaskModal(email) {
    focusUserEmail = email;
    let u = dbUsers.find(x => x.email === email) || (currentUser && email === currentUser.email ? currentUser : null);
    document.getElementById("focusUserName").innerText = u ? `${u.name} (${email})` : email;
    let tb = document.getElementById("userTaskTableBody");
    let html = '';
    allTasks.filter(t => t.email === email).forEach((t, i) => {
        let timeStr = t.timeSpent ? ` <span class="text-[9px] text-indigo-500 font-bold">⏱️ ${fmtHM(t.timeSpent)}</span>` : '';
        html += `<tr class="border-b border-slate-100"><td class="p-3 font-bold text-indigo-600"><i class="fas fa-file-alt mr-1"></i> ภารกิจ</td><td class="p-3 text-slate-800 font-bold">${t.name}${timeStr} <span class="text-[9px] text-slate-400 font-normal block mt-1">📂 ${t.project}</span></td><td class="p-3 text-[10px] text-center">${t.cc || '-'}</td><td class="p-3 text-[10px] text-center font-mono text-slate-500">${fmtDate(t.deadline)}</td><td class="p-3 text-center text-[10px]"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-700">${t.status}</span></td><td class="p-3 text-center"><button onclick="document.getElementById('uHist_${i}').classList.toggle('hidden')" class="bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-[9px] font-bold hover:bg-slate-200">ดู</button></td></tr>
        <tr id="uHist_${i}" class="hidden bg-slate-50"><td colspan="6" class="p-3 space-y-1">
            <div class="text-[11px] font-bold text-slate-700"><i class="fas fa-paperclip text-blue-500 mr-1"></i> ไฟล์/ลิงก์: ${parseFileLinks(t.file)}</div>
            ${t.taskDesc ? `<div class="text-[11px] text-slate-600"><b>📝</b> ${t.taskDesc}</div>` : ''}
            ${t.feedback ? `<div class="text-[11px] text-indigo-700"><b>💬 ฟีดแบก:</b> ${t.feedback}</div>` : ''}
        </td></tr>`;
    });
    tb.innerHTML = html || `<tr><td colspan="6" class="text-center p-4 text-slate-400">ไม่มีประวัติภารกิจ</td></tr>`;

    let extraBox = document.getElementById("userExtraHistoryBox");
    if(extraBox) {
        let lessons = allMeets.filter(m => m.email === email);
        let questions = allMsgs.filter(m => m.email === email);
        let notes = allNotes.filter(n => n.email === email);
        let sec = '';
        sec += `<div><h4 class="font-bold text-xs text-slate-700 border-b border-slate-200 pb-2 mb-2 mt-3"><i class="fas fa-book-reader text-emerald-500 mr-1"></i> ถอดบทเรียน (${lessons.length})</h4>`;
        sec += lessons.length ? lessons.map(l => `<div class="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 mb-1.5 text-[11px]"><b>${l.type}</b> <span class="text-slate-400">(${fmtDate(l.date)})</span><div class="text-slate-600 mt-1">${escapeHtml(l.note)}</div></div>`).join('') : `<div class="text-[11px] text-slate-400">ไม่มีข้อมูล</div>`;
        sec += `</div>`;
        sec += `<div><h4 class="font-bold text-xs text-slate-700 border-b border-slate-200 pb-2 mb-2 mt-3"><i class="far fa-comments text-amber-500 mr-1"></i> คำถามที่เคยส่ง (${questions.length})</h4>`;
        sec += questions.length ? questions.map(q => `<div class="bg-amber-50 border border-amber-100 rounded-lg p-2.5 mb-1.5 text-[11px]"><div class="text-slate-700">${escapeHtml(q.text)}</div>${q.reply ? `<div class="mt-1 text-emerald-700">↳ ${escapeHtml(q.reply)}</div>` : `<div class="mt-1 text-slate-400 italic">รอการตอบกลับ...</div>`}</div>`).join('') : `<div class="text-[11px] text-slate-400">ไม่มีข้อมูล</div>`;
        sec += `</div>`;
        sec += `<div><h4 class="font-bold text-xs text-slate-700 border-b border-slate-200 pb-2 mb-2 mt-3"><i class="fas fa-file-signature text-purple-500 mr-1"></i> บันทึกข้อความที่เคยส่ง (${notes.length})</h4>`;
        sec += notes.length ? notes.map(n => `<div class="bg-purple-50 border border-purple-100 rounded-lg p-2.5 mb-1.5 text-[11px]"><b>${escapeHtml(n.topic)}</b> <span class="text-slate-400">(${n.status})</span>${n.link ? ` <a href="${n.link}" target="_blank" class="text-purple-600 hover:underline">🔗 ลิงก์</a>` : ''}</div>`).join('') : `<div class="text-[11px] text-slate-400">ไม่มีข้อมูล</div>`;
        sec += `</div>`;
        extraBox.innerHTML = sec;
    }

    renderUserDailySummary(email, 'today');
    openModal("userTaskModal");
}

function renderUserDailySummary(email, which) {
    let dateStr = which === 'today' ? todayStr() : yesterdayStr();
    document.getElementById('btnDaySumToday').className = which === 'today' ? 'flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-xs transition' : 'flex-1 bg-slate-200 text-slate-600 font-bold py-2 rounded-lg text-xs transition';
    document.getElementById('btnDaySumYesterday').className = which === 'yesterday' ? 'flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg text-xs transition' : 'flex-1 bg-slate-200 text-slate-600 font-bold py-2 rounded-lg text-xs transition';

    let dayAtt = allAtt.filter(a => a.email === email && new Date(a.time).toLocaleDateString('en-CA') === dateStr);
    dayAtt.sort((a,b) => new Date(a.time) - new Date(b.time));
    let clockIn = dayAtt.find(a => a.action === 'ClockIn');
    let clockOutList = dayAtt.filter(a => a.action === 'ClockOut');
    let clockOut = clockOutList.length ? clockOutList[clockOutList.length-1] : null;

    let att = computeAttendanceSecondsForDate(email, dateStr);
    let sessionCount = dayAtt.filter(a => a.action === 'ClockIn').length;

    let html = `<div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-white border border-slate-200 rounded-lg p-2.5"><span class="text-[10px] text-slate-400 block">🟢 ClockIn ${sessionCount > 1 ? `(${sessionCount} รอบ)` : ''}</span><span class="font-bold text-slate-800">${clockIn ? new Date(clockIn.time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '-'}</span></div>
        <div class="bg-white border border-slate-200 rounded-lg p-2.5"><span class="text-[10px] text-slate-400 block">🔴  ClockOut ล่าสุด</span><span class="font-bold text-slate-800">${clockOut ? new Date(clockOut.time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '-'}</span></div>
    </div>
    <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2 flex justify-between items-center">
        <span class="font-bold text-emerald-800">⏱️ รวมเวลาทำงาน (สะสมทุกรอบ)</span><span class="font-bold text-emerald-700">${fmtHM(att.total)}</span>
    </div>`;
    document.getElementById('userDailySummaryBox').innerHTML = html;
}

function updateNotiBadges() {
    if(!currentUser || (currentUser.role === "BOSS" || currentUser.role === "ADMIN")) return;
    let seen = new Set(getSeenInboxIds());
    let msgItems = allMsgs.filter(m => m.email === currentUser.email && m.reply).map(m => 'msg_'+m.id);
    let reqItems = allReqs.filter(r => r.email === currentUser.email && r.status !== "รอตอบ").map(r => 'req_'+r.id);
    let allItems = msgItems.concat(reqItems);
    let unseenCount = allItems.filter(id => !seen.has(id)).length;
    let badge = document.getElementById("inboxNotiBadge");
    if(badge) {
        if(unseenCount > 0) { badge.innerText = unseenCount;
                      badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
    }
}

function getSeenInboxIds() {
    try { return JSON.parse(localStorage.getItem('seenInbox_' + currentUser.email) || '[]'); } catch(e) { return []; }
}
function markInboxSeen(ids) {
    let seen = new Set(getSeenInboxIds());
    ids.forEach(id => seen.add(id));
    let arr = [...seen];
    if(arr.length > 500) arr = arr.slice(arr.length - 500);
    localStorage.setItem('seenInbox_' + currentUser.email, JSON.stringify(arr));
}

function renderStaffInboxContent() {
    let list = document.getElementById("staffInboxList");
    let html = '';
    let myMsgs = allMsgs.filter(m => m.email === currentUser.email);
    if(myMsgs.length > 0) {
        html += `<h4 class="font-bold text-xs text-slate-700 border-b border-slate-200 pb-2 mb-3">❓ คำถาม/การแจ้งเตือน</h4>`;
        myMsgs.slice().reverse().forEach(m => {
            let hasReply = !!m.reply;
            let isBounced = hasReply && m.reply.indexOf('🔄 [ตีกลับ') === 0;
            let isSystemNotice = m.text && m.text.indexOf('[ระบบแจ้งเตือน]') === 0;
            let replyBox = !hasReply ? `<div class="text-[10px] text-amber-500 font-bold italic"><i class="fas fa-hourglass-half"></i> รอการตอบกลับ...</div>`
                : isBounced ? `<div class="text-xs bg-rose-50 text-rose-800 p-2.5 rounded-lg border border-rose-200"><span class="font-bold">⚠️ ผู้บริหารตีกลับ:</span> ${wrapLongText(m.reply.replace('🔄 [ตีกลับ - กรุณาตรวจสอบผู้รับ] ',''), 'replyB_'+m.id)}</div>`
                : `<div class="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100"><span class="font-bold">${isSystemNotice ? '🔔' : '✅ ผู้บริหารตอบกลับ:'}</span> ${wrapLongText(m.reply, 'replyN_'+m.id)}</div>`;
            html += `<div class="bg-white p-4 rounded-lg border ${hasReply ? (isBounced ? 'border-rose-200 shadow-md' : 'border-emerald-200 shadow-md') : 'border-slate-200 shadow-sm'} mb-3">${isSystemNotice ? '' : `<div class="text-[11px] font-bold text-slate-700 mb-2">Q: ${wrapLongText(m.text, 'q_'+m.id)}</div>`}${replyBox}</div>`;
        });
    }

    let myReqs = allReqs.filter(r => r.email === currentUser.email);
    if(myReqs.length > 0) {
        html += `<h4 class="font-bold text-xs text-slate-700 border-b border-slate-200 pb-2 mb-3 mt-5">📅 สถานะขอนัดหมายเข้าพบ</h4>`;
        myReqs.slice().reverse().forEach(r => {
            let statusColor = r.status === "รับนัด" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : (r.status === "ปฏิเสธ" ? "text-rose-700 bg-rose-50 border-rose-200" : (r.status === "ขอแก้ไขเวลา" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-amber-700 bg-amber-50 border-amber-200"));
            let statusIcon = r.status === "รับนัด" ? "✅" : (r.status === "ปฏิเสธ" ? "❌" : (r.status === "ขอแก้ไขเวลา" ? "✏️" : "⏳"));
            let durLabel = r.duration ? ` (~${r.duration} นาที)` : '';
            let confirmBtn = r.status === "ขอแก้ไขเวลา" ? `<button onclick="confirmMeetingNewTime('${r.id}')" class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition">✅ ยืนยันเวลาใหม่ที่เสนอ</button>` : '';
            html += `<div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm mb-3"><div class="text-[11px] font-bold text-slate-700 mb-1">หัวข้อ: ${r.topic}</div><div class="text-[10px] text-slate-500 mb-3">เวลาที่ขอ: ${new Date(r.date).toLocaleString('th-TH')}${durLabel}</div><div class="text-[11px] p-2.5 rounded-lg border ${statusColor}"><span class="font-bold">${statusIcon} สถานะ: ${r.status}</span>${r.remark ? `<div class="mt-2 text-[10px] bg-white p-2 rounded opacity-90"><b class="block">หมายเหตุจากผู้บริหาร:</b> ${wrapLongText(r.remark, 'rmk_'+r.id)}</div>` : ''}${confirmBtn}</div></div>`;
        });
    }
    list.innerHTML = html || `<div class="text-center text-slate-400 text-xs py-8">คุณยังไม่มีประวัติการส่งคำถาม หรือขอนัดหมายผู้บริหาร</div>`;
}

async function openStaffInbox() {
    renderStaffInboxContent();
    openModal('staffInboxModal');

    let seenIds = allMsgs.filter(m => m.email === currentUser.email && m.reply).map(m => 'msg_'+m.id)
        .concat(allReqs.filter(r => r.email === currentUser.email && r.status !== "รอตอบ").map(r => 'req_'+r.id));
    markInboxSeen(seenIds);
    updateNotiBadges();

    await silentRefresh();
    if(!document.getElementById('staffInboxModal').classList.contains('hidden')) {
        renderStaffInboxContent();
    }
}

function checkLessonPerm() {
    let dateInp = document.getElementById("meetDateInput");
    if(dateInp && !dateInp.value) dateInp.value = new Date().toLocaleDateString('en-CA');
    document.getElementById("meetNote").disabled = false;
    document.getElementById("btnSubmitLesson").disabled = false;
}

function openCreateProjectModal() {
    mockNewProjTasks = [];
    document.getElementById("cpSubTaskList").innerHTML = "";
    document.getElementById("cpName").value = "";
    document.getElementById("cpNameEn").value = "";
    document.getElementById("cpDeadline").value = "";
    document.getElementById("cpSubTaskDl").value = "";

    let assignHtml = '<option value="">-- เลือกผู้รับผิดชอบ --</option>';
    dbUsers.filter(u => u.role !== 'BOSS' && u.role !== 'ADMIN').forEach(u => {
        assignHtml += `<option value="${u.email}" data-dept="${u.dept}">${u.name} (${u.dept})</option>`;
    });
    document.getElementById("cpAssignee").innerHTML = assignHtml;

    let isBoss = (currentUser.role === 'BOSS' || currentUser.role === 'ADMIN');
    let sel = document.getElementById("cpExistingProject");
    let html = '<option value="">➕ สร้างโครงการใหม่</option>';
    let projList = isBoss ? allProjects : allProjects.filter(p => p.dept === currentUser.dept);
    projList.forEach(p => { html += `<option value="${p.projName}">📂 ${p.projName} (DL: ${fmtDate(p.deadline)})</option>`; });
    sel.innerHTML = html;

    onCpProjectChange();
    openModal("createProjectModal");
}

function onCpProjectChange() {
    let val = document.getElementById("cpExistingProject").value;
    let newFields = document.getElementById("cpNewProjFields");
    let existWrap = document.getElementById("cpExistingSubTasksWrap");
    let label = document.getElementById("cpAddLabel");
    if(val) {
        newFields.classList.add("hidden");
        existWrap.classList.remove("hidden");
        label.innerText = " (เพิ่มเข้าโครงการ: " + val + ")";
        let list = document.getElementById("cpExistingSubTasksList");
        let existing = allTasks.filter(t => t.project === val);
        list.innerHTML = existing.length ? existing.map(t => `<li class="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between"><span>⚪ ${t.name}</span><span class="text-slate-500">${t.email} · ${t.status}</span></li>`).join('') : `<li class="text-slate-400 text-center py-2">ยังไม่มีงานย่อยในโครงการนี้</li>`;
    } else {
        newFields.classList.remove("hidden");
        existWrap.classList.add("hidden");
        label.innerText = "";
    }
}

function addMockSubTask() {
    let t = document.getElementById("cpSubTask").value;
    let dl = document.getElementById("cpSubTaskDl").value;
    let desc = document.getElementById("cpSubTaskDesc").value;
    let aSelect = document.getElementById("cpAssignee");
    let a = aSelect.value;
    let aName = aSelect.options[aSelect.selectedIndex]?.text;
    let aDept = aSelect.options[aSelect.selectedIndex]?.getAttribute('data-dept') || currentUser.dept;
    if(!t || !a) return alert("ระบุงานย่อยและเลือกคนรับผิดชอบให้ครบถ้วน");

    mockNewProjTasks.push({t: t, a: a, aName: aName, aDept: aDept, dl: dl || '-', desc: desc || ''});
    document.getElementById("cpSubTask").value = "";
    document.getElementById("cpSubTaskDl").value = "";
    document.getElementById("cpSubTaskDesc").value = "";

    let html = '';
    mockNewProjTasks.forEach(x => { html += `<li class="bg-white p-2 rounded border mb-1"><div class="flex justify-between items-center"><span>⚪ ${x.t} ${x.dl !== '-' ? '<span class="text-[9px] text-slate-400">(DL: '+fmtDate(x.dl)+')</span>':''}</span> <span class="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[9px]">${x.aName}</span></div>${x.desc ? `<div class="text-[9px] text-slate-500 mt-1">📝 ${x.desc}</div>` : ''}</li>`; });
    document.getElementById("cpSubTaskList").innerHTML = html;
}

// --- 5.5 CLOCK IN/OUT ---
function computeAttendanceSecondsForDate(email, dateStr) {
    let dayAtt = allAtt.filter(a => a.email === email && new Date(a.time).toLocaleDateString('en-CA') === dateStr);
    dayAtt.sort((a,b) => new Date(a.time) - new Date(b.time));
    let total = 0, openIn = null;
    dayAtt.forEach(a => {
        if(a.action === 'ClockIn') { openIn = new Date(a.time); }
        else if(a.action === 'ClockOut' && openIn) { total += Math.floor((new Date(a.time) - openIn)/1000); openIn = null; }
    });
    return { total: total, stillOpen: !!openIn, openInTime: openIn };
}
function computeTodayAttendanceSeconds(email) { return computeAttendanceSecondsForDate(email, todayStr()); }

function resumeAttendanceState() {
    if(!currentUser) return;
    let att = computeTodayAttendanceSeconds(currentUser.email);
    masterSeconds = att.total;
    if(masterTimerInterval) { clearInterval(masterTimerInterval); masterTimerInterval = null; }

    if(att.stillOpen) {
        isClockedIn = true;
        masterSessionStart = att.openInTime.getTime();
        let statusEl = document.getElementById("clockStatus");
        if(statusEl) {
            statusEl.innerText = "🟢 Online (กำลังปฏิบัติงาน)";
            statusEl.classList.remove("text-slate-800");
            statusEl.classList.add("text-emerald-600");
        }
        let btnOut = document.getElementById("btnClockOut");
        if(btnOut) {
            btnOut.innerText = "🔴 ClockOut (พัก/เลิกงาน)";
            btnOut.className = "w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition";
        }
        masterTimerInterval = setInterval(refreshMasterDisplay, 1000);
        refreshMasterDisplay();
    } else {
        isClockedIn = false;
        masterSessionStart = null;
        let statusEl = document.getElementById("clockStatus");
        if(statusEl) {
            statusEl.innerText = "🔴 Offline (ยังไม่ได้ ClockIn)";
            statusEl.classList.remove("text-emerald-600");
            statusEl.classList.add("text-slate-800");
        }
        let el = document.getElementById("masterTimerDisplay");
        if(el) el.innerText = fmtHMS(masterSeconds);
    }
    updateDailySessionNote();
}

function masterClockIn() {
    isClockedIn = true;
    masterSessionStart = Date.now();
    document.getElementById("clockStatus").innerText = "🟢 ClockIn (Working)";
    document.getElementById("clockStatus").classList.remove("text-slate-800");
    document.getElementById("clockStatus").classList.add("text-emerald-600");
    let btnOut = document.getElementById("btnClockOut");
    btnOut.disabled = false;
    btnOut.innerText = "🔴 ClockOut (Break/ClockOut)";
    btnOut.className = "w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition";
    document.getElementById("timeLogged").innerText = "ClockIn ล่าสุด: " + new Date().toLocaleTimeString('th-TH');
    sendToSheets({action: "ClockIn", email: currentUser.email, name: currentUser.name, time: new Date().toISOString()}, false);
    updateDailySessionNote();
    if(currentUser.role !== 'BOSS' && currentUser.role !== 'ADMIN') silentRefresh();

    if(masterTimerInterval) clearInterval(masterTimerInterval);
    masterTimerInterval = setInterval(refreshMasterDisplay, 1000);
    refreshMasterDisplay();
}

function masterClockOut() {
    if(masterTimerInterval) clearInterval(masterTimerInterval);
    masterTimerInterval = null;
    if(isClockedIn && masterSessionStart) {
        masterSeconds += Math.floor((Date.now() - masterSessionStart) / 1000);
    }
    isClockedIn = false;
    masterSessionStart = null;
    document.getElementById("clockStatus").innerText = "🔴 Offline (Break/ClockOut)";
    document.getElementById("clockStatus").classList.remove("text-emerald-600");
    document.getElementById("clockStatus").classList.add("text-slate-800");
    let btnOut = document.getElementById("btnClockOut");
    btnOut.disabled = false;
    btnOut.innerText = "🟢 ClockIn (Working)";
    btnOut.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition";
    sendToSheets({action: "ClockOut", email: currentUser.email, name: currentUser.name, time: new Date().toISOString()}, false);
    updateDailySessionNote();
    if(currentUser.role !== 'BOSS' && currentUser.role !== 'ADMIN') silentRefresh();
}

function toggleMasterClock() {
    if(isClockedIn) masterClockOut();
    else masterClockIn();
}

function updateDailySessionNote() {
    let el = document.getElementById("dailySessionNote");
    if(!el) return;
    let liveSec = masterSeconds + (isClockedIn && masterSessionStart ? Math.floor((Date.now()-masterSessionStart)/1000) : 0);
    let sessionsToday = allAtt.filter(a => a.email === currentUser?.email && new Date(a.time).toLocaleDateString('en-CA') === todayStr() && a.action === 'ClockIn').length;
    el.innerText = sessionsToday > 1
        ? `📌 วันนี้ ClockIn มาแล้ว ${sessionsToday} รอบ — เวลาสะสมรวม ${fmtHM(liveSec)}`
        : `📌 เวลาสะสมวันนี้: ${fmtHM(liveSec)}`;
}

function formatMMSS(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s/60).toString().padStart(2,'0') + ":" + (s%60).toString().padStart(2,'0'); }

function startTimer(id) {
    if(timers[id]) clearInterval(timers[id]);
    if(taskSeconds[id] === undefined) taskSeconds[id] = 0;
    let baseSec = taskSeconds[id];
    taskStartedAt[id] = Date.now();
    timers[id] = setInterval(() => {
        let liveSec = baseSec + Math.floor((Date.now() - taskStartedAt[id]) / 1000);
        taskSeconds[id] = liveSec;
        let el = document.getElementById('tm_'+id);
        if(el) el.innerText = formatMMSS(liveSec);
    }, 1000);
    document.getElementById('btnS_'+id).classList.add("hidden");
    document.getElementById('btnP_'+id).classList.remove("hidden");
}
function pauseTimer(id) {
    if(timers[id]) clearInterval(timers[id]);
    document.getElementById('btnP_'+id).classList.add("hidden");
    document.getElementById('btnS_'+id).classList.remove("hidden");
    if(taskStartedAt[id]) {
        let deltaSec = Math.round((Date.now() - taskStartedAt[id]) / 1000);
        if(deltaSec > 0 && currentUser) {
            let t = allTasks.find(x => x.id === id);
            sendToSheets({ action: "logTime", email: currentUser.email, name: currentUser.name, taskId: id, taskName: t ? t.name : id, project: t ? t.project : '', date: todayStr(), seconds: deltaSec }, false);
        }
        delete taskStartedAt[id];
    }
}

function openSubmitModal(id) {
    if(timers[id]) pauseTimer(id);
    let accumulated = taskSeconds[id] || 0;
    if(accumulated <= 0) {
        alert("⏱️ กรุณากดปุ่ม \"เริ่มทำ\" เพื่อจับเวลาทำงานก่อน ถึงจะนำส่งผลงานได้นะครับ");
        return;
    }
    curSubmitId = id;
    let t = allTasks.find(x => x.id === id);
    let feedbackAlert = t.feedback ? `<div class="mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg shadow-inner"><b class="block mb-1"><i class="fas fa-exclamation-circle"></i> ฟีดแบกจากการตีกลับ:</b> ${t.feedback}</div>` : '';
    document.getElementById("modalTaskName").innerHTML = t.name + feedbackAlert;
    document.getElementById("modalTaskDeadline").value = t.deadline;
    document.getElementById("modalTaskProj").value = t.project;
    document.getElementById("taskFileInput").value = "";
    document.getElementById("taskLinkInput").value = "";
    document.getElementById("taskSubmitDesc").value = "";
    document.getElementById("taskTag").value = "ทั่วไป";
    let fyiCb = document.getElementById("fyiOnlyCheckbox");
    if(fyiCb) fyiCb.checked = false;

    let ccSelect = document.getElementById("ccToSelect");
    for (let i = 0; i < ccSelect.options.length; i++) {
        ccSelect.options[i].selected = false;
    }

    let roleSel = document.getElementById('submitToRole');
    let roleInfo = document.getElementById('submitToRoleInfo');
    let bossWrap = document.getElementById('bossPickerWrap');
    let bossSelect = document.getElementById('bossPickerSelect');
    let peerSelect = document.getElementById('peerReviewerSelect');

    let peerCandidates = dbUsers.filter(u => u.email !== currentUser.email && u.role !== 'BOSS' && u.role !== 'ADMIN');
    peerSelect.innerHTML = '<option value="">-- ไม่ระบุ ส่งตามปกติ --</option>' + peerCandidates.map(u => `<option value="${u.email}">${u.name} (${u.dept || u.role})</option>`).join('');

    if(currentUser.role === 'HEAD') {
        roleSel.value = 'รอผู้บริหารตรวจ';
        roleInfo.innerText = '👑 ค่าเริ่มต้น: ส่งถึงผู้บริหาร (เลือกท่านใดท่านหนึ่งด้านล่าง หรือระบุคนอื่นให้ช่วยตรวจก่อนก็ได้)';
        bossWrap.classList.remove('hidden');
        let bosses = dbUsers.filter(u => u.role === 'BOSS' || u.role === 'ADMIN');
        bossSelect.innerHTML = '<option value="">-- ใช้ค่าเริ่มต้นด้านบน --</option>' + bosses.map(b => `<option value="ส่งถึง: ${b.email}">👑 ${b.name}</option>`).join('');
    } else {
        roleSel.value = 'รอหัวหน้าตรวจ';
        roleInfo.innerText = '👉 ค่าเริ่มต้น: ส่งให้หัวหน้าฝ่ายของคุณตรวจ (หรือระบุคนอื่นให้ช่วยตรวจก่อนก็ได้ ด้านล่าง)';
        bossWrap.classList.add('hidden');
    }

    let timeDisplay = document.getElementById("modalTimeSpentDisplay");
    if(timeDisplay) timeDisplay.innerText = "⏱️ เวลาที่ใช้ทำงานทั้งหมด: " + fmtHM(accumulated);
    openModal("submitTaskModal");
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

// --- 6. BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', initApp);
