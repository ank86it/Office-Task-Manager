let ganttChart = null;
let currentEditId = null;
let pendingImportTasks = [];

document.addEventListener("DOMContentLoaded", () => {
    ganttChart = new GanttChart("ganttChart");

    document.getElementById("yearInput").value =
        new Date().getFullYear();

    setupEvents();
    loadTasks();
});

function setupEvents() {
    document.getElementById("addTaskBtn").onclick =
        openNewTaskModal;

    document.getElementById("exportBtn").onclick =
        exportTasks;

    document.getElementById("importBtn").onclick = () => {
        document.getElementById("excelFile").click();
    };

    document.getElementById("excelFile").onchange =
        handleImportFile;

    document.getElementById("addSubtaskBtn").onclick = () => {
        addSubtask();
    };

    document.getElementById("taskForm").onsubmit =
        saveTask;

    document.getElementById("taskProgress").oninput = event => {
        document.getElementById("progressValue").textContent =
            event.target.value;
    };

    document.getElementById("toggleViewBtn").onclick =
        toggleView;

    document.getElementById("prevYearBtn").onclick = () => {
        ganttChart.previousYear();
        loadTasks();
    };

    document.getElementById("nextYearBtn").onclick = () => {
        ganttChart.nextYear();
        loadTasks();
    };

    document.getElementById("todayBtn").onclick = () => {
        ganttChart.goToToday();
        loadTasks();
    };

    document.getElementById("zoomInBtn").onclick = () => {
        ganttChart.zoomIn();
    };

    document.getElementById("zoomOutBtn").onclick = () => {
        ganttChart.zoomOut();
    };

    document.getElementById("yearInput").onchange = event => {
        ganttChart.setYear(event.target.value);
        ganttChart.month = 0;
        loadTasks();
    };

    document.getElementById("confirmImportBtn").onclick =
        confirmImport;
}

function loadTasks() {
    const tasks = storage.getTasks();

    ganttChart.render(tasks);
    renderTable(tasks);
    updateStatus();
}

function openNewTaskModal() {
    currentEditId = null;

    document.getElementById("modalTitle").textContent =
        "Add New Task";

    document.getElementById("taskForm").reset();

    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 30);

    document.getElementById("taskStartDate").value =
        toDateInput(today);

    document.getElementById("taskEndDate").value =
        toDateInput(end);

    document.getElementById("taskProgress").value = 0;
    document.getElementById("progressValue").textContent = 0;

    renderSubtasks([]);

    document.getElementById("taskModal").classList.remove("hidden");
}

