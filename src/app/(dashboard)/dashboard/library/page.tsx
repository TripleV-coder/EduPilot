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
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

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
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Bibliothèque & fonds"
                        sub={`${books.length} ouvrages au catalogue · ${availableCount} disponibles à l'emprunt`}
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
                                                Ajoute une ressource au catalogue.
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
                </div>

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
                            <Card padding={20}>
                                <div className="flex items-center gap-3">
                                    <Spinner size={18} color="var(--brand-600)" />
                                    <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                        Chargement du catalogue…
                                    </span>
                                </div>
                            </Card>
                        ) : null}
                        {errorBooks ? (
                            <Card
                                padding={14}
                                style={{
                                    borderLeft: "3px solid var(--eduflow-danger-500)",
                                    background: "var(--eduflow-danger-50)",
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                                    <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-danger-800)" }}>
                                        {errorBooks}
                                    </p>
                                </div>
                            </Card>
                        ) : null}
                        {!loadingBooks && !errorBooks && books.length === 0 ? (
                            <Card padding={36}>
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div
                                        className="grid place-items-center"
                                        style={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 16,
                                            background: "var(--brand-50)",
                                        }}
                                    >
                                        <Icon name="book" size={26} color="var(--brand-700)" />
                                    </div>
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 18, margin: 0 }}
                                    >
                                        Catalogue vide
                                    </h3>
                                    <p style={{ fontSize: 13, color: "var(--eduflow-text-secondary)", margin: 0 }}>
                                        Ajoute des ouvrages pour démarrer la bibliothèque.
                                    </p>
                                </div>
                            </Card>
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
                    <Card padding={0}>
                        <div
                            className="flex items-center gap-2 border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <Icon name="users" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Emprunts en cours
                            </h3>
                        </div>
                        {loadingBorrowings ? (
                            <div className="flex items-center gap-3 px-5 py-8">
                                <Spinner size={18} color="var(--brand-600)" />
                                <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                    Chargement des emprunts…
                                </span>
                            </div>
                        ) : !borrowings || borrowings.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                                <Icon name="info" size={28} color="var(--eduflow-text-tertiary)" />
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    Aucun emprunt en cours
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "var(--eduflow-surface-sunken)", textAlign: "left" }}>
                                            <Th>Livre</Th>
                                            <Th>Élève</Th>
                                            <Th width={140}>Emprunté le</Th>
                                            <Th width={140}>À rendre</Th>
                                            <Th width={120}>Statut</Th>
                                            <Th width={110} center>
                                                Action
                                            </Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {borrowings.map((rec) => {
                                            const overdue =
                                                rec.status === "BORROWED" &&
                                                new Date(rec.dueDate).getTime() < Date.now();
                                            const studentName = `${rec.student.user.firstName} ${rec.student.user.lastName}`;
                                            return (
                                                <tr
                                                    key={rec.id}
                                                    style={{
                                                        borderTop: "1px solid var(--eduflow-border-subtle)",
                                                    }}
                                                >
                                                    <Td>
                                                        <div
                                                            style={{
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                color: "var(--eduflow-text-primary)",
                                                            }}
                                                        >
                                                            {rec.book.title}
                                                        </div>
                                                        {rec.book.author ? (
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    fontStyle: "italic",
                                                                    color: "var(--eduflow-text-tertiary)",
                                                                }}
                                                            >
                                                                {rec.book.author}
                                                            </div>
                                                        ) : null}
                                                    </Td>
                                                    <Td>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar name={studentName} size="xs" />
                                                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                                                                {studentName}
                                                            </span>
                                                        </div>
                                                    </Td>
                                                    <Td>
                                                        <span
                                                            className="eduflow-tabular"
                                                            style={{
                                                                fontSize: 12,
                                                                color: "var(--eduflow-text-secondary)",
                                                            }}
                                                        >
                                                            {formatDateNumeric(rec.borrowedAt)}
                                                        </span>
                                                    </Td>
                                                    <Td>
                                                        <span
                                                            className="eduflow-tabular"
                                                            style={{
                                                                fontSize: 12,
                                                                color: overdue
                                                                    ? "var(--eduflow-danger-700)"
                                                                    : "var(--eduflow-text-secondary)",
                                                                fontWeight: overdue ? 700 : 500,
                                                            }}
                                                        >
                                                            {formatDateNumeric(rec.dueDate)}
                                                        </span>
                                                    </Td>
                                                    <Td>
                                                        {rec.status === "RETURNED" ? (
                                                            <Badge variant="success" size="sm" icon="check">
                                                                Rendu
                                                            </Badge>
                                                        ) : overdue ? (
                                                            <Badge variant="danger" size="sm" dot>
                                                                En retard
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="brand" size="sm" dot>
                                                                En cours
                                                            </Badge>
                                                        )}
                                                    </Td>
                                                    <Td center>
                                                        {rec.status === "BORROWED" ? (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                loading={returningId === rec.id}
                                                                disabled={returningId === rec.id}
                                                                onClick={() => handleReturn(rec.id)}
                                                            >
                                                                Retourner
                                                            </Button>
                                                        ) : null}
                                                    </Td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                ) : null}
            </div>
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

function Th({
    children,
    width,
    center,
}: {
    children: React.ReactNode;
    width?: number;
    center?: boolean;
}) {
    return (
        <th
            style={{
                padding: "10px 16px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                textAlign: center ? "center" : "left",
                width,
            }}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    style,
    center,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    center?: boolean;
}) {
    return (
        <td
            style={{
                padding: "12px 16px",
                fontSize: 13,
                textAlign: center ? "center" : "left",
                ...style,
            }}
        >
            {children}
        </td>
    );
}
