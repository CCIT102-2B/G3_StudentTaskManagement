
"use strict";

const STORAGE_KEY = "studyFlowTasks";

let tasks = loadTasks();
let currentFilter = "all";
let editingTaskId = null;
let toastTimer = null;

const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskDescription = document.getElementById("taskDescription");
const taskDeadline = document.getElementById("taskDeadline");
const taskPriority = document.getElementById("taskPriority");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");
const searchTask = document.getElementById("searchTask");
const sortTasks = document.getElementById("sortTasks");
const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");
const formTitle = document.getElementById("formTitle");
const toast = document.getElementById("toast");

// Load saved tasks from browser storage.
function loadTasks() {
    try {
        const savedTasks = localStorage.getItem(STORAGE_KEY);

        if (!savedTasks) return [];

        const parsedTasks = JSON.parse(savedTasks);

        if (!Array.isArray(parsedTasks)) return [];

        return parsedTasks
            .filter(task => task && typeof task === "object")
            .map(task => ({
                id: String(task.id || createId()),
                title: String(task.title || "Untitled task"),
                description: String(task.description || ""),
                deadline: typeof task.deadline === "string"
                    ? task.deadline
                    : "",
                priority: ["Low", "Medium", "High"].includes(task.priority)
                    ? task.priority
                    : "Medium",
                completed: task.completed === true,
                createdAt: Number.isFinite(Number(task.createdAt))
                    ? Number(task.createdAt)
                    : Date.now()
            }));
    } catch (error) {
        console.error("Could not load tasks:", error);
        return [];
    }
}

// Save tasks to browser storage.
function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (error) {
        console.error("Could not save tasks:", error);
        showToast("Could not save tasks. Check browser storage.", "error");
        return false;
    }
}

// Create a unique ID.
function createId() {
    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Get today's date in YYYY-MM-DD format.
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Format a date.
function formatDate(dateString) {
    if (!dateString) return "No deadline";

    const parts = dateString.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return dateString;
    }

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return dateString;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

// Show a notification.
function showToast(message, type = "success") {
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 2800);
}

// Update dashboard counts.
function updateSummary() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    const today = getTodayString();

    const overdue = tasks.filter(task =>
        !task.completed &&
        task.deadline &&
        task.deadline < today
    ).length;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("pendingTasks").textContent = pending;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("overdueTasks").textContent = overdue;
}

// Get the deadline status.
function getDeadlineStatus(task) {
    if (task.completed) {
        return {
            label: `✓ Completed · ${formatDate(task.deadline)}`,
            className: "done"
        };
    }

    if (!task.deadline) {
        return {
            label: "No deadline",
            className: ""
        };
    }

    const today = getTodayString();

    if (task.deadline < today) {
        return {
            label: `Overdue · ${formatDate(task.deadline)}`,
            className: "overdue"
        };
    }

    if (task.deadline === today) {
        return {
            label: `Due today · ${formatDate(task.deadline)}`,
            className: "due-today"
        };
    }

    return {
        label: `Due ${formatDate(task.deadline)}`,
        className: ""
    };
}

// Search, filter, and sort tasks.
function getVisibleTasks() {
    const query = searchTask.value.trim().toLowerCase();

    const result = tasks.filter(task => {
        if (currentFilter === "pending" && task.completed) {
            return false;
        }

        if (currentFilter === "completed" && !task.completed) {
            return false;
        }

        const searchableText =
            `${task.title} ${task.description}`.toLowerCase();

        return searchableText.includes(query);
    });

    if (sortTasks.value === "newest") {
        result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortTasks.value === "priority") {
        const rank = {
            High: 3,
            Medium: 2,
            Low: 1
        };

        result.sort((a, b) => {
            if (a.completed !== b.completed) {
                return Number(a.completed) - Number(b.completed);
            }

            return (
                (rank[b.priority] || 0) - (rank[a.priority] || 0) ||
                (a.deadline || "9999-12-31").localeCompare(
                    b.deadline || "9999-12-31"
                )
            );
        });
    } else {
        result.sort((a, b) => {
            if (a.completed !== b.completed) {
                return Number(a.completed) - Number(b.completed);
            }

            return (
                (a.deadline || "9999-12-31").localeCompare(
                    b.deadline || "9999-12-31"
                ) ||
                b.createdAt - a.createdAt
            );
        });
    }

    return result;
}

// Create a badge.
function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = `badge ${className}`.trim();
    badge.textContent = text;

    return badge;
}

