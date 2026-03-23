import type { ComponentType } from "react";
import { Permission, ADMIN_ROLES } from "./permissions";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Calendar,
  MessageSquare,
  DollarSign,
  BarChart3,
  Settings,
  FileText,
  Utensils,
  Shield,
} from "lucide-react";

export type NavItemConfig = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission | Permission[];
  roles?: UserRole[];
};

export const navConfig: NavItemConfig[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/schools", label: "Établissements", icon: School, permission: Permission.SCHOOL_READ, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
  { href: "/dashboard/classes", label: "Classes", icon: BookOpen, permission: Permission.CLASS_READ },
  { href: "/dashboard/students", label: "Élèves", icon: GraduationCap, permission: [Permission.STUDENT_READ, Permission.STUDENT_READ_OWN] },
  { href: "/dashboard/teachers", label: "Enseignants", icon: Users, permission: Permission.TEACHER_READ },
  { href: "/dashboard/grades", label: "Notes", icon: ClipboardList, permission: [Permission.GRADE_READ, Permission.GRADE_READ_OWN, Permission.GRADE_READ_CHILDREN] },
  { href: "/dashboard/attendance", label: "Présence", icon: FileText, permission: Permission.SCHEDULE_READ },
  { href: "/dashboard/calendar", label: "Calendrier", icon: Calendar, permission: [Permission.CALENDAR_EVENT_READ, Permission.HOLIDAY_READ] },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, permission: Permission.NOTIFICATION_READ },
  { href: "/dashboard/finance", label: "Finances", icon: DollarSign, permission: [Permission.FEE_READ, Permission.PAYMENT_READ, Permission.PAYMENT_READ_OWN] },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, permission: [Permission.ANALYTICS_VIEW, Permission.ANALYTICS_VIEW_OWN, Permission.ANALYTICS_VIEW_CHILDREN] },
  { href: "/dashboard/courses", label: "Cours", icon: BookOpen, permission: [Permission.CLASS_READ, Permission.SUBJECT_READ] },
  { href: "/dashboard/homework", label: "Devoirs", icon: FileText, permission: [Permission.EVALUATION_READ, Permission.GRADE_READ] },
  { href: "/dashboard/exams", label: "Examens", icon: ClipboardList, permission: [Permission.EVALUATION_READ, Permission.GRADE_READ] },
  { href: "/dashboard/announcements", label: "Annonces", icon: MessageSquare, permission: Permission.NOTIFICATION_READ },
  { href: "/dashboard/library", label: "Bibliothèque", icon: BookOpen, permission: Permission.REPORT_VIEW, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
  { href: "/dashboard/canteen", label: "Cantine", icon: Utensils, permission: Permission.NOTIFICATION_READ, roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
  { href: "/dashboard/admin", label: "Administration", icon: Shield, roles: [...ADMIN_ROLES] },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];
