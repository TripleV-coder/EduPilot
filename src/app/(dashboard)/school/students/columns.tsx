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


export type Student = {
    id: string
    matricule?: string
    user: {
        id: string
        firstName: string
        lastName: string
        email: string
    }
}

export const columns: ColumnDef<Student>[] = [
    {
        accessorKey: "user.lastName",
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
        accessorKey: "matricule",
        header: "Matricule",
        cell: ({ row }) => <div>{row.original.matricule || "-"}</div>,
    },
    {
        accessorKey: "user.email",
        header: "Email",
        cell: ({ row }) => <div>{row.original.user?.email || "-"}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const student = row.original

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
                            onClick={() => navigator.clipboard.writeText(student.user.email)}
                        >
                            Copier Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Link href={`/school/students/${student.id}`} className="w-full cursor-pointer">
                            <DropdownMenuItem>Modifier</DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem className="text-destructive">Exclure</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
