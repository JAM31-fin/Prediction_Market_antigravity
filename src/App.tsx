/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageProvider } from './context/LanguageContext';
import { MarketProvider, useMarket } from './context/MarketContext';
import { DemoBanner } from './components/common/DemoBanner';
import { SystemAlertBanner } from './components/common/SystemAlertBanner';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HomePage } from './components/home/HomePage';
import { MarketsPage } from './components/markets/MarketsPage';
import { MarketDetailPage } from './components/market-detail/MarketDetailPage';
import { PortfolioPage } from './components/portfolio/PortfolioPage';
import { HistoryPage } from './components/history/HistoryPage';
import { TournamentsPage } from './components/tournaments/TournamentsPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAccessDenied } from './components/admin/AdminAccessDenied';
import { AuthModal } from './components/auth/AuthModal';

const AppContent: React.FC = () => {
  const { currentView, user, authStatus, navigateTo, isAuthModalOpen, setIsAuthModalOpen } = useMarket();

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-[#3b82f6]/30 selection:text-white">
      {/* Top Demo Environment Disclaimer Banner */}
      <DemoBanner />

      {/* Global System & Connectivity Alert */}
      <SystemAlertBanner />

      {/* Main Persistent Navigation Bar */}
      <Navbar />

      {/* Main View Router */}
      <main className="flex-1">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {currentView === 'home' && <HomePage />}
              {currentView === 'markets' && <MarketsPage />}
              {currentView === 'detail' && <MarketDetailPage />}
              {currentView === 'portfolio' && <PortfolioPage />}
              {currentView === 'history' && <HistoryPage />}
              {(currentView === 'tournaments' || currentView === 'leaderboard') && <TournamentsPage />}
              {currentView === 'admin' && (
                user?.role === 'admin' ? (
                  <AdminDashboard />
                ) : authStatus === 'loading' ? (
                  <div className="max-w-4xl mx-auto px-4 py-24 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
                    <div className="text-sm font-mono text-slate-400">Verifying administrator credentials...</div>
                  </div>
                ) : (
                  <AdminAccessDenied
                    onReturnHome={() => navigateTo('home')}
                    onOpenAuth={() => setIsAuthModalOpen(true)}
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      {/* Centralized Identity & Account Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Financial Platform Footer */}
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <MarketProvider>
          <AppContent />
        </MarketProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
