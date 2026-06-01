import { Markup } from "telegraf";

export function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 My Tasks", "TASKS_LIST")],
    [Markup.button.callback("➕ Create Task", "TASK_CREATE")],
    [Markup.button.callback("📅 My Meetings", "MEETINGS_LIST")],
    [Markup.button.callback("🔔 Notifications", "NOTIFS_LIST")],
    [Markup.button.callback("🤖 Ask AI", "AI_CHAT")],
    [Markup.button.callback("🚪 Logout", "LOGOUT")],
  ]);
}

export function taskStatusMenu(taskId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("▶️ Mark In Progress", `TASK_START_${taskId}`)],
    [Markup.button.callback("📤 Submit Task", `TASK_SUBMIT_${taskId}`)],
    [Markup.button.callback("◀️ Back to Tasks", "TASKS_LIST")],
  ]);
}

export function backMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("◀️ Main Menu", "MAIN_MENU")],
  ]);
}

export function cancelMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("❌ Cancel", "CANCEL")],
  ]);
}

export function confirmMenu(action: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Confirm", `CONFIRM_${action}`),
      Markup.button.callback("❌ Cancel", "CANCEL"),
    ],
  ]);
}
