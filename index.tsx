import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Film, Tv, LayoutDashboard, Plus, Search, Bell, Sparkles, Trash2, Edit3, 
  Youtube, Star, ChevronRight, Play, Layers, Settings, ArrowLeft, 
  Calendar, Clock, CheckCircle2, XCircle, MoreVertical, Copy, List, Save, Loader2,
  ExternalLink, Info, Wand2, Eye, EyeOff
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, orderBy, onSnapshot, setDoc, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuración de Firebase ---
// NOTA: En un entorno real, estas credenciales se inyectan dinámicamente.
const firebaseConfig = {
  apiKey: "AIzaSyAs-DEMO-ONLY",
  authDomain: "cinestream-panel.firebaseapp.com",
  projectId: "cinestream-panel",
  storageBucket: "cinestream-panel.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Tipos Mejorados ---

interface VideoSource {
  id: string;
  quality: string;
  language: string;
  format: string;
  url: string;
  server: string;
}

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

interface Season {
  id: string;
  seasonNumber: number;
  name: string;
  year?: number;
  active: boolean;
}

interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  overview?: string;
  duration?: number;
  thumbnail?: string;
  active: boolean;
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
  const [view, setView] = useState<'Dashboard' | 'Movies' | 'Series'>('Dashboard');
  const [navStack, setNavStack] = useState<{ type: string, id: string, label: string }[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [items, setItems] = useState<any[]>([]); // Para subcolecciones (seasons, episodes, videos)
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const currentContext = navStack[navStack.length - 1];

  // Suscripción a Colecciones Principales
  useEffect(() => {
    const unsubMovies = onSnapshot(query(collection(db, "movies"), orderBy("createdAt", "desc")), (snap) => {
      setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
      setLoading(false);
    });
    const unsubSeries = onSnapshot(query(collection(db, "series"), orderBy("createdAt", "desc")), (snap) => {
      setSeriesList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
    });
    return () => { unsubMovies(); unsubSeries(); };
  }, []);

  // Suscripción a Subcolecciones según Contexto
  useEffect(() => {
    if (!currentContext) {
      setItems([]);
      return;
    }

    let q;
    const path = getFirestorePath();
    if (currentContext.type === 'series') {
      q = query(collection(db, `series/${currentContext.id}/seasons`), orderBy("seasonNumber", "asc"));
    } else if (currentContext.type === 'season') {
      const seriesId = navStack.find(n => n.type === 'series')?.id;
      q = query(collection(db, `series/${seriesId}/seasons/${currentContext.id}/episodes`), orderBy("episodeNumber", "asc"));
    } else if (currentContext.type === 'episode') {
      const seriesId = navStack.find(n => n.type === 'series')?.id;
      const seasonId = navStack.find(n => n.type === 'season')?.id;
      q = collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${currentContext.id}/videos_serie`);
    } else if (currentContext.type === 'movie_videos') {
      q = collection(db, `movies/${currentContext.id}/videos_movies`);
    }

    if (q) {
      return onSnapshot(q, (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
  }, [currentContext, navStack]);

  const getFirestorePath = () => {
    if (!currentContext) return "";
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

  const handleNav = (type: string, id: string, label: string) => {
    setNavStack([...navStack, { type, id, label }]);
  };

  const popNav = (index: number) => {
    setNavStack(navStack.slice(0, index + 1));
  };

  const clearNav = () => setNavStack([]);

  const toggleActive = async (id: string, currentStatus: boolean, collectionName?: string) => {
    try {
      let path = collectionName || "";
      if (!path) {
        if (view === 'Movies' && !currentContext) path = 'movies';
        else if (view === 'Series' && !currentContext) path = 'series';
        else path = getFirestorePath();
      }
      await updateDoc(doc(db, path, id), { active: !currentStatus });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este elemento?")) return;
    try {
      let path = "";
      if (!currentContext) {
        path = view === 'Movies' ? 'movies' : 'series';
      } else {
        path = getFirestorePath();
      }
      await deleteDoc(doc(db, path, id));
    } catch (e) { console.error(e); }
  };

  const handleAddEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    
    const data: any = {};
    fd.forEach((value, key) => {
      if (key === 'year' || key === 'TMDB_id' || key === 'rating' || key === 'seasonNumber' || key === 'episodeNumber') {
        data[key] = Number(value);
      } else if (key === 'active' || key === 'sidebar') {
        data[key] = value === 'on';
      } else {
        data[key] = value;
      }
    });

    try {
      let path = "";
      if (!currentContext) {
        path = view === 'Movies' ? 'movies' : 'series';
        if (!editItem) data.createdAt = Date.now();
      } else {
        path = getFirestorePath();
      }

      if (editItem) {
        await updateDoc(doc(db, path, editItem.id), data);
      } else {
        if (!data.active) data.active = true;
        await addDoc(collection(db, path), data);
      }
      setIsModalOpen(false);
      setEditItem(null);
    } catch (err) {
      console.error(err);
      alert("Error al guardar datos.");
    } finally {
      setIsSaving(false);
    }
  };

  const autofillAI = async () => {
    const title = (document.getElementById('form-title') as HTMLInputElement)?.value;
    if (!title) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Return JSON metadata for movie/series "${title}": { "title_original": string, "year": number, "description": string, "genres": string[], "rating": number (0-10) }. JSON only.`;
      const result = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { responseMimeType: "application/json" } 
      });
      const metadata = JSON.parse(result.text);
      
      const setVal = (id: string, val: any) => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = val;
      };
      setVal('form-title-orig', metadata.title_original || "");
      setVal('form-year', metadata.year || "");
      setVal('form-rating', metadata.rating || "");
      setVal('form-desc', metadata.description || "");
      alert("Metadatos generados por IA aplicados.");
    } catch (e) {
      console.error(e);
      alert("Error con Gemini API.");
    } finally { setIsGenerating(false); }
  };

  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const startEp = Number(fd.get('startEp'));
    const quality = fd.get('quality') as string;
    const server = fd.get('server') as string;
    const format = fd.get('format') as string;
    const language = fd.get('language') as string;
    const urls = (fd.get('urls') as string).split('\n').map(u => u.trim()).filter(u => u);

    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;

    try {
      const batch = writeBatch(db);
      // Primero buscamos los episodios existentes en esta temporada
      const epSnap = await getDocs(query(collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`), orderBy("episodeNumber", "asc")));
      const episodesMap = new Map(epSnap.docs.map(d => [d.data().episodeNumber, d.id]));

      for (let i = 0; i < urls.length; i++) {
        const currentEpNum = startEp + i;
        const episodeId = episodesMap.get(currentEpNum);
        
        if (episodeId) {
          const videoRef = doc(collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${episodeId}/videos_serie`));
          batch.set(videoRef, {
            url: urls[i],
            quality,
            server,
            format,
            language,
            createdAt: Date.now()
          });
        } else {
          console.warn(`Episodio ${currentEpNum} no encontrado. Saltando.`);
        }
      }
      await batch.commit();
      alert(`Procesado exitoso. Se añadieron ${urls.length} fuentes.`);
      setIsBatchOpen(false);
    } catch (e) {
      console.error(e);
      alert("Error al procesar lote.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FDFDFF] font-inter">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-100 p-6 flex flex-col space-y-8 sticky top-0 h-screen z-40">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
            <Play fill="currentColor" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800 italic uppercase">Cine<span className="text-indigo-600">Stream</span></h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button onClick={() => { setView('Dashboard'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <LayoutDashboard size={18} /> <span className="text-sm font-bold">Dashboard</span>
          </button>
          <button onClick={() => { setView('Movies'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Movies' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <Film size={18} /> <span className="text-sm font-bold">Películas</span>
          </button>
          <button onClick={() => { setView('Series'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Series' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <Tv size={18} /> <span className="text-sm font-bold">Series</span>
          </button>
        </nav>

        <div className="p-4 bg-indigo-50/50 rounded-3xl border border-indigo-100/50">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Cloud Sync</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight font-medium italic">Sincronizado con Firebase Firestore.</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
              {currentContext ? currentContext.label : (view === 'Dashboard' ? 'Resumen' : view)}
            </h2>
            <div className="mt-1 flex items-center space-x-2">
              <Badge color="slate">Admin Panel</Badge>
              {currentContext && <Badge color="indigo">{currentContext.type}</Badge>}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Buscar títulos..." 
                className="pl-11 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-50 outline-none w-72 shadow-sm transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { setEditItem(null); setIsModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100 flex items-center space-x-2 transition-all active:scale-95"
            >
              <Plus size={18} />
              <span>Añadir {currentContext ? currentContext.type : (view === 'Movies' ? 'Peli' : 'Serie')}</span>
            </button>
          </div>
        </header>

        {/* Navigation Breadcrumbs */}
        {(view === 'Series' || navStack.length > 0) && (
          <nav className="flex items-center space-x-2 text-sm mb-8 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            <button onClick={clearNav} className="hover:text-indigo-600">Home</button>
            {navStack.map((step, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={12} />
                <button onClick={() => popNav(i)} className={i === navStack.length - 1 ? 'text-indigo-600' : 'hover:text-indigo-600'}>
                  {step.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p className="font-black text-xs uppercase tracking-widest">Cargando datos...</p>
          </div>
        ) : (
          <>
            {/* DASHBOARD */}
            {view === 'Dashboard' && !currentContext && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <Film className="text-indigo-600 mb-4" size={32} />
                  <h3 className="text-4xl font-black text-slate-900">{movies.length}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Películas</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <Tv className="text-rose-500 mb-4" size={32} />
                  <h3 className="text-4xl font-black text-slate-900">{seriesList.length}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Series</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <CheckCircle2 className="text-emerald-500 mb-4" size={32} />
                  <h3 className="text-4xl font-black text-slate-900">
                    {movies.filter(m => m.active).length + seriesList.filter(s => s.active).length}
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Activos</p>
                </div>
              </div>
            )}

            {/* MOVIES LIST */}
            {view === 'Movies' && !currentContext && (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-5">Poster</th>
                      <th className="px-8 py-5">Info</th>
                      <th className="px-8 py-5">Rating</th>
                      <th className="px-8 py-5 text-center">Active</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {movies.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-8 py-4 w-24">
                          <img src={m.poster || 'https://via.placeholder.com/150'} className="w-12 h-18 object-cover rounded-xl shadow-lg shadow-indigo-100/20" />
                        </td>
                        <td className="px-8 py-4">
                          <div className="font-bold text-slate-800 text-sm">{m.title}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{m.year} • {m.TMDB_id || 'No TMDB'}</div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center space-x-1 text-amber-500 font-black text-xs">
                            <Star size={12} fill="currentColor" />
                            <span>{m.rating || 0}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <Toggle active={m.active} onToggle={() => toggleActive(m.id, m.active, 'movies')} />
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2 text-slate-300">
                            <button onClick={() => handleNav('movie_videos', m.id, `Videos: ${m.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all" title="Videos"><Layers size={18} /></button>
                            <button onClick={() => { setEditItem(m); setIsModalOpen(true); }} className="p-2 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all" title="Editar"><Edit3 size={18} /></button>
                            <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all" title="Eliminar"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SERIES LIST */}
            {view === 'Series' && !currentContext && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                {seriesList.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                  <div key={s.id} onClick={() => handleNav('series', s.id, s.title)} className="bg-white rounded-[2.5rem] border border-slate-100 p-2 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden">
                    <img src={s.poster || 'https://via.placeholder.com/300'} className="w-full aspect-[2/3] object-cover rounded-[2.2rem] mb-4" />
                    <div className="px-4 pb-4">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{s.title}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <Badge color={s.status === 'ongoing' ? 'emerald' : 'slate'}>{s.status}</Badge>
                        <Toggle active={s.active} onToggle={() => toggleActive(s.id, s.active, 'series')} />
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={(e) => { e.stopPropagation(); setEditItem(s); setIsModalOpen(true); }} className="p-2 bg-white/80 backdrop-blur rounded-xl text-amber-600 shadow-lg"><Edit3 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CONTEXTUAL LISTS (Seasons, Episodes, Videos) */}
            {currentContext && (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">
                     {currentContext.type === 'series' ? 'Temporadas' : currentContext.type === 'season' ? 'Episodios' : 'Fuentes de Video'}
                   </h3>
                   {currentContext.type === 'season' && (
                     <button onClick={() => setIsBatchOpen(true)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center space-x-2">
                       <List size={14} />
                       <span>URLs Lotes</span>
                     </button>
                   )}
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    <tr>
                      {currentContext.type === 'series' && (
                        <>
                          <th className="px-8 py-5">#</th>
                          <th className="px-8 py-5">Nombre</th>
                          <th className="px-8 py-5">Año</th>
                          <th className="px-8 py-5 text-center">Activo</th>
                        </>
                      )}
                      {currentContext.type === 'season' && (
                        <>
                          <th className="px-8 py-5">#</th>
                          <th className="px-8 py-5">Thumbnail</th>
                          <th className="px-8 py-5">Título</th>
                          <th className="px-8 py-5 text-center">Activo</th>
                        </>
                      )}
                      {(currentContext.type === 'episode' || currentContext.type === 'movie_videos') && (
                        <>
                          <th className="px-8 py-5">Servidor</th>
                          <th className="px-8 py-5">Idioma</th>
                          <th className="px-8 py-5">Calidad</th>
                          <th className="px-8 py-5">URL</th>
                        </>
                      )}
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        {currentContext.type === 'series' && (
                          <>
                            <td className="px-8 py-4 font-black text-indigo-600 text-sm">T{item.seasonNumber}</td>
                            <td className="px-8 py-4 font-bold text-slate-800 text-sm">{item.name}</td>
                            <td className="px-8 py-4 text-xs font-bold text-slate-400">{item.year || '-'}</td>
                            <td className="px-8 py-4 text-center">
                               <Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} />
                            </td>
                          </>
                        )}
                        {currentContext.type === 'season' && (
                          <>
                            <td className="px-8 py-4 font-black text-indigo-600 text-sm">E{item.episodeNumber}</td>
                            <td className="px-8 py-4 w-24">
                               <img src={item.thumbnail || 'https://via.placeholder.com/150x84'} className="w-20 h-11 object-cover rounded-lg shadow-sm" />
                            </td>
                            <td className="px-8 py-4 font-bold text-slate-800 text-sm">{item.title}</td>
                            <td className="px-8 py-4 text-center">
                               <Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} />
                            </td>
                          </>
                        )}
                        {(currentContext.type === 'episode' || currentContext.type === 'movie_videos') && (
                          <>
                            <td className="px-8 py-4 font-black text-slate-800 text-xs">{item.server}</td>
                            <td className="px-8 py-4"><Badge color="slate">{item.language}</Badge></td>
                            <td className="px-8 py-4"><Badge color="indigo">{item.quality}</Badge></td>
                            <td className="px-8 py-4 truncate max-w-[200px] text-[10px] font-medium text-indigo-500 underline">{item.url}</td>
                          </>
                        )}
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2 text-slate-300">
                            {currentContext.type === 'series' && (
                               <button onClick={() => handleNav('season', item.id, `T${item.seasonNumber}: ${item.name}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all" title="Episodios"><List size={18} /></button>
                            )}
                            {currentContext.type === 'season' && (
                               <button onClick={() => handleNav('episode', item.id, `E${item.episodeNumber}: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all" title="Fuentes"><Layers size={18} /></button>
                            )}
                            <button onClick={() => { setEditItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"><Edit3 size={16} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-20 text-center">
                          <Info size={32} className="mx-auto text-slate-100 mb-2" />
                          <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">No hay elementos registrados aún.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* --- MODALES --- */}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-fade-in border border-white/20">
            <header className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  {currentContext ? <Layers size={24} /> : (view === 'Movies' ? <Film size={24} /> : <Tv size={24} />)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{editItem ? 'Editar' : 'Añadir'} {currentContext?.type || view}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronización en tiempo real</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditItem(null); }} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-800 shadow-sm">&times;</button>
            </header>

            <form onSubmit={handleAddEdit} className="flex-1 overflow-y-auto p-12 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Campos comunes para Peli/Serie */}
                {(!currentContext) && (
                  <>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Título Principal</label>
                      <div className="flex space-x-2">
                        <input id="form-title" name="title" required defaultValue={editItem?.title} className="flex-1 px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none font-bold" />
                        <button type="button" onClick={autofillAI} disabled={isGenerating} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-100 disabled:opacity-50">
                          {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : <Wand2 size={20} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Título Original</label>
                      <input id="form-title-orig" name="title_original" defaultValue={editItem?.title_original} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Año</label>
                        <input id="form-year" name="year" type="number" defaultValue={editItem?.year} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TMDB ID</label>
                        <input name="TMDB_id" type="number" defaultValue={editItem?.TMDB_id} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rating</label>
                      <input id="form-rating" name="rating" type="number" step="0.1" defaultValue={editItem?.rating} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">YouTube Trailer ID</label>
                      <input name="id_youtube" defaultValue={editItem?.id_youtube} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="v=..." />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Poster URL</label>
                      <input name="poster" defaultValue={editItem?.poster} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sinopsis</label>
                      <textarea id="form-desc" name="description" defaultValue={editItem?.description} className="w-full h-32 px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-medium resize-none" />
                    </div>
                  </>
                )}

                {/* Temporadas */}
                {currentContext?.type === 'series' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Número Temporada</label>
                      <input name="seasonNumber" type="number" required defaultValue={editItem?.seasonNumber} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Personalizado</label>
                      <input name="name" defaultValue={editItem?.name} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="Temporada 1" />
                    </div>
                  </>
                )}

                {/* Episodios */}
                {currentContext?.type === 'season' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"># Episodio</label>
                        <input name="episodeNumber" type="number" required defaultValue={editItem?.episodeNumber} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Duración (min)</label>
                        <input name="duration" type="number" defaultValue={editItem?.duration} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Título Episodio</label>
                      <input name="title" required defaultValue={editItem?.title} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thumbnail URL</label>
                      <input name="thumbnail" defaultValue={editItem?.thumbnail} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                  </>
                )}

                {/* Fuentes de Video (Movie_Videos o Episode_Videos) */}
                {(currentContext?.type === 'episode' || currentContext?.type === 'movie_videos') && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Servidor</label>
                      <input name="server" required defaultValue={editItem?.server} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="Doodstream, Streamtape..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Idioma</label>
                        <select name="language" defaultValue={editItem?.language || 'LAT'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold">
                          <option value="LAT">Latino</option>
                          <option value="ESP">Castellano</option>
                          <option value="SUB">Subtitulado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Calidad</label>
                        <select name="quality" defaultValue={editItem?.quality || '1080p'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold">
                          <option>4K</option>
                          <option>1080p</option>
                          <option>720p</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL del Video</label>
                      <input name="url" required defaultValue={editItem?.url} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                    </div>
                  </>
                )}
              </div>

              <footer className="pt-8 border-t border-slate-50 flex items-center justify-end space-x-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditItem(null); }} className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Cerrar</button>
                <button type="submit" disabled={isSaving} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 flex items-center space-x-2">
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  <span>{editItem ? 'Guardar Cambios' : 'Añadir Item'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal Batch URLs para Episodios */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 animate-fade-in flex flex-col">
            <h3 className="text-2xl font-black text-slate-800 mb-2 italic">Importación por Lotes</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Carga rápida de fuentes para episodios</p>
            
            <form onSubmit={handleBatchProcess} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Episodio Inicio</label>
                  <input name="startEp" type="number" defaultValue={1} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Servidor</label>
                  <input name="server" defaultValue="Streamtape" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Calidad</label>
                   <select name="quality" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none font-bold text-xs">
                     <option>1080p</option>
                     <option>720p</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Idioma</label>
                   <select name="language" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none font-bold text