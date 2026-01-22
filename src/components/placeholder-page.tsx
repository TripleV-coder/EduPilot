import { Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
    return (
        <div className="flex items-center justify-center h-[60vh]">
            <Card className="w-full max-w-md text-center bg-muted/30 border-dashed">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Construction className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Cette fonctionnalité est en cours de développement et sera disponible prochainement.</p>
                </CardContent>
            </Card>
        </div>
    )
}
