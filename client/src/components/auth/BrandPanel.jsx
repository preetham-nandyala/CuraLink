import React from 'react';
import { BookOpen, Search, Activity, Stethoscope } from 'lucide-react';

const BrandPanel = () => {
  return (
    <div className="w-full h-full bg-[#0F6E56] flex flex-col justify-center px-12 text-white">
      <div className="max-w-md mx-auto">
        <h1 className="text-4xl font-bold mb-4 font-headline tracking-tight flex items-center gap-3">
          <Stethoscope size={36} className="text-white" />
          <span>Cura<span className="text-[#374151]">link</span></span>
        </h1>
        <p className="text-xl font-medium mb-12 text-white/90 font-headline leading-tight">
          Your AI Medical Research Companion
        </p>

        <div className="space-y-8 mt-12">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm shadow-sm flex-none">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white mb-1 tracking-wide">Research-backed answers</h3>
              <p className="text-white/75 text-sm leading-relaxed">Direct links to PubMed and OpenAlex with zero hallucinations.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm shadow-sm flex-none">
              <Search size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white mb-1 tracking-wide">Clinical trials finder</h3>
              <p className="text-white/75 text-sm leading-relaxed">Instantly match patients with recruiting trials worldwide.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm shadow-sm flex-none">
              <Activity size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white mb-1 tracking-wide">Multi-turn health insights</h3>
              <p className="text-white/75 text-sm leading-relaxed">Retain context for deeper dives into complex conditions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandPanel;
