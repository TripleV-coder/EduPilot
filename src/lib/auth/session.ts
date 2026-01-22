import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

export async function getSession() {
  const session = await auth();
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role as UserRole)) {
    redirect("/dashboard");
  }
  return user;
}

export async function requireSuperAdmin() {
  return requireRole(["SUPER_ADMIN"]);
}

export async function requireSchoolAdmin() {
  return requireRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]);
}

export async function requireTeacher() {
  return requireRole(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]);
}
