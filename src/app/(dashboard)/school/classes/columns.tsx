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

export type Class = {
    id: string
    name: string
    capacity: number
    mainTeacher?: {
        user: {
            firstName: string;
            lastName: string;
        }
    };
    classLevel: {
        name: string;
    };
    _count?: {
        students: number;
    };
}

export const columns: ColumnDef<Class>[] = [
    {
        accessorKey: "name",
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
        cell: ({ row }) => <div className="font-bold ml-4">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "classLevel.name",
        header: "Niveau",
        cell: ({ row }) => <Badge variant="outline">{row.original.classLevel?.name || "-"}</Badge>,
    },
    {
        accessorKey: "mainTeacher",
        header: "Prof. Principal",
        cell: ({ row }) => {
            const teacher = row.original.mainTeacher?.user;
            return <div>{teacher ? `${teacher.firstName} ${teacher.lastName}` : <span className="text-muted-foreground italic">Non assigné</span>}</div>
        },
    },
    {
        accessorKey: "capacity",
        header: "Capacité",
        cell: ({ row }) => {
            const count = row.original._count?.students || 0;
            const capacity = row.original.capacity;
            const percentage = Math.round((count / capacity) * 100);

            return (
                <div className="flex items-center gap-2">
                    <div className="w-full bg-white/10 h-2 rounded-full w-[60px] overflow-hidden">
                        <div
                            className={`h-full ${percentage > 100 ? 'bg-apogee-crimson' : percentage > 80 ? 'bg-apogee-gold' : 'bg-apogee-emerald'}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground">{count}/{capacity}</span>
                </div>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const cls = row.original

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
                        <DropdownMenuItem>Voir l&apos;emploi du temps</DropdownMenuItem>
                        <DropdownMenuItem>Liste des élèves</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <Link href={`/school/classes/${cls.id}`} className="w-full cursor-pointer">
                            <DropdownMenuItem>Modifier</DropdownMenuItem>
                        </Link>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
