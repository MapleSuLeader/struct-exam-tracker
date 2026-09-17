// 数据结构定义
const DATA_BASE_URL = 'https://raw.githubusercontent.com/MapleSuLeader/struct-exam-tracker/master/data';

// 艾宾浩斯复习间隔（天）
const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

// 全局数据缓存
let cachedRecords = null;
let cachedErrors = null;
let cachedWeeklyPlan = null;

// 科目颜色映射
const SUBJECT_COLORS = {
    '结构力学': '#4f46e5',
    '混凝土': '#10b981',
    '钢结构': '#f59e0b',
    '砌体': '#ef4444',
    '桥梁': '#3b82f6',
    '地基': '#8b5cf6',
    '高层': '#ec4899'
};

// 从 GitHub 加载数据
async function fetchData(filename, cacheKey) {
    if (cacheKey === 'records' && cachedRecords) return cachedRecords;
    if (cacheKey === 'errors' && cachedErrors) return cachedErrors;
    if (cacheKey === 'weeklyPlan' && cachedWeeklyPlan) return cachedWeeklyPlan;

    try {
        const response = await fetch(`${DATA_BASE_URL}/${filename}?t=${Date.now()}`);
        const data = await response.json();
        if (cacheKey === 'records') cachedRecords = data;
        if (cacheKey === 'errors') cachedErrors = data;
        if (cacheKey === 'weeklyPlan') cachedWeeklyPlan = data;
        return data;
    } catch (e) {
        console.error(`加载 ${filename} 失败:`, e);
        const local = localStorage.getItem(`struct_exam_${cacheKey}`);
        return local ? JSON.parse(local) : (Array.isArray([]) ? [] : {});
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initDailyForm();
    initErrorForm();
    await loadDashboard();
    await loadRecords();
    await loadErrors();
    await loadReviewSchedule();
    await loadStats();
    checkAchievements();
});

// 导航切换
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'dashboard') await loadDashboard();
            if (targetId === 'daily') await loadRecords();
            if (targetId === 'errors') await loadErrors();
            if (targetId === 'review') await loadReviewSchedule();
            if (targetId === 'stats') await loadStats();
            if (targetId === 'notes') {
                initNotesTabs();
                initSubjectTabs();
            }
        });
    });
}

// 笔记标签切换
function initNotesTabs() {
    const tabs = document.querySelectorAll('.note-tab');
    const notes = document.querySelectorAll('.cornell-note');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const lecture = tab.dataset.lecture;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            notes.forEach(note => note.classList.remove('active'));
            document.getElementById(`note-${lecture}`).classList.add('active');
        });
    });
}

// 科目切换
function initSubjectTabs() {
    const btns = document.querySelectorAll('.subject-btn');
    const contents = document.querySelectorAll('.subject-content');
    
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const subject = btn.dataset.subject;
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`subject-${subject}`).classList.add('active');
        });
    });
}

// 每日记录表单（禁用手动录入）
function initDailyForm() {
    const form = document.getElementById('daily-form');
    const dateInput = document.getElementById('record-date');
    dateInput.valueAsDate = new Date();
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showAchievement('⚠️ 数据由 Spica 自动管理，请在飞书中告诉我学习内容');
    });
}

// 获取学习记录
async function getRecords() { return await fetchData('records.json', 'records'); }

