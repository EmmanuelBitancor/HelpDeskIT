export type Role = "user" | "support" | "admin" | "superadmin";

export const roleRoutes: Record<Role, string> = {
  user: "/dashboard",
  support: "/support",
  admin: "/admin",
  superadmin: "/super-admin",
};
