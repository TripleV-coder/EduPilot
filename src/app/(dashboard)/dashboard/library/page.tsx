"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { BookOpen, AlertCircle, Undo2, Plus, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { toast } from "sonner";

type Book = {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  available?: boolean;
  quantity?: number;
};

type BorrowingRecord = {
  id: string;
  book: {
    title: string;
    author?: string;
  };
  student: {
    user: {
        firstName: string;
        lastName: string;
    }
  };
  status: "BORROWED" | "RETURNED";
  dueDate: string;
  borrowedAt: string;
  returnedAt?: string | null;
};

type Tab = "catalogue" | "borrowings" | "admin";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("catalogue");

  // ---- Catalogue state ----
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [errorBooks, setErrorBooks] = useState<string | null>(null);
  const [borrowingBookId, setBorrowingBookId] = useState<string | null>(null);
  
  // Admin form state
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [newBook, setNewBook] = useState({ title: "", author: "", isbn: "", quantity: 1 });

  const fetchBooks = async () => {
    setLoadingBooks(true);
    try {
        const r = await fetch("/api/library/books", { credentials: "include" });
        if (!r.ok) throw new Error("Erreur");
        const data = await r.json();
        setBooks(Array.isArray(data) ? data : data.books ?? []);
    } catch (e) {
        setErrorBooks("Erreur de chargement");
    } finally {
        setLoadingBooks(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // ---- Borrowings state (useSWR) ----
  const {
    data: borrowings,
    error: errorBorrowings,
    isLoading: loadingBorrowings,
    mutate: mutateBorrowings,
  } = useSWR<BorrowingRecord[]>(
    (activeTab === "borrowings" || activeTab === "admin") ? "/api/library/borrowings" : null,
    fetcher
  );

  const [returningId, setReturningId] = useState<string | null>(null);

  // ---- Actions ----
  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    try {
        const res = await fetch("/api/library/books", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newBook),
        });
        if (res.ok) {
            toast.success("Livre ajouté au catalogue");
            setIsAddingBook(false);
            setNewBook({ title: "", author: "", isbn: "", quantity: 1 });
            fetchBooks();
        }
    } catch {
        toast.error("Échec de l'ajout");
    }
  }

  async function handleBorrow(bookId: string) {
    setBorrowingBookId(bookId);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 2 weeks by default

      const res = await fetch("/api/library/borrowings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookId, dueDate: dueDate.toISOString() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'emprunt");
      }

      toast.success("Emprunt enregistré");
      fetchBooks();
      mutateBorrowings();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'emprunt");
    } finally {
      setBorrowingBookId(null);
    }
  }

  async function handleReturn(recordId: string) {
    setReturningId(recordId);
    try {
      const res = await fetch("/api/library/borrowings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recordId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors du retour");
      }

      toast.success("Livre retourné");
      mutateBorrowings();
      fetchBooks();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du retour");
    } finally {
      setReturningId(null);
    }
  }

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session?.user?.role || "");

  return (
    <PageGuard permission={Permission.REPORT_VIEW} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6">
        <PageHeader
          title="Bibliothèque & Fonds"
          description="Consultez et empruntez des ouvrages pédagogiques."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Bibliothèque" },
          ]}
          actions={isAdmin && (
            <Dialog open={isAddingBook} onOpenChange={setIsAddingBook}>
                <DialogTrigger asChild>
                    <Button className="gap-2 action-critical"><Plus className="w-4 h-4" /> Ajouter un Livre</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nouvel Ouvrage</DialogTitle>
                        <DialogDescription>Ajoutez une ressource au catalogue de l&apos;école.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddBook} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Titre du livre</Label>
                            <Input value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Auteur</Label>
                            <Input value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ISBN</Label>
                                <Input value={newBook.isbn} onChange={e => setNewBook({...newBook, isbn: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Quantité</Label>
                                <Input type="number" value={newBook.quantity} onChange={e => setNewBook({...newBook, quantity: parseInt(e.target.value)})} min={1} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Enregistrer</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
          )}
        />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-0">
            <button onClick={() => setActiveTab("catalogue")} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "catalogue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                Catalogue
            </button>
            <button onClick={() => setActiveTab("borrowings")} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "borrowings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                Mes emprunts
            </button>
            {isAdmin && (
                <button onClick={() => setActiveTab("admin")} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "admin" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    Gestion & Retours
                </button>
            )}
        </div>

        {/* ========== CATALOGUE TAB ========== */}
        {activeTab === "catalogue" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loadingBooks ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : books.map((book) => (
              <Card key={book.id} className="border-border bg-card hover:shadow-md transition-shadow overflow-hidden">
                <div className="h-1.5 w-full bg-primary/20" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-foreground line-clamp-2">{book.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {book.author && <p className="font-medium text-foreground/80">👤 {book.author}</p>}
                    {book.isbn && <p className="mt-1">🆔 {book.isbn}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={book.available ? "secondary" : "outline"} className="text-[10px]">
                        {book.available ? `${book.quantity || 1} dispos` : "Indisponible"}
                    </Badge>
                    {book.available && session?.user?.role === "STUDENT" && (
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] uppercase font-bold" onClick={() => handleBorrow(book.id)}>
                            Emprunter
                        </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ========== BORROWINGS / ADMIN TAB ========== */}
        {(activeTab === "borrowings" || activeTab === "admin") && (
          <Card className="border-border overflow-hidden shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="px-6 py-4">Ouvrage</TableHead>
                    {activeTab === "admin" && <TableHead>Emprunteur</TableHead>}
                    <TableHead>Date Emprunt</TableHead>
                    <TableHead>Date Retour Prévue</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!borrowings || borrowings.length === 0) ? (
                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Aucun emprunt enregistré.</TableCell></TableRow>
                  ) : borrowings.map((record) => (
                    <TableRow key={record.id} className="group hover:bg-muted/5">
                      <TableCell className="px-6 font-bold">{record.book.title}</TableCell>
                      {activeTab === "admin" && (
                        <TableCell>
                            <span className="font-medium">{record.student.user.firstName} {record.student.user.lastName}</span>
                        </TableCell>
                      )}
                      <TableCell className="text-xs">{formatDate(record.borrowedAt)}</TableCell>
                      <TableCell className="text-xs font-medium text-amber-600">{formatDate(record.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={record.status === "BORROWED" ? "warning" : "success"} className="text-[9px] uppercase font-black">
                          {record.status === "BORROWED" ? "En cours" : "Retourné"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        {record.status === "BORROWED" && (
                          <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase" onClick={() => handleReturn(record.id)}>
                            <Undo2 className="h-3 w-3 mr-1" /> Retourner
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PageGuard>
  );
}
