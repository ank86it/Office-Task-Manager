const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbzZ9ujs6ER0He31wQmSd8FXUfgaJQ-WqlCww8Az1DfqbPgV7g2RLSRKWxAOQUGi0T05/exec";


async function callGoogleApi(action, data = {}) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action: action,
            ...data
        })
    });

    if (!response.ok) {
        throw new Error(
            `Server error: ${response.status}`
        );
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(
            result.error || "Google Sheets request failed"
        );
    }

    return result.data;
}


/* =========================
   USERS AND LOGIN
========================= */

async function getUsers() {
    const result = await callGoogleApi("getUsers");

    if (Array.isArray(result)) {
        return result;
    }

    if (result && Array.isArray(result.users)) {
        return result.users;
    }

    return [];
}

async function createUser(userName, pin) {
    return await callGoogleApi("createUser", {
        userName: userName,
        pin: pin
    });
}

async function login(userId, pin) {
    return await callGoogleApi("login", {
        userId: userId,
        pin: pin
    });
}


/* =========================
   TASKS AND SUBTASKS
========================= */

async function getAllData(userId, pin) {
    return await callGoogleApi("getAllData", {
        userId: userId,
        pin: pin
    });
}

async function saveTaskToGoogle(task, userId, pin) {
    return await callGoogleApi("saveTask", {
        task: task,
        userId: userId,
        pin: pin
    });
}

async function deleteTaskFromGoogle(taskId, userId, pin) {
    return await callGoogleApi("deleteTask", {
        taskId: taskId,
        userId: userId,
        pin: pin
    });
}


/* =========================
   COMMENTS AND REPLIES
========================= */

async function addComment(comment, userId, pin) {
    return await callGoogleApi("addComment", {
        comment: comment,
        userId: userId,
        pin: pin
    });
}

async function updateComment(
    commentId,
    commentText,
    userId,
    pin
) {
    return await callGoogleApi("updateComment", {
        commentId: commentId,
        commentText: commentText,
        userId: userId,
        pin: pin
    });
}

async function deleteComment(commentId, userId, pin) {
    return await callGoogleApi("deleteComment", {
        commentId: commentId,
        userId: userId,
        pin: pin
    });
}


/* =========================
   BACKUP
========================= */

async function exportGoogleBackup(userId, pin) {
    return await callGoogleApi("exportBackup", {
        userId: userId,
        pin: pin
    });
}