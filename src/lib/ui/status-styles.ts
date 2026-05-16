export function getAppointmentStatusClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-success/10 text-success border-success/30";
    case "PENDING":
      return "bg-warning/10 text-warning border-warning/30";
    case "CANCELLED":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "COMPLETED":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/10 text-primary border-primary/30";
  }
}

export function getIncidentSeverityClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "HIGH":
    case "MEDIUM":
      return "bg-warning/10 text-warning border-warning/30";
    case "LOW":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function getAnnouncementPriorityClass(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "HIGH":
      return "bg-warning/10 text-warning border-warning/30";
    case "LOW":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/10 text-primary border-primary/30";
  }
}

export function getComplianceRequestStatusClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-warning/10 text-warning";
    case "IN_PROGRESS":
      return "bg-primary/10 text-primary";
    case "COMPLETED":
      return "bg-success/10 text-success";
    case "REJECTED":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getEventTypeClass(type: string): string {
  switch (type) {
    case "FIELD_TRIP":
      return "bg-success/10 text-success border-success/30";
    case "SPORTS":
    case "GRADUATION":
      return "bg-warning/10 text-warning border-warning/30";
    case "COMPETITION":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "ASSEMBLY":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/10 text-primary border-primary/30";
  }
}

export function getEventTypeAccentClass(type: string): string {
  switch (type) {
    case "FIELD_TRIP":
      return "bg-success";
    case "SPORTS":
    case "GRADUATION":
      return "bg-warning";
    case "COMPETITION":
      return "bg-destructive";
    case "ASSEMBLY":
      return "bg-muted-foreground";
    default:
      return "bg-primary";
  }
}

export function getAuditLogActionClass(action: string): string {
  const value = action.toLowerCase();
  if (value.includes("create")) return "bg-success/10 text-success border-success/30";
  if (value.includes("update")) return "bg-primary/10 text-primary border-primary/30";
  if (value.includes("delete")) return "bg-destructive/10 text-destructive border-destructive/20";
  if (value.includes("login")) {
    return value.includes("fail")
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-primary/10 text-primary border-primary/30";
  }
  return "bg-muted/50 text-foreground border-border";
}

export function getClassCycleClass(level?: string): string {
  switch (level) {
    case "PRIMARY":
      return "bg-success/10 text-success border-success/30";
    case "SECONDARY_COLLEGE":
    case "SECONDARY_LYCEE":
      return "bg-primary/10 text-primary border-primary/30";
    case "MIXED":
      return "bg-warning/10 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function getUserActivityClass(isActive?: boolean): string {
  return isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
}

export function getUserAccountStatusClass(isActive?: boolean): string {
  return isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
}

export function getRootUserRoleClass(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-primary/10 text-primary border-primary/30";
    case "SCHOOL_ADMIN":
      return "bg-success/10 text-success border-success/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
