import { apiFetch } from "./api";
import { useAuthStore } from "./auth-store";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: "MEETING" | "DEADLINE" | "HOLIDAY" | "REMINDER" | "EVENT";
  startAt: string;
  endAt?: string;
  allDay: boolean;
  color?: string;
  attendees?: { user: { id: string, fullName: string } }[];
}

export interface TaskAsEvent {
  id: string;
  title: string;
  dueAt: string;
  priority: string;
  status: string;
}

export const calendarApi = {
  async getEvents(projectId?: string) {
    const { accessToken } = useAuthStore.getState();
    const query = projectId ? `?projectId=${projectId}` : "";
    return apiFetch<{ ok: boolean, events: CalendarEvent[], tasksAsEvents: TaskAsEvent[] }>(
      `/calendar/events${query}`,
      {},
      accessToken
    );
  },

  async createEvent(data: Omit<CalendarEvent, "id"> & { attendeeIds?: string[], projectId?: string }) {
    const { accessToken } = useAuthStore.getState();
    return apiFetch<{ ok: boolean, event: CalendarEvent }>(
      "/calendar/events",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      accessToken
    );
  },

  async createRecurringTask(data: any) {
    const { accessToken } = useAuthStore.getState();
    return apiFetch<{ ok: boolean, recurring: any }>(
      "/calendar/recurring-tasks",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      accessToken
    );
  },

  async syncTasks() {
    const { accessToken } = useAuthStore.getState();
    return apiFetch<{ ok: boolean, generatedCount: number, tasks: any[] }>(
      "/calendar/sync",
      { method: "POST" },
      accessToken
    );
  }
};
