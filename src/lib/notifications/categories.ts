export type NotificationSeverity = "urgent" | "warning" | "info";

export type NotificationType =
  | "exam_today"
  | "exam_tomorrow"
  | "exam_upcoming"
  | "submission_overdue"
  | "grades_overdue"
  | "grades_not_transferred"
  | "makeup_open_overdue"
  | "makeup_sent_no_grade";

export type NotificationCategory = "teacher" | "student";

export type Notification = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
  icon: "calendar" | "alert" | "clock" | "file" | "send" | "check";
  sortDate: string;
  entityKey: string;
  extraCount?: number;
};

export const STUDENT_NOTIFICATION_TYPES: NotificationType[] = [
  "makeup_open_overdue",
  "makeup_sent_no_grade",
];

export function notificationCategory(type: NotificationType): NotificationCategory {
  return STUDENT_NOTIFICATION_TYPES.includes(type) ? "student" : "teacher";
}

export function isTeacherNotification(type: string): boolean {
  return notificationCategory(type as NotificationType) === "teacher";
}

export function countBySeverity(
  items: { severity: NotificationSeverity }[],
): { urgent: number; warning: number; info: number; total: number } {
  let urgent = 0;
  let warning = 0;
  let info = 0;
  for (const it of items) {
    if (it.severity === "urgent") urgent += 1;
    else if (it.severity === "warning") warning += 1;
    else info += 1;
  }
  return { urgent, warning, info, total: items.length };
}
