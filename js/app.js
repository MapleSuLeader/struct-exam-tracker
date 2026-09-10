// 数据结构定义
const STORAGE_KEYS = {
    records: 'struct_exam_records',
    errors: 'struct_exam_errors',
    weeklyPlan: 'struct_exam_weekly_plan',
    achievements: 'struct_exam_achievements'
};

// 艾宾浩斯复习间隔（天）
const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initDailyForm();
    initErrorForm();
    loadDashboard();
    loadRecords();
    loadErrors();
    loadReviewSchedule();
    loadStats();
    checkAchievements();
});

// 导航切换
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            // 更新导航状态
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // 切换页面
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // 刷新对应页面数据
            if (targetId === 'dashboard') loadDashboard();
            if (targetId === 'daily') loadRecords();
            if (targetId === 'errors') loadErrors();
            if (targetId === 'review') loadReviewSchedule();
            if (targetId === 'stats') loadStats();
        });
    });
}

// 每日记录表单
function initDailyForm() {
    const form = document.getElementById('daily-form');
    const dateInput = document.getElementById('record-date');
    
    // 默认今天
    dateInput.valueAsDate = new Date();
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const record = {
            id: Date.now(),
            date: document.getElementById('record-date').value,
            content: document.getElementById('record-content').value,
            duration: parseInt(document.getElementById('record-duration').value),
            problems: parseInt(document.getElementById('record-problems').value),
            correct: parseInt(document.getElementById('record-correct').value),
            energy: parseInt(document.getElementById('record-energy').value),
            focus: parseInt(document.getElementById('record-focus').value),
            difficulties: document.getElementById('record-difficulties').value,
            notes: document.getElementById('record-notes').value,
            tomorrow: document.getElementById('record-tomorrow').value,
            createdAt: new Date().toISOString()
        };
        
        saveRecord(record);
        form.reset();
        dateInput.valueAsDate = new Date();
        
        showAchievement('✅ 学习记录已保存！');
        loadRecords();
        loadDashboard();
    });
}

// 保存学习记录
function saveRecord(record) {
    const records = getRecords();
    records.push(record);
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

// 获取学习记录
function getRecords() {
    const data = localStorage.getItem(STORAGE_KEYS.records);
    return data ? JSON.parse(data) : [];
}

// 加载历史记录
function loadRecords() {
    const records = getRecords();
    const container = document.getElementById('records-container');
    
    if (records.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无学习记录</p>';
        return;
    }
    
    // 按日期倒序
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
                        <span> 专注${record.focus}/5</span>
                    </div>
                </div>
                <div class="record-content">${record.content}</div>
                ${record.difficulties ? `<div class="record-notes">❓ ${record.difficulties}</div>` : ''}
                ${record.notes ? `<div class="record-notes">💡 ${record.notes}</div>` : ''}
                ${record.tomorrow ? `<div class="record-notes"> 明日：${record.tomorrow}</div>` : ''}
            </div>
        `;
    }).join('');
}

// 错题表单
function initErrorForm() {
    const form = document.getElementById('error-form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const error = {
            id: Date.now(),
            question: document.getElementById('error-question').value,
            subject: document.getElementById('error-subject').value,
            topic: document.getElementById('error-topic').value,
            wrongAnswer: document.getElementById('error-wrong-answer').value,
            correctAnswer: document.getElementById('error-correct-answer').value,
            errorType: document.getElementById('error-type').value,
            code: document.getElementById('error-code').value,
            difficulty: parseInt(document.getElementById('error-difficulty').value),
            reviewSchedule: calculateReviewSchedule(),
            createdAt: new Date().toISOString()
        };
        
        saveError(error);
        form.reset();
        closeErrorModal();
        
        showAchievement(' 错题已添加到复习计划！');
        loadErrors();
        loadReviewSchedule();
        loadDashboard();
    });
}

// 保存错题
function saveError(error) {
    const errors = getErrors();
    errors.push(error);
    localStorage.setItem(STORAGE_KEYS.errors, JSON.stringify(errors));
}

// 获取错题
function getErrors() {
    const data = localStorage.getItem(STORAGE_KEYS.errors);
    return data ? JSON.parse(data) : [];
}

// 计算艾宾浩斯复习计划
function calculateReviewSchedule() {
    const today = new Date();
    return EBBINGHAUS_INTERVALS.map(days => {
        const reviewDate = new Date(today);
        reviewDate.setDate(reviewDate.getDate() + days);
        return {
            dueDate: reviewDate.toISOString().split('T')[0],
            completed: false
        };
    });
}

// 加载错题列表
function loadErrors() {
    const errors = getErrors();
    const container = document.getElementById('errors-container');
    
    // 筛选器
    const subjectFilter = document.getElementById('filter-subject').value;
    const typeFilter = document.getElementById('filter-error-type').value;
    
    let filtered = errors;
    if (subjectFilter) {
        filtered = filtered.filter(e => e.subject === subjectFilter);
    }
    if (typeFilter) {
        filtered = filtered.filter(e => e.errorType === typeFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无错题</p>';
        return;
    }
    
    // 按创建时间倒序
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    container.innerHTML = filtered.map(error => {
        const stars = '⭐'.repeat(error.difficulty);
        const nextReview = error.reviewSchedule.find(r => !r.completed);
        
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
                    ${nextReview ? `<span> 下次复习：${nextReview.dueDate}</span>` : ''}
                    <span> 添加于：${error.createdAt.split('T')[0]}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 加载复习计划
function loadReviewSchedule() {
    const errors = getErrors();
    const today = new Date().toISOString().split('T')[0];
    
    const todayReview = [];
    const futureReview = [];
    
    errors.forEach(error => {
        error.reviewSchedule.forEach((schedule, idx) => {
            if (!schedule.completed) {
                if (schedule.dueDate === today) {
                    todayReview.push({
                        error: error,
                        scheduleIndex: idx,
                        dueDate: schedule.dueDate
                    });
                } else if (schedule.dueDate > today) {
                    futureReview.push({
                        error: error,
                        scheduleIndex: idx,
                        dueDate: schedule.dueDate
                    });
                }
            }
        });
    });
    
    // 今日待复习
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
                <button class="btn-review" onclick="completeReview(${item.error.id}, ${item.scheduleIndex})">
                    完成复习
                </button>
            </div>
        `).join('');
    }
    
    // 未来复习
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
    
    // Dashboard 待复习列表
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

