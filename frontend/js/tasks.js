// Tasks and Assignment Tracker Module
window.TaskManager = {
  STORAGE_KEY: 'tpb_tasks_data',

  getTasks() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading tasks:', e);
      return [];
    }
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks:', e);
    }
  },

  addTask(task) {
    const tasks = this.getTasks();
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: task.title,
      course_id: task.course_id || '',
      course_name: task.course_name || 'Umum',
      deadline: task.deadline || '',
      notes: task.notes || '',
      completed: false,
      created_at: new Date().toISOString()
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  },

  toggleTask(taskId) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this.saveTasks(tasks);
    }
    return tasks;
  },

  deleteTask(taskId) {
    let tasks = this.getTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    this.saveTasks(tasks);
    return tasks;
  },

  getTasksForCourse(courseName) {
    if (!courseName) return [];
    const tasks = this.getTasks();
    return tasks.filter(t => t.course_name.toLowerCase().includes(courseName.toLowerCase()) || courseName.toLowerCase().includes(t.course_name.toLowerCase()));
  },

  getPendingCount() {
    return this.getTasks().filter(t => !t.completed).length;
  }
};
