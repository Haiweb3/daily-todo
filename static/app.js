// 全局状态
let currentDate = new Date();
let selectedDate = new Date();
let currentTasks = [];

// DOM 元素
const elements = {
    calendarGrid: document.getElementById('calendarGrid'),
    calendarTitle: document.getElementById('calendarTitle'),
    currentDateDisplay: document.getElementById('currentDate'),
    tasksList: document.getElementById('tasksList'),
    taskCount: document.getElementById('taskCount'),
    newTaskInput: document.getElementById('newTaskInput'),
    addTaskBtn: document.getElementById('addTaskBtn'),
    taskPriority: document.getElementById('taskPriority'),
    selectedDateText: document.getElementById('selectedDateText'),
    emptyState: document.getElementById('emptyState'),
    stats: {
        total: document.getElementById('totalTasks'),
        completed: document.getElementById('completedTasks'),
        rate: document.getElementById('completionRate')
    },
    modal: {
        overlay: document.getElementById('editModal'),
        input: document.getElementById('editTaskInput'),
        priority: document.getElementById('editTaskPriority'),
        close: document.getElementById('closeModal'),
        cancel: document.getElementById('cancelEdit'),
        save: document.getElementById('saveEdit')
    }
};

let editingTaskId = null;

// 初始化
function init() {
    const now = new Date();
    // 强制使用当前时间
    currentDate = new Date(now);
    selectedDate = new Date(now);

    console.log('App Initializing:', {
        now: now.toString(),
        currentDate: currentDate.toString(),
        selectedDate: selectedDate.toString(),
        dateStr: formatDate(now)
    });

    renderCalendar();
    selectDate(now);
    setupEventListeners();
    updateDateDisplay();
    setInterval(updateDateDisplay, 1000);
}

// 格式化日期字符串 YYYY-MM-DD (使用本地时间)
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 显示当前日期
function updateDateDisplay() {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    elements.currentDateDisplay.textContent = new Date().toLocaleString('zh-CN', options);
}

// 渲染日历
async function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    elements.calendarTitle.textContent = `${year}年 ${month + 1}月`;
    elements.calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // 0 is Sunday

    // Show loading state
    elements.calendarGrid.classList.add('loading');

    // 获取本月统计数据用于标记
    const stats = await fetchMonthlyStats(year, (month + 1).toString().padStart(2, '0'));

    // Hide loading state
    elements.calendarGrid.classList.remove('loading');

    // 填充空白天数
    for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        elements.calendarGrid.appendChild(emptyDay);
    }

    // 填充日期
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = i;

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        // 标记是否有任务（注意 stats.days 使用两位数日期作为 key）
        const dayKey = String(i).padStart(2, '0');
        if (stats.days && stats.days[dayKey] && stats.days[dayKey].total > 0) {
            dayEl.classList.add('has-tasks');
        }

        // 标记今天
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayEl.classList.add('today');
        }

        // 标记选中日期
        if (year === selectedDate.getFullYear() && month === selectedDate.getMonth() && i === selectedDate.getDate()) {
            dayEl.classList.add('selected');
        }

        dayEl.addEventListener('click', () => {
            selectDate(new Date(year, month, i));
        });

        elements.calendarGrid.appendChild(dayEl);
    }

    // 更新月度统计显示
    elements.stats.total.textContent = stats.totalTasks;
    elements.stats.completed.textContent = stats.completedTasks;
    const rate = stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
    elements.stats.rate.textContent = `${rate}%`;
}

// 选择日期
function selectDate(date) {
    selectedDate = date;

    // 更新日历选中状态
    const allDays = document.querySelectorAll('.calendar-day');
    allDays.forEach(day => day.classList.remove('selected'));

    // 重新渲染日历以应用新的选中状态（这里可以优化，但重新渲染最简单）
    renderCalendar();

    // 更新标题文字
    const isToday = formatDate(date) === formatDate(new Date());
    elements.selectedDateText.textContent = isToday ? '今日任务' : `${date.getMonth() + 1}月${date.getDate()}日 任务`;

    // 加载任务
    loadTasks(formatDate(date));
}

// API 调用
async function fetchTasks(dateStr) {
    const res = await fetch(`/api/tasks/${dateStr}`);
    return await res.json();
}

