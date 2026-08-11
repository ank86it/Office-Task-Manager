class GanttChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tasks = [];
        this.year = new Date().getFullYear();
        this.month = new Date().getMonth();
        this.pixelsPerDay = 22;

        this.monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];
    }

    render(tasks) {
        this.tasks = tasks || [];
        this.container.innerHTML = "";

        const gantt = document.createElement("div");
        gantt.className = "gantt";

        gantt.appendChild(this.createMonthNavigation());
        gantt.appendChild(this.createHeader());

        const body = document.createElement("div");
        body.className = "gantt-body";

        const left = document.createElement("div");
        left.className = "gantt-left";

        const right = document.createElement("div");
        right.className = "gantt-right";

        if (this.tasks.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-gantt";
            empty.textContent = "No tasks available. Click Add Task.";
            right.appendChild(empty);
        } else {
            this.tasks.forEach(task => {
                const rows = this.createRows(task);

                rows.forEach(rowData => {
                    left.appendChild(this.createLeftRow(rowData));
                    right.appendChild(this.createRightRow(rowData));
                });
            });
        }

        body.appendChild(left);
        body.appendChild(right);

        gantt.appendChild(body);
        this.container.appendChild(gantt);
    }

    createRows(task) {
        const rows = [
            {
                type: "task",
                item: task,
                parent: task
            }
        ];

        const subtasks = Array.isArray(task.subtasks)
            ? task.subtasks
            : [];

        subtasks.forEach(subtask => {
            rows.push({
                type: "subtask",
                item: subtask,
                parent: task
            });
        });

        return rows;
    }

    createMonthNavigation() {
        const navigation = document.createElement("div");
        navigation.className = "gantt-month-nav";

        const previousButton = document.createElement("button");
        previousButton.className = "btn btn-small";
        previousButton.textContent = "◀ Previous Month";
        previousButton.onclick = () => this.previousMonth();

        const title = document.createElement("strong");
        title.textContent =
            `${this.monthNames[this.month]} ${this.year}`;

        const nextButton = document.createElement("button");
        nextButton.className = "btn btn-small";
        nextButton.textContent = "Next Month ▶";
        nextButton.onclick = () => this.nextMonth();

        navigation.appendChild(previousButton);
        navigation.appendChild(title);
        navigation.appendChild(nextButton);

        return navigation;
    }

    createHeader() {
        const header = document.createElement("div");
        header.className = "gantt-header";

        const leftHeader = document.createElement("div");
        leftHeader.className = "gantt-left-header";
        leftHeader.textContent = "Tasks and Subtasks";

        const rightHeader = document.createElement("div");
        rightHeader.className = "gantt-right-header";

        const days = this.getDaysInMonth(
            this.month,
            this.year
        );

        /*
         * Make the date header width exactly equal
         * to the timeline width.
         */
        const totalWidth = days * this.pixelsPerDay;

        rightHeader.style.width = `${totalWidth}px`;
        rightHeader.style.minWidth = `${totalWidth}px`;
        rightHeader.style.flex = `0 0 ${totalWidth}px`;

        for (let day = 1; day <= days; day++) {
            const date = new Date(
                this.year,
                this.month,
                day
            );

            const cell = document.createElement("div");
            cell.className = "gantt-day-header";
            cell.textContent = day;

            /*
             * These three values are important.
             * They keep every date aligned during zoom.
             */
            cell.style.width = `${this.pixelsPerDay}px`;
            cell.style.minWidth = `${this.pixelsPerDay}px`;
            cell.style.flex = `0 0 ${this.pixelsPerDay}px`;

            if (
                date.getDay() === 0 ||
                date.getDay() === 6
            ) {
                cell.classList.add("weekend");
            }

            rightHeader.appendChild(cell);
        }

        header.appendChild(leftHeader);
        header.appendChild(rightHeader);

        return header;
    }

    createLeftRow(rowData) {
        const row = document.createElement("div");

        if (rowData.type === "task") {
            row.className = "gantt-left-row gantt-main-row";

            const task = rowData.item;
            const subtasks = task.subtasks || [];

            const completed = subtasks.filter(
                item => item.completed
            ).length;

            row.innerHTML = `
                <div class="gantt-task-label">
                    <span class="task-icon">📌</span>

                    <div>
                        <strong>${this.escape(task.name)}</strong>

                        <small>
                            ${this.escape(task.assignee || "Unassigned")}
                        </small>

                        <small>
                            ${completed}/${subtasks.length}
                            subtasks completed
                        </small>
                    </div>
                </div>
            `;
        } else {
            row.className = "gantt-left-row gantt-subtask-row";

            const subtask = rowData.item;
            const parent = rowData.parent;

            row.innerHTML = `
                <div class="gantt-subtask-label">
                    <span class="subtask-branch">└─</span>

                    <span class="subtask-check">
                        ${subtask.completed ? "☑" : "☐"}
                    </span>

                    <div>
                        <strong>
                            ${this.escape(subtask.title || "Subtask")}
                        </strong>

                        <small>
                            ${this.formatDate(subtask.startDate)}
                            -
                            ${this.formatDate(subtask.endDate)}
                        </small>

                        <small>
                            Under: ${this.escape(parent.name)}
                        </small>
                    </div>
                </div>
            `;
        }

        return row;
    }

    createRightRow(rowData) {
        const row = document.createElement("div");

        row.className = rowData.type === "task"
            ? "gantt-right-row gantt-main-row"
            : "gantt-right-row gantt-subtask-row";

        const timeline = document.createElement("div");
        timeline.className = "gantt-timeline";

        const days = this.getDaysInMonth(
            this.month,
            this.year
        );

        const timelineWidth = days * this.pixelsPerDay;

        /*
         * The timeline must have the same width as
         * the date header.
         */
        timeline.style.width = `${timelineWidth}px`;
        timeline.style.minWidth = `${timelineWidth}px`;
        timeline.style.flex = `0 0 ${timelineWidth}px`;

        /*
         * The vertical grid also uses the zoom width.
         */
        timeline.style.backgroundImage = `
            repeating-linear-gradient(
                to right,
                transparent 0,
                transparent ${this.pixelsPerDay - 1}px,
                #edf0f2 ${this.pixelsPerDay - 1}px,
                #edf0f2 ${this.pixelsPerDay}px
            )
        `;

        const item = rowData.item;

        const startDate = this.parseDate(item.startDate);
        const endDate = this.parseDate(item.endDate);

        if (this.overlapsMonth(startDate, endDate)) {
            const bar = this.createBar(
                item,
                rowData.type,
                startDate,
                endDate
            );

            timeline.appendChild(bar);
        }

        row.appendChild(timeline);

        return row;
    }

    createBar(item, type, startDate, endDate) {
        const monthStart = new Date(
            this.year,
            this.month,
            1
        );

        const monthEnd = new Date(
            this.year,
            this.month + 1,
            0
        );

        const visibleStart = startDate < monthStart
            ? monthStart
            : startDate;

        const visibleEnd = endDate > monthEnd
            ? monthEnd
            : endDate;

        const startDay = visibleStart.getDate() - 1;

        const duration =
            visibleEnd.getDate() -
            visibleStart.getDate() +
            1;

        const bar = document.createElement("div");

        if (type === "task") {
            bar.className =
                `gantt-task-bar gantt-main-task-bar ${
                    item.priority || "medium"
                }`;
        } else {
            bar.className =
                `gantt-task-bar gantt-subtask-bar ${
                    item.completed ? "completed" : ""
                }`;
        }

        /*
         * Bar position and width use the same zoom value
         * as the date header.
         */
        bar.style.left =
            `${startDay * this.pixelsPerDay}px`;

        bar.style.width =
            `${Math.max(duration, 1) * this.pixelsPerDay}px`;

        bar.style.minWidth =
            `${Math.max(duration, 1) * this.pixelsPerDay}px`;

        const progress = type === "task"
            ? Number(item.progress) || 0
            : item.completed
                ? 100
                : 0;

        const progressLayer = document.createElement("div");
        progressLayer.className = "gantt-progress";
        progressLayer.style.width = `${progress}%`;

        const label = document.createElement("span");

        if (type === "task") {
            label.textContent = `${progress}%`;
        } else {
            label.textContent = item.completed
                ? "Completed"
                : "";
        }

        bar.title =
            `${item.name || item.title}\n` +
            `${item.startDate} to ${item.endDate}\n` +
            `Progress: ${progress}%`;

        bar.appendChild(progressLayer);
        bar.appendChild(label);

        return bar;
    }

    overlapsMonth(startDate, endDate) {
        const monthStart = new Date(
            this.year,
            this.month,
            1
        );

        const monthEnd = new Date(
            this.year,
            this.month + 1,
            0
        );

        return startDate <= monthEnd && endDate >= monthStart;
    }

    parseDate(value) {
        if (!value) {
            return new Date(
                this.year,
                this.month,
                1
            );
        }

        const parts = value.split("-").map(Number);

        return new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );
    }

    getDaysInMonth(month, year) {
        return new Date(
            year,
            month + 1,
            0
        ).getDate();
    }

    nextMonth() {
        this.month++;

        if (this.month > 11) {
            this.month = 0;
            this.year++;
        }

        this.syncYear();
        this.render(this.tasks);
    }

    previousMonth() {
        this.month--;

        if (this.month < 0) {
            this.month = 11;
            this.year--;
        }

        this.syncYear();
        this.render(this.tasks);
    }

    nextYear() {
        this.year++;
        this.syncYear();
        this.render(this.tasks);
    }

    previousYear() {
        this.year--;
        this.syncYear();
        this.render(this.tasks);
    }

    setYear(year) {
        this.year = Number(year);
    }

    goToToday() {
        const today = new Date();

        this.year = today.getFullYear();
        this.month = today.getMonth();

        this.syncYear();
        this.render(this.tasks);
    }

    zoomIn() {
        this.pixelsPerDay = Math.min(
            this.pixelsPerDay + 4,
            60
        );

        this.render(this.tasks);
    }

    zoomOut() {
        this.pixelsPerDay = Math.max(
            this.pixelsPerDay - 4,
            12
        );

        this.render(this.tasks);
    }

    syncYear() {
        const input = document.getElementById("yearInput");

        if (input) {
            input.value = this.year;
        }
    }

    formatDate(value) {
        if (!value) {
            return "No date";
        }

        const parts = value.split("-");

        return parts.length === 3
            ? `${parts[2]}/${parts[1]}/${parts[0]}`
            : value;
    }

    escape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}