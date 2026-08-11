class TaskStorage {
    constructor() {
        this.storageKey = "office_tasks_v3";
        this.lastSyncKey = "office_tasks_v3_last_sync";
    }

    getTasks() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        } catch {
            return [];
        }
    }

    saveTasks(tasks) {
        localStorage.setItem(this.storageKey, JSON.stringify(tasks));
        localStorage.setItem(
            this.lastSyncKey,
            new Date().toLocaleString()
        );
    }

    getLastSync() {
        return localStorage.getItem(this.lastSyncKey) || "Never";
    }

    addTask(task) {
        const tasks = this.getTasks();

        const newTask = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: task.name,
            assignee: task.assignee || "",
            priority: task.priority || "medium",
            startDate: task.startDate,
            endDate: task.endDate,
            progress: Number(task.progress) || 0,
            description: task.description || "",
            subtasks: task.subtasks || [],
            createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        this.saveTasks(tasks);
        return newTask;
    }

    updateTask(id, updates) {
        const tasks = this.getTasks();

        const updated = tasks.map(task => {
            if (task.id !== id) return task;

            return {
                ...task,
                ...updates,
                subtasks: updates.subtasks ?? task.subtasks ?? []
            };
        });

        this.saveTasks(updated);
        return updated.find(task => task.id === id);
    }

    deleteTask(id) {
        const tasks = this.getTasks().filter(task => task.id !== id);
        this.saveTasks(tasks);
    }

    getTaskById(id) {
        return this.getTasks().find(task => task.id === id);
    }

    updateSubtask(taskId, subtaskId, completed) {
        const task = this.getTaskById(taskId);
        if (!task) return null;

        const subtasks = (task.subtasks || []).map(subtask => {
            if (subtask.id === subtaskId) {
                return { ...subtask, completed };
            }

            return subtask;
        });

        const progress = calculateSubtaskProgress(subtasks);

        return this.updateTask(taskId, {
            subtasks,
            progress
        });
    }

    deleteSubtask(taskId, subtaskId) {
        const task = this.getTaskById(taskId);
        if (!task) return null;

        const subtasks = (task.subtasks || []).filter(
            subtask => subtask.id !== subtaskId
        );

        const progress = subtasks.length
            ? calculateSubtaskProgress(subtasks)
            : 0;

        return this.updateTask(taskId, {
            subtasks,
            progress
        });
    }

    mergeImportedTasks(importedTasks, mode) {
        const current = this.getTasks();

        const finalTasks = mode === "merge"
            ? [...current, ...importedTasks]
            : importedTasks;

        this.saveTasks(finalTasks);
        return finalTasks;
    }
}

function calculateSubtaskProgress(subtasks) {
    if (!subtasks || subtasks.length === 0) return 0;

    const completed = subtasks.filter(item => item.completed).length;

    return Math.round((completed / subtasks.length) * 100);
}

const storage = new TaskStorage();