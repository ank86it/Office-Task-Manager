class ExcelHandler {

    static async exportTasks(tasks) {
        if (!tasks.length) {
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
            "Subtasks",
            "Created At"
        ];

        const rows = tasks.map(task => {
            const subtasks = (task.subtasks || [])
                .map(item => `${item.completed ? "[x]" : "[ ]"} ${item.title}`)
                .join(" | ");

            return [
                task.name,
                task.assignee || "",
                task.startDate,
                task.endDate,
                task.progress || 0,
                task.priority || "medium",
                task.description || "",
                subtasks,
                task.createdAt || ""
            ];
        });

        const csv = [
            headers,
            ...rows
        ]
        .map(row => row.map(value => this.csvEscape(value)).join(","))
        .join("\r\n");

        const blob = new Blob(
            ["\ufeff" + csv],
            { type: "text/csv;charset=utf-8" }
        );

        const filename = `office_tasks_${new Date().toISOString().slice(0, 10)}.csv`;

        if ("showSaveFilePicker" in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: "Excel-compatible CSV",
                        accept: {
                            "text/csv": [".csv"]
                        }
                    }]
                });

                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (error) {
                if (error.name === "AbortError") {
                    throw new Error("Save cancelled");
                }

                throw error;
            }
        }

        this.download(blob, filename);
    }

    static csvEscape(value) {
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
        const extension = file.name.toLowerCase().split(".").pop();

        if (extension !== "csv") {
            return Promise.reject(
                new Error(
                    "This offline version imports CSV files. Open your Excel file and save it as CSV first."
                )
            );
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = event => {
                try {
                    resolve(this.parseCSV(event.target.result));
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error("Unable to read file"));
            reader.readAsText(file);
        });
    }

    static parseCSV(content) {
        const rows = [];
        let row = [];
        let value = "";
        let quoted = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next = content[i + 1];

            if (char === '"' && quoted && next === '"') {
                value += '"';
                i++;
            } else if (char === '"') {
                quoted = !quoted;
            } else if (char === "," && !quoted) {
                row.push(value);
                value = "";
            } else if ((char === "\n" || char === "\r") && !quoted) {
                if (char === "\r" && next === "\n") i++;

                row.push(value);
                if (row.some(cell => cell.trim() !== "")) {
                    rows.push(row);
                }

                row = [];
                value = "";
            } else {
                value += char;
            }
        }

        if (value.length || row.length) {
            row.push(value);
            rows.push(row);
        }

        if (rows.length < 2) {
            throw new Error("CSV file is empty");
        }

        const headers = rows[0].map(header => header.trim());

        const index = name => headers.indexOf(name);

        const tasks = rows.slice(1).map(row => {
            const get = name => {
                const position = index(name);
                return position >= 0 ? (row[position] || "").trim() : "";
            };

            const subtasks = get("Subtasks")
                .split("|")
                .map(item => item.trim())
                .filter(Boolean)
                .map(item => ({
                    id: crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}_${Math.random()}`,
                    title: item.replace(/^\[(x| )\]\s*/i, ""),
                    completed: /^\[x\]/i.test(item)
                }));

            return {
                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}_${Math.random()}`,
                name: get("Task Name"),
                assignee: get("Assignee"),
                startDate: get("Start Date"),
                endDate: get("End Date"),
                progress: calculateSubtaskProgress(subtasks) ||
                    Number(get("Progress (%)")) ||
                    0,
                priority: ["low", "medium", "high"].includes(get("Priority"))
                    ? get("Priority")
                    : "medium",
                description: get("Description"),
                subtasks,
                createdAt: new Date().toISOString()
            };
        }).filter(task => task.name);

        if (!tasks.length) {
            throw new Error("No valid tasks found");
        }

        return tasks;
    }

    static download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }
}