import dynamic from "next/dynamic";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";

const ProductScreenshotSection = dynamic(() =>
    import("@/components/landing/ProductScreenshotSection").then((m) => m.ProductScreenshotSection),
);
const StatsSection = dynamic(() =>
    import("@/components/landing/StatsSection").then((m) => m.StatsSection),
);
const FeaturesSection = dynamic(() =>
    import("@/components/landing/FeaturesSection").then((m) => m.FeaturesSection),
);
const PricingSection = dynamic(() =>
    import("@/components/landing/PricingSection").then((m) => m.PricingSection),
);
const TestimonialsSection = dynamic(() =>
    import("@/components/landing/TestimonialsSection").then((m) => m.TestimonialsSection),
);
const FAQSection = dynamic(() =>
    import("@/components/landing/FAQSection").then((m) => m.FAQSection),
);
const FooterSection = dynamic(() =>
    import("@/components/landing/FooterSection").then((m) => m.FooterSection),
);

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
