import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { AllBooks } from './pages/AllBooks';
import { MangaDetail } from './pages/MangaDetail';
import { AuthorWorks } from './pages/AuthorWorks';
import { Reader } from './pages/Reader';
import { Library } from './pages/Library';
import { getTheme, setTheme } from './storage';

function NavigationHistoryTracker() {
  const location = useLocation();

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    if (
      !location.pathname.startsWith('/manga/') &&
      !location.pathname.startsWith('/read/')
    ) {
      sessionStorage.setItem('ciaran_last_main_path', fullPath);
    }
    // Always reset scroll to top on page/filter navigation
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.search]);

  return null;
}

export function App() {
  useEffect(() => {
    setTheme(getTheme());
  }, []);

  return (
    <BrowserRouter>
      <NavigationHistoryTracker />
      <div className="min-h-screen bg-[#f8f8f8] dark:bg-[#121212] text-[#121212] dark:text-[#f8f8f8] font-poppins flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/books" element={<AllBooks />} />
            <Route path="/manga/:id" element={<MangaDetail />} />
            <Route path="/author/:authorId" element={<AuthorWorks />} />
            <Route path="/read/:chapterId" element={<Reader />} />
            <Route path="/library" element={<Library />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