function editTask(id) {
    const task = storage.getTaskById(id);

    if (!task) {
        notify("Task not found", "error");
        return;
    }

    currentEditId = id;

    document.getElementById("modalTitle").textContent =
        "Edit Task";

    document.getElementById("taskName").value =
        task.name || "";

    document.getElementById("taskAssignee").value =
        task.assignee || "";

    document.getElementById("taskPriority").value =
        task.priority || "medium";

    document.getElementById("taskStartDate").value =
        task.startDate || "";

    document.getElementById("taskEndDate").value =
        task.endDate || "";

    document.getElementById("taskProgress").value =
        task.progress || 0;

    document.getElementById("progressValue").textContent =
        task.progress || 0;

    document.getElementById("taskDescription").value =
        task.description || "";

    renderSubtasks(task.subtasks || []);

    document.getElementById("taskModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("taskModal").classList.add("hidden");
    currentEditId = null;
}

function saveTask(event) {
    event.preventDefault();

    const name = document.getElementById("taskName").value.trim();
    const startDate = document.getElementById("taskStartDate").value;
    const endDate = document.getElementById("taskEndDate").value;

    if (!name) {
        notify("Task name is required", "error");
        return;
    }

    if (!startDate || !endDate) {
        notify("Start and end dates are required", "error");
        return;
    }

    if (endDate < startDate) {
        notify("End date cannot be before start date", "error");
        return;
    }

    const subtasks = getSubtasksFromForm();

    const progress = subtasks.length
        ? calculateSubtaskProgress(subtasks)
        : Number(document.getElementById("taskProgress").value) || 0;

    const taskData = {
        name,
        assignee: document.getElementById("taskAssignee").value.trim(),
        priority: document.getElementById("taskPriority").value,
        startDate,
        endDate,
        progress,
        description: document.getElementById("taskDescription").value.trim(),
        subtasks
    };

    if (currentEditId) {
        storage.updateTask(currentEditId, taskData);
        notify("Task updated successfully", "success");
    } else {
        storage.addTask(taskData);
        notify("Task created successfully", "success");
    }

    closeModal();
    loadTasks();
}

function addSubtask(data = {}) {
    const container = document.getElementById("subtasksContainer");
    const row = createSubtaskRow(data);

    container.appendChild(row);

    const title = row.querySelector(".subtask-title");
    if (title) {
        title.focus();
    }

    updateSubtaskProgress();
}

function renderSubtasks(subtasks) {
    const container = document.getElementById("subtasksContainer");
    container.innerHTML = "";

    subtasks.forEach(subtask => {
        container.appendChild(createSubtaskRow(subtask));
    });

    updateSubtaskProgress();
}

function createSubtaskRow(data = {}) {
    const row = document.createElement("div");
    row.className = "subtask-row";

    const id = data.id ||
        (
            crypto.randomUUID
                ? crypto.randomUUID()
                : `subtask_${Date.now()}_${Math.random()}`
        );

    row.dataset.id = id;

    row.innerHTML = `
        <input
            type="checkbox"
            class="subtask-checkbox"
            ${data.completed ? "checked" : ""}
        >

        <input
            type="text"
            class="subtask-title"
            placeholder="Subtask name"
            value="${escapeHtml(data.title || "")}"
        >

        <input
            type="date"
            class="subtask-start-date"
            value="${data.startDate || ""}"
        >

        <input
            type="date"
            class="subtask-end-date"
            value="${data.endDate || ""}"
        >

        <button
            type="button"
            class="remove-subtask"
        >
            ×
        </button>
    `;

    const checkbox = row.querySelector(".subtask-checkbox");
    const title = row.querySelector(".subtask-title");
    const start = row.querySelector(".subtask-start-date");
    const end = row.querySelector(".subtask-end-date");
    const remove = row.querySelector(".remove-subtask");

    checkbox.onchange = () => {
        row.classList.toggle("completed", checkbox.checked);
        updateSubtaskProgress();
    };

    title.oninput = updateSubtaskProgress;
    start.onchange = updateSubtaskProgress;
    end.onchange = updateSubtaskProgress;

    remove.onclick = () => {
        row.remove();
        updateSubtaskProgress();
    };

    if (data.completed) {
        row.classList.add("completed");
    }

    return row;
}

function getSubtasksFromForm() {
    const rows = document.querySelectorAll(".subtask-row");
    const subtasks = [];

    rows.forEach(row => {
        const title = row.querySelector(".subtask-title").value.trim();

        if (!title) {
            return;
        }

        subtasks.push({
            id: row.dataset.id,
            title,
            startDate: row.querySelector(".subtask-start-date").value,
            endDate: row.querySelector(".subtask-end-date").value,
            completed: row.querySelector(".subtask-checkbox").checked
        });
    });

    return subtasks;
}

function updateSubtaskProgress() {
    const rows = Array.from(
        document.querySelectorAll(".subtask-row")
    );

    const info = document.getElementById("subtaskProgressInfo");

    if (!rows.length) {
        info.textContent = "No subtasks added";
        return;
    }

    const completed = rows.filter(row => {
        return row.querySelector(".subtask-checkbox").checked;
    }).length;

    const progress = Math.round(
        completed / rows.length * 100
    );

    info.textContent =
        `${completed} of ${rows.length} completed — Progress: ${progress}%`;

    document.getElementById("progressValue").textContent = progress;
    document.getElementById("taskProgress").value = progress;
}

function calculateSubtaskProgress(subtasks) {
    if (!subtasks.length) {
        return 0;
    }

    const completed = subtasks.filter(
        item => item.completed
    ).length;

    return Math.round(completed / subtasks.length * 100);
}

function renderTable(tasks) {
    const tbody = document.getElementById("tasksTableBody");
    tbody.innerHTML = "";

    if (!tasks.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-table">
                    No tasks available.
                </td>
            </tr>
        `;
        return;
    }

    tasks.forEach(task => {
        const subtasks = task.subtasks || [];
        const completed = subtasks.filter(
            item => item.completed
        ).length;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <strong>${escapeHtml(task.name)}</strong>
                <small>${escapeHtml(task.description || "")}</small>
            </td>

            <td>${escapeHtml(task.assignee || "-")}</td>
            <td>${formatDate(task.startDate)}</td>
            <td>${formatDate(task.endDate)}</td>

            <td>
                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width:${Number(task.progress) || 0}%"
                    >
                        ${Number(task.progress) || 0}%
                    </div>
                </div>
            </td>

            <td>
                <span class="priority-badge priority-${task.priority}">
                    ${capitalize(task.priority)}
                </span>
            </td>

            <td>${completed}/${subtasks.length}</td>

            <td>
                <div class="actions">
                    <button
                        class="btn btn-edit"
                        onclick="editTask('${task.id}')"
                    >
                        Edit
                    </button>

                    <button
                        class="btn btn-danger"
                        onclick="deleteTask('${task.id}')"
                    >
                        Delete
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function deleteTask(id) {
    const task = storage.getTaskById(id);

    if (!task) {
        return;
    }

    if (confirm(`Delete "${task.name}"?`)) {
        storage.deleteTask(id);
        loadTasks();
        notify("Task deleted", "success");
    }
}

function toggleView() {
    const gantt = document.getElementById("ganttView");
    const table = document.getElementById("tableView");

    const isGanttVisible = gantt.classList.contains("active");

    gantt.classList.toggle("active", !isGanttVisible);
    table.classList.toggle("active", isGanttVisible);

    document.getElementById("toggleViewBtn").textContent =
        isGanttVisible ? "Show Gantt" : "Show Table";
}

async function exportTasks() {
    try {
        const tasks = storage.getTasks();

        if (!tasks.length) {
            notify("No tasks to export", "error");
            return;
        }

        if (typeof ExcelHandler === "undefined") {
            notify("Excel handler file is missing", "error");
            return;
        }

        await ExcelHandler.exportTasks(tasks);
        notify("Tasks exported successfully", "success");
    } catch (error) {
        notify(error.message, "error");
    }
}

function handleImportFile(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (typeof ExcelHandler === "undefined") {
        notify("Excel handler file is missing", "error");
        return;
    }

    ExcelHandler.importFile(file)
        .then(tasks => {
            pendingImportTasks = tasks;
            showImportPreview(tasks);
        })
        .catch(error => {
            notify(error.message, "error");
        });

    event.target.value = "";
}

function showImportPreview(tasks) {
    document.getElementById("importMessage").textContent =
        `${tasks.length} task(s) found`;

    const preview = document.getElementById("importPreview");

    preview.innerHTML = `
        <table class="import-preview-table">
            <thead>
                <tr>
                    <th>Task</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Progress</th>
                </tr>
            </thead>

            <tbody>
                ${tasks.slice(0, 10).map(task => `
                    <tr>
                        <td>${escapeHtml(task.name)}</td>
                        <td>${task.startDate}</td>
                        <td>${task.endDate}</td>
                        <td>${task.progress}%</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    document.getElementById("importModal")
        .classList.remove("hidden");
}

function confirmImport() {
    if (!pendingImportTasks.length) {
        notify("No tasks to import", "error");
        return;
    }

    const mode = document.querySelector(
        'input[name="importMode"]:checked'
    ).value;

    storage.mergeImportedTasks(
        pendingImportTasks,
        mode
    );

    closeImportModal();
    loadTasks();

    notify("Tasks imported successfully", "success");
    pendingImportTasks = [];
}

function closeImportModal() {
    document.getElementById("importModal")
        .classList.add("hidden");

    document.getElementById("importPreview")
        .innerHTML = "";

    pendingImportTasks = [];
}

function updateStatus() {
    const tasks = storage.getTasks();

    document.getElementById("statusText").textContent =
        `${tasks.length} task(s) stored locally`;

    document.getElementById("lastSync").textContent =
        `Last updated: ${storage.getLastSync()}`;
}

function notify(message, type = "info") {
    const item = document.createElement("div");

    item.className =
        `notification notification-${type}`;

    item.textContent = message;

    document.body.appendChild(item);

    setTimeout(() => item.classList.add("show"), 10);

    setTimeout(() => {
        item.classList.remove("show");

        setTimeout(() => item.remove(), 300);
    }, 3000);
}

function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) {
        return "No date";
    }

    const parts = value.split("-");

    return parts.length === 3
        ? `${parts[2]}/${parts[1]}/${parts[0]}`
        : value;
}

function capitalize(value) {
    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}