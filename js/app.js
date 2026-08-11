let currentUser = null;
let currentTaskId = null;
let allTasks = [];
let allSubtasks = [];
let allComments = [];
let ganttChart = null;

document.addEventListener("DOMContentLoaded", initializeApp);


/* =========================
   INITIALIZATION
========================= */

async function initializeApp() {
    setupEventListeners();

    ganttChart = new GanttChart("ganttChart");

    const yearInput = document.getElementById("yearInput");

    if (yearInput) {
        yearInput.value = new Date().getFullYear();
    }

    await loadUsers();
}


/* =========================
   EVENT LISTENERS
========================= */

function setupEventListeners() {
    addClick("loginBtn", loginUser);
    addClick("createUserBtn", createNewUser);
    addClick("showCreateUserBtn", showCreateUser);
    addClick("backToLoginBtn", showLogin);

    addClick("addTaskBtn", openNewTask);
    addClick("refreshBtn", loadSharedData);
    addClick("backupBtn", exportBackup);
    addClick("logoutBtn", logoutUser);

    addClick("toggleViewBtn", toggleView);
    addClick("showGanttBtn", showGantt);

    addClick("addSubtaskBtn", () => {
        addSubtask();
    });

    addClick("addCommentBtn", addCommentToTask);

    addClick("prevYearBtn", () => {
        if (!ganttChart) return;
        ganttChart.previousYear();
        renderGantt();
    });

    addClick("nextYearBtn", () => {
        if (!ganttChart) return;
        ganttChart.nextYear();
        renderGantt();
    });

    addClick("todayBtn", () => {
        if (!ganttChart) return;
        ganttChart.goToToday();
        renderGantt();
    });

    addClick("zoomInBtn", () => {
        if (!ganttChart) return;
        ganttChart.zoomIn();
    });

    addClick("zoomOutBtn", () => {
        if (!ganttChart) return;
        ganttChart.zoomOut();
    });

    addClick("confirmImportBtn", () => {});

    const taskForm = document.getElementById("taskForm");

    if (taskForm) {
        taskForm.addEventListener("submit", saveTask);
    }

    const progress = document.getElementById("taskProgress");

    if (progress) {
        progress.addEventListener("input", event => {
            setText("progressValue", event.target.value);
        });
    }

    const yearInput = document.getElementById("yearInput");

    if (yearInput) {
        yearInput.addEventListener("change", event => {
            const year = Number(event.target.value);

            if (!year || year < 2020 || year > 2100) {
                notify("Enter a valid year between 2020 and 2100", "error");
                return;
            }

            ganttChart.setYear(year);
            renderGantt();
        });
    }

    document
        .querySelectorAll("[data-close-task-modal]")
        .forEach(button => {
            button.addEventListener("click", closeTaskModal);
        });
}

function addClick(id, callback) {
    const element = document.getElementById(id);

    if (element) {
        element.addEventListener("click", callback);
    }
}


/* =========================
   USER LOGIN
========================= */

async function loadUsers() {
    const select = document.getElementById("userSelect");

    if (!select) return;

    select.innerHTML = `
        <option value="">Loading users...</option>
    `;

    try {
        const response = await getUsers();

        const users = Array.isArray(response)
            ? response
            : response && Array.isArray(response.users)
                ? response.users
                : [];

        select.innerHTML = `
            <option value="">Select your name</option>
        `;

        users.forEach(user => {
            const userId =
                user.userId ||
                user["User ID"] ||
                user.id;

            const userName =
                user.userName ||
                user["User Name"] ||
                user.name;

            if (!userId || !userName) return;

            const option = document.createElement("option");

            option.value = userId;
            option.textContent = userName;

            select.appendChild(option);
        });

        if (!users.length) {
            select.innerHTML = `
                <option value="">No users found</option>
            `;
        }

    } catch (error) {
        select.innerHTML = `
            <option value="">Unable to load users</option>
        `;

        showLoginMessage(
            "Unable to load users: " + error.message,
            "error"
        );
    }
}

