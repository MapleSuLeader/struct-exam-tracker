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
    // 优先用缓存
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
        // 降级到 localStorage
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

// 每日记录表单
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
async function getRecords() {
    return await fetchData('records.json', 'records');
}

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
        const accuracy = record.problems > 0 
            ? Math.round((record.correct / record.problems) * 100) 
            : 0;
        
        return `
            <div class="record-item">
                <div class="record-item-header">
                    <span class="record-date">${record.date}</span>
                    <div class="record-meta">
                        <span>⏱️ ${record.duration}分钟</span>
                        <span>📝 ${record.problems}题</span>
                        <span>✅ ${accuracy}%正确率</span>
                        <span>⚡ 精力${record.energy}/5</span>
                        <span>🎯 专注${record.focus}/5</span>
                    </div>
                </div>
                <div class="record-content">${record.content}</div>
                ${record.difficulties ? `<div class="record-notes">❓ ${record.difficulties}</div>` : ''}
                ${record.notes ? `<div class="record-notes"> ${record.notes}</div>` : ''}
                ${record.tomorrow ? `<div class="record-notes">📋 明日：${record.tomorrow}</div>` : ''}
            </div>
        `;
    }).join('');
}

// 错题表单
function initErrorForm() {
    const form = document.getElementById('error-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showAchievement('⚠️ 错题由 Spica 自动管理，请在飞书中告诉我错题内容');
    });
}

// 获取错题
async function getErrors() {
    return await fetchData('errors.json', 'errors');
}

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
                    <div class="error-answer-box wrong">
                        <strong>❌ 错误答案：</strong><br>
                        ${error.wrongAnswer || '未记录'}
                    </div>
                    <div class="error-answer-box correct">
                        <strong>✅ 正确答案：</strong><br>
                        ${error.correctAnswer}
                    </div>
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
    const today = new Date().toISOString().split('T')[0];
    
    const todayReview = [];
    const futureReview = [];
    
    (errors || []).forEach(error => {
        if (error.reviewSchedule) {
            error.reviewSchedule.forEach((schedule, idx) => {
                if (!schedule.completed) {
                    if (schedule.dueDate === today) {
                        todayReview.push({ error, scheduleIndex: idx, dueDate: schedule.dueDate });
                    } else if (schedule.dueDate > today) {
                        futureReview.push({ error, scheduleIndex: idx, dueDate: schedule.dueDate });
                    }
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
    
    const dashboardReview = document.getElementById('review-due-list');
    if (todayReview.length === 0) {
        dashboardReview.innerHTML = '<p class="empty-state">暂无待复习错题</p>';
    } else {
        dashboardReview.innerHTML = todayReview.slice(0, 5).map(item => `
            <div class="review-item">
                <strong>${item.error.topic}</strong> - ${item.error.subject}
            </div>
        `).join('');
    }
}

// 加载 Dashboard
async function loadDashboard() {
    const records = await getRecords();
    const errors = await getErrors();
    
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
            datasets: [{
                label: '学习时长（分钟）',
                data: weekData,
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 各科正确率图表
async function loadSubjectChart(records) {
    const ctx = document.getElementById('subject-chart');
    if (!ctx) return;
    
    const subjects = ['混凝土', '钢结构', '砌体', '桥梁', '地基', '高层'];
    const data = [0, 0, 0, 90, 0, 0]; // 桥梁已有基础
    
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: subjects,
            datasets: [{
                label: '正确率（%）',
                data: data,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: { r: { beginAtZero: true, max: 100 } }
        }
    });
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
            datasets: [{
                label: '学习时长（分钟）',
                data: last30.map(r => r.duration),
                borderColor: 'rgba(79, 70, 229, 1)',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true }
    });
}

function loadAccuracyTrendChart(records) {
    const ctx = document.getElementById('accuracy-trend-chart');
    if (!ctx) return;
    
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    
    const accuracyData = last30.map(r => 
        r.problems > 0 ? Math.round((r.correct / r.problems) * 100) : 0
    );
    
    if (ctx._chart) ctx._chart.destroy();
    ctx._chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30.map(r => r.date.substring(5)),
            datasets: [{
                label: '正确率（%）',
                data: accuracyData,
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
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
            datasets: [{
                data: Object.keys(typeCount).length ? Object.values(typeCount) : [1],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(16, 185, 129, 0.6)'
                ]
            }]
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
        <div class="progress-item">
            <span>${idx + 1}. ${topic}</span>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${(count / sorted[0][1]) * 100}%"></div>
            </div>
            <span>${count}次</span>
        </div>
    `).join('');
}

// 显示成就提示
function showAchievement(text) {
    const toast = document.getElementById('achievement-toast');
    toast.querySelector('.achievement-text').textContent = text;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

// 检查成就
function checkAchievements() {
    // 从 GitHub 数据检查，简化处理
}

// 弹窗控制
function showAddErrorModal() {
    document.getElementById('error-modal').classList.remove('hidden');
}
function closeErrorModal() {
    document.getElementById('error-modal').classList.add('hidden');
}

// 筛选器事件
document.getElementById('filter-subject').addEventListener('change', loadErrors);
document.getElementById('filter-error-type').addEventListener('change', loadErrors);
