"use client";

import useSWR from "swr";
import { HeartPulse, Loader2, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MedicalRecord = {
  bloodType: string | null;
  conditions: string[];
  medications: string[];
  notes: string | null;
  allergies: Array<{ id: string; allergen: string; severity: string; reaction: string | null; treatment: string | null }>;
  vaccinations: Array<{ id: string; vaccineName: string; dateGiven: string }>;
  emergencyContacts: Array<{ id: string; name: string; relationship: string; phone: string; isPrimary: boolean }>;
};

/** 404 = aucun dossier ouvert : un état réel, pas une erreur. */
async function fetchRecord(url: string): Promise<MedicalRecord | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Erreur de chargement");
  }
  return res.json();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-none bg-muted/20 shadow-none">
      <CardHeader className="border-b border-border/50 p-4">
        <CardTitle className="text-xs font-bold text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 text-[13px]">{children}</CardContent>
    </Card>
  );
}

const none = <p className="text-muted-foreground">Non renseigné.</p>;

/**
 * Dossier médical réel de l'élève (/api/medical-records). L'onglet affichait en
 * dur « Dossier médical vide », même quand des allergies étaient enregistrées.
 * Réservé aux rôles de santé (direction, infirmerie, secrétariat), au parent et
 * à l'élève : l'appelant ne monte l'onglet que pour eux.
 */
export function StudentHealthTab({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR(`/api/medical-records?studentId=${encodeURIComponent(studentId)}`, fetchRecord);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Chargement du dossier médical">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Impossible de charger le dossier médical : {error.message}
      </div>
    );
  }
  if (!data) {
    return (
      <Card className="border-none bg-muted/20 shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <HeartPulse className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-bold text-muted-foreground">Aucun dossier médical ouvert pour cet élève.</p>
          <p className="mt-1 text-xs text-muted-foreground">Il se crée depuis le module Santé.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Allergies">
        {data.allergies.length === 0
          ? none
          : data.allergies.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.allergen}</span>
                <Badge variant="outline" className="text-[11px]">{a.severity}</Badge>
                {a.reaction ? <span className="text-muted-foreground">· {a.reaction}</span> : null}
                {a.treatment ? <span className="text-muted-foreground">· conduite : {a.treatment}</span> : null}
              </div>
            ))}
      </Section>
      <Section title="Santé">
        <p>
          <span className="text-muted-foreground">Groupe sanguin : </span>
          {data.bloodType ?? "non renseigné"}
        </p>
        <p>
          <span className="text-muted-foreground">Affections : </span>
          {data.conditions.length ? data.conditions.join(", ") : "aucune renseignée"}
        </p>
        <p>
          <span className="text-muted-foreground">Traitements : </span>
          {data.medications.length ? data.medications.join(", ") : "aucun renseigné"}
        </p>
        {data.notes ? <p className="text-muted-foreground">{data.notes}</p> : null}
      </Section>
      <Section title="Contacts d'urgence">
        {data.emergencyContacts.length === 0
          ? none
          : data.emergencyContacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground"> · {c.relationship}</span>
                  {c.isPrimary ? <span className="text-muted-foreground"> · principal</span> : null}
                </span>
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-semibold text-primary no-underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {c.phone}
                </a>
              </div>
            ))}
      </Section>
      <Section title="Vaccinations">
        {data.vaccinations.length === 0
          ? none
          : data.vaccinations.map((v) => (
              <p key={v.id}>
                <span className="font-semibold">{v.vaccineName}</span>
                <span className="text-muted-foreground"> · {new Date(v.dateGiven).toLocaleDateString("fr-FR")}</span>
              </p>
            ))}
      </Section>
    </div>
  );
}