async function loginUser() {
    const userSelect = document.getElementById("userSelect");
    const pinInput = document.getElementById("loginPin");

    const userId = userSelect ? userSelect.value : "";
    const pin = pinInput ? pinInput.value.trim() : "";

    if (!userId) {
        showLoginMessage("Please select your name", "error");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        showLoginMessage(
            "PIN must contain exactly 4 digits",
            "error"
        );
        return;
    }

    try {
        showLoginMessage("Checking PIN...", "info");

        const result = await login(userId, pin);

        currentUser = {
            userId: result.userId,
            userName: result.userName,
            pin
        };

        showApplication();
        await loadSharedData();

    } catch (error) {
        showLoginMessage(error.message, "error");
    }
}

async function createNewUser() {
    const nameInput = document.getElementById("newUserName");
    const pinInput = document.getElementById("newUserPin");
    const confirmInput = document.getElementById("confirmUserPin");

    const userName = nameInput ? nameInput.value.trim() : "";
    const pin = pinInput ? pinInput.value.trim() : "";
    const confirmPin = confirmInput
        ? confirmInput.value.trim()
        : "";

    if (!userName) {
        showLoginMessage("Enter your name", "error");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        showLoginMessage(
            "PIN must contain exactly 4 digits",
            "error"
        );
        return;
    }

    if (pin !== confirmPin) {
        showLoginMessage("PIN values do not match", "error");
        return;
    }

    try {
        showLoginMessage("Creating user...", "info");

        const result = await createUser(userName, pin);

        await loadUsers();

        const userSelect = document.getElementById("userSelect");

        if (userSelect) {
            userSelect.value =
                result.userId || result["User ID"] || "";
        }

        const loginPin = document.getElementById("loginPin");

        if (loginPin) {
            loginPin.value = pin;
        }

        showLogin();
        showLoginMessage(
            "User created. Click Continue.",
            "success"
        );

    } catch (error) {
        showLoginMessage(error.message, "error");
    }
}

function showCreateUser() {
    toggleElement("existingUserSection", false);
    toggleElement("createUserSection", true);
    clearLoginMessage();
}

function showLogin() {
    toggleElement("existingUserSection", true);
    toggleElement("createUserSection", false);
}

function showApplication() {
    toggleElement("loginScreen", false);
    toggleElement("appScreen", true);

    setText(
        "currentUserDisplay",
        `👤 ${currentUser.userName}`
    );
}

function logoutUser() {
    currentUser = null;
    allTasks = [];
    allSubtasks = [];
    allComments = [];

    toggleElement("appScreen", false);
    toggleElement("loginScreen", true);

    const pin = document.getElementById("loginPin");

    if (pin) {
        pin.value = "";
    }

    showLogin();
}


/* =========================
   GOOGLE SHEETS DATA
========================= */

async function loadSharedData() {
    if (!currentUser) return;

    try {
        updateStatus("Loading shared data...");

        const result = await getAllData(
            currentUser.userId,
            currentUser.pin
        );

        allTasks = result.tasks || [];
        allSubtasks = result.subtasks || [];
        allComments = result.comments || [];

        normalizeData();

        renderGantt();
        renderTaskTable();

        updateStatus(
            `${allTasks.length} task(s) loaded from Google Sheets`
        );

    } catch (error) {
        updateStatus("Unable to load shared data");
        notify(error.message, "error");
    }
}

function normalizeData() {
    allTasks = allTasks.map(task => {
        const taskId =
            task["Task ID"] || task.taskId || task.id;

        const subtasks = allSubtasks
            .filter(subtask => {
                const subtaskTaskId =
                    subtask["Task ID"] ||
                    subtask.taskId;

                return String(subtaskTaskId) === String(taskId);
            })
            .map(subtask => ({
                id:
                    subtask["Subtask ID"] ||
                    subtask.subtaskId ||
                    subtask.id,

                title:
                    subtask["Subtask Name"] ||
                    subtask.title ||
                    subtask.name ||
                    "",

                startDate:
                    subtask["Start Date"] ||
                    subtask.startDate ||
                    "",

                endDate:
                    subtask["End Date"] ||
                    subtask.endDate ||
                    "",

                completed:
                    String(
                        subtask.Completed ||
                        subtask.completed ||
                        ""
                    ).toLowerCase() === "true"
            }));

        return {
            taskId,
            id: taskId,
            name: task["Task Name"] || task.name || "",
            assignee: task.Assignee || task.assignee || "",
            startDate: task["Start Date"] || task.startDate || "",
            endDate: task["End Date"] || task.endDate || "",
            progress: Number(
                task.Progress || task.progress || 0
            ),
            priority:
                task.Priority ||
                task.priority ||
                "medium",
            description:
                task.Description ||
                task.description ||
                "",
            createdBy: task["Created By"] || "",
            createdAt: task["Created At"] || "",
            updatedBy: task["Updated By"] || "",
            updatedAt: task["Updated At"] || "",
            subtasks
        };
    });
}


