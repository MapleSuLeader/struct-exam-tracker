// 数据结构定义
const DATA_BASE_URL = 'https://raw.githubusercontent.com/MapleSuLeader/struct-exam-tracker/master/data';

// 艾宾浩斯复习间隔（天）
const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

// 全局数据缓存
let cachedRecords = null;
let cachedErrors = null;
let cachedWeeklyPlan = null;

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

// 加载复习计划
async function loadReviewSchedule() {
    const errors = await getErrors();
    const weeklyPlan = await fetchData('weeklyPlan.json', 'weeklyPlan');
    const today = new Date().toISOString().split('T')[0];

    // 艾宾浩斯错题复习
    const todayReview = [];
    const futureReview = [];
    (errors || []).forEach(error => {
        if (error.reviewSchedule) {
            error.reviewSchedule.forEach((schedule, idx) => {
                if (!schedule.completed) {
                    if (schedule.dueDate === today) todayReview.push({ error, scheduleIndex: idx, dueDate: schedule.dueDate });
                    else if (schedule.dueDate > today) futureReview.push({ error, scheduleIndex: idx, dueDate: schedule.dueDate });
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

    const futureContainer = document.getElementById('future-review-list');
    futureReview.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (futureReview.length === 0) {
        futureContainer.innerHTML = '<p class="empty-state">暂无未来复习计划</p>';
    } else {
        futureContainer.innerHTML = futureReview.slice(0, 10).map(item => `
            <div class="review-item-card">
                <div class="review-item-info">
                    <div class="review-item-topic">${item.error.topic}</div>
                    <div class="review-item-due">${item.dueDate} · ${item.error.subject}</div>
                </div>
            </div>
        `).join('');
    }

    // 本周学习计划（从 weeklyPlan 读取）
    const planContainer = document.getElementById('weekly-plan-list');
    if (planContainer) {
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const todayDate = new Date();
        let planHtml = '';
        for (let i = 0; i < 7; i++) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = i === 0 ? '今天' : (i === 1 ? '明天' : weekDays[d.getDay()]);
            const plan = weeklyPlan ? weeklyPlan[dateStr] : null;
            const statusIcon = plan ? (plan.status === 'completed' ? '✅' : (plan.status === 'in_progress' ? '🔄' : '📋')) : '⬜';
            const topicText = plan ? `${plan.subject} - ${plan.topic}` : '暂无安排';
            planHtml += `
                <div class="review-item-card" style="${dateStr === today ? 'border-left:3px solid #4f46e5;' : ''}">
                    <div class="review-item-info">
                        <div class="review-item-topic">${statusIcon} ${dayName}（${dateStr.substring(5)}）</div>
                        <div class="review-item-due">${topicText}</div>
                    </div>
                </div>
            `;
        }
        planContainer.innerHTML = planHtml;
    }

    const dashboardReview = document.getElementById('review-due-list');
    if (todayReview.length === 0) {
        dashboardReview.innerHTML = '<p class="empty-state">暂无待复习错题</p>';
    } else {
        dashboardReview.innerHTML = todayReview.slice(0, 5).map(item => `
            <div class="review-item"><strong>${item.error.topic}</strong> - ${item.error.subject}</div>
        `).join('');
    }
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
        html += `
            <div class="progress-item">
                <span>${subj}</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>
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
