"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Permission } from "@/lib/rbac/permissions";
import { formatDateNumeric } from "@/lib/utils/formatters";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Input,
    type IconName,
} from "@/components/edu";
import { DataTable } from "@/components/layout/data-table";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

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
    book: { title: string; author?: string };
    student: { user: { firstName: string; lastName: string } };
    status: "BORROWED" | "RETURNED";
    dueDate: string;
    borrowedAt: string;
    returnedAt?: string | null;
};

type Tab = "catalogue" | "borrowings";

export default function LibraryPage() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState<Tab>("catalogue");

    const [books, setBooks] = useState<Book[]>([]);
    const [loadingBooks, setLoadingBooks] = useState(true);
    const [errorBooks, setErrorBooks] = useState<string | null>(null);
    const [borrowingBookId, setBorrowingBookId] = useState<string | null>(null);
    const [isAddingBook, setIsAddingBook] = useState(false);
    const [newBook, setNewBook] = useState({
        title: "",
        author: "",
        isbn: "",
        quantity: 1,
    });

    const fetchBooks = async () => {
        setLoadingBooks(true);
        try {
            const r = await fetch("/api/library/books", { credentials: "include" });
            if (!r.ok) throw new Error("Erreur");
            const data = await r.json();
            setBooks(Array.isArray(data) ? data : data.books ?? []);
        } catch {
            setErrorBooks("Erreur de chargement");
        } finally {
            setLoadingBooks(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    const {
        data: borrowings,
        isLoading: loadingBorrowings,
        mutate: mutateBorrowings,
    } = useSWR<BorrowingRecord[]>(
        activeTab === "borrowings" ? "/api/library/borrowings" : null,
        fetcher
    );

    const [returningId, setReturningId] = useState<string | null>(null);

    const handleAddBook = async (e: React.FormEvent) => {
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
    };

    const handleBorrow = async (bookId: string) => {
        setBorrowingBookId(bookId);
        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
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
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erreur lors de l'emprunt");
        } finally {
            setBorrowingBookId(null);
        }
    };

    const handleReturn = async (recordId: string) => {
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
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erreur lors du retour");
        } finally {
            setReturningId(null);
        }
    };

    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
        session?.user?.role || ""
    );

    const availableCount = books.filter((b) => b.available !== false).length;

    return (
        <PageGuard
            permission={Permission.REPORT_VIEW}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Bibliothèque & fonds"
                    description={`${books.length} ouvrages au catalogue · ${availableCount} disponibles à l'emprunt`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Bibliothèque" },
                    ]}
                    actions={
                            isAdmin ? (
                                <Dialog open={isAddingBook} onOpenChange={setIsAddingBook}>
                                    <DialogTrigger asChild>
                                        <Button icon="plus">Ajouter un livre</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Nouvel ouvrage</DialogTitle>
                                            <DialogDescription>
                                                Ajoutez une ressource au catalogue.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleAddBook} className="flex flex-col gap-3 py-4">
                                            <Input
                                                label="Titre du livre"
                                                value={newBook.title}
                                                onChange={(e) =>
                                                    setNewBook({ ...newBook, title: e.target.value })
                                                }
                                                placeholder="Ex : Mathématiques 4ᵉ"
                                                icon="book"
                                            />
                                            <Input
                                                label="Auteur"
                                                value={newBook.author}
                                                onChange={(e) =>
                                                    setNewBook({ ...newBook, author: e.target.value })
                                                }
                                                placeholder="Ex : A. Césaire"
                                                icon="users"
                                            />
                                            <div
                                                className="grid gap-3"
                                                style={{
                                                    gridTemplateColumns: "1fr 100px",
                                                }}
                                            >
                                                <Input
                                                    label="ISBN"
                                                    value={newBook.isbn}
                                                    onChange={(e) =>
                                                        setNewBook({ ...newBook, isbn: e.target.value })
                                                    }
                                                    placeholder="978-2-…"
                                                />
                                                <Input
                                                    label="Quantité"
                                                    type="number"
                                                    value={String(newBook.quantity)}
                                                    onChange={(e) =>
                                                        setNewBook({
                                                            ...newBook,
                                                            quantity: parseInt(e.target.value) || 1,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button
                                                    type="submit"
                                                    icon="check"
                                                    disabled={!newBook.title.trim()}
                                                >
                                                    Ajouter au catalogue
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            ) : null
                    }
                />

                <SegmentedToggle
                    value={activeTab}
                    onChange={setActiveTab}
                    options={[
                        { value: "catalogue", label: "Catalogue", icon: "book" },
                        { value: "borrowings", label: "Emprunts en cours", icon: "users" },
                    ]}
                />

                {activeTab === "catalogue" ? (
                    <div className="flex flex-col gap-4">
                        {loadingBooks ? (
                            <PageLoading label="Chargement du catalogue…" />
                        ) : null}
                        {errorBooks ? <PageError message={errorBooks} onRetry={() => void fetchBooks()} /> : null}
                        {!loadingBooks && !errorBooks && books.length === 0 ? (
                            <PageEmpty
                                icon="book"
                                title="Catalogue vide"
                                description="Ajoutez des ouvrages pour démarrer la bibliothèque."
                                actions={
                                    isAdmin
                                        ? [{ label: "Ajouter un livre", onClick: () => setIsAddingBook(true) }]
                                        : undefined
                                }
                            />
                        ) : null}
                        <div
                            className="edu-stagger"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                                gap: 14,
                            }}
                        >
                            {books.map((book) => {
                                const available = book.available !== false;
                                return (
                                    <Card
                                        key={book.id}
                                        padding={16}
                                        style={{
                                            transition:
                                                "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                        }}
                                        className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className="grid place-items-center"
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 12,
                                                    background: "var(--brand-50)",
                                                    color: "var(--brand-700)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon name="book" size={20} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: "var(--eduflow-text-primary)",
                                                        lineHeight: 1.25,
                                                    }}
                                                >
                                                    {book.title}
                                                </h3>
                                                {book.author ? (
                                                    <p
                                                        style={{
                                                            margin: "4px 0 0",
                                                            fontSize: 12,
                                                            fontStyle: "italic",
                                                            color: "var(--eduflow-text-secondary)",
                                                        }}
                                                    >
                                                        {book.author}
                                                    </p>
                                                ) : null}
                                                {book.isbn ? (
                                                    <div
                                                        className="eduflow-mono"
                                                        style={{
                                                            fontSize: 10,
                                                            color: "var(--eduflow-text-tertiary)",
                                                            marginTop: 4,
                                                        }}
                                                    >
                                                        {book.isbn}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t pt-3"
                                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                                        >
                                            {available ? (
                                                <Badge variant="success" size="sm" dot>
                                                    Disponible
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning" size="sm">
                                                    Emprunté
                                                </Badge>
                                            )}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={!available || borrowingBookId === book.id}
                                                loading={borrowingBookId === book.id}
                                                onClick={() => handleBorrow(book.id)}
                                            >
                                                Emprunter
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {activeTab === "borrowings" ? (
                    <div className="flex flex-col gap-4">
                        {loadingBorrowings ? (
                            <PageLoading label="Chargement des emprunts…" />
                        ) : !borrowings || borrowings.length === 0 ? (
                            <PageEmpty
                                icon="users"
                                title="Aucun emprunt en cours"
                                description="Les emprunts actifs apparaîtront ici une fois enregistrés."
                            />
                        ) : (
                            <DataTable
                                caption="Emprunts en cours"
                                data={borrowings}
                                getRowKey={(rec) => rec.id}
                                columns={[
                                    {
                                        id: "livre",
                                        header: "Livre",
                                        cell: (rec) => (
                                            <div>
                                                <div className="text-[13px] font-semibold">
                                                    {rec.book.title}
                                                </div>
                                                {rec.book.author ? (
                                                    <div
                                                        className="text-[11px] italic"
                                                        style={{ color: "var(--eduflow-text-tertiary)" }}
                                                    >
                                                        {rec.book.author}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ),
                                    },
                                    {
                                        id: "eleve",
                                        header: "Élève",
                                        cell: (rec) => {
                                            const studentName = `${rec.student.user.firstName} ${rec.student.user.lastName}`;
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <Avatar name={studentName} size="xs" />
                                                    <span className="text-[13px] font-medium">
                                                        {studentName}
                                                    </span>
                                                </div>
                                            );
                                        },
                                    },
                                    {
                                        id: "emprunte",
                                        header: "Emprunté le",
                                        cell: (rec) => (
                                            <span
                                                className="eduflow-tabular text-xs"
                                                style={{ color: "var(--eduflow-text-secondary)" }}
                                            >
                                                {formatDateNumeric(rec.borrowedAt)}
                                            </span>
                                        ),
                                    },
                                    {
                                        id: "rendre",
                                        header: "À rendre",
                                        cell: (rec) => {
                                            const overdue =
                                                rec.status === "BORROWED" &&
                                                new Date(rec.dueDate).getTime() < Date.now();
                                            return (
                                                <span
                                                    className="eduflow-tabular text-xs"
                                                    style={{
                                                        color: overdue
                                                            ? "var(--eduflow-danger-700)"
                                                            : "var(--eduflow-text-secondary)",
                                                        fontWeight: overdue ? 700 : 500,
                                                    }}
                                                >
                                                    {formatDateNumeric(rec.dueDate)}
                                                </span>
                                            );
                                        },
                                    },
                                    {
                                        id: "statut",
                                        header: "Statut",
                                        cell: (rec) => {
                                            const overdue =
                                                rec.status === "BORROWED" &&
                                                new Date(rec.dueDate).getTime() < Date.now();
                                            if (rec.status === "RETURNED") {
                                                return (
                                                    <Badge variant="success" size="sm" icon="check">
                                                        Rendu
                                                    </Badge>
                                                );
                                            }
                                            if (overdue) {
                                                return (
                                                    <Badge variant="danger" size="sm" dot>
                                                        En retard
                                                    </Badge>
                                                );
                                            }
                                            return (
                                                <Badge variant="brand" size="sm" dot>
                                                    En cours
                                                </Badge>
                                            );
                                        },
                                    },
                                    {
                                        id: "action",
                                        header: "Action",
                                        cell: (rec) =>
                                            rec.status === "BORROWED" ? (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    loading={returningId === rec.id}
                                                    disabled={returningId === rec.id}
                                                    onClick={() => handleReturn(rec.id)}
                                                >
                                                    Retourner
                                                </Button>
                                            ) : null,
                                    },
                                ]}
                            />
                        )}
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}

function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon: IconName }[];
}) {
    return (
        <div
            className="flex w-fit gap-1 rounded-md p-1"
            style={{
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active ? "var(--eduflow-surface-card)" : "transparent",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            color: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-text-secondary)",
                            boxShadow: active ? "var(--eduflow-shadow-sm)" : "none",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <Icon name={opt.icon} size={13} />
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

