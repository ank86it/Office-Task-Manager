const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbzZ9ujs6ER0He31wQmSd8FXUfgaJQ-WqlCww8Az1DfqbPgV7g2RLSRKWxAOQUGi0T05/exec";


async function callGoogleApi(action, data = {}) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action,
            ...data
        })
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(
            result.error || "Google Sheets request failed"
        );
    }

    return result.data;
}


async function getUsers() {
    return await callGoogleApi("getUsers");
}


async function createUser(userName, pin) {
    return await callGoogleApi("createUser", {
        userName,
        pin
    });
}


async function login(userId, pin) {
    return await callGoogleApi("login", {
        userId,
        pin
    });
}


async function getAllData(userId, pin) {
    return await callGoogleApi("getAllData", {
        userId,
        pin
    });
}


/*
 * This name is required by Version 5 app.js.
 * It sends a task and its subtasks to Google Sheets.
 */
async function saveTaskToGoogle(task, userId, pin) {
    return await callGoogleApi("saveTask", {
        task,
        userId,
        pin
    });
}


async function deleteTaskFromGoogle(taskId, userId, pin) {
    return await callGoogleApi("deleteTask", {
        taskId,
        userId,
        pin
    });
}


async function addComment(comment, userId, pin) {
    return await callGoogleApi("addComment", {
        comment,
        userId,
        pin
    });
}


async function updateComment(
    commentId,
    commentText,
    userId,
    pin
) {
    return await callGoogleApi("updateComment", {
        commentId,
        commentText,
        userId,
        pin
    });
}


async function deleteComment(commentId, userId, pin) {
    return await callGoogleApi("deleteComment", {
        commentId,
        userId,
        pin
    });
}


async function exportGoogleBackup(userId, pin) {
    return await callGoogleApi("exportBackup", {
        userId,
        pin
    });
}