// 加载历史记录
async function loadRecords() {
    const records = await getRecords();
    const container = document.getElementById('records-container');
    if (!records || records.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无学习记录</p>';
        return;
    }
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = records.map(record => {
        const accuracy = record.problems > 0 ? Math.round((record.correct / record.problems) * 100) : 0;
        return `
            <div class="record-item">
                <div class="record-item-header">
                    <span class="record-date">${record.date}</span>
                    <span class="record-subject" style="background:#e8f4f8;color:#2980b9;padding:2px 8px;border-radius:10px;font-size:12px;margin-left:8px;">${record.subject || '未分类'}</span>
                    <div class="record-meta">
                        <span>⏱️ ${record.duration}分钟</span>
                        <span>📝 ${record.problems}题</span>
                        <span>✅ ${accuracy}%正确率</span>
                        <span>⚡ 精力${record.energy}/5</span>
                        <span> 专注${record.focus}/5</span>
                    </div>
                </div>
                <div class="record-content">${record.content}</div>
                ${record.difficulties ? `<div class="record-notes">❓ ${record.difficulties}</div>` : ''}
                ${record.notes ? `<div class="record-notes">💡 ${record.notes}</div>` : ''}
                ${record.tomorrow ? `<div class="record-notes">📋 明日：${record.tomorrow}</div>` : ''}
            </div>
        `;
    }).join('');
}

// 错题表单（禁用手动录入）
function initErrorForm() {
    const form = document.getElementById('error-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showAchievement('⚠️ 错题由 Spica 自动管理，请在飞书中告诉我错题内容');
    });
}

// 获取错题
async function getErrors() { return await fetchData('errors.json', 'errors'); }

