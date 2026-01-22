# EduPilot Frontend Architecture Standards

## Overview

This document describes the professional frontend architecture implemented in EduPilot, following best practices for UX, performance, and maintainability.

## Table of Contents

1. [Data Fetching](#data-fetching)
2. [Error Handling](#error-handling)
3. [Loading & Empty States](#loading--empty-states)
4. [Component Patterns](#component-patterns)
5. [Dashboard Implementation](#dashboard-implementation)
6. [Accessibility](#accessibility)
7. [Performance](#performance)

---

## Data Fetching

### Using React Query Hooks

All data fetching must go through the standardized hooks in `src/hooks/use-api.ts`. This ensures consistent error handling, caching, and retry logic.

#### Basic Query Hook

```tsx
import { useApiQuery, queryKeys } from "@/hooks/use-api";

function MyComponent() {
  const { data, isPending, error, isError } = useApiQuery<StudentType>(
    `/api/students/123`
  );

  if (isPending) return <LoadingSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data) return <EmptyState />;

  return <div>{data.name}</div>;
}
```

#### Conditional Queries

Don't fetch if you don't have the ID yet:

```tsx
const { data } = useApiQuery<StudentType>(
  studentId ? `/api/students/${studentId}` : null
);
```

### Mutation Hook

```tsx
import { useApiMutation, queryKeys } from "@/hooks/use-api";

function CreateStudent() {
  const { mutate, isPending } = useApiMutation(
    `/api/students`,
    "POST",
    {
      invalidateKeys: [queryKeys.students],
      onSuccess: (data) => {
        toast.success("Élève créé avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );

  return (
    <Button 
      onClick={() => mutate({ firstName: "Jean" })}
      loading={isPending}
    >
      Créer
    </Button>
  );
}
```

### Error Handling in Hooks

The `ApiError` class provides structured error information:

```tsx
try {
  const result = await fetchApi(endpoint);
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.statusCode);  // HTTP status
    console.log(error.message);      // User-friendly message
    console.log(error.details);      // Additional server data
  }
}
```

#### Retry Logic

- **4xx errors** (validation, auth, not found): No retry
- **5xx errors** (server errors): Retry up to 3 times
- **Network errors**: Retry up to 3 times

---

## Error Handling

### Global Error Boundary

The app is wrapped with a global `ErrorBoundary` component at the root level. This catches any unhandled React errors.

**Location**: `src/components/providers/error-boundary.tsx`

### Route-Level Error Handlers

Each layout has an `error.tsx` file for route-specific error handling:

- `src/app/(dashboard)/error.tsx` - Dashboard errors
- `src/app/(auth)/error.tsx` - Authentication errors

### Component-Level Error States

Always show users a clear error message with a retry option:

```tsx
import { ErrorState } from "@/components/ui/states";

<ErrorState
  title="Impossible de charger les données"
  message={error.message}
  onRetry={() => refetch()}
  variant="card" // "card" | "inline" | "page"
/>
```

#### Error State Variants

- **card**: Default card layout
- **inline**: Inline error banner (good for forms)
- **page**: Full-page error (good for critical failures)

---

## Loading & Empty States

### Loading States

Use `LoadingSkeleton` to show loading placeholders that match your content:

```tsx
import { LoadingSkeleton } from "@/components/ui/states";

// Shows loading cards
<LoadingSkeleton type="card" count={3} />

// Shows loading table rows
<LoadingSkeleton type="table" count={5} />

// Shows loading grid
<LoadingSkeleton type="grid" count={6} />

// Shows loading list
<LoadingSkeleton type="list" count={4} />

// Shows full page loading
<LoadingSkeleton type="full" />
```

### Empty States

Show a friendly message when there's no data:

```tsx
import { EmptyState } from "@/components/ui/states";
import { FileText } from "lucide-react";

<EmptyState
  icon={<FileText className="h-8 w-8" />}
  title="Aucune note"
  description="Vous n'avez pas encore de notes enregistrées."
  actionLabel="Créer une note"
  onAction={() => navigate("/create-grade")}
  variant="card" // "card" | "inline" | "page"
/>
```

---

## Component Patterns

### Complete Data Flow Pattern

Here's the recommended pattern for all data-driven components:

```tsx
"use client";

import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/ui/states";

export function StudentDashboard() {
  const { data, isLoading, error, isError } = useStudentDashboard();

  // 1. Loading state
  if (isLoading) {
    return <LoadingSkeleton type="full" />;
  }

  // 2. Error state
  if (isError && error) {
    return (
      <ErrorState
        title="Impossible de charger le tableau de bord"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 3. No data state
  if (!data) {
    return (
      <EmptyState
        title="Données non disponibles"
        description="Les données ne sont pas encore disponibles."
      />
    );
  }

  // 4. Success state - render data
  return (
    <div>
      <h1>{data.student.firstName}</h1>
      {/* ... render content ... */}
    </div>
  );
}
```

### Handling Optional Sections

Some sections may not have data but shouldn't block the whole page:

```tsx
{data.grades.length > 0 ? (
  <div className="space-y-4">
    {data.grades.map(grade => (...))}
  </div>
) : (
  <EmptyState
    icon={<FileText className="h-6 w-6" />}
    title="Aucune note"
    variant="inline"
  />
)}
```

---

## Dashboard Implementation

### Dashboard Hooks

Each role has a dedicated hook that aggregates all necessary data:

- `useStudentDashboard()` - Student dashboard
- `useTeacherDashboard()` - Teacher dashboard
- `useParentDashboard()` - Parent dashboard
- `useSchoolAdminDashboard()` - School admin dashboard
- `useSuperAdminDashboard()` - Super admin dashboard

Each hook returns:
- `data` - Combined dashboard data
- `isLoading` - Loading state
- `error` - Error object
- `isError` - Boolean error flag

### Adding a New Dashboard Section

1. Add API query in the hook
2. Combine data in return statement
3. Handle loading/error/empty states in component
4. Test with real API data

Example:

```tsx
// In useStudentDashboard.ts
function useStudentHomework() {
  const { data: session } = useSession();
  return useApiQuery<any>(
    session?.user?.id ? `/api/homework?studentId=${session.user.id}` : null
  );
}

// In return statement
const data = profileQuery.data && homeworkQuery.data ? {
  // ... other data ...
  homework: homeworkQuery.data.homework || [],
} : undefined;

// In component
{data.homework.length > 0 ? (
  <div>
    {data.homework.map(hw => (...))}
  </div>
) : (
  <EmptyState title="Aucun devoir" />
)}
```

---

## Accessibility

### Semantic HTML

- Use semantic elements: `<button>`, `<nav>`, `<section>`, `<article>`
- Never use `<div>` as a button - use `<button>` with proper styling

### ARIA Labels

Always provide context for screen readers:

```tsx
<Button aria-label="Supprimer cet élève">
  <Trash className="h-4 w-4" />
</Button>

<input
  aria-label="Prénom"
  placeholder="Prénom"
/>
```

### Color Contrast

- Text on background: minimum 4.5:1 contrast ratio
- Large text (18pt+): minimum 3:1 contrast ratio
- Check with: https://webaim.org/resources/contrastchecker/

### Keyboard Navigation

- All interactive elements should be keyboard accessible
- Tab order should be logical
- Forms should have proper labels and validation messages

---

## Performance

### Image Optimization

- Use Next.js `Image` component
- Provide responsive `sizes`
- Use WebP format when possible

```tsx
import Image from "next/image";

<Image
  src="/avatar.png"
  alt="Student photo"
  width={128}
  height={128}
  sizes="(max-width: 768px) 100px, 128px"
/>
```

### Code Splitting

- Lazy load routes with `next/dynamic`
- Lazy load components not needed on initial render

```tsx
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(
  () => import("@/components/HeavyComponent"),
  { loading: () => <LoadingSkeleton /> }
);
```

### React Query Caching

The QueryProvider is configured with:
- `staleTime: 5 * 60 * 1000` - Data stays fresh for 5 minutes
- `gcTime: 10 * 60 * 1000` - Cache kept for 10 minutes
- `refetchOnWindowFocus: false` - Don't refetch when window regains focus
- `retry: 3` - Retry failed queries 3 times

---

## Best Practices Summary

### ✅ DO

- Use `useApiQuery` for all GET requests
- Use `useApiMutation` for all mutations
- Show loading skeletons matching content shape
- Show error states with retry options
- Show empty states when no data available
- Use semantic HTML
- Test with real API data early
- Handle edge cases (null, empty arrays, errors)

### ❌ DON'T

- Use `fetch()` directly in components (use hooks instead)
- Show spinners without context (use skeletons)
- Leave error states unhandled
- Hardcode mock data in production
- Use `<div>` as buttons
- Ignore accessibility requirements
- Make blocking API calls in render

---

## Troubleshooting

### Query Not Updating

Make sure to include the query key in `invalidateKeys`:

```tsx
// Wrong
useApiMutation(`/api/students`, "POST", {
  invalidateKeys: [["students"]], // ❌ Wrong structure
});

// Right
useApiMutation(`/api/students`, "POST", {
  invalidateKeys: [queryKeys.students],
});
```

### Component Not Re-rendering

Check that your hook is enabled:

```tsx
// Won't fetch if studentId is null
const { data } = useApiQuery(
  studentId ? `/api/students/${studentId}` : null
);
```

### Error Not Showing

Make sure error is being returned:

```tsx
const { isError, error } = useApiQuery(endpoint);

// Handle the error
if (isError && error) {
  return <ErrorState />;
}
```

---

## File Structure

```
src/
├── hooks/
│   ├── use-api.ts                 # Core data fetching hooks
│   ├── useStudentDashboard.ts
│   ├── useTeacherDashboard.ts
│   ├── useParentDashboard.ts
│   ├── useSchoolAdminDashboard.ts
│   └── useSuperAdminDashboard.ts
├── components/
│   ├── providers/
│   │   ├── error-boundary.tsx     # Global error boundary
│   │   └── query-provider.tsx     # React Query provider
│   └── ui/
│       └── states/
│           ├── loading-skeleton.tsx
│           ├── error-state.tsx
│           ├── empty-state.tsx
│           └── index.ts
└── app/
    ├── layout.tsx                 # Root layout with ErrorBoundary
    ├── (auth)/
    │   └── error.tsx              # Auth error handler
    └── (dashboard)/
        └── error.tsx              # Dashboard error handler
```

---

## Next Steps

- [ ] Implement Teacher dashboard UI
- [ ] Implement Parent dashboard UI
- [ ] Implement School Admin dashboard UI
- [ ] Implement Super Admin dashboard UI
- [ ] Create detail pages for students, teachers, classes
- [ ] Add Grade management interface
- [ ] Add Homework system
- [ ] Add Payment system
- [ ] Implement real-time notifications via WebSocket
- [ ] Performance optimization and testing

---

Last Updated: January 2025
Maintained by: EduPilot Team
