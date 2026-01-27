import React from 'react';
import { Link } from 'react-router-dom';
import HeroSection from './Herosection';
import FeaturesSection from '../components/Home-sections/FeaturesSection';
import HowItWorksSection from '../components/Home-sections/HowItWorksSection';
import FinalCTASection from '../components/Home-sections/FinalCTASection';

import { Sparkles, Bot, Rocket, Zap, BookOpenCheck, ShieldCheck, UploadCloud, MessageCircle, Users } from 'lucide-react';

import FeatureShowcase from '../components/Home-sections/FeatureShowcase';

export default function Home() {
  
  return (
    <main className="overflow-x-hidden bg-[#05060a] text-white transition-colors duration-300">
      
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