// Display tasks.
function renderTasks() {
    const visibleTasks = getVisibleTasks();

    taskList.replaceChildren();

    document.getElementById("visibleTaskCount").textContent =
        `${visibleTasks.length} ${
            visibleTasks.length === 1 ? "task" : "tasks"
        }`;

    emptyMessage.hidden = visibleTasks.length > 0;

    if (visibleTasks.length === 0) {
        const heading = emptyMessage.querySelector("h3");
        const message = emptyMessage.querySelector("p");

        if (tasks.length === 0) {
            heading.textContent = "No tasks yet";
            message.textContent =
                "Add your first task using the form to get started.";
        } else {
            heading.textContent = "No matching tasks";
            message.textContent =
                "Try another search or select a different filter.";
        }
    }

    visibleTasks.forEach(task => {
        const card = document.createElement("article");
        card.className =
            `task-card${task.completed ? " completed" : ""}`;

        const top = document.createElement("div");
        top.className = "task-top";

        // Complete button.
        const completeButton = document.createElement("button");
        completeButton.type = "button";
        completeButton.className = "complete-toggle";
        completeButton.textContent = task.completed ? "✓" : "";

        completeButton.setAttribute(
            "aria-pressed",
            String(task.completed)
        );

        completeButton.setAttribute(
            "aria-label",
            task.completed
                ? `Mark ${task.title} as pending`
                : `Mark ${task.title} as completed`
        );

        completeButton.title =
            completeButton.getAttribute("aria-label");

        completeButton.addEventListener("click", () => {
            toggleCompleted(task.id);
        });

        // Task title and description.
        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;
        content.appendChild(title);

        if (task.description) {
            const description = document.createElement("p");
            description.className = "task-description";
            description.textContent = task.description;
            content.appendChild(description);
        }

        // Priority and deadline badges.
        const badges = document.createElement("div");
        badges.className = "task-badges";

        const priorityClass =
            `priority-${String(task.priority).toLowerCase()}`;

        badges.appendChild(
            makeBadge(`${task.priority} priority`, priorityClass)
        );

        const deadline = getDeadlineStatus(task);

        badges.appendChild(
            makeBadge(
                deadline.label,
                `deadline-badge ${deadline.className}`
            )
        );

        content.appendChild(badges);

        // Edit and delete buttons.
        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "icon-btn";
        editButton.textContent = "✎";
        editButton.title = `Edit ${task.title}`;
        editButton.setAttribute(
            "aria-label",
            `Edit ${task.title}`
        );

        editButton.addEventListener("click", () => {
            editTask(task.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "icon-btn delete";
        deleteButton.textContent = "⌫";
        deleteButton.title = `Delete ${task.title}`;
        deleteButton.setAttribute(
            "aria-label",
            `Delete ${task.title}`
        );

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        actions.append(editButton, deleteButton);
        top.append(completeButton, content, actions);
        card.appendChild(top);
        taskList.appendChild(card);
    });

    updateSummary();
}

// Reset the form.
function resetForm() {
    taskForm.reset();
    taskPriority.value = "Medium";
    editingTaskId = null;

    formTitle.textContent = "Add a new task";
    saveButton.textContent = "＋ Add task";
    cancelButton.hidden = true;
}

// Add or update a task.
taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();
    const deadline = taskDeadline.value;
    const priority = taskPriority.value;

    if (!title) {
        showToast("Please enter a task title.", "error");
        taskTitle.focus();
        return;
    }

    if (!deadline) {
        showToast("Please select a deadline.", "error");
        taskDeadline.focus();
        return;
    }

    if (!["Low", "Medium", "High"].includes(priority)) {
        showToast("Please choose a valid priority.", "error");
        taskPriority.focus();
        return;
    }

    // Update an existing task.
    if (editingTaskId !== null) {
        const task = tasks.find(item => item.id === editingTaskId);

        if (!task) {
            showToast("Task could not be found.", "error");
            resetForm();
            return;
        }

        const previousTask = { ...task };

        task.title = title;
        task.description = description;
        task.deadline = deadline;
        task.priority = priority;

        if (!saveTasks()) {
            Object.assign(task, previousTask);
            return;
        }

        resetForm();
        renderTasks();
        showToast("Task updated successfully.");
        return;
    }

    // Create a new task.
    const newTask = {
        id: createId(),
        title,
        description,
        deadline,
        priority,
        completed: false,
        createdAt: Date.now()
    };

    tasks.push(newTask);

    if (!saveTasks()) {
        tasks = tasks.filter(task => task.id !== newTask.id);
        return;
    }

    resetForm();
    renderTasks();
    showToast("Task added successfully.");
});

// Edit a task.
function editTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) {
        showToast("Task could not be found.", "error");
        return;
    }

    editingTaskId = id;
    taskTitle.value = task.title;
    taskDescription.value = task.description;
    taskDeadline.value = task.deadline;
    taskPriority.value = task.priority;

    formTitle.textContent = "Edit task";
    saveButton.textContent = "Save changes";
    cancelButton.hidden = false;

    taskTitle.focus();

    document.querySelector(".form-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// Delete a task.
function deleteTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    const confirmed = window.confirm(
        `Delete "${task.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    const previousTasks = tasks;
    tasks = tasks.filter(item => item.id !== id);

    if (!saveTasks()) {
        tasks = previousTasks;
        return;
    }

    if (editingTaskId === id) {
        resetForm();
    }

    renderTasks();
    showToast("Task deleted.");
}

// Complete or reopen a task.
function toggleCompleted(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    const previousValue = task.completed;
    task.completed = !task.completed;

    if (!saveTasks()) {
        task.completed = previousValue;
        return;
    }

    renderTasks();

    showToast(
        task.completed
            ? "Task marked as completed."
            : "Task marked as pending."
    );
}

// Cancel editing.
cancelButton.addEventListener("click", () => {
    resetForm();
    showToast("Edit cancelled.");
});

// Search and sorting.
searchTask.addEventListener("input", renderTasks);
sortTasks.addEventListener("change", renderTasks);

// Filter buttons.
document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter || "all";

        document.querySelectorAll(".filter-btn").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });
});

// Initialize the page.
function initializePage() {
    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });

    taskDeadline.min = getTodayString();
    renderTasks();
}

initializePage();
