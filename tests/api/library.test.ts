import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_BOOKS, POST as POST_BOOKS } from "@/app/api/library/books/route";
import { GET, POST, PUT } from "@/app/api/library/borrowings/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { libraryService } from "@/lib/library/service";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/library/service", () => ({
  libraryService: {
    searchBooks: vi.fn(),
    borrowBook: vi.fn(),
    returnBook: vi.fn(),
    getStudentBorrowings: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    book: { create: vi.fn(), findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    borrowingRecord: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

describe("GET /api/library/books", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET_BOOKS(makeRequest("http://localhost/api/library/books"));
    expect(res.status).toBe(401);
  });

  it("should search books through the library service", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(libraryService.searchBooks).mockResolvedValue([{ id: "b1", title: "Les Misérables" }] as never);

    const res = await GET_BOOKS(makeRequest("http://localhost/api/library/books?q=miserables&category=ROMAN"));
    expect(res.status).toBe(200);
    expect(libraryService.searchBooks).toHaveBeenCalledWith(
      expect.stringContaining("schoola"),
      "miserables",
      "ROMAN"
    );
  });
});

describe("POST /api/library/books", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_BOOKS(makeRequest("http://localhost/api/library/books", { method: "POST", body: { title: "Livre", author: "Auteur", quantity: 2 } }));
    expect(res.status).toBe(403);
  });

  it("should create a book", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.book.create).mockResolvedValue({ id: "b1" } as never);

    const res = await POST_BOOKS(makeRequest("http://localhost/api/library/books", { method: "POST", body: { title: "Livre", author: "Auteur", quantity: 2 } }));
    expect(res.status).toBe(200);
    expect(prisma.book.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ available: 2 }) })
    );
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST_BOOKS(makeRequest("http://localhost/api/library/books", { method: "POST", body: { title: "", author: "" } }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/library/borrowings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 403 when user has no student profile", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/library/borrowings", { method: "POST", body: { bookId: "b1", dueDate: "2026-10-01" } }));
    expect(res.status).toBe(403);
  });

  it("should return 404 when book not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "sp1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.book.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/library/borrowings", { method: "POST", body: { bookId: "b1", dueDate: "2026-10-01" } }));
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school borrowing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "sp1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.book.findUnique).mockResolvedValue({ id: "b1", schoolId: FIXTURES.schoolB } as never);
    const res = await POST(makeRequest("http://localhost/api/library/borrowings", { method: "POST", body: { bookId: "b1", dueDate: "2026-10-01" } }));
    expect(res.status).toBe(403);
  });

  it("should borrow the book via the service", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "sp1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.book.findUnique).mockResolvedValue({ id: "b1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(libraryService.borrowBook).mockResolvedValue({ id: "r1" } as never);

    const res = await POST(makeRequest("http://localhost/api/library/borrowings", { method: "POST", body: { bookId: "b1", dueDate: "2026-10-01" } }));
    expect(res.status).toBe(200);
    expect(libraryService.borrowBook).toHaveBeenCalledWith("sp1", "b1", expect.any(Date));
  });
});

describe("PUT /api/library/borrowings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when record not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.borrowingRecord.findUnique).mockResolvedValue(null);
    const res = await PUT(makeRequest("http://localhost/api/library/borrowings", { method: "PUT", body: { recordId: "r1" } }));
    expect(res.status).toBe(404);
  });

  it("should forbid returning another student's book", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.borrowingRecord.findUnique).mockResolvedValue({
      id: "r1",
      book: { schoolId: FIXTURES.schoolA },
      student: { userId: "other-user", schoolId: FIXTURES.schoolA },
    } as never);
    const res = await PUT(makeRequest("http://localhost/api/library/borrowings", { method: "PUT", body: { recordId: "r1" } }));
    expect(res.status).toBe(403);
  });

  it("should return a book via the service", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "u1" }));
    vi.mocked(prisma.borrowingRecord.findUnique).mockResolvedValue({
      id: "r1",
      book: { schoolId: FIXTURES.schoolA },
      student: { userId: "u1", schoolId: FIXTURES.schoolA },
    } as never);
    vi.mocked(libraryService.returnBook).mockResolvedValue({ id: "r1", returnedAt: new Date() } as never);

    const res = await PUT(makeRequest("http://localhost/api/library/borrowings", { method: "PUT", body: { recordId: "r1" } }));
    expect(res.status).toBe(200);
    expect(libraryService.returnBook).toHaveBeenCalledWith("r1");
  });
});

describe("GET /api/library/borrowings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return student borrowings when user is a student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "sp1" } as never);
    vi.mocked(libraryService.getStudentBorrowings).mockResolvedValue([{ id: "r1" }] as never);

    const res = await GET(makeRequest("http://localhost/api/library/borrowings"));
    expect(res.status).toBe(200);
    expect(libraryService.getStudentBorrowings).toHaveBeenCalledWith("sp1");
  });

  it("should list school borrowings for an admin", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.borrowingRecord.findMany).mockResolvedValue([{ id: "r1" }] as never);

    const res = await GET(makeRequest("http://localhost/api/library/borrowings"));
    expect(res.status).toBe(200);
    expect(prisma.borrowingRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { book: { schoolId: expect.any(String) } } })
    );
  });

  it("should forbid non-student non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/library/borrowings"));
    expect(res.status).toBe(403);
  });
});