"use client"

import Link from "next/link"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

// Type matching the API response
export type Teacher = {
    id: string
    specialization?: string
    user: {
        id: string
        firstName: string
        lastName: string
        email: string
        phone?: string
        isActive: boolean
    }
}

export const columns: ColumnDef<Teacher>[] = [
    {
        accessorKey: "user.lastName", // Accessor for nested data
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Nom
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <div className="font-medium ml-4">{row.original.user?.lastName}</div>,
    },
    {
        accessorKey: "user.firstName",
        header: "Prénom",
        cell: ({ row }) => <div>{row.original.user?.firstName}</div>,
    },
    {
        accessorKey: "user.email",
        header: "Email",
        cell: ({ row }) => <div>{row.original.user?.email}</div>,
    },
    {
        accessorKey: "specialization",
        header: "Spécialisation",
        cell: ({ row }) => {
            const spec = row.original.specialization;
            return spec ? <Badge variant="outline">{spec}</Badge> : <span className="text-muted-foreground text-xs">-</span>;
        }
    },
    {
        accessorKey: "user.isActive",
        header: "Statut",
        cell: ({ row }) => {
            const isActive = row.original.user?.isActive;
            return (
                <Badge variant={isActive ? 'success' : 'secondary'}>
                    {isActive ? 'Actif' : 'Inactif'}
                </Badge>
            )
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const teacher = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Ouvrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(teacher.user.email)}
                        >
                            Copier Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Link href={`/school/teachers/${teacher.id}`} className="w-full cursor-pointer">
                            <DropdownMenuItem>Modifier</DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem className="text-destructive">Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
