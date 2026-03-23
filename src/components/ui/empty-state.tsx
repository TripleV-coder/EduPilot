"use client";

import React from "react";

interface EmptyStateProps {
    icon?: React.ReactNode | React.ComponentType<any>;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    const renderedIcon = Icon
        ? typeof Icon === "function"
            ? <Icon className="h-10 w-10" />
            : Icon
        : null;
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {renderedIcon && <div className="text-4xl mb-4 text-muted-foreground">{renderedIcon}</div>}
            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
}
