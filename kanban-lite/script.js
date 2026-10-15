(() => {
  "use strict";

  const STORAGE_KEY = "kanban-lite-tasks-v1";
  const THEME_KEY = "kanban-lite-theme";
  const STATUSES = ["todo", "in-progress", "completed"];
  const STATUS_LABELS = { todo: "To do", "in-progress": "In progress", completed: "Completed" };
  const CATEGORIES = ["Development", "Design", "Marketing", "Research", "Operations"];
  const PRIORITIES = ["Low", "Medium", "High"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const elements = {
    form: $("#task-form"), dialog: $("#task-dialog"), title: $("#task-title"),
    description: $("#task-description"), category: $("#task-category"),
    priority: $("#task-priority"), status: $("#task-status"),
    search: $("#search-input"), categoryFilter: $("#category-filter"),
    error: $("#form-error"), toast: $("#toast")
  };

  // Guard against invalid or unavailable localStorage data.
  function loadTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(task =>
        task && typeof task.id === "string" &&
        typeof task.title === "string" &&
        STATUSES.includes(task.status) &&
        CATEGORIES.includes(task.category) &&
        PRIORITIES.includes(task.priority)
      ).map(task => ({
        id: task.id,
        title: task.title.slice(0, 120),
        description: typeof task.description === "string" ? task.description.slice(0, 500) : "",
        category: task.category,
        priority: task.priority,
        status: task.status,
        createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString()
      }));
    } catch (error) {
      console.warn("Could not read saved tasks.", error);
      return [];
    }
  }

  let tasks = loadTasks();
  let editingId = null;
  let draggedTaskId = null;
  let toastTimer = null;

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Could not save tasks.", error);
      showToast("Could not save changes. Check your browser storage settings.");
      return false;
    }
  }

  function makeId() {
    return window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Added recently";
    return `Added ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date)}`;
  }

  function getVisibleTasks() {
    const term = elements.search.value.trim().toLocaleLowerCase();
    const category = elements.categoryFilter.value;
    return tasks.filter(task => {
      const searchable = `${task.title} ${task.description}`.toLocaleLowerCase();
      return searchable.includes(term) && (category === "All" || task.category === category);
    });
  }

  function createTaskCard(task) {
    const card = makeElement("article", "task-card");
    card.dataset.priority = task.priority;
    card.dataset.taskId = task.id;
    card.draggable = true;
    card.setAttribute("aria-label", `${task.title}, ${task.priority} priority`);

    const top = makeElement("div", "task-card-top");
    top.append(makeElement("h4", "task-title", task.title));
    const menu = makeElement("button", "card-menu", "⋯");
    menu.type = "button";
    menu.setAttribute("aria-label", `Edit ${task.title}`);
    menu.title = "Edit task";
    menu.addEventListener("click", () => openTaskDialog(task));
    top.append(menu);
    card.append(top);

    if (task.description) card.append(makeElement("p", "task-description", task.description));

    const badges = makeElement("div", "task-badges");
    badges.append(makeElement("span", "category-badge", task.category));
    const priority = makeElement("span", "priority-badge", task.priority);
    priority.dataset.priority = task.priority;
    badges.append(priority);
    card.append(badges);

    const footer = makeElement("div", "card-footer");
    footer.append(makeElement("span", "card-date", formatDate(task.createdAt)));
    const statusSelect = makeElement("select", "status-select");
    statusSelect.setAttribute("aria-label", `Change status for ${task.title}`);
    STATUSES.forEach(status => {
      const option = makeElement("option", "", STATUS_LABELS[status]);
      option.value = status;
      option.selected = task.status === status;
      statusSelect.append(option);
    });
    statusSelect.addEventListener("change", () => updateTask(task.id, { status: statusSelect.value }));
    footer.append(statusSelect);
    card.append(footer);

    card.addEventListener("dragstart", event => {
      draggedTaskId = task.id;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
    });
    card.addEventListener("dragend", () => {
      draggedTaskId = null;
      card.classList.remove("dragging");
      $$(".column").forEach(column => column.classList.remove("drag-over"));
    });
    return card;
  }

  function renderTasks() {
    const visibleTasks = getVisibleTasks();
    const counts = { todo: 0, "in-progress": 0, completed: 0 };
    $$(".task-list").forEach(list => { list.replaceChildren(); });

    visibleTasks.forEach(task => {
      counts[task.status] += 1;
      const list = $(`#list-${task.status}`);
      if (list) list.append(createTaskCard(task));
    });

    STATUSES.forEach(status => {
      $(`#count-${status}`).textContent = counts[status];
      const list = $(`#list-${status}`);
      if (!list.children.length) {
        const empty = makeElement("div", "empty-state");
        empty.append(makeElement("span", "empty-icon", elements.search.value || elements.categoryFilter.value !== "All" ? "⌕" : "+"));
        empty.append(makeElement("strong", "", elements.search.value || elements.categoryFilter.value !== "All" ? "No matching tasks" : "Nothing here yet"));
        empty.append(makeElement("span", "", elements.search.value || elements.categoryFilter.value !== "All" ? "Try another search or filter." : "Drop a task here when you're ready."));
        list.append(empty);
      }
    });

    const total = tasks.length;
    const completed = tasks.filter(task => task.status === "completed").length;
    const inProgress = tasks.filter(task => task.status === "in-progress").length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    $("#total-count").textContent = total;
    $("#active-count").textContent = inProgress;
    $("#completed-count").textContent = completed;
    $("#progress-label").textContent = `${percentage}%`;
    $("#progress-fill").style.width = `${percentage}%`;
    $("#progress-bar").setAttribute("aria-valuenow", percentage);
    $("#board-count").textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;
  }

  function openTaskDialog(task = null, preferredStatus = "todo") {
    editingId = task ? task.id : null;
    elements.form.reset();
    elements.error.textContent = "";
    $("#dialog-title").textContent = task ? "Edit task" : "Create a task";
    $("#save-task-button").innerHTML = task ? 'Save changes <span aria-hidden="true">↗</span>' : 'Create task <span aria-hidden="true">↗</span>';
    elements.title.value = task ? task.title : "";
    elements.description.value = task ? task.description : "";
    elements.category.value = task ? task.category : "Development";
    elements.priority.value = task ? task.priority : "Medium";
    elements.status.value = task ? task.status : (STATUSES.includes(preferredStatus) ? preferredStatus : "todo");
    if (!elements.dialog.open) elements.dialog.showModal();
    requestAnimationFrame(() => elements.title.focus());
  }

  function closeTaskDialog() {
    elements.dialog.close();
    editingId = null;
    elements.error.textContent = "";
  }

  function updateTask(id, changes) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    const previousStatus = task.status;
    Object.assign(task, changes);
    saveTasks();
    renderTasks();
    if (changes.status && changes.status !== previousStatus) showToast(`Moved to ${STATUS_LABELS[changes.status]}.`);
  }

  function deleteTask(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    // Confirm destructive actions to prevent accidental data loss.
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    tasks = tasks.filter(item => item.id !== id);
    saveTasks();
    renderTasks();
    showToast("Task deleted.");
  }

  elements.form.addEventListener("submit", event => {
    event.preventDefault();
    const title = elements.title.value.trim();
    if (!title) {
      elements.error.textContent = "Please enter a task title.";
      elements.title.focus();
      return;
    }
    if (title.length > 120) {
      elements.error.textContent = "Task titles must be 120 characters or fewer.";
      return;
    }

    const data = {
      title,
      description: elements.description.value.trim().slice(0, 500),
      category: CATEGORIES.includes(elements.category.value) ? elements.category.value : "Development",
      priority: PRIORITIES.includes(elements.priority.value) ? elements.priority.value : "Medium",
      status: STATUSES.includes(elements.status.value) ? elements.status.value : "todo"
    };

    if (editingId) {
      const existing = tasks.find(task => task.id === editingId);
      if (existing) Object.assign(existing, data);
      showToast("Task updated.");
    } else {
      tasks.unshift({ id: makeId(), ...data, createdAt: new Date().toISOString() });
      showToast("Task created.");
    }
    saveTasks();
    renderTasks();
    closeTaskDialog();
  });

  $("#open-task-form").addEventListener("click", () => openTaskDialog());
  $("#close-dialog").addEventListener("click", closeTaskDialog);
  $("#cancel-task").addEventListener("click", closeTaskDialog);
  $$("[data-add-status]").forEach(button => button.addEventListener("click", () => openTaskDialog(null, button.dataset.addStatus)));
  elements.search.addEventListener("input", renderTasks);
  elements.categoryFilter.addEventListener("change", renderTasks);

  // Native HTML Drag and Drop API for desktop pointer interactions.
  $$(".column").forEach(column => {
    column.addEventListener("dragover", event => {
      if (!draggedTaskId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", event => {
      if (!column.contains(event.relatedTarget)) column.classList.remove("drag-over");
    });
    column.addEventListener("drop", event => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const id = event.dataTransfer.getData("text/plain") || draggedTaskId;
      const newStatus = column.dataset.status;
      if (id && STATUSES.includes(newStatus)) updateTask(id, { status: newStatus });
    });
  });

  // Keep destructive actions discoverable from each task card's edit menu.
  // The edit dialog includes a Delete action only while editing.
  const deleteButton = makeElement("button", "secondary-button", "Delete task");
  deleteButton.type = "button";
  deleteButton.style.color = "var(--high)";
  deleteButton.style.marginRight = "auto";
  deleteButton.hidden = true;
  $(".dialog-actions").prepend(deleteButton);
  deleteButton.addEventListener("click", () => {
    const id = editingId;
    if (id) {
      closeTaskDialog();
      deleteTask(id);
    }
  });
  const originalOpenTaskDialog = openTaskDialog;
  // Wrap the dialog opener so edit mode exposes its delete action.
  openTaskDialog = function(task = null, preferredStatus = "todo") {
    originalOpenTaskDialog(task, preferredStatus);
    deleteButton.hidden = !task;
  };

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("#theme-toggle").setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
    $("#theme-toggle").innerHTML = dark
      ? '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.6 8.6 0 1 0 20.2 15.1Z"/></svg>';
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) { /* Theme still works for this session. */ }
  }

  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  $("#today-label").textContent = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  }).format(new Date());

  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  } catch (_) {
    applyTheme("light");
  }

  renderTasks();
})();