/* =========================
   TASKS
========================= */

function openNewTask() {
    currentTaskId = null;

    setText("modalTitle", "Add New Task");

    const form = document.getElementById("taskForm");

    if (form) {
        form.reset();
    }

    setValue("editingTaskId", "");
    setValue("taskProgress", "0");
    setText("progressValue", "0");

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);

    setValue("taskStartDate", toDateInput(today));
    setValue("taskEndDate", toDateInput(endDate));

    const subtasks = document.getElementById("subtasksContainer");

    if (subtasks) {
        subtasks.innerHTML = "";
    }

    setText("subtaskProgressInfo", "No subtasks added");

    const comments = document.getElementById("commentsContainer");

    if (comments) {
        comments.innerHTML = `
            <p class="no-comments">
                Save the task first to add comments.
            </p>
        `;
    }

    toggleElement("newCommentSection", false);
    openTaskModal();
}

function editTask(taskId) {
    const task = allTasks.find(item =>
        String(item.taskId) === String(taskId)
    );

    if (!task) {
        notify("Task not found", "error");
        return;
    }

    currentTaskId = task.taskId;

    setText("modalTitle", "Edit Task");
    setValue("editingTaskId", task.taskId);
    setValue("taskName", task.name);
    setValue("taskAssignee", task.assignee);
    setValue("taskPriority", task.priority);
    setValue("taskStartDate", task.startDate);
    setValue("taskEndDate", task.endDate);
    setValue("taskProgress", task.progress);
    setText("progressValue", task.progress);
    setValue("taskDescription", task.description);

    renderSubtasks(task.subtasks || []);
    renderComments(task.taskId);

    toggleElement("newCommentSection", true);
    openTaskModal();
}

async function saveTask(event) {
    event.preventDefault();

    const name = getValue("taskName").trim();
    const startDate = getValue("taskStartDate");
    const endDate = getValue("taskEndDate");

    if (!name) {
        notify("Task name is required", "error");
        return;
    }

    if (!startDate || !endDate) {
        notify("Start and end dates are required", "error");
        return;
    }

    if (endDate < startDate) {
        notify(
            "End date cannot be before start date",
            "error"
        );
        return;
    }

    const subtasks = readSubtasks();

    const progress = subtasks.length
        ? calculateProgress(subtasks)
        : Number(getValue("taskProgress")) || 0;

    const task = {
        taskId: currentTaskId || "",
        name,
        assignee: getValue("taskAssignee").trim(),
        priority: getValue("taskPriority"),
        startDate,
        endDate,
        progress,
        description: getValue("taskDescription").trim(),
        subtasks
    };

    try {
        await saveTaskToGoogle(
            task,
            currentUser.userId,
            currentUser.pin
        );

        closeTaskModal();
        await loadSharedData();

        notify("Task saved successfully", "success");

    } catch (error) {
        notify(error.message, "error");
    }
}


/* =========================
   SUBTASKS
========================= */

function renderSubtasks(subtasks) {
    const container =
        document.getElementById("subtasksContainer");

    if (!container) return;

    container.innerHTML = "";

    subtasks.forEach(subtask => {
        addSubtask(subtask);
    });

    updateSubtaskProgress();
}

