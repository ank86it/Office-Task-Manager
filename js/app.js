let currentUser = null;
let currentTaskId = null;
let allTasks = [];
let allSubtasks = [];
let allComments = [];
let selectedTask = null;

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
    setupEventListeners();
    setDefaultYear();

    try {
        await loadUsers();
    } catch (error) {
        showLoginMessage(error.message, "error");
    }
}

/* =========================
   EVENT LISTENERS
========================= */

function setupEventListeners() {
    document.getElementById("loginBtn").addEventListener("click", loginUser);
    document.getElementById("createUserBtn").addEventListener("click", createNewUser);

    document
        .getElementById("showCreateUserBtn")
        .addEventListener("click", showCreateUser);

    document
        .getElementById("backToLoginBtn")
        .addEventListener("click", showLogin);

    document
        .getElementById("addTaskBtn")
        .addEventListener("click", openNewTask);

    document
        .getElementById("taskForm")
        .addEventListener("submit", saveTask);

    document
        .getElementById("addSubtaskBtn")
        .addEventListener("click", () => addSubtask());

    document
        .getElementById("addCommentBtn")
        .addEventListener("click", addCommentToTask);

    document
        .getElementById("backupBtn")
        .addEventListener("click", exportBackup);

    document
        .getElementById("refreshBtn")
        .addEventListener("click", loadSharedData);

    document
        .getElementById("logoutBtn")
        .addEventListener("click", logoutUser);

    document
        .getElementById("toggleViewBtn")
        .addEventListener("click", toggleView);

    document
        .getElementById("showGanttBtn")
        .addEventListener("click", showGantt);

    document
        .getElementById("prevYearBtn")
        .addEventListener("click", () => {
            ganttChart.previousYear();
            renderGantt();
        });

    document
        .getElementById("nextYearBtn")
        .addEventListener("click", () => {
            ganttChart.nextYear();
            renderGantt();
        });

    document
        .getElementById("todayBtn")
        .addEventListener("click", () => {
            ganttChart.goToToday();
            renderGantt();
        });

    document
        .getElementById("zoomInBtn")
        .addEventListener("click", () => ganttChart.zoomIn());

    document
        .getElementById("zoomOutBtn")
        .addEventListener("click", () => ganttChart.zoomOut());

    document
        .getElementById("yearInput")
        .addEventListener("change", event => {
            ganttChart.setYear(Number(event.target.value));
            renderGantt();
        });

    document
        .getElementById("taskProgress")
        .addEventListener("input", event => {
            document.getElementById("progressValue").textContent =
                event.target.value;
        });

    document
        .querySelectorAll("[data-close-task-modal]")
        .forEach(button => {
            button.addEventListener("click", closeTaskModal);
        });
}

/* =========================
   LOGIN AND USERS
========================= */

async function loadUsers() {
    const result = await getUsers();

    const users = Array.isArray(result)
        ? result
        : result.users || [];

    const select = document.getElementById("userSelect");

    select.innerHTML = `
        <option value="">Select your name</option>
    `;

    users.forEach(user => {
        const option = document.createElement("option");

        option.value = user.userId || user["User ID"];
        option.textContent = user.userName || user["User Name"];

        select.appendChild(option);
    });
}

async function loginUser() {
    const userId = document.getElementById("userSelect").value;
    const pin = document.getElementById("loginPin").value.trim();

    if (!userId) {
        showLoginMessage("Please select your name", "error");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        showLoginMessage("PIN must contain exactly 4 digits", "error");
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

        sessionStorage.setItem(
            "office_task_user",
            JSON.stringify(currentUser)
        );

        showApplication();
        await loadSharedData();

    } catch (error) {
        showLoginMessage(error.message, "error");
    }
}

async function createNewUser() {
    const userName = document
        .getElementById("newUserName")
        .value
        .trim();

    const pin = document
        .getElementById("newUserPin")
        .value
        .trim();

    const confirmPin = document
        .getElementById("confirmUserPin")
        .value
        .trim();

    if (!userName) {
        showLoginMessage("Enter your name", "error");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        showLoginMessage("PIN must contain exactly 4 digits", "error");
        return;
    }

    if (pin !== confirmPin) {
        showLoginMessage("PIN values do not match", "error");
        return;
    }

    try {
        const result = await createUser(userName, pin);

        currentUser = {
            userId: result.userId,
            userName: result.userName,
            pin
        };

        sessionStorage.setItem(
            "office_task_user",
            JSON.stringify(currentUser)
        );

        showApplication();
        await loadSharedData();

    } catch (error) {
        showLoginMessage(error.message, "error");
    }
}

