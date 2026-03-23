"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Permission } from "@/lib/rbac/permissions";
import { Bell, AlertCircle, CheckCircle, Plus, Calendar, Megaphone, Users, Trash2, ShieldAlert } from "lucide-react";
import { useSession } from "next-auth/react";
import { Switch } from "@/components/ui/switch";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type Announcement = {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

export default function AnnouncementsPage() {
  const { data: session } = useSession();
  const isDirectorOrAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session?.user?.role || "");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [publishNow, setPublishNow] = useState(true);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("Erreur de récupération des annonces");
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title,
      content,
      type,
      priority,
      targetRoles: targetRoles.length > 0 ? targetRoles : undefined, // empty means all roles
      isPublished: publishNow,
    };

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      setSuccessMsg("Annonce publiée avec succès !");
      setIsAdding(false);

      // Reset form
      setTitle("");
      setContent("");
      setType("GENERAL");
      setPriority("NORMAL");
      setTargetRoles([]);

      fetchAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/announcements/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== deleteTarget.id));
      } else {
        throw new Error("Réponse non valide");
      }
    } catch {
      setError("Erreur lors de la suppression de l'annonce.");
    } finally {
      setIsDeleteConfirmLoading(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "HIGH": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "LOW": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EVENT": return <Calendar className="w-5 h-5 text-purple-500" />;
      case "URGENT": return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default: return <Megaphone className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader
            title="Fil d'Annonces"
            description="Tableau d'affichage numérique de l'établissement."
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Annonces" },
            ]}
          />
          {isDirectorOrAdmin && !isAdding && (
            <Button onClick={() => setIsAdding(true)} className="gap-2 shadow-sm shrink-0">
              <Plus className="h-4 w-4" />
              Nouvelle Annonce
            </Button>
          )}
        </div>

          <ConfirmActionDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setDeleteTarget(null);
            }}
            title="Supprimer l'annonce"
            description={deleteTarget ? `Cette action supprimera "${deleteTarget.title}".` : undefined}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            variant="destructive"
            isConfirmLoading={isDeleteConfirmLoading}
            onConfirm={confirmDelete}
          />

        {error && (
          <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{successMsg}</p>
          </div>
        )}

        {/* Create Form */}
        {isAdding && isDirectorOrAdmin && (
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                Rédiger une nouvelle annonce
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAnnouncement} className="space-y-5">
                <div className="space-y-2">
                  <Label>Titre <span className="text-destructive">*</span></Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contenu du message <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    
                    required
                    className="h-32 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="GENERAL">Général (Information standard)</option>
                      <option value="ACADEMIC">Pédagogique (Examens, devoirs...)</option>
                      <option value="EVENT">Événement (Kermesse, Réunion)</option>
                      <option value="URGENT">Urgence (Fermeture, Météo)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="LOW">Basse</option>
                      <option value="NORMAL">Normale</option>
                      <option value="HIGH">Haute</option>
                      <option value="URGENT">Urgente (Alerte rouge)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Label>Audience cible (Laissez vide pour diffuser à tout le monde)</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "TEACHER", label: "Professeurs" },
                      { id: "STUDENT", label: "Élèves" },
                      { id: "PARENT", label: "Parents" },
                    ].map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${targetRoles.includes(role.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:border-primary/50'}`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-background mt-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{t("common.publishNow")}</Label>
                    <p className="text-xs text-muted-foreground">L'annonce sera visible dès l'enregistrement.</p>
                  </div>
                  <Switch checked={publishNow} onCheckedChange={setPublishNow} />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                  <Button type="submit" disabled={saving || !title || !content} className="gap-2">
                    {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2" /> : <Bell className="w-4 h-4" />}
                    {t("common.publish")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Announcements List */}
        <div className="space-y-4 pt-2">
          {loading ? (
            <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">Aucune annonce</h3>
              <p className="text-sm text-muted-foreground mt-1">Le tableau d'affichage numérique est vide.</p>
            </div>
          ) : (
            announcements.map(announcement => (
              <Card key={announcement.id} className={`overflow-hidden border-l-4 transition-all hover:shadow-md ${announcement.priority === 'URGENT' ? 'border-l-red-500' : announcement.priority === 'HIGH' ? 'border-l-orange-500' : 'border-l-primary'}`}>
                <CardContent className="p-0">
                  <div className="p-5">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 shrink-0">
                          {getTypeIcon(announcement.type)}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground leading-tight">{announcement.title}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {announcement.publishedAt ? new Date(announcement.publishedAt).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Non publié'}
                            </span>
                            <span className="text-muted-foreground text-xs">•</span>
                            <span className="text-xs text-muted-foreground">
                              Par {announcement.author?.firstName} {announcement.author?.lastName}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getPriorityColor(announcement.priority)}`}>
                              {announcement.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isDirectorOrAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(announcement.id, announcement.title)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t text-sm whitespace-pre-wrap text-foreground/90">
                      {announcement.content}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageGuard>
  );
}