function addSubtask(subtask = {}) {
    const container =
        document.getElementById("subtasksContainer");

    if (!container) return;

    const row = document.createElement("div");
    row.className = "subtask-row";

    row.dataset.id =
        subtask.id ||
        `subtask_${Date.now()}_${Math.random()}`;

    row.innerHTML = `
        <input
            type="checkbox"
            class="subtask-checkbox"
            ${subtask.completed ? "checked" : ""}
        >

        <input
            type="text"
            class="subtask-title"
            placeholder="Subtask name"
            value="${escapeHtml(subtask.title || "")}"
        >

        <input
            type="date"
            class="subtask-start-date"
            value="${subtask.startDate || ""}"
        >

        <input
            type="date"
            class="subtask-end-date"
            value="${subtask.endDate || ""}"
        >

        <button
            type="button"
            class="remove-subtask"
        >
            ×
        </button>
    `;

    const checkbox =
        row.querySelector(".subtask-checkbox");

    checkbox.addEventListener("change", () => {
        row.classList.toggle(
            "completed",
            checkbox.checked
        );

        updateSubtaskProgress();
    });

    row.querySelector(".remove-subtask")
        .addEventListener("click", () => {
            row.remove();
            updateSubtaskProgress();
        });

    container.appendChild(row);
}

function readSubtasks() {
    return [...document.querySelectorAll(".subtask-row")]
        .map(row => ({
            id: row.dataset.id,
            title: row.querySelector(".subtask-title").value.trim(),
            startDate: row.querySelector(".subtask-start-date").value,
            endDate: row.querySelector(".subtask-end-date").value,
            completed:
                row.querySelector(".subtask-checkbox").checked
        }))
        .filter(subtask => subtask.title);
}

function calculateProgress(subtasks) {
    if (!subtasks.length) return 0;

    const completed = subtasks.filter(
        subtask => subtask.completed
    ).length;

    return Math.round(
        completed / subtasks.length * 100
    );
}

function updateSubtaskProgress() {
    const subtasks = readSubtasks();
    const progress = calculateProgress(subtasks);

    setValue(
        "taskProgress",
        subtasks.length ? progress : 0
    );

    setText(
        "progressValue",
        subtasks.length ? progress : 0
    );

    setText(
        "subtaskProgressInfo",
        subtasks.length
            ? `${subtasks.filter(item => item.completed).length} of ${subtasks.length} completed`
            : "No subtasks added"
    );
}


/* =========================
   COMMENTS
========================= */

function getTaskComments(taskId) {
    return allComments.filter(comment => {
        const commentTaskId =
            comment["Task ID"] ||
            comment.taskId;

        const deleted = String(
            comment.Deleted ||
            comment.deleted ||
            ""
        ).toLowerCase();

        return String(commentTaskId) === String(taskId) &&
            deleted !== "true";
    });
}

function renderComments(taskId) {
    const comments = getTaskComments(taskId);
    const container =
        document.getElementById("commentsContainer");

    if (!container) return;

    setText("commentsCount", comments.length);

    if (!comments.length) {
        container.innerHTML = `
            <p class="no-comments">
                No comments yet.
            </p>
        `;
        return;
    }

    container.innerHTML = "";

    const parentComments = comments.filter(comment => {
        const parentId =
            comment["Parent Comment ID"] ||
            comment.parentCommentId ||
            "";

        return !parentId;
    });

    parentComments.forEach(comment => {
        container.appendChild(
            createCommentElement(comment, comments)
        );
    });
}

