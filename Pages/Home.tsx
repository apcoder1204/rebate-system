import React from 'react';
import { Button } from '@/Components/ui/button';
import { User } from '@/entities/User';
import { Card, CardContent } from '@/Components/ui/card';
import { Check, LogIn, TrendingUp, FileSignature, ShoppingCart } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import cctvpointLogo from '../cctvpointLogo.jpg';

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogin = () => navigate(createPageUrl('Login'));

  const features = [
    {
      icon: <FileSignature className="w-5 h-5" />,
      title: 'Simple Contract',
      description: 'Read, sign, and create your contract to get started.',
    },
    {
      icon: <ShoppingCart className="w-5 h-5" />,
      title: 'Earn on Every Order',
      description: 'Automatically accrue a 1% rebate on all eligible purchases.',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Track Your Rebates',
      description: 'Monitor your pending and available rebates in real-time.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg">
            <FileSignature className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-bold text-slate-900 dark:text-slate-100 text-xl">Rebate System</h1>
        </div>
        <Button onClick={handleLogin}>
          <LogIn className="w-4 h-4 mr-2" />
          Login / Register
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col items-center mb-6">
            <img src={cctvpointLogo} alt="CCTV Point Logo" className="h-24 md:h-40 object-contain mb-4" />
            <Card className="p-4 bg-blue-500/10 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 rounded-full inline-flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="font-medium text-blue-700 dark:text-blue-300 text-sm">Welcome to the cctvpoint.org Rebate Program</p>
            </Card>
          </div>

          <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-slate-100 mb-6 leading-tight">
            Earn <span className="text-blue-600 dark:text-blue-400">1% Rebate</span> on All Your Purchases
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10">
            Join our exclusive rebate program. Sign a simple contract and start earning cash back on all your orders after 6 months.
          </p>

          <div className="flex justify-center">
            <Button size="lg" onClick={handleLogin} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-xl shadow-blue-500/30 text-lg py-7 px-8">
              Get Started Now
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20 text-left">
            {features.map((feature, index) => (
              <div key={index} className="p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{feature.title}</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}