async function fetchMonthlyStats(year, month) {
    try {
        const res = await fetch(`/api/stats/${year}/${month}`);
        return await res.json();
    } catch (e) {
        return { totalTasks: 0, completedTasks: 0, days: {} };
    }
}

// 加载任务列表
async function loadTasks(dateStr) {
    try {
        const data = await fetchTasks(dateStr);
        currentTasks = data.tasks || [];
        renderTasks();
    } catch (e) {
        console.error('Failed to load tasks', e);
    }
}

// 渲染任务列表
function renderTasks() {
    elements.tasksList.innerHTML = '';

    // 排序：高优先级在前 (保留已完成任务的位置)
    currentTasks.sort((a, b) => {
        const priorityScore = { urgent: 3, important: 2, normal: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
    });

    elements.taskCount.textContent = `${currentTasks.length} 项任务`;

    if (currentTasks.length === 0) {
        elements.tasksList.appendChild(elements.emptyState);
        elements.emptyState.style.display = 'block';
        return;
    }

    elements.emptyState.style.display = 'none';

    currentTasks.forEach(task => {
        const el = document.createElement('div');
        el.className = `task-item ${task.completed ? 'completed' : ''}`;
        el.innerHTML = `
            <div class="task-checkbox" onclick="toggleTask('${task.id}')">
                <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <div class="task-content">${escapeHtml(task.content)}</div>
            <div class="task-meta">
                <span class="priority-tag priority-${task.priority}">
                    ${getPriorityLabel(task.priority)}
                </span>
                <div class="task-actions">
                    <button class="action-btn" onclick="openEditModal('${task.id}')">✎</button>
                    <button class="action-btn delete-btn" onclick="deleteTask('${task.id}')">🗑</button>
                </div>
            </div>
        `;
        elements.tasksList.appendChild(el);
    });
}

// 添加任务
async function addTask() {
    const content = elements.newTaskInput.value.trim();
    if (!content) return;

    const priority = elements.taskPriority.value;
    const dateStr = formatDate(selectedDate);

    try {
        const res = await fetch(`/api/tasks/${dateStr}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, priority })
        });

        if (res.ok) {
            elements.newTaskInput.value = '';
            await loadTasks(dateStr);
            renderCalendar(); // 更新日历上的小点
        }
    } catch (e) {
        console.error('Error adding task', e);
    }
}

// 切换任务状态
async function toggleTask(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    const dateStr = formatDate(selectedDate);
    const updates = { completed: !task.completed };

    try {
        await fetch(`/api/tasks/${dateStr}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        await loadTasks(dateStr);
        renderCalendar();
    } catch (e) {
        console.error('Error updating task', e);
    }
}

// 删除任务
async function deleteTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) return;

    const dateStr = formatDate(selectedDate);
    try {
        await fetch(`/api/tasks/${dateStr}/${taskId}`, { method: 'DELETE' });
        await loadTasks(dateStr);
        renderCalendar();
    } catch (e) {
        console.error('Error deleting task', e);
    }
}

// 编辑任务
window.openEditModal = (taskId) => {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    elements.modal.input.value = task.content;
    elements.modal.priority.value = task.priority;
    elements.modal.overlay.style.display = 'flex';
};

async function saveEdit() {
    if (!editingTaskId) return;

    const content = elements.modal.input.value.trim();
    const priority = elements.modal.priority.value;
    const dateStr = formatDate(selectedDate);

    if (!content) return;

    try {
        await fetch(`/api/tasks/${dateStr}/${editingTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, priority })
        });

        elements.modal.overlay.style.display = 'none';
        editingTaskId = null;
        await loadTasks(dateStr);
    } catch (e) {
        console.error('Error saving edit', e);
    }
}

// 工具函数
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getPriorityLabel(p) {
    const map = { normal: '普通', important: '重要', urgent: '紧急' };
    return map[p] || p;
}

// 事件监听
function setupEventListeners() {
    // 导航
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // 添加任务
    elements.addTaskBtn.addEventListener('click', addTask);
    elements.newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // 模态框
    elements.modal.close.addEventListener('click', () => elements.modal.overlay.style.display = 'none');
    elements.modal.cancel.addEventListener('click', () => elements.modal.overlay.style.display = 'none');
    elements.modal.save.addEventListener('click', saveEdit);

    // 全局暴露函数给 HTML onclick 调用
    window.toggleTask = toggleTask;
    window.deleteTask = deleteTask;
}

init();
