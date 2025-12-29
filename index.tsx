import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Film, Tv, LayoutDashboard, Plus, Search, Bell, Sparkles, Trash2, Edit3, 
  Youtube, Star, ChevronRight, Play, Layers, Settings, ArrowLeft, 
  Calendar, Clock, CheckCircle2, XCircle, MoreVertical, Copy, List, Save, Loader2,
  ExternalLink, Info, Wand2, Eye, EyeOff, LogIn, LogOut, SearchIcon, AlertTriangle, ShieldAlert, Image as ImageIcon, Wand, Tag, Monitor, Hash
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, orderBy, onSnapshot, setDoc, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCVgiTuT2Kw1_J1Ob4E-FJHND9JKo0t4mg",
  authDomain: "yupi-e9be3.firebaseapp.com",
  projectId: "yupi-e9be3",
  storageBucket: "yupi-e9be3.firebasestorage.app",
  messagingSenderId: "584606456014",
  appId: "1:584606456014:web:00082b3034e318715fd89f",
  measurementId: "G-B5HHYETCEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Tipos ---

interface Movie {
  id: string;
  title: string;
  title_original?: string;
  TMDB_id?: number;
  year: number;
  duration?: number;
  poster?: string;
  banner?: string;
  description?: string;
  genres?: string[];
  rating?: number;
  active: boolean;
  id_youtube?: string;
  sidebar?: boolean;
  createdAt: number;
}

interface Series {
  id: string;
  title: string;
  title_original?: string;
  description?: string;
  poster?: string;
  banner?: string;
  year?: number;
  genres?: string[];
  rating?: number;
  id_youtube?: string;
  status: "ongoing" | "ended";
  active: boolean;
  createdAt: number;
}

// --- Componentes UI ---

