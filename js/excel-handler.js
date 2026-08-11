class ExcelHandler {
    static async exportTasks(tasks) {
        if (!tasks || tasks.length === 0) {
            throw new Error("No tasks to export");
        }

        const headers = [
            "Task Name",
            "Assignee",
            "Start Date",
            "End Date",
            "Progress (%)",
            "Priority",
            "Description",
            "Subtasks"
        ];

        const rows = tasks.map(task => {
            const subtasks = Array.isArray(task.subtasks)
                ? task.subtasks.map(subtask => ({
                    id: subtask.id || "",
                    title: subtask.title || "",
                    startDate: subtask.startDate || "",
                    endDate: subtask.endDate || "",
                    completed: Boolean(subtask.completed)
                }))
                : [];

            return [
                task.name || "",
                task.assignee || "",
                task.startDate || "",
                task.endDate || "",
                Number(task.progress) || 0,
                task.priority || "medium",
                task.description || "",
                JSON.stringify(subtasks)
            ];
        });

        const csvLines = [
            headers.map(value => this.escapeCSV(value)).join(","),
            ...rows.map(row =>
                row.map(value => this.escapeCSV(String(value))).join(",")
            )
        ];

        const csvContent = "\uFEFF" + csvLines.join("\r\n");
        const blob = new Blob(
            [csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const filename =
            `office-tasks-${new Date().toISOString().slice(0, 10)}.csv`;

        await this.saveFile(blob, filename);
    }

    static async saveFile(blob, filename) {
        if ("showSaveFilePicker" in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: "CSV File",
                            accept: {
                                "text/csv": [".csv"]
                            }
                        }
                    ]
                });

                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();

                return true;
            } catch (error) {
                if (error.name === "AbortError") {
                    throw new Error("Save cancelled");
                }

                throw error;
            }
        }

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        return true;
    }

    static escapeCSV(value) {
        const text = String(value ?? "");

        if (
            text.includes(",") ||
            text.includes('"') ||
            text.includes("\n") ||
            text.includes("\r")
        ) {
            return `"${text.replace(/"/g, '""')}"`;
        }

        return text;
    }

    static importFile(file) {
        if (!file) {
            return Promise.reject(new Error("No file selected"));
        }

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (extension !== "csv") {
            return Promise.reject(
                new Error(
                    "Please use a CSV file. Open your Excel file and save it as CSV UTF-8."
                )
            );
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = event => {
                try {
                    const csvText = event.target.result;
                    const tasks = this.parseCSV(csvText);

                    if (tasks.length === 0) {
                        throw new Error("No valid tasks found in the file");
                    }

                    resolve(tasks);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error("Could not read the selected file"));
            };

            reader.readAsText(file, "UTF-8");
        });
    }

    static parseCSV(csvText) {
        const rows = this.readCSVRows(csvText);

        if (rows.length < 2) {
            throw new Error("The CSV file does not contain task data");
        }

        const headers = rows[0].map(header =>
            header.trim().replace(/^\uFEFF/, "")
        );

        const taskNameIndex = this.findColumn(
            headers,
            "Task Name"
        );

        if (taskNameIndex === -1) {
            throw new Error('The "Task Name" column is missing');
        }

        return rows.slice(1)
            .filter(row => row.some(value => value.trim() !== ""))
            .map((row, index) => {
                const getValue = columnName => {
                    const columnIndex = this.findColumn(
                        headers,
                        columnName
                    );

                    return columnIndex >= 0
                        ? (row[columnIndex] || "").trim()
                        : "";
                };

                const name = getValue("Task Name");

                if (!name) {
                    return null;
                }

                const subtasksText =
                    getValue("Subtasks");

                return {
                    id: `imported_${Date.now()}_${index}_${Math.random()}`,
                    name,
                    assignee: getValue("Assignee"),
                    startDate: getValue("Start Date"),
                    endDate: getValue("End Date"),
                    progress: this.safeProgress(
                        getValue("Progress (%)")
                    ),
                    priority: this.safePriority(
                        getValue("Priority")
                    ),
                    description: getValue("Description"),
                    subtasks: this.parseSubtasks(subtasksText),
                    createdAt: new Date().toISOString()
                };
            })
            .filter(task => task !== null);
    }

    static parseSubtasks(value) {
        if (!value || !value.trim()) {
            return [];
        }

        /*
         * New export format:
         * Subtasks are stored as JSON in one CSV cell.
         */
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return parsed.map((subtask, index) => ({
                    id: subtask.id ||
                        `subtask_${Date.now()}_${index}_${Math.random()}`,
                    title: subtask.title || "",
                    startDate: subtask.startDate || "",
                    endDate: subtask.endDate || "",
                    completed: Boolean(subtask.completed)
                }));
            }
        } catch (error) {
            /*
             * Old files may contain plain text instead of JSON.
             * Preserve the old subtask names, but dates will remain empty
             * because old exports did not contain the date information.
             */
            return value
                .split(/\r?\n|;/)
                .map((line, index) => line
                    .replace(/^\s*\[[ xX✓☑]\]\s*/, "")
                    .trim()
                )
                .filter(Boolean)
                .map((title, index) => ({
                    id: `old_subtask_${Date.now()}_${index}_${Math.random()}`,
                    title,
                    startDate: "",
                    endDate: "",
                    completed: false
                }));
        }

        return [];
    }

    static findColumn(headers, columnName) {
        return headers.findIndex(header =>
            header.trim().toLowerCase() === columnName.toLowerCase()
        );
    }

    static safeProgress(value) {
        const progress = Number(value);

        if (Number.isNaN(progress)) {
            return 0;
        }

        return Math.max(0, Math.min(100, progress));
    }

    static safePriority(value) {
        const priority = String(value || "").toLowerCase();

        return ["low", "medium", "high"].includes(priority)
            ? priority
            : "medium";
    }

    static readCSVRows(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let insideQuotes = false;

        for (let index = 0; index < text.length; index++) {
            const character = text[index];
            const nextCharacter = text[index + 1];

            if (character === '"') {
                if (insideQuotes && nextCharacter === '"') {
                    cell += '"';
                    index++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (character === "," && !insideQuotes) {
                row.push(cell);
                cell = "";
            } else if (
                (character === "\n" || character === "\r") &&
                !insideQuotes
            ) {
                if (character === "\r" && nextCharacter === "\n") {
                    index++;
                }

                row.push(cell);
                rows.push(row);

                row = [];
                cell = "";
            } else {
                cell += character;
            }
        }

        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        return rows;
    }
}
