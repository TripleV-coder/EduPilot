import { prisma } from "@/lib/prisma";

export class TemplateEngineService {

    /**
     * Fetch a template by name and language, falling back to default language or creating a placeholder
     */
    async getTemplate(name: string, schoolId?: string, language: string = 'fr') {
        // 1. Try to find school-specific template in requested language
        if (schoolId) {
            const schoolTemplate = await prisma.communicationTemplate.findFirst({
                where: { schoolId, name, language, isActive: true }
            });
            if (schoolTemplate) return schoolTemplate;
        }

        // 2. Try to find system-wide template in requested language
        const systemTemplate = await prisma.communicationTemplate.findFirst({
            where: { schoolId: null, name, language, isActive: true }
        });
        if (systemTemplate) return systemTemplate;

        // 3. Fallback to default language (FR)
        if (language !== 'fr') {
            if (schoolId) {
                const fallbackSchool = await prisma.communicationTemplate.findFirst({
                    where: { schoolId, name, language: 'fr', isActive: true }
                });
                if (fallbackSchool) return fallbackSchool;
            }
            const fallbackSystem = await prisma.communicationTemplate.findFirst({
                where: { schoolId: null, name, language: 'fr', isActive: true }
            });
            if (fallbackSystem) return fallbackSystem;
        }

        return null;
    }

    /**
     * Substitute variables in content: "Hello {{name}}" -> "Hello Jean"
     */
    render(content: string, variables: Record<string, string> = {}): string {
        let rendered = content;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, value);
        }
        return rendered;
    }
}

export const templateEngine = new TemplateEngineService();