const Badge = ({ children, color = "indigo" }: { children: React.ReactNode, color?: string }) => {
  const styles: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[color] || styles.indigo}`}>
      {children}
    </span>
  );
};

const Toggle = ({ active, onToggle, disabled = false }: { active: boolean, onToggle: (val: boolean) => void, disabled?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); if(!disabled) onToggle(!active); }}
    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}
  >
    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${active ? 'translate-x-5' : ''}`} />
  </button>
);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<'Dashboard' | 'Movies' | 'Series'>('Dashboard');
  const [navStack, setNavStack] = useState<{ type: string, id: string, label: string }[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  
  const [posterPreviewUrl, setPosterPreviewUrl] = useState("");
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState("");
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  const currentContext = navStack[navStack.length - 1];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const email = fd.get('email');
    const password = fd.get('password');

    if (email === 'basurtobaque@gmail.com' && password) {
      setIsAuthenticated(true);
      setAuthError("");
    } else if (email !== 'basurtobaque@gmail.com') {
      setAuthError("Email no autorizado.");
    } else {
      setAuthError("Contraseña requerida.");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    const handleError = (err: any) => {
      if (err.code === 'permission-denied') setConfigError("Acceso denegado a Firestore.");
      setLoading(false);
    };
    const unsubMovies = onSnapshot(query(collection(db, "movies"), orderBy("createdAt", "desc")), (snap) => {
      setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
      setLoading(false);
    }, handleError);
    const unsubSeries = onSnapshot(query(collection(db, "series"), orderBy("createdAt", "desc")), (snap) => {
      setSeriesList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
    }, handleError);
    return () => { unsubMovies(); unsubSeries(); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!currentContext || !isAuthenticated) { setItems([]); return; }
    let q;
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;
    const episodeId = navStack.find(n => n.type === 'episode')?.id;

    if (currentContext.type === 'series') q = query(collection(db, `series/${currentContext.id}/seasons`), orderBy("seasonNumber", "asc"));
    else if (currentContext.type === 'season') q = query(collection(db, `series/${seriesId}/seasons/${currentContext.id}/episodes`), orderBy("episodeNumber", "asc"));
    else if (currentContext.type === 'episode') q = collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${currentContext.id}/videos_serie`);
    else if (currentContext.type === 'movie_videos') q = collection(db, `movies/${currentContext.id}/videos_movies`);

    if (q) return onSnapshot(q, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentContext, navStack, isAuthenticated]);

  const getFirestorePath = () => {
    if (!currentContext) return view === 'Movies' ? 'movies' : 'series';
    const series = navStack.find(n => n.type === 'series');
    const season = navStack.find(n => n.type === 'season');
    const episode = navStack.find(n => n.type === 'episode');
    const movie = navStack.find(n => n.type === 'movie_videos');

    if (movie) return `movies/${movie.id}/videos_movies`;
    if (episode) return `series/${series?.id}/seasons/${season?.id}/episodes/${episode.id}/videos_serie`;
    if (season) return `series/${series?.id}/seasons/${season.id}/episodes`;
    if (series) return `series/${series.id}/seasons`;
    return "";
  };

  const handleNav = (type: string, id: string, label: string) => setNavStack([...navStack, { type, id, label }]);
  const popNav = (index: number) => setNavStack(navStack.slice(0, index + 1));
  const clearNav = () => setNavStack([]);

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const path = getFirestorePath();
      await updateDoc(doc(db, path, id), { active: !currentStatus });
    } catch (e) { alert("Error al actualizar estado."); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar este registro?")) return;
    try {
      const path = getFirestorePath();
      await deleteDoc(doc(db, path, id));
    } catch (e) { alert("Error al eliminar."); }
  };

  const handleAddEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const data: any = {};
    fd.forEach((value, key) => {
      if (['year', 'TMDB_id', 'rating', 'seasonNumber', 'episodeNumber', 'duration'].includes(key)) data[key] = Number(value);
      else if (['active', 'sidebar'].includes(key)) data[key] = value === 'on';
      else if (key === 'genres') data[key] = (value as string).split(',').map(g => g.trim()).filter(g => g);
      else data[key] = value;
    });

    try {
      const path = getFirestorePath();
      if (editItem) await updateDoc(doc(db, path, editItem.id), data);
      else {
        data.active = data.active ?? true;
        data.createdAt = Date.now();
        await addDoc(collection(db, path), data);
      }
      setIsModalOpen(false);
      setEditItem(null);
    } catch (err) { alert("Error al guardar."); }
    finally { setIsSaving(false); }
  };

  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const startEp = Number(fd.get('startEp'));
    const server = fd.get('server') as string;
    const language = fd.get('language') as string;
    const quality = fd.get('quality') as string;
    const urls = (fd.get('urls') as string).split('\n').map(u => u.trim()).filter(u => u !== '');
    
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;

    try {
      const batch = writeBatch(db);
      for (let i = 0; i < urls.length; i++) {
        const epNum = startEp + i;
        const targetEp = items.find(item => item.episodeNumber === epNum);
        if (targetEp) {
          const videoRef = doc(collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${targetEp.id}/videos_serie`));
          batch.set(videoRef, { url: urls[i], server, language, quality, format: 'embed', createdAt: Date.now(), active: true });
        }
      }
      await batch.commit();
      setIsBatchOpen(false);
    } catch (err) { alert("Error en proceso masivo."); }
    finally { setIsSaving(false); }
  };

  const searchTmdb = async () => {
    const queryStr = (document.getElementById('tmdb-query') as HTMLInputElement)?.value;
    if (!queryStr) return;
    setIsSearchingTmdb(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Extrae metadatos de TMDB para "${queryStr}". 
      Formato JSON con campos: title, title_original, year, TMDB_id, poster, banner, description, rating, duration, genres (array), id_youtube (key del video trailer), status (ongoing o ended para series).`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                year: { type: Type.NUMBER },
                TMDB_id: { type: Type.NUMBER },
                poster: { type: Type.STRING },
                banner: { type: Type.STRING },
                description: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                title_original: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                genres: { type: Type.ARRAY, items: { type: Type.STRING } },
                id_youtube: { type: Type.STRING },
                status: { type: Type.STRING }
              }
            }
          }
        } 
      });
      setTmdbSearchResults(JSON.parse(response.text || "[]"));
    } catch (e) { alert("Error TMDB."); }
    finally { setIsSearchingTmdb(false); }
  };

  const selectTmdbResult = (res: any) => {
    const setVal = (name: string, val: any) => {
      const el = document.getElementsByName(name)[0] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (el) el.value = val;
    };
    setVal('title', res.title);
    setVal('title_original', res.title_original || res.title);
    setVal('year', res.year);
    setVal('TMDB_id', res.TMDB_id);
    setVal('rating', res.rating);
    setVal('poster', res.poster);
    setVal('banner', res.banner || "");
    setVal('duration', res.duration || 0);
    setVal('genres', (res.genres || []).join(', '));
    setVal('description', res.description);
    setVal('id_youtube', res.id_youtube || "");
    setVal('status', res.status || 'ongoing');
    setPosterPreviewUrl(res.poster);
    setBannerPreviewUrl(res.banner || "");
    setTmdbSearchResults([]);
  };

  const openModal = (item: any = null) => {
    setEditItem(item);
    setPosterPreviewUrl(item?.poster || item?.thumbnail || "");
    setBannerPreviewUrl(item?.banner || "");
    setIsModalOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl mb-6"><Play fill="currentColor" size={32} /></div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Cine<span className="text-indigo-600">Panel</span></h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input name="email" type="email" required placeholder="Admin Email" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
            <input name="password" type="password" required placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
            {authError && <p className="text-rose-500 text-[10px] font-black text-center uppercase tracking-widest">{authError}</p>}
            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3 transition-all active:scale-95">
              <LogIn size={20} /> <span>Ingresar</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFF] font-inter">
      <aside className="w-64 bg-white border-r border-slate-100 p-6 flex flex-col space-y-8 sticky top-0 h-screen z-40">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3"><Play fill="currentColor" size={20} /></div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800 italic uppercase">Cine<span className="text-indigo-600">Panel</span></h1>
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => { setView('Dashboard'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutDashboard size={18} /> <span className="text-sm font-bold">Resumen</span></button>
          <button onClick={() => { setView('Movies'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Movies' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><Film size={18} /> <span className="text-sm font-bold">Películas</span></button>
          <button onClick={() => { setView('Series'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Series' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><Tv size={18} /> <span className="text-sm font-bold">Series</span></button>
        </nav>
        <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-rose-400 hover:bg-rose-50 font-bold text-sm"><LogOut size={18} /> <span>Salir</span></button>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto relative">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
              {currentContext ? currentContext.label : (view === 'Movies' ? 'Películas' : view === 'Series' ? 'Series TV' : 'Dashboard')}
            </h2>
            {currentContext && (
               <div className="flex items-center space-x-2 mt-2">
                 {navStack.map((step, idx) => (
                   <React.Fragment key={idx}>
                     <button onClick={() => popNav(idx)} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">{step.label}</button>
                     {idx < navStack.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
                   </React.Fragment>
                 ))}
               </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <input type="text" placeholder="Filtrar por nombre..." className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm outline-none w-72 shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button onClick={() => openModal()} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center space-x-2 shadow-lg shadow-indigo-100"><Plus size={18} /> <span>Añadir</span></button>
            {currentContext?.type === 'season' && (
              <button onClick={() => setIsBatchOpen(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center space-x-2"><List size={18} /> <span>Bulk URLs</span></button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-200"><Loader2 size={48} className="animate-spin mb-4" /><p className="font-black text-[10px] uppercase tracking-widest tracking-widest">Sincronizando yupi-e9be3...</p></div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <tr><th className="px-8 py-5">Recurso</th><th className="px-8 py-5">Info</th><th className="px-8 py-5 text-center">Estado</th><th className="px-8 py-5 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(currentContext ? items : (view === 'Movies' ? movies : seriesList)).filter(i => (i.title || i.name || "").toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-4 w-24">
                      <div className="w-12 h-18 rounded-xl overflow-hidden shadow-md border border-slate-100 bg-slate-50">
                        <img src={item.poster || item.thumbnail || 'https://via.placeholder.com/300x450'} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="font-bold text-slate-800 text-sm">{item.title || item.name || `Episodio ${item.episodeNumber}`}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.year || item.server || (item.episodeNumber ? `Epi ${item.episodeNumber}` : 'N/A')}</span>
                        {item.status && <Badge color={item.status === 'ongoing' ? 'emerald' : 'slate'}>{item.status}</Badge>}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center"><Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} /></td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 text-slate-300">
                        {view === 'Movies' && !currentContext && <button onClick={() => handleNav('movie_videos', item.id, `Vídeos: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl" title="Servidores"><Layers size={18} /></button>}
                        {view === 'Series' && !currentContext && <button onClick={() => handleNav('series', item.id, `Temp: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl" title="Temporadas"><List size={18} /></button>}
                        {currentContext?.type === 'series' && <button onClick={() => handleNav('season', item.id, `S${item.seasonNumber}: ${item.name}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl" title="Episodios"><List size={18} /></button>}
                        {currentContext?.type === 'season' && <button onClick={() => handleNav('episode', item.id, `E${item.episodeNumber}: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl" title="Servidores"><Layers size={18} /></button>}
                        <button onClick={() => openModal(item)} className="p-2 hover:bg-amber-50 hover:text-amber-600 rounded-xl" title="Editar"><Edit3 size={18} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl" title="Eliminar"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* --- MODAL EDITOR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-7xl max-h-[94vh] rounded-[3.5rem] shadow-2xl overflow-hidden flex border border-white/20">
            {/* Sidebar Preview */}
            <div className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col p-8 items-center overflow-y-auto">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Vista Previa Visual</h4>
               <div className="w-full aspect-[3/4] rounded-[2rem] bg-white shadow-xl overflow-hidden flex items-center justify-center relative border border-slate-200">
                  {posterPreviewUrl ? <img src={posterPreviewUrl} className="w-full h-full object-cover" /> : <ImageIcon size={48} className="text-slate-200" />}
               </div>
               <div className="w-full aspect-[16/9] mt-8 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center relative border border-slate-200">
                  {bannerPreviewUrl ? <img src={bannerPreviewUrl} className="w-full h-full object-cover" /> : <Monitor size={32} className="text-slate-200" />}
               </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              <header className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{editItem ? 'Editando' : 'Creando'} {currentContext?.type || view}</h3>
                  <Badge color="slate">Nivel: {currentContext?.type || 'Root'}</Badge>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-800">&times;</button>
              </header>

              <form onSubmit={handleAddEdit} className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                {(!currentContext || currentContext.type === 'series') && !editItem && (
                   <div className="p-8 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100">
                     <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 block">Asistente TMDB</label>
                     <div className="flex space-x-2">
                       <input id="tmdb-query" placeholder="Buscar título original..." className="flex-1 px-6 py-4 bg-white border-none rounded-2xl outline-none font-bold shadow-sm" />
                       <button type="button" onClick={searchTmdb} disabled={isSearchingTmdb} className="px-8 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2">
                         {isSearchingTmdb ? <Loader2 className="animate-spin" size={16} /> : <SearchIcon size={16} />}
                         <span>Consultar</span>
                       </button>
                     </div>
                     {tmdbSearchResults.length > 0 && (
                       <div className="grid grid-cols-3 gap-4 mt-6">
                         {tmdbSearchResults.map((res, i) => (
                           <div key={i} onClick={() => selectTmdbResult(res)} className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer border border-indigo-50 transition-all flex items-center space-x-3 group">
                             <img src={res.poster} className="w-10 h-14 object-cover rounded-lg" />
                             <div className="flex-1 min-w-0"><h5 className="font-bold text-slate-800 text-[10px] truncate">{res.title}</h5><p className="text-[8px] text-slate-400 font-bold uppercase">{res.year}</p></div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                )}

                <div className="space-y-6">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider pl-4 border-l-4 border-indigo-500">Datos Principales</h5>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nombre / Título</label>
                      <input name="title" required defaultValue={editItem?.title || editItem?.name} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>

                    {/* Mostrar campos según el contexto */}
                    {(!currentContext || currentContext.type === 'series' || currentContext.type === 'season') && (
                      <>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Título Original</label><input name="title_original" defaultValue={editItem?.title_original} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Año</label><input name="year" type="number" defaultValue={editItem?.year} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Rating</label><input name="rating" type="number" step="0.1" defaultValue={editItem?.rating} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                        </div>
                      </>
                    )}

                    {view === 'Series' && !currentContext && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Estado Serie</label>
                        <select name="status" defaultValue={editItem?.status || 'ongoing'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold appearance-none">
                          <option value="ongoing">En Emisión (Ongoing)</option>
                          <option value="ended">Finalizada (Ended)</option>
                        </select>
                      </div>
                    )}

                    {currentContext?.type === 'series' && (
                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Número de Temporada</label><input name="seasonNumber" type="number" defaultValue={editItem?.seasonNumber} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    )}

                    {currentContext?.type === 'season' && (
                       <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Episodio #</label><input name="episodeNumber" type="number" defaultValue={editItem?.episodeNumber} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Duración (min)</label><input name="duration" type="number" defaultValue={editItem?.duration} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                       </div>
                    )}
                  </div>
                </div>

                {/* Sección Multimedia */}
                {(!currentContext || currentContext.type === 'season') && (
                  <div className="space-y-6">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider pl-4 border-l-4 border-indigo-500">Recursos Visuales</h5>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">YouTube ID (Trailer Key)</label>
                        <input name="id_youtube" defaultValue={editItem?.id_youtube} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{currentContext?.type === 'season' ? 'URL Thumbnail (Episode)' : 'URL Póster'}</label>
                        <input name={currentContext?.type === 'season' ? 'thumbnail' : 'poster'} defaultValue={editItem?.poster || editItem?.thumbnail} onChange={(e) => setPosterPreviewUrl(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">URL Banner</label>
                        <input name="banner" defaultValue={editItem?.banner} onChange={(e) => setBannerPreviewUrl(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sección Videos/Servidores */}
                {(currentContext?.type === 'episode' || currentContext?.type === 'movie_videos') && (
                  <div className="space-y-6">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider pl-4 border-l-4 border-indigo-500">Configuración de Video</h5>
                    <div className="grid grid-cols-2 gap-6">
                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Servidor</label><input name="server" required defaultValue={editItem?.server} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                       <div className="grid grid-cols-2 gap-4">
                         <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Idioma</label><input name="language" defaultValue={editItem?.language || 'LAT'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                         <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Calidad</label><input name="quality" defaultValue={editItem?.quality || '1080p'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                       </div>
                       <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">URL Directa / Embed</label><input name="url" required defaultValue={editItem?.url} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Formato</label><input name="format" defaultValue={editItem?.format || 'embed'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    </div>
                  </div>
                )}

                <div className="col-span-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Descripción / Overview</label>
                  <textarea name={currentContext?.type === 'season' ? 'overview' : 'description'} defaultValue={editItem?.description || editItem?.overview} className="w-full h-32 px-6 py-4 bg-slate-50 border-none rounded-3xl outline-none font-medium text-slate-600 resize-none leading-relaxed" />
                </div>

                <footer className="pt-8 flex justify-end space-x-4 border-t border-slate-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center space-x-2 shadow-indigo-100 transition-all active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    <span>Guardar Registro</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK URLS */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 border border-white/20">
            <h3 className="text-2xl font-black text-slate-800 mb-2 italic">Carga Masiva de Vídeos</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Pega una URL por línea para asignar a episodios secuenciales</p>
            <form onSubmit={handleBatchProcess} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input name="startEp" type="number" defaultValue={1} className="px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Epi. Inicial" />
                <input name="server" defaultValue="Streamtape" className="px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Servidor" />
              </div>
              <textarea name="urls" required className="w-full h-40 px-6 py-4 bg-slate-50 border-none rounded-3xl outline-none font-medium text-[10px] resize-none" placeholder="URLs..." />
              <div className="flex space-x-4">
                <button type="button" onClick={() => setIsBatchOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cerrar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 active:scale-95">
                   {isSaving ? <Loader2 className="animate-spin" /> : <Plus size={16} />}
                   <span>Procesar Lote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
