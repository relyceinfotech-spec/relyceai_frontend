import React from 'react';
import { Link } from 'react-router-dom';
import HeroSection from './Herosection';
import FeaturesSection from '../components/Home-sections/FeaturesSection';
import HowItWorksSection from '../components/Home-sections/HowItWorksSection';
import FinalCTASection from '../components/Home-sections/FinalCTASection';



import FeatureShowcase from '../components/Home-sections/FeatureShowcase';

import { Helmet } from 'react-helmet-async';

export default function Home() {
  
  return (
    <main className="overflow-x-hidden bg-[#05060a] text-white transition-colors duration-300">
      <Helmet>
        <title>Relyce AI – Privacy-First AI Assistant with Custom Personalities</title>
        <meta
          name="description"
          content="Create private AI assistants, upload files, and chat securely using RAG. Your AI, your rules."
        />
        <meta property="og:title" content="Relyce AI – Privacy-First AI Assistant" />
        <meta property="og:description" content="Custom AI personalities, secure file chat, and zero data training." />
        <meta property="og:url" content="https://relyceai.com/" />
        <link rel="canonical" href="https://relyceai.com/" />
      </Helmet>
      
      {/* Hero Section */}
      <HeroSection/>


      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Feature Showcase (Carousel) */}
      <FeatureShowcase />

      {/* Final CTA Section */}
      <FinalCTASection />

    </main>
  );
}