// 加载错题列表
async function loadErrors() {
    const errors = await getErrors();
    const container = document.getElementById('errors-container');
    const subjectFilter = document.getElementById('filter-subject').value;
    const typeFilter = document.getElementById('filter-error-type').value;
    let filtered = errors || [];
    if (subjectFilter) filtered = filtered.filter(e => e.subject === subjectFilter);
    if (typeFilter) filtered = filtered.filter(e => e.errorType === typeFilter);
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无错题 🎉</p>';
        return;
    }
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    container.innerHTML = filtered.map(error => {
        const stars = '⭐'.repeat(error.difficulty || 3);
        const nextReview = error.reviewSchedule ? error.reviewSchedule.find(r => !r.completed) : null;
        return `
            <div class="error-item">
                <div class="error-item-header">
                    <span class="error-subject">${error.subject}</span>
                    <span class="error-tag">${error.errorType}</span>
                    <span class="error-tag">${stars}</span>
                </div>
                <div class="error-topic">${error.topic}</div>
                <div class="error-question">${error.question}</div>
                <div class="error-answers">
                    <div class="error-answer-box wrong"><strong>❌ 错误答案：</strong><br>${error.wrongAnswer || '未记录'}</div>
                    <div class="error-answer-box correct"><strong>✅ 正确答案：</strong><br>${error.correctAnswer}</div>
                </div>
                <div class="error-meta">
                    ${error.code ? `<span>📖 ${error.code}</span>` : ''}
                    ${nextReview ? `<span>📅 下次复习：${nextReview.dueDate}</span>` : ''}
                    <span>📆 添加于：${error.createdAt ? error.createdAt.split('T')[0] : ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 加载复习计划页面
async function loadReviewSchedule() {
    const errors = await getErrors();
    const weeklyPlan = await fetchData('weeklyPlan.json', 'weeklyPlan');
    const today = new Date().toISOString().split('T')[0];

    // 艾宾浩斯错题复习
    const todayReview = [];
    (errors || []).forEach(error => {
        if (error.reviewSchedule) {
            error.reviewSchedule.forEach((schedule, idx) => {
                if (!schedule.completed && schedule.dueDate <= today) {
                    todayReview.push({ error, scheduleIndex: idx, dueDate: schedule.dueDate });
                }
            });
        }
    });

    const todayContainer = document.getElementById('today-review-list');
    document.getElementById('today-review-count').textContent = `${todayReview.length} 题`;
    if (todayReview.length === 0) {
        todayContainer.innerHTML = '<p class="empty-state">今日无待复习错题 🎉</p>';
    } else {
        todayContainer.innerHTML = todayReview.map(item => `
            <div class="review-item-card">
                <div class="review-item-info">
                    <div class="review-item-topic">${item.error.topic}</div>
                    <div class="review-item-due">${item.error.subject} · ${item.error.errorType}</div>
                </div>
            </div>
        `).join('');
    }

    // 三周计划视图
    await loadThreeWeekView(weeklyPlan || {});
    
    // 横道图
    await loadGanttChart(weeklyPlan || {});
}

// 加载三周计划视图
async function loadThreeWeekView(weeklyPlan) {
    const today = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    // 获取本周周一
    const getMonday = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };
    
    const thisMonday = getMonday(today);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    
    // 生成一周数据
    const generateWeekData = (monday, isPast) => {
        const days = [];
        let completed = 0, total = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const plan = weeklyPlan[dateStr];
            const isToday = dateStr === today.toISOString().split('T')[0];
            
            let status = 'empty';
            let statusLabel = '无计划';
            if (plan) {
                total++;
                if (plan.status === 'completed') {
                    status = 'completed';
                    statusLabel = '已完成';
                    completed++;
                } else if (plan.status === 'in_progress') {
                    status = 'in-progress';
                    statusLabel = '进行中';
                } else if (isPast && d < today) {
                    status = 'empty';
                    statusLabel = '未完成';
                } else {
                    status = 'planned';
                    statusLabel = '计划中';
                }
            }
            
            days.push({
                date: dateStr,
                dayName: weekDays[d.getDay()],
                shortDate: `${d.getMonth()+1}/${d.getDate()}`,
                plan: plan,
                status: status,
                statusLabel: statusLabel,
                isToday: isToday
            });
        }
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { days, completed, total, pct };
    };
    
    const lastWeek = generateWeekData(lastMonday, true);
    const thisWeek = generateWeekData(thisMonday, false);
    const nextWeek = generateWeekData(nextMonday, false);
    
    // 渲染上周
    const lastWeekContainer = document.getElementById('last-week-days');
    const lastWeekPct = document.getElementById('last-week-pct');
    lastWeekPct.textContent = `${lastWeek.pct}%`;
    lastWeekPct.className = `week-completion ${lastWeek.pct >= 80 ? 'completed' : lastWeek.pct >= 50 ? 'partial' : 'pending'}`;
    lastWeekContainer.innerHTML = lastWeek.days.map(d => renderWeekDay(d)).join('');
    
    // 渲染本周
    const thisWeekContainer = document.getElementById('this-week-days');
    const thisWeekPct = document.getElementById('this-week-pct');
    thisWeekPct.textContent = `${thisWeek.pct}%`;
    thisWeekPct.className = `week-completion ${thisWeek.pct >= 80 ? 'completed' : thisWeek.pct >= 50 ? 'partial' : 'pending'}`;
    thisWeekContainer.innerHTML = thisWeek.days.map(d => renderWeekDay(d)).join('');
    
    // 渲染下周
    const nextWeekContainer = document.getElementById('next-week-days');
    document.getElementById('next-week-pct').textContent = '—';
    nextWeekContainer.innerHTML = nextWeek.days.map(d => renderWeekDay(d)).join('');
}

// 渲染单日
function renderWeekDay(d) {
    const statusClass = d.isToday ? 'today' : d.status;
    return `
        <div class="week-day-item ${statusClass}">
            <div class="week-day-label">
                <span class="week-day-name">${d.dayName} ${d.shortDate}</span>
                ${d.plan ? `<span class="week-day-status ${d.status}">${d.statusLabel}</span>` : ''}
            </div>
            <div class="week-day-topic">${d.plan ? `${d.plan.subject} - ${d.plan.topic}` : '—'}</div>
        </div>
    `;
}

// 加载横道图
async function loadGanttChart(weeklyPlan) {
    const ganttContainer = document.getElementById('gantt-chart');
    const legendContainer = document.getElementById('gantt-legend');
    
    // 计算时间范围：从2026-09-14到2026-10-27
    const startDate = new Date('2026-09-14');
    const endDate = new Date('2026-10-27');
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const today = new Date();
    const todayOffset = Math.max(0, Math.min(totalDays - 1, Math.floor((today - startDate) / (1000 * 60 * 60 * 24))));
    
    // 按科目分组计划
    const subjectPlans = {};
    const planEntries = Object.entries(weeklyPlan).sort((a, b) => a[0].localeCompare(b[0]));
    
    planEntries.forEach(([date, plan]) => {
        const subj = plan.subject;
        if (!subjectPlans[subj]) {
            subjectPlans[subj] = { subject: subj, days: [], completed: 0, total: 0 };
        }
        subjectPlans[subj].days.push({ date, plan });
        subjectPlans[subj].total++;
        if (plan.status === 'completed') {
            subjectPlans[subj].completed++;
        }
    });
    
    // 渲染横道图
    let html = '';
    
    // 时间轴标签（每周一）
    html += '<div class="gantt-timeline">';
    for (let i = 0; i < totalDays; i += 7) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const pct = (i / totalDays) * 100;
        html += `<span class="gantt-timeline-label" style="left:${pct}%">${d.getMonth()+1}/${d.getDate()}</span>`;
    }
    html += '</div>';
    
    // 各科目行
    Object.entries(subjectPlans).forEach(([subj, data]) => {
        const color = SUBJECT_COLORS[subj] || '#6b7280';
        const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        
        html += `<div class="gantt-row" data-subject="${subj}">`;
        html += `<div class="gantt-label">${subj}</div>`;
        html += `<div class="gantt-bar-container">`;
        
        // 绘制每天进度
        data.days.forEach(day => {
            const dayDate = new Date(day.date);
            const dayOffset = Math.floor((dayDate - startDate) / (1000 * 60 * 60 * 24));
            const left = (dayOffset / totalDays) * 100;
            const width = Math.max(1, 100 / totalDays);
            
            const statusClass = day.plan.status === 'completed' ? 'completed' : 
                                day.plan.status === 'in_progress' ? 'in-progress' : 'planned';
            
            html += `<div class="gantt-bar ${statusClass}" style="left:${left}%;width:${width}%;background:${color}" title="${day.date}: ${day.plan.topic}"></div>`;
        });
        
        // 今天标记线
        html += `<div class="gantt-today-line" style="left:${(todayOffset/totalDays)*100}%"></div>`;
        
        html += '</div></div>';
    });
    
    // 总进度行
    const totalCompleted = Object.values(subjectPlans).reduce((s, d) => s + d.completed, 0);
    const totalTotal = Object.values(subjectPlans).reduce((s, d) => s + d.total, 0);
    const totalPct = totalTotal > 0 ? Math.round((totalCompleted / totalTotal) * 100) : 0;
    
    html += `<div class="gantt-row" data-subject="total">`;
    html += `<div class="gantt-label">总进度</div>`;
    html += `<div class="gantt-bar-container">`;
    html += `<div class="gantt-bar completed" style="left:0;width:${totalPct}%;background:var(--primary)">${totalPct}%</div>`;
    html += `<div class="gantt-today-line" style="left:${(todayOffset/totalDays)*100}%"></div>`;
    html += '</div></div>';
    
    ganttContainer.innerHTML = html;
    
    // 图例
    legendContainer.innerHTML = `
        <div class="legend-item"><div class="legend-color completed"></div>已完成</div>
        <div class="legend-item"><div class="legend-color in-progress"></div>进行中</div>
        <div class="legend-item"><div class="legend-color planned"></div>计划中</div>
        <div class="legend-item"><div class="legend-color today-line"></div>今天</div>
    `;
    
    // 科目筛选器
    const filters = document.querySelectorAll('.filter-chip');
    filters.forEach(chip => {
        const checkbox = chip.querySelector('input');
        checkbox.addEventListener('change', () => {
            chip.classList.toggle('active', checkbox.checked);
            updateGanttVisibility();
        });
        // 初始化状态
        if (checkbox.checked) chip.classList.add('active');
    });
    
    // 点击切换
    filters.forEach(chip => {
        chip.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT') return;
            const checkbox = chip.querySelector('input');
            checkbox.checked = !checkbox.checked;
            chip.classList.toggle('active', checkbox.checked);
            updateGanttVisibility();
        });
    });
}

// 更新横道图可见性
function updateGanttVisibility() {
    const activeSubjects = new Set();
    document.querySelectorAll('.filter-chip').forEach(chip => {
        const checkbox = chip.querySelector('input');
        if (checkbox.checked) {
            activeSubjects.add(chip.dataset.subject);
        }
    });
    
    const showAll = activeSubjects.has('all');
    
    document.querySelectorAll('.gantt-row').forEach(row => {
        const subj = row.dataset.subject;
        if (subj === 'total') {
            row.style.display = 'flex';
        } else if (showAll) {
            row.style.display = 'flex';
        } else {
            row.style.display = activeSubjects.has(subj) ? 'flex' : 'none';
        }
    });
}

// 加载 Dashboard
async function loadDashboard() {
    const records = await getRecords();
    const errors = await getErrors();
    const weeklyPlan = await fetchData('weeklyPlan.json', 'weeklyPlan');

    const uniqueDays = new Set((records || []).map(r => r.date)).size;
    document.getElementById('total-days').textContent = uniqueDays;

    const totalMinutes = (records || []).reduce((sum, r) => sum + (r.duration || 0), 0);
    document.getElementById('total-hours').textContent = (totalMinutes / 60).toFixed(1);

    const totalProblems = (records || []).reduce((sum, r) => sum + (r.problems || 0), 0);
    document.getElementById('total-problems').textContent = totalProblems;

    let totalCorrect = 0;
    (records || []).forEach(r => { totalCorrect += (r.correct || 0); });
    const accuracy = totalProblems > 0 ? Math.round((totalCorrect / totalProblems) * 100) : 0;
    document.getElementById('accuracy-rate').textContent = `${accuracy}%`;

    await loadWeeklyChart(records || []);
    await loadSubjectChart(records || []);
    await loadWeeklyProgress(weeklyPlan || {});
}

// 本周学习时长图表
async function loadWeeklyChart(records) {
    const ctx = document.getElementById('weekly-chart');
    if (!ctx) return;
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const today = new Date();
    const weekData = [];
    const weekLabels = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayRecord = records.find(r => r.date === dateStr);
        weekData.push(dayRecord ? dayRecord.duration : 0);
        weekLabels.push(weekDays[date.getDay()] + ' ' + (date.getMonth()+1) + '/' + date.getDate());
    }
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekLabels,
            datasets: [{ label: '学习时长（分钟）', data: weekData, backgroundColor: 'rgba(79, 70, 229, 0.6)', borderColor: 'rgba(79, 70, 229, 1)', borderWidth: 1 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// 各科正确率雷达图（含结构力学）
async function loadSubjectChart(records) {
    const ctx = document.getElementById('subject-chart');
    if (!ctx) return;

    // 按科目统计正确率
    const subjectStats = {};
    (records || []).forEach(r => {
        const subj = r.subject || '未分类';
        if (!subjectStats[subj]) subjectStats[subj] = { total: 0, correct: 0 };
        subjectStats[subj].total += (r.problems || 0);
        subjectStats[subj].correct += (r.correct || 0);
    });

    const allSubjects = ['结构力学', '混凝土', '钢结构', '砌体', '桥梁', '地基', '高层'];
    const data = allSubjects.map(s => {
        if (subjectStats[s] && subjectStats[s].total > 0) {
            return Math.round((subjectStats[s].correct / subjectStats[s].total) * 100);
        }
        // 桥梁默认有基础分
        if (s === '桥梁') return 70;
        return 0;
    });

    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: allSubjects,
            datasets: [{
                label: '正确率（%）',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: { r: { beginAtZero: true, max: 100 } }
        }
    });
}

// 本周目标进度
async function loadWeeklyProgress(weeklyPlan) {
    const container = document.getElementById('weekly-progress-list');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        weekDays.push(d.toISOString().split('T')[0]);
    }

    const completed = weekDays.filter(d => weeklyPlan[d] && weeklyPlan[d].status === 'completed').length;
    const total = weekDays.filter(d => weeklyPlan[d]).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    let html = `
        <div class="progress-item">
            <span>本周进度（${completed}/${total}）</span>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span>${pct}%</span>
        </div>
    `;

    // 各科进度
    const subjectProgress = {};
    weekDays.forEach(d => {
        const plan = weeklyPlan[d];
        if (plan) {
            const subj = plan.subject;
            if (!subjectProgress[subj]) subjectProgress[subj] = { total: 0, done: 0 };
            subjectProgress[subj].total++;
            if (plan.status === 'completed') subjectProgress[subj].done++;
        }
    });

    Object.entries(subjectProgress).forEach(([subj, stats]) => {
        const p = Math.round((stats.done / stats.total) * 100);
        const color = SUBJECT_COLORS[subj] || 'var(--primary)';
        html += `
            <div class="progress-item">
                <span>${subj}</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${p}%;background:${color}"></div></div>
                <span>${p}%</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 加载统计页面
async function loadStats() {
    const records = await getRecords();
    const errors = await getErrors();
    loadDurationTrendChart(records || []);
    loadAccuracyTrendChart(records || []);
    loadErrorTypeChart(errors || []);
    loadWeakTopics(errors || []);
}

function loadDurationTrendChart(records) {
    const ctx = document.getElementById('duration-trend-chart');
    if (!ctx) return;
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30.map(r => r.date.substring(5)),
            datasets: [{ label: '学习时长（分钟）', data: last30.map(r => r.duration), borderColor: 'rgba(79, 70, 229, 1)', backgroundColor: 'rgba(79, 70, 229, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true }
    });
}

function loadAccuracyTrendChart(records) {
    const ctx = document.getElementById('accuracy-trend-chart');
    if (!ctx) return;
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    const accuracyData = last30.map(r => r.problems > 0 ? Math.round((r.correct / r.problems) * 100) : 0);
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30.map(r => r.date.substring(5)),
            datasets: [{ label: '正确率（%）', data: accuracyData, borderColor: 'rgba(16, 185, 129, 1)', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function loadErrorTypeChart(errors) {
    const ctx = document.getElementById('error-type-chart');
    if (!ctx) return;
    const typeCount = {};
    errors.forEach(e => { typeCount[e.errorType] = (typeCount[e.errorType] || 0) + 1; });
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCount).length ? Object.keys(typeCount) : ['暂无数据'],
            datasets: [{ data: Object.keys(typeCount).length ? Object.values(typeCount) : [1], backgroundColor: ['rgba(239,68,68,0.6)', 'rgba(245,158,11,0.6)', 'rgba(59,130,246,0.6)', 'rgba(16,185,129,0.6)'] }]
        },
        options: { responsive: true }
    });
}

function loadWeakTopics(errors) {
    const container = document.getElementById('weak-topics-list');
    if (!container) return;
    const topicCount = {};
    errors.forEach(e => { topicCount[e.topic] = (topicCount[e.topic] || 0) + 1; });
    const sorted = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无错题数据 🎉</p>';
        return;
    }
    container.innerHTML = sorted.map(([topic, count], idx) => `
        <div class="progress-item"><span>${idx+1}. ${topic}</span><div class="progress-bar"><div class="progress-fill" style="width:${(count/sorted[0][1])*100}%"></div></div><span>${count}次</span></div>
    `).join('');
}

function showAchievement(text) {
    const toast = document.getElementById('achievement-toast');
    toast.querySelector('.achievement-text').textContent = text;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

function checkAchievements() {}

function showAddErrorModal() { document.getElementById('error-modal').classList.remove('hidden'); }
function closeErrorModal() { document.getElementById('error-modal').classList.add('hidden'); }

document.getElementById('filter-subject').addEventListener('change', loadErrors);
document.getElementById('filter-error-type').addEventListener('change', loadErrors);