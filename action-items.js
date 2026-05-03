let db = null;
let currentUser = null;
let tabs = [];
let tasks = [];
let activeTabId = null;
let unsubTabs = null;
let unsubTasks = null;
let dragTaskId = null;
let dragSourceTabId = null;

function priorityRank(priority) {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

function setStatus(message, isError) {
  const el = document.getElementById('actionStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#B71C1C' : '#2E7D32';
  if (!message) return;
  setTimeout(() => {
    if (el.textContent === message) {
      el.textContent = '';
    }
  }, 2200);
}

function errorText(prefix, error) {
  if (!error) return prefix;
  const code = error.code ? ` (${error.code})` : '';
  const detail = error.message ? ` ${error.message}` : '';
  return `${prefix}${code}.${detail}`.trim();
}

function applyThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('prTheme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (themeToggle) {
    themeToggle.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
      localStorage.setItem('prTheme', next);
    });
  }
}

function tabsRef() {
  return db.collection('users').doc(currentUser.uid).collection('actionTabs');
}

function tasksRef(tabId) {
  return tabsRef().doc(tabId).collection('tasks');
}

function isTaskOverdue(task) {
  if (task.completed || !task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function renderTabs() {
  const list = document.getElementById('tabList');
  list.innerHTML = '';

  if (!tabs.length) {
    list.innerHTML = '<p class="card-sub">No sub tabs yet. Add your first one.</p>';
    document.getElementById('selectedTabLabel').textContent = 'Selected: -';
    return;
  }

  tabs.forEach((tab) => {
    const item = document.createElement('div');
    item.className = `subtab-item ${tab.id === activeTabId ? 'active' : ''}`;
    item.innerHTML = `
      <button type="button" class="subtab-name" data-select="${tab.id}">${tab.name}</button>
      <button type="button" class="subtab-delete" data-delete-tab="${tab.id}" aria-label="Delete sub tab">x</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-select]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-select')));
  });

  list.querySelectorAll('.subtab-item').forEach((item) => {
    item.addEventListener('dragover', onTabDragOver);
    item.addEventListener('dragleave', onTabDragLeave);
    item.addEventListener('drop', onTabDrop);
  });

  list.querySelectorAll('[data-delete-tab]').forEach((btn) => {
    btn.addEventListener('click', () => deleteSubTab(btn.getAttribute('data-delete-tab')));
  });

  const active = tabs.find((tab) => tab.id === activeTabId);
  document.getElementById('selectedTabLabel').textContent = active
    ? `Selected: ${active.name}`
    : 'Selected: -';
}

function renderTasks() {
  const list = document.getElementById('taskList');
  const taskFilter = document.getElementById('taskFilter');
  const taskSort = document.getElementById('taskSort');
  const reorderHint = document.getElementById('reorderHint');
  const filterValue = taskFilter ? taskFilter.value : 'all';
  const sortValue = taskSort ? taskSort.value : 'manual';
  const allowReorder = sortValue === 'manual' && filterValue === 'all';
  list.innerHTML = '';

  if (reorderHint) {
    reorderHint.textContent = allowReorder
      ? 'Drag tasks to reorder. Order is saved automatically.'
      : 'Drag reorder is available only in Manual sort with All filter.';
  }

  if (!activeTabId) {
    list.innerHTML = '<p class="card-sub">Select a sub tab to manage tasks.</p>';
    return;
  }

  if (!tasks.length) {
    list.innerHTML = '<p class="card-sub">No tasks yet in this sub tab.</p>';
    updateTaskStats([]);
    return;
  }

  updateTaskStats(tasks);

  const filtered = tasks.filter((task) => {
    if (filterValue === 'pending') return !task.completed;
    if (filterValue === 'completed') return Boolean(task.completed);
    if (filterValue === 'overdue') return isTaskOverdue(task);
    if (filterValue === 'high') return (task.priority || 'Medium') === 'High';
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = '<p class="card-sub">No tasks for this filter.</p>';
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    if (sortValue === 'manual') {
      const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
    }

    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (sortValue === 'due-desc' && dueA !== dueB) {
      return dueB - dueA;
    }

    if (sortValue === 'priority') {
      const p = priorityRank(b.priority || 'Medium') - priorityRank(a.priority || 'Medium');
      if (p !== 0) return p;
    }

    if (sortValue === 'newest') {
      const c = (b.createdAt || 0) - (a.createdAt || 0);
      if (c !== 0) return c;
    }

    if (dueA !== dueB) {
      return dueA - dueB;
    }

    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  sorted.forEach((task) => {
    const dueText = task.dueDate || 'No due date';
    const overdue = isTaskOverdue(task);
    const priority = task.priority || 'Medium';
    const priorityClass =
      priority === 'High'
        ? 'priority-high'
        : priority === 'Low'
          ? 'priority-low'
          : 'priority-medium';

    const row = document.createElement('div');
    row.className = `task-row ${task.completed ? 'done' : ''} ${overdue ? 'overdue' : ''}`;
    row.setAttribute('data-task-id', task.id);
    row.setAttribute('draggable', allowReorder ? 'true' : 'false');
    if (allowReorder) row.classList.add('draggable-row');
    row.innerHTML = `
      <label class="task-main">
        <span class="task-checkline">
          <span class="drag-handle" title="Drag to reorder">::</span>
          <input type="checkbox" data-toggle-task="${task.id}" ${task.completed ? 'checked' : ''} />
          <span class="task-title">${task.title}</span>
        </span>
        <span class="task-meta">
          <span class="task-chip ${priorityClass}">${priority}</span>
          <span class="task-chip due-chip ${overdue ? 'due-chip-overdue' : ''}">Due: ${dueText}</span>
        </span>
      </label>
      <button type="button" class="subtab-delete" data-delete-task="${task.id}" aria-label="Delete task">x</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('[data-toggle-task]').forEach((cb) => {
    cb.addEventListener('change', () => toggleTask(cb.getAttribute('data-toggle-task'), cb.checked));
  });

  list.querySelectorAll('[data-delete-task]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.getAttribute('data-delete-task')));
  });

  if (allowReorder) {
    list.querySelectorAll('.draggable-row').forEach((row) => {
      row.addEventListener('dragstart', onTaskDragStart);
      row.addEventListener('dragover', onTaskDragOver);
      row.addEventListener('drop', onTaskDrop);
      row.addEventListener('dragend', onTaskDragEnd);
    });
  }
}

function onTaskDragStart(event) {
  const row = event.currentTarget;
  dragTaskId = row.getAttribute('data-task-id');
  dragSourceTabId = activeTabId;
  row.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

function onTaskDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

async function onTaskDrop(event) {
  event.preventDefault();
  const targetRow = event.currentTarget;
  const targetTaskId = targetRow.getAttribute('data-task-id');

  if (!dragTaskId || !targetTaskId || dragTaskId === targetTaskId) return;
  await reorderTasks(dragTaskId, targetTaskId);
}

function onTaskDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.subtab-item.drag-over').forEach((tab) => {
    tab.classList.remove('drag-over');
  });
  dragTaskId = null;
  dragSourceTabId = null;
}

function onTabDragOver(event) {
  if (!dragTaskId) return;
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function onTabDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

async function onTabDrop(event) {
  event.preventDefault();
  const targetContainer = event.currentTarget;
  targetContainer.classList.remove('drag-over');

  if (!dragTaskId || !dragSourceTabId) return;
  const targetButton = targetContainer.querySelector('[data-select]');
  if (!targetButton) return;

  const targetTabId = targetButton.getAttribute('data-select');
  if (!targetTabId || targetTabId === dragSourceTabId) return;

  await moveTaskToTab(dragTaskId, dragSourceTabId, targetTabId);
}

async function moveTaskToTab(taskId, sourceTabId, targetTabId) {
  const taskToMove = tasks.find((task) => task.id === taskId);
  if (!taskToMove) return;

  try {
    const targetTasksSnapshot = await tasksRef(targetTabId).get();
    const targetOrders = targetTasksSnapshot.docs.map((doc) => {
      const data = doc.data();
      return typeof data.order === 'number' ? data.order : 0;
    });
    const nextOrder = targetOrders.length ? Math.max(...targetOrders) + 1 : 1;

    const payload = {
      ...taskToMove,
      order: nextOrder,
      movedAt: Date.now(),
    };
    delete payload.id;

    const batch = db.batch();
    batch.set(tasksRef(targetTabId).doc(taskId), payload, { merge: true });
    batch.delete(tasksRef(sourceTabId).doc(taskId));
    await batch.commit();

    setStatus('Task moved to selected sub tab.', false);
  } catch (error) {
    setStatus('Unable to move task to another sub tab.', true);
  }
}

async function reorderTasks(sourceTaskId, targetTaskId) {
  if (!activeTabId) return;

  const ordered = [...tasks]
    .sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (orderA !== orderB) return orderA - orderB;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const from = ordered.findIndex((task) => task.id === sourceTaskId);
  const to = ordered.findIndex((task) => task.id === targetTaskId);
  if (from < 0 || to < 0) return;

  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);

  try {
    const batch = db.batch();
    ordered.forEach((task, index) => {
      batch.set(
        tasksRef(activeTabId).doc(task.id),
        { order: index + 1 },
        { merge: true }
      );
    });
    await batch.commit();
    setStatus('Task order updated.', false);
  } catch (error) {
    setStatus('Unable to save task order.', true);
  }
}

function updateTaskStats(taskItems) {
  const stats = document.getElementById('taskStats');
  if (!stats) return;

  const total = taskItems.length;
  const pending = taskItems.filter((task) => !task.completed).length;
  const completed = taskItems.filter((task) => task.completed).length;
  const overdue = taskItems.filter((task) => isTaskOverdue(task)).length;

  stats.innerHTML = `
    <span class="stats-chip">Total: ${total}</span>
    <span class="stats-chip">Pending: ${pending}</span>
    <span class="stats-chip stats-chip-overdue">Overdue: ${overdue}</span>
    <span class="stats-chip stats-chip-complete">Completed: ${completed}</span>
  `;
}

function watchTasks(tabId) {
  if (unsubTasks) unsubTasks();
  tasks = [];
  renderTasks();

  if (!tabId) return;

  const watchingTabId = tabId;
  unsubTasks = tasksRef(tabId).onSnapshot((snapshot) => {
    // Ignore late snapshots from a previously selected tab.
    if (activeTabId !== watchingTabId) return;
    tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderTasks();
  }, (error) => {
    setStatus(errorText('Failed to load tasks for this tab', error), true);
  });
}

function setActiveTab(tabId) {
  activeTabId = tabId;
  localStorage.setItem('actionItemsActiveTab', tabId || '');

  const taskFilter = document.getElementById('taskFilter');
  if (taskFilter) {
    taskFilter.value = 'all';
  }

  renderTabs();
  watchTasks(activeTabId);
}

async function addSubTab() {
  const input = document.getElementById('newTabName');
  const name = input.value.trim();
  if (!name) {
    setStatus('Enter a sub tab name.', true);
    return;
  }

  try {
    const created = await tabsRef().add({ name, createdAt: Date.now() });
    input.value = '';
    setActiveTab(created.id);
    setStatus('Sub tab added.', false);
  } catch (error) {
    setStatus(errorText('Unable to add sub tab', error), true);
  }
}

async function deleteSubTab(tabId) {
  if (!tabId) return;

  try {
    const taskSnapshot = await tasksRef(tabId).get();
    const batch = db.batch();
    taskSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(tabsRef().doc(tabId));
    await batch.commit();

    if (activeTabId === tabId) {
      activeTabId = null;
    }

    setStatus('Sub tab deleted.', false);
  } catch (error) {
    setStatus(errorText('Unable to delete sub tab', error), true);
  }
}

async function addTask() {
  if (!activeTabId) {
    setStatus('Select a sub tab first.', true);
    return;
  }

  const input = document.getElementById('newTaskTitle');
  const dueInput = document.getElementById('newTaskDueDate');
  const priorityInput = document.getElementById('newTaskPriority');
  const title = input.value.trim();
  if (!title) {
    setStatus('Enter a task title.', true);
    return;
  }

  try {
    const nextOrder = tasks.length
      ? Math.max(...tasks.map((task) => (typeof task.order === 'number' ? task.order : 0))) + 1
      : 1;

    await tasksRef(activeTabId).add({
      title,
      dueDate: dueInput.value || '',
      priority: priorityInput.value || 'Medium',
      order: nextOrder,
      completed: false,
      createdAt: Date.now(),
    });
    input.value = '';
    dueInput.value = '';
    priorityInput.value = 'Medium';
    setStatus('Task added.', false);
  } catch (error) {
    setStatus(errorText('Unable to add task', error), true);
  }
}

async function toggleTask(taskId, checked) {
  if (!activeTabId || !taskId) return;

  try {
    await tasksRef(activeTabId).doc(taskId).set(
      { completed: checked, completedAt: checked ? Date.now() : null },
      { merge: true }
    );
  } catch (error) {
    setStatus(errorText('Unable to update task', error), true);
  }
}

async function deleteTask(taskId) {
  if (!activeTabId || !taskId) return;

  try {
    await tasksRef(activeTabId).doc(taskId).delete();
    setStatus('Task deleted.', false);
  } catch (error) {
    setStatus(errorText('Unable to delete task', error), true);
  }
}

async function clearCompleted() {
  if (!activeTabId) {
    setStatus('Select a sub tab first.', true);
    return;
  }

  try {
    const snapshot = await tasksRef(activeTabId).where('completed', '==', true).get();
    if (snapshot.empty) {
      setStatus('No completed tasks to delete.', false);
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    setStatus('Completed tasks deleted.', false);
  } catch (error) {
    setStatus(errorText('Unable to delete completed tasks', error), true);
  }
}

function watchTabs() {
  if (unsubTabs) unsubTabs();

  unsubTabs = tabsRef().onSnapshot((snapshot) => {
    tabs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!tabs.length) {
      activeTabId = null;
      renderTabs();
      renderTasks();
      return;
    }

    const savedActive = localStorage.getItem('actionItemsActiveTab');
    const existsSaved = tabs.some((tab) => tab.id === savedActive);

    if (!activeTabId) {
      activeTabId = existsSaved ? savedActive : tabs[0].id;
    } else if (!tabs.some((tab) => tab.id === activeTabId)) {
      activeTabId = tabs[0].id;
    }

    renderTabs();
    watchTasks(activeTabId);
  }, (error) => {
    setStatus(errorText('Failed to load sub tabs', error), true);
  });
}

async function ensureDefaultTab() {
  const snapshot = await tabsRef().limit(1).get();
  if (snapshot.empty) {
    const created = await tabsRef().add({ name: 'General', createdAt: Date.now() });
    activeTabId = created.id;
  }
}

async function init() {
  applyThemeToggle();

  await window.RajanAuth.requireAuth();
  currentUser = await window.RajanAuth.onAuthReady();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => window.RajanAuth.logout());
  }

  db = firebase.firestore();

  document.getElementById('addTabBtn').addEventListener('click', addSubTab);
  document.getElementById('addTaskBtn').addEventListener('click', addTask);
  document.getElementById('clearCompletedBtn').addEventListener('click', clearCompleted);
  document.getElementById('taskFilter').addEventListener('change', renderTasks);
  document.getElementById('taskSort').addEventListener('change', renderTasks);

  document.getElementById('newTabName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSubTab();
    }
  });

  document.getElementById('newTaskTitle').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTask();
    }
  });

  try {
    await ensureDefaultTab();
    watchTabs();
  } catch (error) {
    setStatus(errorText('Unable to initialize Action Items', error), true);
  }
}

init();