function showCreateUser() {
    document
        .getElementById("existingUserSection")
        .classList.add("hidden");

    document
        .getElementById("createUserSection")
        .classList.remove("hidden");

    clearLoginMessage();
}

function showLogin() {
    document
        .getElementById("createUserSection")
        .classList.add("hidden");

    document
        .getElementById("existingUserSection")
        .classList.remove("hidden");

    clearLoginMessage();
}

function showApplication() {
    document
        .getElementById("loginScreen")
        .classList.add("hidden");

    document
        .getElementById("appScreen")
        .classList.remove("hidden");

    document
        .getElementById("currentUserDisplay")
        .textContent = `👤 ${currentUser.userName}`;
}

function logoutUser() {
    currentUser = null;
    sessionStorage.removeItem("office_task_user");

    document
        .getElementById("appScreen")
        .classList.add("hidden");

    document
        .getElementById("loginScreen")
        .classList.remove("hidden");

    document.getElementById("loginPin").value = "";

    showLogin();
}

function showLoginMessage(message, type) {
    const element = document.getElementById("loginMessage");

    element.textContent = message;
    element.className = `login-message ${type}`;
}

function clearLoginMessage() {
    const element = document.getElementById("loginMessage");

    element.textContent = "";
    element.className = "login-message";
}

/* =========================
   SHARED DATA
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

        normalizeSharedData();

        renderGantt();
        renderTaskTable();

        updateStatus(
            `${allTasks.length} task(s) loaded from Google Sheets`
        );

    } catch (error) {
        notify(error.message, "error");
        updateStatus("Unable to load shared data");
    }
}

function normalizeSharedData() {
    allTasks = allTasks.map(task => {
        const taskId = task["Task ID"] || task.taskId;

        return {
            id: taskId,
            taskId,
            name: task["Task Name"] || task.name || "",
            assignee: task.Assignee || task.assignee || "",
            startDate: task["Start Date"] || task.startDate || "",
            endDate: task["End Date"] || task.endDate || "",
            progress: Number(task.Progress || task.progress || 0),
            priority: task.Priority || task.priority || "medium",
            description: task.Description || task.description || "",
            createdBy: task["Created By"] || "",
            createdAt: task["Created At"] || "",
            updatedBy: task["Updated By"] || "",
            updatedAt: task["Updated At"] || "",
            subtasks: allSubtasks
                .filter(subtask =>
                    String(subtask["Task ID"] || subtask.taskId) ===
                    String(taskId)
                )
                .map(subtask => ({
                    id: subtask["Subtask ID"] || subtask.subtaskId,
                    title: subtask["Subtask Name"] || subtask.title || "",
                    startDate: subtask["Start Date"] || "",
                    endDate: subtask["End Date"] || "",
                    completed: String(
                        subtask.Completed
                    ).toLowerCase() === "true"
                }))
        };
    });
}

/* =========================
   TASK FORM
========================= */

function openNewTask() {
    currentTaskId = null;
    selectedTask = null;

    document.getElementById("modalTitle").textContent =
        "Add New Task";

    document.getElementById("taskForm").reset();
    document.getElementById("editingTaskId").value = "";

    document.getElementById("progressValue").textContent = "0";
    document.getElementById("subtasksContainer").innerHTML = "";
    document.getElementById("subtaskProgressInfo").textContent =
        "No subtasks added";

    document.getElementById("commentsContainer").innerHTML = `
        <p class="no-comments">
            Save the task first to add comments.
        </p>
    `;

    document.getElementById("commentsCount").textContent = "0";
    document.getElementById("newCommentSection").classList.add("hidden");

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);

    document.getElementById("taskStartDate").value =
        toDateInput(today);

    document.getElementById("taskEndDate").value =
        toDateInput(endDate);

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
    selectedTask = task;

    document.getElementById("modalTitle").textContent =
        "Edit Task";

    document.getElementById("editingTaskId").value =
        task.taskId;

    document.getElementById("taskName").value =
        task.name;

    document.getElementById("taskAssignee").value =
        task.assignee;

    document.getElementById("taskPriority").value =
        task.priority;

    document.getElementById("taskStartDate").value =
        task.startDate;

    document.getElementById("taskEndDate").value =
        task.endDate;

    document.getElementById("taskProgress").value =
        task.progress;

    document.getElementById("progressValue").textContent =
        task.progress;

    document.getElementById("taskDescription").value =
        task.description;

    renderSubtasks(task.subtasks || []);
    renderComments(task.taskId);

    document
        .getElementById("newCommentSection")
        .classList.remove("hidden");

    openTaskModal();
}

