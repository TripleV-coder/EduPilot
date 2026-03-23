"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import {
    HeartPulse, Search, Loader2, AlertCircle, Users, Activity,
    Droplet, Pill, AlertTriangle, FileText, FileClock, Edit,
    Phone, Syringe, ShieldCheck
} from "lucide-react";
import { t } from "@/lib/i18n";

type EmergencyContact = {
    id: string;
    name: string;
    relationship: string;
    phone: string;
    alternatePhone?: string;
    isPrimary: boolean;
};

type Vaccination = {
    id: string;
    vaccineName: string;
    dateGiven: string;
    nextDueDate?: string;
    administeredBy?: string;
};

type MedicalRecord = {
    id: string;
    studentId: string;
    bloodType: string | null;
    medicalHistory: string | null;
    medications: string[];
    conditions: string[];
    notes: string | null;
};

type Student = {
    id: string;
    enrollmentNumber: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    class: {
        name: string;
    } | null;
};

export default function MedicalRecordsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [medicalRecord, setMedicalRecord] = useState<MedicalRecord | null>(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState<Partial<MedicalRecord>>({});
    const [saving, setSaving] = useState(false);
    const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
    const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/students?limit=100");
            if (res.ok) {
                const data = await res.json();
                const studentList = data.students || [];
                setStudents(studentList);
                if (studentList.length === 1) {
                    fetchMedicalRecord(studentList[0]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch students", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMedicalRecord = async (student: Student) => {
        setSelectedStudent(student);
        setEditMode(false);
        setLoadingRecord(true);
        setMedicalRecord(null);
        setFormData({});
        setEmergencyContacts([]);
        setVaccinations([]);

        try {
            const res = await fetch(`/api/health/medical-records?studentId=${student.id}`);
            if (res.ok) {
                const data = await res.json();
                const record = Array.isArray(data.medicalRecords) ? data.medicalRecords[0] ?? null : data.medicalRecord ?? null;

                if (record) {
                    setMedicalRecord(record);
                    setFormData(record);

                    // Fetch emergency contacts and vaccinations from health APIs
                    const [contactsRes, vaccinationsRes] = await Promise.all([
                        fetch(`/api/health/emergency-contacts?studentId=${student.id}`).catch(() => null),
                        fetch(`/api/health/vaccinations?studentId=${student.id}`).catch(() => null),
                    ]);
                    if (contactsRes?.ok) {
                        const contactsData = await contactsRes.json();
                        setEmergencyContacts(Array.isArray(contactsData) ? contactsData : contactsData.emergencyContacts || []);
                    }
                    if (vaccinationsRes?.ok) {
                        const vaccinationsData = await vaccinationsRes.json();
                        setVaccinations(Array.isArray(vaccinationsData) ? vaccinationsData : vaccinationsData.vaccinations || []);
                    }
                } else {
                    setMedicalRecord(null);
                    setFormData({ studentId: student.id, bloodType: "", medicalHistory: "", notes: "", medications: [], conditions: [] });
                }
            } else if (res.status === 404) {
                setMedicalRecord(null);
                setFormData({ studentId: student.id, bloodType: "", medicalHistory: "", notes: "", medications: [], conditions: [] });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingRecord(false);
        }
    };

    const handleSaveRecord = async () => {
        if (!selectedStudent) return;
        setSaving(true);

        // Convert comma separated strings to arrays
        const payload = {
            ...formData,
            studentId: selectedStudent.id,
            medications: typeof (formData.medications as any) === "string" ? (formData.medications as any).split(",").map((s: string) => s.trim()).filter(Boolean) : formData.medications,
            conditions: typeof (formData.conditions as any) === "string" ? (formData.conditions as any).split(",").map((s: string) => s.trim()).filter(Boolean) : formData.conditions,
        };

        try {
            const res = await fetch("/api/health/medical-records", {
                method: medicalRecord ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(medicalRecord ? { id: medicalRecord.id, ...payload } : payload)
            });

            if (res.ok) {
                const savedData = await res.json();
                const record = savedData.medicalRecord ?? savedData;
                setMedicalRecord(record);
                setFormData(record);
                setEditMode(false);
            } else {
                alert("Erreur lors de l'enregistrement du dossier médical");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.user.firstName.toLowerCase().includes(search.toLowerCase()) ||
        s.user.lastName.toLowerCase().includes(search.toLowerCase()) ||
        s.enrollmentNumber.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <PageGuard permission={[Permission.STUDENT_READ, Permission.STUDENT_READ_OWN]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Infirmerie & Dossiers Médicaux"
                    description="Gérez les fiches de santé, antécédents et urgences médicales des élèves."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Vie Scolaire" },
                        { label: "Santé" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Colonne de gauche : Recherche des élèves */}
                    <Card className="h-[750px] flex flex-col shadow-sm">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Registre des Élèves
                            </h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    
                                    className="pl-9 bg-muted/30"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground text-sm">Aucun élève trouvé.</div>
                            ) : (
                                filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => fetchMedicalRecord(student)}
                                        className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${selectedStudent?.id === student.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted text-foreground/80"
                                            }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate">{student.user.firstName} {student.user.lastName}</div>
                                            <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                                                <span>{student.enrollmentNumber}</span>
                                                {student.class && (
                                                    <span className="bg-secondary/10 text-secondary px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                                                        {student.class.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Colonne de droite : Détails du dossier médical */}
                    <Card className="md:col-span-2 h-[750px] shadow-sm flex flex-col bg-background relative overflow-hidden">
                        {selectedStudent ? (
                            loadingRecord ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                                    <p className="text-muted-foreground text-sm">Chargement du dossier médical...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="p-6 border-b bg-muted/10 flex items-start justify-between shrink-0">
                                        <div>
                                            <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-3">
                                                <HeartPulse className="w-7 h-7 text-rose-500" />
                                                Dossier Médical
                                            </h2>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Élève : <span className="font-semibold text-foreground">{selectedStudent.user.firstName} {selectedStudent.user.lastName}</span>
                                                <span className="mx-2">•</span>
                                                Matricule : {selectedStudent.enrollmentNumber}
                                            </p>
                                        </div>
                                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                                            <Button onClick={() => setEditMode(!editMode)} variant={editMode ? "outline" : "default"} className="gap-2">
                                                {editMode ? "Annuler l'édition" : <><Edit className="w-4 h-4" /> Mettre à jour</>}
                                            </Button>
                                        </RoleActionGuard>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        {!medicalRecord && !editMode ? (
                                            <div className="text-center py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/5">
                                                <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                                <h3 className="text-lg font-semibold text-foreground/80">Aucun dossier médical</h3>
                                                <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">Cet élève n'a pas encore de fiche médicale informatisée dans la base de données de l'infirmerie.</p>
                                                <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                                                    <Button onClick={() => setEditMode(true)}>
                                                        Créer la fiche médicale
                                                    </Button>
                                                </RoleActionGuard>
                                            </div>
                                        ) : (
                                            <div className="space-y-8">
                                                {/* Edit Mode Form */}
                                                {editMode ? (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                                                                    <Droplet className="w-4 h-4 text-rose-500" />
                                                                    Groupe Sanguin
                                                                </label>
                                                                <Input
                                                                    
                                                                    value={formData.bloodType || ""}
                                                                    onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                                Allergies / Conditions Spécifiques
                                                            </label>
                                                            <Input
                                                                
                                                                value={Array.isArray(formData.conditions) ? formData.conditions.join(", ") : formData.conditions || ""}
                                                                onChange={(e) => setFormData({ ...formData, conditions: e.target.value as any })}
                                                                className="border-amber-200 focus-visible:ring-amber-500/20"
                                                            />
                                                            <p className="text-[11px] text-muted-foreground">Séparez les différentes conditions par des virgules.</p>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                                                                <Pill className="w-4 h-4 text-blue-500" />
                                                                Traitements Réguliers (Médicaments)
                                                            </label>
                                                            <Input
                                                                
                                                                value={Array.isArray(formData.medications) ? formData.medications.join(", ") : formData.medications || ""}
                                                                onChange={(e) => setFormData({ ...formData, medications: e.target.value as any })}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                                                                <FileClock className="w-4 h-4 text-slate-500" />
                                                                Antécédents Médicaux Importants
                                                            </label>
                                                            <textarea
                                                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                                                
                                                                value={formData.medicalHistory || ""}
                                                                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                Notes de l'Infirmerie / Consignes Urgentes
                                                            </label>
                                                            <textarea
                                                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/30 border-destructive/20 focus-visible:border-destructive/30"
                                                                
                                                                value={formData.notes || ""}
                                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-sm py-4">
                                                            <Button variant="outline" onClick={() => {
                                                                setEditMode(false);
                                                                setFormData(medicalRecord || {});
                                                            }}>{t("common.cancel")}</Button>
                                                            <Button onClick={handleSaveRecord} disabled={saving} className="min-w-[120px]">
                                                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Enregistrer la fiche"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* View Mode */
                                                    <div className="space-y-8 animate-in fade-in duration-300">
                                                        {medicalRecord?.conditions && medicalRecord.conditions.length > 0 && (
                                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                                                                <h3 className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-2 mb-3">
                                                                    <AlertTriangle className="w-5 h-5" />
                                                                    Urgences & Allergies
                                                                </h3>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {medicalRecord.conditions.map((cond, i) => (
                                                                        <span key={i} className="bg-amber-500 text-white font-semibold px-3 py-1 rounded-full text-sm">
                                                                            {cond}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="bg-muted/10 border rounded-lg p-4">
                                                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                                                                    <Droplet className="w-4 h-4 text-rose-500" />
                                                                    Groupe Sanguin
                                                                </div>
                                                                <div className="text-2xl font-bold font-display text-foreground">
                                                                    {medicalRecord?.bloodType || <span className="text-muted-foreground/50 italic text-lg">Inconnu</span>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-muted/10 border rounded-lg p-4">
                                                                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                                                                    <Pill className="w-4 h-4 text-blue-500" />
                                                                    Traitements
                                                                </div>
                                                                {medicalRecord?.medications && medicalRecord.medications.length > 0 ? (
                                                                    <ul className="text-sm font-medium space-y-1">
                                                                        {medicalRecord.medications.map((med, i) => (
                                                                            <li key={i} className="flex items-center gap-2 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full">{med}</li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic text-sm">Aucun traitement en cours</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 border-b pb-2 flex items-center gap-2">
                                                                <FileClock className="w-4 h-4 text-slate-500" />
                                                                Antécédents Majeurs
                                                            </div>
                                                            <p className="text-foreground/80 text-sm whitespace-pre-wrap leading-relaxed bg-muted/5 p-4 rounded-lg border border-border/50">
                                                                {medicalRecord?.medicalHistory || <span className="text-muted-foreground italic">Aucun historique médical signalé.</span>}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 border-b pb-2 flex items-center gap-2">
                                                                <FileText className="w-4 h-4 text-slate-500" />
                                                                Notes de l'Infirmerie
                                                            </div>
                                                            <p className="text-foreground/80 text-sm whitespace-pre-wrap leading-relaxed bg-primary/5 p-4 rounded-lg border border-primary/10">
                                                                {medicalRecord?.notes || <span className="text-muted-foreground italic">Aucune consigne ou note interne.</span>}
                                                            </p>
                                                        </div>

                                                        {/* Emergency Contacts */}
                                                        <div>
                                                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 border-b pb-2 flex items-center gap-2">
                                                                <Phone className="w-4 h-4 text-green-500" />
                                                                Contacts d'Urgence
                                                            </div>
                                                            {emergencyContacts.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {emergencyContacts.map((contact) => (
                                                                        <div key={contact.id} className="flex items-center justify-between bg-muted/10 border rounded-lg p-3">
                                                                            <div>
                                                                                <p className="font-medium text-sm text-foreground">
                                                                                    {contact.name}
                                                                                    {contact.isPrimary && (
                                                                                        <span className="ml-2 text-[10px] uppercase font-bold bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">Principal</span>
                                                                                    )}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                                                                            </div>
                                                                            <div className="text-sm font-mono text-foreground/80">{contact.phone}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground italic bg-muted/5 p-4 rounded-lg border border-border/50">Aucun contact d'urgence enregistré.</p>
                                                            )}
                                                        </div>

                                                        {/* Vaccinations */}
                                                        <div>
                                                            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 border-b pb-2 flex items-center gap-2">
                                                                <Syringe className="w-4 h-4 text-indigo-500" />
                                                                Vaccinations
                                                            </div>
                                                            {vaccinations.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {vaccinations.map((vax) => (
                                                                        <div key={vax.id} className="flex items-center justify-between bg-muted/10 border rounded-lg p-3">
                                                                            <div>
                                                                                <p className="font-medium text-sm text-foreground">{vax.vaccineName}</p>
                                                                                {vax.administeredBy && (
                                                                                    <p className="text-xs text-muted-foreground">Par : {vax.administeredBy}</p>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-sm text-foreground/80">{new Date(vax.dateGiven).toLocaleDateString("fr-FR")}</p>
                                                                                {vax.nextDueDate && (
                                                                                    <p className="text-xs text-muted-foreground">Rappel : {new Date(vax.nextDueDate).toLocaleDateString("fr-FR")}</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground italic bg-muted/5 p-4 rounded-lg border border-border/50">Aucune vaccination enregistrée.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/5 border-l">
                                <Activity className="w-16 h-16 text-muted-foreground/20 mb-4" />
                                <h3 className="text-xl font-display font-semibold text-foreground/80">Infirmerie d'Établissement</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mt-2">Sélectionnez un élève dans le registre à gauche pour consulter ou mettre à jour son dossier médical.</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
