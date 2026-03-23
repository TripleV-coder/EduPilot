"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone } from "lucide-react";

type ParentStudent = {
  relationship?: string;
  parent?: {
    user?: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    };
  };
};

export function StudentParentsTab({ parents }: { parents: ParentStudent[] }) {
  if (!parents || parents.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aucun parent enregistré pour cet élève.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {parents.map((ps, index) => {
        const user = ps.parent?.user;
        const fullName = user ? `${user.firstName} ${user.lastName}` : "Parent inconnu";

        return (
          <Card key={index} className="border-border bg-card">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">{fullName}</h3>
                {ps.relationship && (
                  <Badge variant="secondary">{ps.relationship}</Badge>
                )}
              </div>

              {user?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${user.email}`} className="hover:underline">
                    {user.email}
                  </a>
                </div>
              )}

              {user?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${user.phone}`} className="hover:underline">
                    {user.phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
