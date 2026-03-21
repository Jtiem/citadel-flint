import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ProductPreview } from './components/ProductPreview';
import { Problem } from './components/Problem';
import { CoreJobs } from './components/CoreJobs';
import { HowItWorks } from './components/HowItWorks';
import { TwoProducts } from './components/TwoProducts';
import { Competitive } from './components/Competitive';
import { Trust } from './components/Trust';
import { UseCases } from './components/UseCases';
import { Domains } from './components/Domains';
import { FAQ } from './components/FAQ';
import { GettingStarted } from './components/GettingStarted';
import { EmailCapture } from './components/EmailCapture';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main>
        <Hero />
        <ProductPreview />
        <Problem />
        <CoreJobs />
        <HowItWorks />
        <TwoProducts />
        <Competitive />
        <Trust />
        <UseCases />
        <Domains />
        <FAQ />
        <GettingStarted />
        <EmailCapture />
      </main>
      <Footer />
    </div>
  );
}
