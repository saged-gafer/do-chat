import React, { useEffect, useState } from 'react';
import { Shield, Lock, Trash2, Network, HardDrive, Smartphone, Monitor, Apple, Download, ChevronRight, Zap, CheckCircle2 } from 'lucide-react';
import './_group.css';

export function Landing() {
  const [os, setOs] = useState<'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown'>('unknown');

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) setOs('windows');
    else if (userAgent.includes('mac')) setOs('mac');
    else if (userAgent.includes('linux') && !userAgent.includes('android')) setOs('linux');
    else if (userAgent.includes('android')) setOs('android');
    else if (userAgent.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) setOs('ios');
  }, []);

  const getPrimaryDownload = () => {
    switch (os) {
      case 'windows': return { name: 'Download for Windows', icon: <Monitor className="w-5 h-5 mr-2" /> };
      case 'mac': return { name: 'Download for macOS', icon: <Apple className="w-5 h-5 mr-2" /> };
      case 'android': return { name: 'Get it on Google Play', icon: <Smartphone className="w-5 h-5 mr-2" /> };
      case 'ios': return { name: 'Download on the App Store', icon: <Apple className="w-5 h-5 mr-2" /> };
      default: return { name: 'Download Now', icon: <Download className="w-5 h-5 mr-2" /> };
    }
  };

  const primaryDownload = getPrimaryDownload();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-purple-600 p-[1px]">
              <div className="w-full h-full bg-[#020617] rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Ghost<span className="text-sky-400">Net</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#download" className="hover:text-white transition-colors">Download</a>
          </div>
          <button className="bg-white text-slate-950 px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-sky-50 transition-colors flex items-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
        
        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-8">
            <Zap className="w-3.5 h-3.5" />
            <span>v2.0 is now live</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 max-w-4xl">
            Uncompromised privacy for <br className="hidden md:block" />
            <span className="gradient-text">the modern world.</span>
          </h1>
          
          <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Zero-knowledge, peer-to-peer, and fully encrypted. Your messages never touch a central server and self-destruct after 12 hours.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all flex items-center justify-center group">
              {primaryDownload.icon}
              {primaryDownload.name}
              <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-lg border border-slate-700 hover:bg-slate-800 transition-colors flex items-center justify-center">
              Learn More
            </a>
          </div>

          <div className="mt-16 w-full max-w-5xl rounded-2xl border border-slate-800/60 bg-[#0f172a]/50 backdrop-blur-sm p-2 shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 rounded-2xl"></div>
            <img 
              src="/__mockup/images/hero-network.png" 
              alt="Encrypted Network Visualization" 
              className="w-full h-auto rounded-xl object-cover aspect-video mix-blend-screen opacity-90"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-[#0a0f1c] relative border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Security without compromise</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Built from the ground up with a paranoid security model. Trust the math, not the servers.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Shield className="w-6 h-6 text-sky-400" />}
              title="Zero Knowledge"
              description="Our signaling servers only route encrypted packets. We cannot read, see, or intercept your messages. Ever."
            />
            <FeatureCard 
              icon={<Lock className="w-6 h-6 text-purple-400" />}
              title="AES-256-GCM"
              description="Military-grade end-to-end encryption ensures your conversations remain strictly between you and the recipient."
            />
            <FeatureCard 
              icon={<Network className="w-6 h-6 text-emerald-400" />}
              title="P2P WebRTC"
              description="Messages flow directly between devices via decentralized WebRTC data channels. No central point of failure."
            />
            <FeatureCard 
              icon={<HardDrive className="w-6 h-6 text-orange-400" />}
              title="Local Storage Only"
              description="Data is stored in an encrypted local SQLite database. Your phone is the only place your history exists."
            />
            <FeatureCard 
              icon={<Trash2 className="w-6 h-6 text-rose-400" />}
              title="12-Hour Auto-Purge"
              description="Conversations are ephemeral by default. All data is securely shredded and overwritten every 12 hours."
            />
            <FeatureCard 
              icon={<Monitor className="w-6 h-6 text-blue-400" />}
              title="Cross-Platform"
              description="Seamlessly communicate across Windows, macOS, Linux, iOS, and Android without breaking the secure link."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">The Anatomy of a Ghost Message</h2>
              <p className="text-slate-400 mb-10 text-lg">We've eliminated the middleman. Here is exactly what happens when you hit send.</p>
              
              <div className="space-y-8">
                <Step 
                  number="01"
                  title="Direct Handshake"
                  description="Devices establish a direct P2P connection via a zero-knowledge signaling server. Keys are exchanged locally."
                />
                <Step 
                  number="02"
                  title="Local Encryption"
                  description="The payload is encrypted on-device using AES-256-GCM before it ever hits the network interface."
                />
                <Step 
                  number="03"
                  title="Direct Delivery"
                  description="The encrypted packet travels directly to the recipient's IP address. No server stores the message in transit."
                />
                <Step 
                  number="04"
                  title="Secure Shredding"
                  description="After 12 hours, local SQLite records are overwritten with random bytes and permanently deleted."
                />
              </div>
            </div>
            
            <div className="lg:w-1/2 w-full">
              <div className="relative rounded-2xl border border-slate-800 bg-[#0f172a] p-8 box-glow">
                {/* Mockup UI representation */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="font-mono text-sm text-emerald-400">P2P Link Established</span>
                  </div>
                  
                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-500 break-all border border-slate-800">
                    <span className="text-sky-500">ENCRYPTING PAYLOAD...</span><br/>
                    0x8a9f2b4c7d1e5...<br/>
                    <span className="text-slate-600">e2e_key_exchange: success</span>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-sky-500/10 border border-sky-500/20 text-sky-100 rounded-2xl rounded-tr-sm py-3 px-4 max-w-[80%]">
                      Meeting at 0900. Safehouse B.
                    </div>
                  </div>
                  
                  <div className="flex justify-center text-xs text-slate-600 font-mono items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>Message shredded in 11:59:59</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24 bg-[#0a0f1c] border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Go Dark Today</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-16 text-lg">Available on all major platforms. No phone number required. No email required. Just download and connect.</p>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <DownloadCard 
              icon={<Monitor className="w-8 h-8 text-sky-400" />}
              platform="Windows"
              version="Requires Windows 10+"
              active={os === 'windows'}
            />
            <DownloadCard 
              icon={<Smartphone className="w-8 h-8 text-emerald-400" />}
              platform="Android"
              version="Requires Android 9.0+"
              active={os === 'android'}
            />
            <DownloadCard 
              icon={<Apple className="w-8 h-8 text-slate-200" />}
              platform="iOS"
              version="Requires iOS 14.0+"
              active={os === 'ios'}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-12 bg-[#020617]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-white">GhostNet</span>
          </div>
          
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Security Whitepaper</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Source Code</a>
          </div>
          
          <div className="text-slate-600 text-sm">
            © {new Date().getFullYear()} GhostNet Privacy Systems.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-800/40 transition-colors group">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800/50 flex items-center justify-center font-mono text-sm font-bold text-slate-400 group-hover:border-sky-500 group-hover:text-sky-400 transition-colors">
          {number}
        </div>
        <div className="w-px h-full bg-slate-800 my-2 group-hover:bg-sky-500/30 transition-colors"></div>
      </div>
      <div className="pb-8">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function DownloadCard({ icon, platform, version, active }: { icon: React.ReactNode, platform: string, version: string, active: boolean }) {
  return (
    <div className={`p-8 rounded-2xl border flex flex-col items-center text-center transition-all ${active ? 'border-sky-500/50 bg-sky-500/5 box-glow scale-[1.02]' : 'border-slate-800 bg-[#0f172a] hover:border-slate-700'}`}>
      {active && (
        <div className="bg-sky-500 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full mb-4">
          Detected OS
        </div>
      )}
      <div className="mb-4">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">{platform}</h3>
      <p className="text-slate-500 text-sm mb-8">{version}</p>
      <button className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${active ? 'bg-sky-500 hover:bg-sky-400 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
        <Download className="w-4 h-4" />
        Download
      </button>
    </div>
  );
}