async function saveTask(event) {
    event.preventDefault();

    const name = document
        .getElementById("taskName")
        .value
        .trim();

    const startDate =
        document.getElementById("taskStartDate").value;

    const endDate =
        document.getElementById("taskEndDate").value;

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

    const subtasks = readSubtasks();

    const progress = subtasks.length
        ? calculateProgress(subtasks)
        : Number(
            document.getElementById("taskProgress").value
        ) || 0;

    const task = {
        taskId: currentTaskId || "",
        name,
        assignee: document
            .getElementById("taskAssignee")
            .value
            .trim(),
        priority: document
            .getElementById("taskPriority")
            .value,
        startDate,
        endDate,
        progress,
        description: document
            .getElementById("taskDescription")
            .value
            .trim(),
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

function renderSubtasks(subtasks) {
    const container =
        document.getElementById("subtasksContainer");

    container.innerHTML = "";

    subtasks.forEach(subtask => {
        addSubtask(subtask);
    });

    updateSubtaskProgress();
}

function addSubtask(subtask = {}) {
    const container =
        document.getElementById("subtasksContainer");

    const row = document.createElement("div");
    row.className = "subtask-row";
    row.dataset.id =
        subtask.id || `subtask_${Date.now()}_${Math.random()}`;

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

    row
        .querySelector(".subtask-checkbox")
        .addEventListener("change", () => {
            row.classList.toggle(
                "completed",
                row.querySelector(".subtask-checkbox").checked
            );

            updateSubtaskProgress();
        });

    row
        .querySelector(".remove-subtask")
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
            completed: row.querySelector(".subtask-checkbox").checked
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

    document.getElementById("progressValue").textContent =
        subtasks.length ? progress : 0;

    document.getElementById("taskProgress").value =
        subtasks.length ? progress : 0;

    document.getElementById("subtaskProgressInfo").textContent =
        subtasks.length
            ? `${subtasks.filter(item => item.completed).length} of ${subtasks.length} completed`
            : "No subtasks added";
}

/* =========================
   COMMENTS
========================= */

function getTaskComments(taskId) {
    return allComments.filter(comment =>
        String(comment["Task ID"] || comment.taskId) ===
        String(taskId) &&
        String(comment.Deleted).toLowerCase() !== "true"
    );
}

function renderComments(taskId) {
    const comments = getTaskComments(taskId);
    const container = document.getElementById("commentsContainer");

    document.getElementById("commentsCount").textContent =
        comments.length;

    if (!comments.length) {
        container.innerHTML = `
            <p class="no-comments">
                No comments yet.
            </p>
        `;
        return;
    }

    const parentComments = comments.filter(comment =>
        !(comment["Parent Comment ID"] || comment.parentCommentId)
    );

    container.innerHTML = "";

    parentComments.forEach(comment => {
        container.appendChild(
            createCommentElement(comment, comments)
        );
    });
}

function createCommentElement(comment, allTaskComments) {
    const commentId =
        comment["Comment ID"] || comment.commentId;

    const userId =
        comment["User ID"] || comment.userId;

    const text =
        comment["Comment Text"] || comment.commentText || "";

    const userName =
        comment["User Name"] || comment.userName || "";

    const createdAt =
        comment["Created At"] || comment.createdAt || "";

    const wrapper = document.createElement("div");
    wrapper.className = "comment-item";

    wrapper.innerHTML = `
        <div class="comment-header">
            <strong>${escapeHtml(userName)}</strong>
            <small>${escapeHtml(createdAt)}</small>
        </div>

        <div class="comment-text">
            ${escapeHtml(text)}
        </div>

        <div class="comment-actions">
            <button class="comment-reply-btn">Reply</button>
            ${
                userId === currentUser.userId
                    ? `
                        <button class="comment-edit-btn">Edit</button>
                        <button class="comment-delete-btn">Delete</button>
                      `
                    : ""
            }
        </div>

        <div class="reply-form hidden">
            <textarea
                class="reply-text"
                rows="2"
                placeholder="Write a reply..."
            ></textarea>

            <button class="btn btn-small submit-reply-btn">
                Add Reply
            </button>
        </div>

        <div class="replies-container"></div>
    `;

    wrapper
        .querySelector(".comment-reply-btn")
        .addEventListener("click", () => {
            wrapper
                .querySelector(".reply-form")
                .classList.toggle("hidden");
        });

    wrapper
        .querySelector(".submit-reply-btn")
        .addEventListener("click", async () => {
            const replyText = wrapper
                .querySelector(".reply-text")
                .value
                .trim();

            if (!replyText) return;

            await submitComment({
                taskId: currentTaskId,
                commentText: replyText,
                parentCommentId: commentId
            });
        });

    const editButton =
        wrapper.querySelector(".comment-edit-btn");

    if (editButton) {
        editButton.addEventListener("click", async () => {
            const newText = prompt(
                "Edit comment:",
                text
            );

            if (!newText || newText.trim() === text) {
                return;
            }

            try {
                await updateComment(
                    commentId,
                    newText.trim(),
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
        wrapper.querySelector(".comment-delete-btn");

    if (deleteButton) {
        deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this comment?")) {
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

    const replies = allTaskComments.filter(reply =>
        String(
            reply["Parent Comment ID"] ||
            reply.parentCommentId
        ) === String(commentId)
    );

    const repliesContainer =
        wrapper.querySelector(".replies-container");

    replies.forEach(reply => {
        repliesContainer.appendChild(
            createCommentElement(reply, allTaskComments)
        );
    });

    return wrapper;
}

async function addCommentToTask() {
    const text = document
        .getElementById("newComment")
        .value
        .trim();

    if (!currentTaskId) {
        notify("Save the task before adding comments", "error");
        return;
    }

    if (!text) {
        notify("Enter a comment", "error");
        return;
    }

    await submitComment({
        taskId: currentTaskId,
        commentText: text,
        parentCommentId: ""
    });
}

async function submitComment(comment) {
    try {
        await addComment(
            comment,
            currentUser.userId,
            currentUser.pin
        );

        document.getElementById("newComment").value = "";

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
    if (!window.ganttChart) {
        if (typeof GanttChart !== "undefined") {
            window.ganttChart = new GanttChart("ganttChart");
        } else {
            return;
        }
    }

    ganttChart.render(allTasks);
}

function renderTaskTable() {
    const tbody =
        document.getElementById("tasksTableBody");

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
                <button class="btn btn-edit edit-task-btn">
                    Edit
                </button>
            </td>
        `;

        row
            .querySelector(".edit-task-btn")
            .addEventListener("click", () => {
                editTask(task.taskId);
            });

        tbody.appendChild(row);
    });
}

function toggleView() {
    const gantt = document.getElementById("ganttView");
    const table = document.getElementById("tableView");

    const showingGantt = gantt.classList.contains("active");

    gantt.classList.toggle("active", !showingGantt);
    table.classList.toggle("active", showingGantt);

    document.getElementById("toggleViewBtn").textContent =
        showingGantt ? "Show Gantt" : "Show Table";
}

function showGantt() {
    document.getElementById("tableView").classList.remove("active");
    document.getElementById("ganttView").classList.add("active");
}

/* =========================
   BACKUP EXPORT
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
    const sections = [];

    sections.push("[USERS]");
    sections.push(objectsToCSV(data.users || []));

    sections.push("[TASKS]");
    sections.push(objectsToCSV(data.tasks || []));

    sections.push("[SUBTASKS]");
    sections.push(objectsToCSV(data.subtasks || []));

    sections.push("[COMMENTS]");
    sections.push(objectsToCSV(data.comments || []));

    sections.push("[AUDITLOG]");
    sections.push(objectsToCSV(data.auditLog || []));

    return "\uFEFF" + sections.join("\r\n\r\n");
}

function objectsToCSV(objects) {
    if (!objects.length) {
        return "";
    }

    const headers = Object.keys(objects[0]);

    const lines = [
        headers.map(escapeCSV).join(",")
    ];

    objects.forEach(object => {
        lines.push(
            headers
                .map(header =>
                    escapeCSV(object[header] || "")
                )
                .join(",")
        );
    });

    return lines.join("\r\n");
}

function escapeCSV(value) {
    const text = String(value || "");

    return /[",\r\n]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
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
    link.click();

    URL.revokeObjectURL(url);
}

/* =========================
   MODAL AND HELPERS
========================= */

function openTaskModal() {
    document
        .getElementById("taskModal")
        .classList.remove("hidden");
}

function closeTaskModal() {
    document
        .getElementById("taskModal")
        .classList.add("hidden");
}

function setDefaultYear() {
    const input = document.getElementById("yearInput");

    if (input) {
        input.value = new Date().getFullYear();
    }
}

function updateStatus(message) {
    document.getElementById("statusText").textContent =
        message;

    document.getElementById("lastSync").textContent =
        `Last sync: ${new Date().toLocaleTimeString()}`;
}

function notify(message, type = "info") {
    const container =
        document.getElementById("notificationContainer");

    const notification = document.createElement("div");

    notification.className =
        `notification notification-${type}`;

    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 10);

    setTimeout(() => {
        notification.classList.remove("show");

        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function formatDate(value) {
    if (!value) return "-";

    const parts = value.split("-");

    return parts.length === 3
        ? `${parts[2]}/${parts[1]}/${parts[0]}`
        : value;
}

function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function capitalize(value) {
    if (!value) return "";

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