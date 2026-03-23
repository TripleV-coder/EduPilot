import { HeroSection } from "@/components/landing/HeroSection";
import { Navbar } from "@/components/landing/Navbar";

export default function Home() {
    return (
        <main className="min-h-screen bg-background selection:bg-primary/30">
            <Navbar />
            <HeroSection />
        </main>
    );
}
