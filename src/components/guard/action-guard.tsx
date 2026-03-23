"use client";

import { Button } from "@/components/ui/button";
import { useRBAC } from "@/lib/hooks/use-rbac";
import { Permission } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";

type ActionGuardProps = {
  permission?: Permission | Permission[];
  roles?: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * ActionGuard - Protège les actions (boutons, liens) selon les permissions RBAC
 * Masque complètement l'action si l'utilisateur n'a pas les droits
 */
export function ActionGuard({ permission, roles, fallback = null, children }: ActionGuardProps) {
  const { canAccess, status } = useRBAC();

  // Pendant le chargement, on peut afficher ou masquer selon le contexte
  if (status === "loading") {
    return <>{fallback}</>;
  }

  // Si aucune restriction, afficher l'action
  const hasRequirement = (permission != null && (Array.isArray(permission) ? permission.length > 0 : true)) || (roles != null && roles.length > 0);
  if (!hasRequirement) {
    return <>{children}</>;
  }

  // Vérifier les permissions
  const allowed = canAccess({ permission, roles });
  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * ActionButton - Bouton protégé par RBAC
 * Désactive le bouton si l'utilisateur n'a pas les droits (au lieu de le masquer)
 */
type ActionButtonProps = {
  permission?: Permission | Permission[];
  roles?: UserRole[];
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline" | "destructive" | "secondary";
  type?: "button" | "submit" | "reset";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function ActionButton({
  permission,
  roles,
  disabled = false,
  className = "",
  children,
  onClick,
  variant = "default",
  type = "button",
  ...props
}: ActionButtonProps) {
  const { canAccess, status } = useRBAC();

  const hasRequirement = (permission != null && (Array.isArray(permission) ? permission.length > 0 : true)) || (roles != null && roles.length > 0);
  const isAllowed = !hasRequirement || (status === "authenticated" && canAccess({ permission, roles }));
  const isDisabled = disabled || !isAllowed;

  // Si pas autorisé, ne pas afficher le bouton
  if (hasRequirement && !isAllowed) {
    return null;
  }

  return (
    <Button
      variant={variant}
      type={type}
      disabled={isDisabled}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
}
