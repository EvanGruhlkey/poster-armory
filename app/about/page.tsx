import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-primary">About Poster Armory</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Meaningful places, made for your wall.
          </h1>
          <p className="mt-5 leading-7 text-muted-foreground">
            Poster Armory helps you turn a city, neighborhood, address, or landmark into custom map art. Designing and previewing are free. You only need an account when you download a high-resolution file or order a print.
          </p>

          <section className="mt-10 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Need help?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Questions about a design, download, payment, or order are answered by email.
            </p>
            <Button asChild className="mt-5">
              <a href="mailto:posterarmory@gmail.com">Email support</a>
            </Button>
          </section>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link href="/pricing" className="font-medium underline underline-offset-4">Pricing</Link>
            <Link href="/terms" className="font-medium underline underline-offset-4">Terms</Link>
            <Link href="/privacy" className="font-medium underline underline-offset-4">Privacy</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