// 完成复习
function completeReview(errorId, scheduleIndex) {
    const errors = getErrors();
    const error = errors.find(e => e.id === errorId);
    
    if (error && error.reviewSchedule[scheduleIndex]) {
        error.reviewSchedule[scheduleIndex].completed = true;
        error.reviewSchedule[scheduleIndex].completedAt = new Date().toISOString();
        
        saveError(error);
        loadReviewSchedule();
        loadDashboard();
        
        showAchievement('✅ 复习完成！');
    }
}

// 加载 Dashboard
function loadDashboard() {
    const records = getRecords();
    const errors = getErrors();
    
    // 总学习天数
    const uniqueDays = new Set(records.map(r => r.date)).size;
    document.getElementById('total-days').textContent = uniqueDays;
    
    // 总时长（小时）
    const totalMinutes = records.reduce((sum, r) => sum + r.duration, 0);
    document.getElementById('total-hours').textContent = (totalMinutes / 60).toFixed(1);
    
    // 做题总数
    const totalProblems = records.reduce((sum, r) => sum + r.problems, 0);
    document.getElementById('total-problems').textContent = totalProblems;
    
    // 平均正确率
    let totalCorrect = 0;
    records.forEach(r => { totalCorrect += r.correct; });
    const accuracy = totalProblems > 0 ? Math.round((totalCorrect / totalProblems) * 100) : 0;
    document.getElementById('accuracy-rate').textContent = `${accuracy}%`;
    
    // 本周学习时长图表
    loadWeeklyChart(records);
    
    // 各科正确率图表
    loadSubjectChart(records);
}

// 本周学习时长图表
function loadWeeklyChart(records) {
    const ctx = document.getElementById('weekly-chart');
    if (!ctx) return;
    
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayRecord = records.find(r => r.date === dateStr);
        weekData.push(dayRecord ? dayRecord.duration : 0);
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekDays,
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
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 各科正确率图表
function loadSubjectChart(records) {
    const ctx = document.getElementById('subject-chart');
    if (!ctx) return;
    
    // 这里简化处理，实际需要从错题中统计
    const subjects = ['混凝土', '钢结构', '砌体', '桥梁', '地基', '高层'];
    const data = [75, 68, 82, 90, 65, 70]; // 示例数据
    
    new Chart(ctx, {
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
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// 加载统计页面
function loadStats() {
    const records = getRecords();
    const errors = getErrors();
    
    // 学习时长趋势
    loadDurationTrendChart(records);
    
    // 正确率变化
    loadAccuracyTrendChart(records);
    
    // 错题类型分布
    loadErrorTypeChart(errors);
    
    // 薄弱知识点
    loadWeakTopics(errors);
}

// 学习时长趋势
function loadDurationTrendChart(records) {
    const ctx = document.getElementById('duration-trend-chart');
    if (!ctx) return;
    
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    
    new Chart(ctx, {
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
        options: {
            responsive: true
        }
    });
}

// 正确率变化
function loadAccuracyTrendChart(records) {
    const ctx = document.getElementById('accuracy-trend-chart');
    if (!ctx) return;
    
    const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    
    const accuracyData = last30.map(r => 
        r.problems > 0 ? Math.round((r.correct / r.problems) * 100) : 0
    );
    
    new Chart(ctx, {
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
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// 错题类型分布
function loadErrorTypeChart(errors) {
    const ctx = document.getElementById('error-type-chart');
    if (!ctx) return;
    
    const typeCount = {};
    errors.forEach(e => {
        typeCount[e.errorType] = (typeCount[e.errorType] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCount),
            datasets: [{
                data: Object.values(typeCount),
                backgroundColor: [
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(16, 185, 129, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// 薄弱知识点
function loadWeakTopics(errors) {
    const container = document.getElementById('weak-topics-list');
    if (!container) return;
    
    const topicCount = {};
    errors.forEach(e => {
        topicCount[e.topic] = (topicCount[e.topic] || 0) + 1;
    });
    
    const sorted = Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无错题数据</p>';
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
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// 检查成就
function checkAchievements() {
    const records = getRecords();
    const errors = getErrors();
    
    const achievements = [];
    
    // 连续学习成就
    if (records.length >= 7) {
        achievements.push('🔥 连续学习 7 天！');
    }
    if (records.length >= 30) {
        achievements.push('🔥 连续学习 30 天！');
    }
    
    // 做题成就
    const totalProblems = records.reduce((sum, r) => sum + r.problems, 0);
    if (totalProblems >= 100) {
        achievements.push('📝 累计做题 100 道！');
    }
    if (totalProblems >= 500) {
        achievements.push(' 累计做题 500 道！');
    }
    
    // 错题复习成就
    const completedReviews = errors.reduce((sum, e) => 
        sum + e.reviewSchedule.filter(r => r.completed).length, 0
    );
    if (completedReviews >= 50) {
        achievements.push('🔄 完成 50 次错题复习！');
    }
    
    // 显示第一个成就
    if (achievements.length > 0) {
        showAchievement(achievements[0]);
    }
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