function createCommentElement(comment, comments) {
    const commentId =
        comment["Comment ID"] ||
        comment.commentId;

    const userId =
        comment["User ID"] ||
        comment.userId;

    const userName =
        comment["User Name"] ||
        comment.userName ||
        "";

    const text =
        comment["Comment Text"] ||
        comment.commentText ||
        "";

    const createdAt =
        comment["Created At"] ||
        comment.createdAt ||
        "";

    const element = document.createElement("div");
    element.className = "comment-item";

    element.innerHTML = `
        <div class="comment-header">
            <strong>${escapeHtml(userName)}</strong>
            <small>${escapeHtml(createdAt)}</small>
        </div>

        <div class="comment-text">
            ${escapeHtml(text)}
        </div>

        <div class="comment-actions">
            <button class="reply-comment-btn">
                Reply
            </button>

            ${
                String(userId) === String(currentUser.userId)
                    ? `
                        <button class="edit-comment-btn">
                            Edit
                        </button>

                        <button class="delete-comment-btn">
                            Delete
                        </button>
                      `
                    : ""
            }
        </div>

        <div class="reply-box hidden">
            <textarea
                class="reply-input"
                rows="2"
                placeholder="Write a reply..."
            ></textarea>

            <button class="btn btn-small submit-reply-btn">
                Add Reply
            </button>
        </div>

        <div class="replies-container"></div>
    `;

    element.querySelector(".reply-comment-btn")
        .addEventListener("click", () => {
            element.querySelector(".reply-box")
                .classList.toggle("hidden");
        });

    element.querySelector(".submit-reply-btn")
        .addEventListener("click", async () => {
            const reply = element
                .querySelector(".reply-input")
                .value
                .trim();

            if (!reply) return;

            await submitComment({
                taskId: currentTaskId,
                commentText: reply,
                parentCommentId: commentId
            });
        });

    const editButton =
        element.querySelector(".edit-comment-btn");

    if (editButton) {
        editButton.addEventListener("click", async () => {
            const updatedText = prompt(
                "Edit your comment:",
                text
            );

            if (!updatedText || !updatedText.trim()) {
                return;
            }

            try {
                await updateComment(
                    commentId,
                    updatedText.trim(),
                    currentUser.userId,
                    currentUser.pin
                );

                await loadSharedData();
                renderComments(currentTaskId);

            } catch (error) {
                notify(error.message, "error");
            }
        });
    }

    const deleteButton =
        element.querySelector(".delete-comment-btn");

    if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete your comment?")) {
                return;
            }

            try {
                await deleteComment(
                    commentId,
                    currentUser.userId,
                    currentUser.pin
                );

                await loadSharedData();
                renderComments(currentTaskId);

            } catch (error) {
                notify(error.message, "error");
            }
        });
    }

    const replies = comments.filter(reply => {
        const parentId =
            reply["Parent Comment ID"] ||
            reply.parentCommentId ||
            "";

        return String(parentId) === String(commentId);
    });

    const repliesContainer =
        element.querySelector(".replies-container");

    replies.forEach(reply => {
        repliesContainer.appendChild(
            createCommentElement(reply, comments)
        );
    });

    return element;
}

async function addCommentToTask() {
    const input = document.getElementById("newComment");

    if (!currentTaskId) {
        notify(
            "Save the task before adding comments",
            "error"
        );
        return;
    }

    const text = input ? input.value.trim() : "";

    if (!text) {
        notify("Enter a comment", "error");
        return;
    }

    await submitComment({
        taskId: currentTaskId,
        commentText: text,
        parentCommentId: ""
    });

    input.value = "";
}

async function submitComment(comment) {
    try {
        await addComment(
            comment,
            currentUser.userId,
            currentUser.pin
        );

        await loadSharedData();
        renderComments(currentTaskId);

        notify("Comment saved", "success");

    } catch (error) {
        notify(error.message, "error");
    }
}


/* =========================
   TABLE AND GANTT
========================= */

function renderGantt() {
    if (!ganttChart) {
        ganttChart = new GanttChart("ganttChart");
    }

    if (typeof ganttChart.render !== "function") {
        notify(
            "gantt.js does not contain a render() function",
            "error"
        );
        return;
    }

    ganttChart.render(allTasks);
}

function renderTaskTable() {
    const tbody =
        document.getElementById("tasksTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!allTasks.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table">
                    No tasks found.
                </td>
            </tr>
        `;
        return;
    }

    allTasks.forEach(task => {
        const comments = getTaskComments(task.taskId);
        const completed = task.subtasks.filter(
            subtask => subtask.completed
        ).length;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <strong>${escapeHtml(task.name)}</strong>
                <small>${escapeHtml(task.description)}</small>
            </td>

            <td>${escapeHtml(task.assignee || "-")}</td>
            <td>${formatDate(task.startDate)}</td>
            <td>${formatDate(task.endDate)}</td>

            <td>
                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width:${task.progress}%"
                    >
                        ${task.progress}%
                    </div>
                </div>
            </td>

            <td>
                <span class="priority-badge priority-${task.priority}">
                    ${capitalize(task.priority)}
                </span>
            </td>

            <td>
                ${completed}/${task.subtasks.length}
            </td>

            <td>
                ${comments.length}
            </td>

            <td>
                <button class="btn btn-small btn-edit edit-task-button">
                    Edit
                </button>
            </td>
        `;

        row.querySelector(".edit-task-button")
            .addEventListener("click", () => {
                editTask(task.taskId);
            });

        tbody.appendChild(row);
    });
}

