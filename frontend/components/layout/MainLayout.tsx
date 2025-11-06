'use client';

import Header from './Header';
import AppLayout from './AppLayout';

export default function MainLayout() {
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden h-[calc(100vh-4rem)]">
        <AppLayout />
      </main>
    </div>
  );
}
