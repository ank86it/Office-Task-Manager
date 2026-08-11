# Office Task Manager V4

Offline task management web app with:

- Main tasks and subtasks
- Subtask start and end dates
- Subtask completion checkboxes
- Automatic progress calculation
- Monthly Gantt chart
- Gantt zoom controls
- Task and subtask grouping
- Table view
- CSV export and import
- Browser local storage

## Project Structure

text office-task-manager/ 
├── README.md 
├── index.html 
├── css/ 
│ └── style.css 
└── js/ 
	├── excel-handler.js 
	├── storage.js 
	├── gantt.js 
	└── app.js

## Run

Open `index.html` in a browser.

No server or internet connection is required.

## JavaScript Order

## Data

Tasks are saved offline in browser storage.

Use **Export CSV** to create a backup.

Use **Import CSV** to restore tasks.

## Backup

Export your tasks regularly because clearing browser data can remove saved tasks.