function toggleView() {
    const gantt = document.getElementById("ganttView");
    const table = document.getElementById("tableView");

    if (!gantt || !table) return;

    const ganttVisible = gantt.classList.contains("active");

    gantt.classList.toggle("active", !ganttVisible);
    table.classList.toggle("active", ganttVisible);

    const button = document.getElementById("toggleViewBtn");

    if (button) {
        button.textContent = ganttVisible
            ? "Show Gantt"
            : "Show Table";
    }
}

function showGantt() {
    toggleElement("tableView", false);
    toggleElement("ganttView", true);
}


/* =========================
   BACKUP
========================= */

async function exportBackup() {
    try {
        const data = await exportGoogleBackup(
            currentUser.userId,
            currentUser.pin
        );

        const csv = createBackupCSV(data);

        downloadTextFile(
            csv,
            `office-task-manager-backup-${Date.now()}.csv`
        );

        notify("Backup exported successfully", "success");

    } catch (error) {
        notify(error.message, "error");
    }
}

function createBackupCSV(data) {
    const sections = [
        "[USERS]",
        objectsToCSV(data.users || []),
        "[TASKS]",
        objectsToCSV(data.tasks || []),
        "[SUBTASKS]",
        objectsToCSV(data.subtasks || []),
        "[COMMENTS]",
        objectsToCSV(data.comments || []),
        "[AUDITLOG]",
        objectsToCSV(data.auditLog || [])
    ];

    return "\uFEFF" + sections.join("\r\n\r\n");
}

function objectsToCSV(objects) {
    if (!objects.length) return "";

    const headers = Object.keys(objects[0]);

    const lines = [
        headers.map(escapeCSV).join(",")
    ];

    objects.forEach(object => {
        lines.push(
            headers.map(header =>
                escapeCSV(object[header])
            ).join(",")
        );
    });

    return lines.join("\r\n");
}

function downloadTextFile(text, filename) {
    const blob = new Blob(
        [text],
        { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================
   MODAL AND HELPERS
========================= */

function openTaskModal() {
    toggleElement("taskModal", true);
}

function closeTaskModal() {
    toggleElement("taskModal", false);
}

function updateStatus(message) {
    setText("statusText", message);
    setText(
        "lastSync",
        `Last sync: ${new Date().toLocaleTimeString()}`
    );
}

function showLoginMessage(message, type) {
    const element = document.getElementById("loginMessage");

    if (!element) return;

    element.textContent = message;
    element.className = `login-message ${type || ""}`;
}

function clearLoginMessage() {
    showLoginMessage("", "");
}

function notify(message, type = "info") {
    const container =
        document.getElementById("notificationContainer");

    if (!container) {
        alert(message);
        return;
    }

    const element = document.createElement("div");

    element.className =
        `notification notification-${type}`;

    element.textContent = message;

    container.appendChild(element);

    setTimeout(() => {
        element.classList.add("show");
    }, 10);

    setTimeout(() => {
        element.classList.remove("show");

        setTimeout(() => {
            element.remove();
        }, 300);
    }, 3000);
}

function toggleElement(id, show) {
    const element = document.getElementById(id);

    if (!element) return;

    element.classList.toggle("hidden", !show);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function setValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value;
    }
}

function getValue(id) {
    const element = document.getElementById(id);

    return element ? element.value : "";
}

function formatDate(value) {
    if (!value) return "-";

    const parts = String(value).split("-");

    return parts.length === 3
        ? `${parts[2]}/${parts[1]}/${parts[0]}`
        : value;
}

function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function capitalize(value) {
    if (!value) return "";

    return value.charAt(0).toUpperCase() +
        value.slice(1);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeCSV(value) {
    const text = String(value || "");

    return /[",\r\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
}