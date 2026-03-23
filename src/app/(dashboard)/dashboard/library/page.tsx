"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BookOpen, AlertCircle, Undo2 } from "lucide-react";

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
  status: "BORROWED" | "RETURNED";
  dueDate: string;
  borrowedAt: string;
  returnedAt?: string | null;
};

type Tab = "catalogue" | "borrowings";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("catalogue");

  // ---- Catalogue state (kept as original fetch/useEffect) ----
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [errorBooks, setErrorBooks] = useState<string | null>(null);
  const [borrowingBookId, setBorrowingBookId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library/books", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Erreur de chargement du catalogue");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setBooks(Array.isArray(data) ? data : data.books ?? []);
      })
      .catch((e) => {
        if (!cancelled) setErrorBooks(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingBooks(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Borrowings state (useSWR) ----
  const {
    data: borrowings,
    error: errorBorrowings,
    isLoading: loadingBorrowings,
    mutate: mutateBorrowings,
  } = useSWR<BorrowingRecord[]>(
    activeTab === "borrowings" ? "/api/library/borrowings" : null,
    fetcher
  );

  const [returningId, setReturningId] = useState<string | null>(null);

  // ---- Actions ----
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

      // Refresh books list to update availability
      const booksRes = await fetch("/api/library/books", { credentials: "include" });
      if (booksRes.ok) {
        const data = await booksRes.json();
        setBooks(Array.isArray(data) ? data : data.books ?? []);
      }

      // Also refresh borrowings if cached
      mutateBorrowings();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de l'emprunt";
      alert(message);
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

      mutateBorrowings();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors du retour";
      alert(message);
    } finally {
      setReturningId(null);
    }
  }

  // ---- Tab buttons ----
  const tabs: { key: Tab; label: string }[] = [
    { key: "catalogue", label: "Catalogue" },
    { key: "borrowings", label: "Mes emprunts" },
  ];

  return (
    <PageGuard permission={Permission.REPORT_VIEW} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6">
        <PageHeader
          title="Bibliothèque & LMS"
          description="Catalogue des ressources pédagogiques"
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Bibliothèque" },
          ]}
        />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========== CATALOGUE TAB ========== */}
        {activeTab === "catalogue" && (
          <>
            {loadingBooks && (
              <div className="flex justify-center items-center py-12">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                  aria-label="Chargement..."
                />
              </div>
            )}

            {errorBooks && (
              <div
                role="alert"
                className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{errorBooks}</p>
              </div>
            )}

            {!loadingBooks && !errorBooks && books.length === 0 && (
              <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                <BookOpen
                  className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-medium text-foreground">
                  Catalogue vide
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Les ressources pédagogiques apparaîtront ici.
                </p>
              </div>
            )}

            {!loadingBooks && !errorBooks && books.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {books.map((book) => (
                  <Card
                    key={book.id}
                    className="border-border bg-card hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <BookOpen
                          className="w-5 h-5 text-primary"
                          aria-hidden="true"
                        />
                      </div>
                      <CardTitle className="text-sm font-semibold text-foreground line-clamp-2">
                        {book.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {book.author && (
                        <p className="text-xs text-muted-foreground">
                          Par {book.author}
                        </p>
                      )}
                      {book.isbn && (
                        <p className="text-xs text-muted-foreground font-mono">
                          ISBN: {book.isbn}
                        </p>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          book.available !== false
                            ? "bg-secondary/10 text-secondary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {book.available !== false
                          ? `Disponible${book.quantity ? ` (${book.quantity})` : ""}`
                          : "Indisponible"}
                      </span>
                      {book.available !== false && (
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs"
                            disabled={borrowingBookId === book.id}
                            onClick={() => handleBorrow(book.id)}
                          >
                            {borrowingBookId === book.id
                              ? "Emprunt en cours..."
                              : "Emprunter"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ========== BORROWINGS TAB ========== */}
        {activeTab === "borrowings" && (
          <>
            {loadingBorrowings && (
              <div className="flex justify-center items-center py-12">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                  aria-label="Chargement..."
                />
              </div>
            )}

            {errorBorrowings && (
              <div
                role="alert"
                className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  {errorBorrowings instanceof Error
                    ? errorBorrowings.message
                    : "Erreur de chargement des emprunts"}
                </p>
              </div>
            )}

            {!loadingBorrowings &&
              !errorBorrowings &&
              (!borrowings || borrowings.length === 0) && (
                <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                  <BookOpen
                    className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-medium text-foreground">
                    Aucun emprunt
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Vos emprunts de livres apparaîtront ici.
                  </p>
                </div>
              )}

            {!loadingBorrowings &&
              !errorBorrowings &&
              borrowings &&
              borrowings.length > 0 && (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titre</TableHead>
                          <TableHead>Auteur</TableHead>
                          <TableHead>Date d&apos;emprunt</TableHead>
                          <TableHead>Date de retour prévue</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {borrowings.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {record.book.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.book.author || "-"}
                            </TableCell>
                            <TableCell>{formatDate(record.borrowedAt)}</TableCell>
                            <TableCell>{formatDate(record.dueDate)}</TableCell>
                            <TableCell>
                              {record.status === "BORROWED" ? (
                                <Badge variant="warning">Emprunté</Badge>
                              ) : (
                                <Badge variant="success">Retourné</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {record.status === "BORROWED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={returningId === record.id}
                                  onClick={() => handleReturn(record.id)}
                                >
                                  <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                  {returningId === record.id
                                    ? "Retour..."
                                    : "Retourner"}
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
          </>
        )}
      </div>
    </PageGuard>
  );
}
