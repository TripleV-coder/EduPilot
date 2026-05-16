import { HeroSection } from "@/components/landing/HeroSection";
import { Navbar } from "@/components/landing/Navbar";
import { ProductScreenshotSection } from "@/components/landing/ProductScreenshotSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FooterSection } from "@/components/landing/FooterSection";

export default function Home() {
    return (
        <main className="min-h-screen bg-background selection:bg-primary/30">
            <Navbar />
            <HeroSection />
            <ProductScreenshotSection />
            <StatsSection />
            <FeaturesSection />
            <PricingSection />
            <TestimonialsSection />
            <FAQSection />
            <FooterSection />
        </main>
    );
}
