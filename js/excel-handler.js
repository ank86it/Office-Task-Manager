class ExcelHandler {
    static async exportTasks(tasks) {
        if (!Array.isArray(tasks) || tasks.length === 0) {
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
                ? task.subtasks.map((subtask, index) => ({
                    id: subtask.id || `subtask_${index}`,
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

        const csv = [
            headers.map(value => this.escapeCSV(value)).join(","),
            ...rows.map(row =>
                row.map(value => this.escapeCSV(value)).join(",")
            )
        ].join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8" }
        );

        const filename =
            `office-tasks-${new Date().toISOString().slice(0, 10)}.csv`;

        await this.saveFile(blob, filename);
    }

    static async saveFile(blob, filename) {
        if ("showSaveFilePicker" in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: "CSV file",
                            accept: {
                                "text/csv": [".csv"]
                            }
                        }
                    ]
                });

                const writable = await handle.createWritable();
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

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

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
            text.includes("\r") ||
            text.includes("\n")
        ) {
            return `"${text.replace(/"/g, '""')}"`;
        }

        return text;
    }

    static importFile(file) {
        if (!file) {
            return Promise.reject(
                new Error("No file selected")
            );
        }

        const extension = file.name
            .split(".")
            .pop()
            .toLowerCase();

        if (extension !== "csv") {
            return Promise.reject(
                new Error(
                    "Please save the Excel file as CSV UTF-8 before importing"
                )
            );
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = event => {
                try {
                    const tasks = this.parseCSV(event.target.result);

                    if (!tasks.length) {
                        throw new Error(
                            "No valid tasks found in the CSV file"
                        );
                    }

                    resolve(tasks);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error("Unable to read the CSV file"));
            };

            reader.readAsText(file, "UTF-8");
        });
    }

    static parseCSV(csvText) {
        const rows = this.readCSVRows(csvText);

        if (rows.length < 2) {
            throw new Error("CSV file does not contain task data");
        }

        const headers = rows[0].map(header =>
            String(header)
                .replace(/^\uFEFF/, "")
                .trim()
                .toLowerCase()
        );

        const column = name => {
            return headers.indexOf(name.toLowerCase());
        };

        const taskNameColumn = column("Task Name");

        if (taskNameColumn === -1) {
            throw new Error('Missing "Task Name" column');
        }

        return rows
            .slice(1)
            .filter(row => row.some(value => String(value).trim() !== ""))
            .map((row, index) => {
                const value = name => {
                    const position = column(name);

                    return position >= 0
                        ? String(row[position] ?? "").trim()
                        : "";
                };

                const taskName = value("Task Name");

                if (!taskName) {
                    return null;
                }

                return {
                    id: `imported_${Date.now()}_${index}_${Math.random()}`,
                    name: taskName,
                    assignee: value("Assignee"),
                    startDate: value("Start Date"),
                    endDate: value("End Date"),
                    progress: this.readProgress(
                        value("Progress (%)")
                    ),
                    priority: this.readPriority(
                        value("Priority")
                    ),
                    description: value("Description"),
                    subtasks: this.parseSubtasks(
                        value("Subtasks")
                    ),
                    createdAt: new Date().toISOString()
                };
            })
            .filter(Boolean);
    }

    static parseSubtasks(rawValue) {
        if (!rawValue || !rawValue.trim()) {
            return [];
        }

        let value = rawValue.trim();

        /*
         * First attempt:
         * Correctly parsed CSV normally gives JSON like:
         *
         * [{"id":"123","title":"Design","startDate":"2026-08-06"}]
         */
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) {
                return this.normalizeSubtasks(parsed);
            }
        } catch (error) {
            // Continue with repair attempts below.
        }

        /*
         * Repair attempt:
         * Some CSV readers leave doubled quotes:
         *
         * [{""id"":""123"",""title"":""Design""}]
         *
         * Convert doubled quotes back to normal JSON quotes.
         */
        let repaired = value.replace(/""/g, '"');

        try {
            const parsed = JSON.parse(repaired);

            if (Array.isArray(parsed)) {
                return this.normalizeSubtasks(parsed);
            }
        } catch (error) {
            // Continue with the next repair attempt.
        }

        /*
         * Repair attempt for a value that still contains
         * an outer pair of quotes.
         */
        if (
            repaired.startsWith('"') &&
            repaired.endsWith('"')
        ) {
            repaired = repaired.slice(1, -1);
            repaired = repaired.replace(/""/g, '"');

            try {
                const parsed = JSON.parse(repaired);

                if (Array.isArray(parsed)) {
                    return this.normalizeSubtasks(parsed);
                }
            } catch (error) {
                // Continue with old-format fallback.
            }
        }

        /*
         * Old export fallback.
         * Old files did not contain subtask dates, so names
         * can be recovered but dates remain empty.
         */
        return value
            .split(/\r?\n|;/)
            .map(line =>
                line
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

    static normalizeSubtasks(subtasks) {
        return subtasks
            .filter(subtask =>
                subtask &&
                typeof subtask === "object"
            )
            .map((subtask, index) => ({
                id: subtask.id ||
                    `subtask_${Date.now()}_${index}_${Math.random()}`,
                title: String(subtask.title || ""),
                startDate: this.normalizeDate(
                    subtask.startDate
                ),
                endDate: this.normalizeDate(
                    subtask.endDate
                ),
                completed: Boolean(subtask.completed)
            }))
            .filter(subtask => subtask.title.trim() !== "");
    }

    static normalizeDate(value) {
        if (!value) {
            return "";
        }

        const text = String(value).trim();

        /*
         * Preserve ISO date format:
         * YYYY-MM-DD
         */
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return text;
        }

        /*
         * Convert common Excel date format:
         * DD-MM-YYYY
         */
        const dateParts = text.split("-");

        if (
            dateParts.length === 3 &&
            dateParts[2].length === 4
        ) {
            return `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`;
        }

        return text;
    }

    static readProgress(value) {
        const progress = Number(value);

        if (Number.isNaN(progress)) {
            return 0;
        }

        return Math.max(0, Math.min(100, progress));
    }

    static readPriority(value) {
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

        for (let i = 0; i < text.length; i++) {
            const character = text[i];
            const nextCharacter = text[i + 1];

            if (character === '"') {
                if (
                    insideQuotes &&
                    nextCharacter === '"'
                ) {
                    cell += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (
                character === "," &&
                !insideQuotes
            ) {
                row.push(cell);
                cell = "";
            } else if (
                (character === "\n" || character === "\r") &&
                !insideQuotes
            ) {
                if (
                    character === "\r" &&
                    nextCharacter === "\n"
                ) {
                    i++;
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
