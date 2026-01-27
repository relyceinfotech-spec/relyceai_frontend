import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

export default function Footer() {

  return (
    <footer className="bg-black text-white border-t border-emerald-500/30">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12">

          {/* Column 1: Logo & Brand Info */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-4">
              <img src="/logo.svg" alt="Relyce AI" className="w-12 h-12 object-contain rounded-lg" />
              <span className="text-3xl font-extrabold text-white">
                Relyce AI
              </span>
            </Link>
            <p className="mt-6 max-w-sm leading-relaxed text-zinc-400">
              Your AI-powered assistant for faster, smarter conversations, built on a foundation of trust and accuracy.
            </p>
          </div>

          {/* Column 2: Product Links */}
          <div>
            <h3 className="text-lg font-semibold text-white">Product</h3>
            <div className="mt-6 flex flex-col gap-4">
              <Link to="/" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                Home
              </Link>
              <Link to="/about" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                About
              </Link>
              <Link to="/membership" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                Pricing
              </Link>
            </div>
          </div>

          {/* Column 3: Company Links */}
          <div>
            <h3 className="text-lg font-semibold text-white">Company</h3>
            <div className="mt-6 flex flex-col gap-4">
              <Link to="/contact" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                Contact Us
              </Link>
              <Link to="#" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                Careers
              </Link>
              <Link to="#" className="text-zinc-400 hover:text-emerald-400 transition-colors">
                Blog
              </Link>
            </div>
          </div>

          {/* Column 4: Social Links */}
          <div>
            <h3 className="text-lg font-semibold text-white">Connect</h3>
            <div className="mt-6 flex items-center gap-5">
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin size={24} />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram size={24} />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="WhatsApp">
                <FaWhatsapp size={24} />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="mt-16 pt-8 border-t border-emerald-500/20 flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-4">
          <p className="text-zinc-500 text-sm">
            &copy; {new Date().getFullYear()} Relyce Infotech. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <Link to="/terms" className="hover:text-white hover:transition-colors">
              Terms of Use
            </Link>
            <Link to="/privacy" className="hover:text-white hover:transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}