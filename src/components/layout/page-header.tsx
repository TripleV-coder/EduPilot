import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";


interface PageHeaderProps {
    heading: string;
    description?: string;
    action?: {
        label: string;
        href: string;
        icon?: React.ReactNode;
    };
    children?: React.ReactNode;
}

export function PageHeader({ heading, description, action, children }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between space-y-2 mb-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
                {description && (
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex items-center space-x-2">
                {children}
                {action && (
                    <Link href={action.href}>
                        <Button variant="default">
                            {action.icon || <Plus className="mr-2 h-4 w-4" />}
                            {action.label}
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}
