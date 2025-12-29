
import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Film, Tv, LayoutDashboard, Plus, Search, Bell, Sparkles, Trash2, Edit3, 
  Youtube, Star, ChevronRight, Play, Layers, Settings, ArrowLeft, 
  Calendar, Clock, CheckCircle2, XCircle, MoreVertical, Copy, List, Save, Loader2,
  ExternalLink, Info, Wand2, Eye, EyeOff, LogIn, LogOut, SearchIcon, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, orderBy, onSnapshot, setDoc, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Configuración de Firebase (Actualizada con credenciales reales) ---
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
  poster?: string;
  description?: string;
  rating?: number;
  active: boolean;
  createdAt: number;
}

interface Series {
  id: string;
  title: string;
  title_original?: string;
  status: "ongoing" | "ended";
  // Added year to Series to fix TS error when accessing item.year in Movie | Series union
  year?: number;
  active: boolean;
  poster?: string;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);

  const currentContext = navStack[navStack.length - 1];

  // --- Auth Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const email = fd.get('email');
    const password = fd.get('password');

    // Validación simple para acceder al panel
    if (email === 'basurtobaque@gmail.com' && password) {
      setIsAuthenticated(true);
      setAuthError("");
    } else if (email !== 'basurtobaque@gmail.com') {
      setAuthError("Email no autorizado.");
    } else {
      setAuthError("Contraseña requerida.");
    }
  };

  // --- Firestore Data Fetching with Error Handling ---
  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setConfigError(null);

    const handleError = (err: any) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') {
        setConfigError("Permiso denegado en Firestore (yupi-e9be3). Verifica las Reglas de Seguridad.");
      } else {
        setConfigError("Error al conectar con Firestore. Revisa tu conexión.");
      }
      setLoading(false);
    };

    const unsubMovies = onSnapshot(query(collection(db, "movies"), orderBy("createdAt", "desc")), 
      (snap) => {
        setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
        setLoading(false);
      }, 
      handleError
    );

    const unsubSeries = onSnapshot(query(collection(db, "series"), orderBy("createdAt", "desc")), 
      (snap) => {
        setSeriesList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Series)));
      }, 
      handleError
    );

    return () => { unsubMovies(); unsubSeries(); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!currentContext || !isAuthenticated) {
      setItems([]);
      return;
    }
    
    let q;
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;

    if (currentContext.type === 'series') {
      q = query(collection(db, `series/${currentContext.id}/seasons`), orderBy("seasonNumber", "asc"));
    } else if (currentContext.type === 'season') {
      q = query(collection(db, `series/${seriesId}/seasons/${currentContext.id}/episodes`), orderBy("episodeNumber", "asc"));
    } else if (currentContext.type === 'episode') {
      q = collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${currentContext.id}/videos_serie`);
    } else if (currentContext.type === 'movie_videos') {
      q = collection(db, `movies/${currentContext.id}/videos_movies`);
    }

    if (q) {
      return onSnapshot(q, 
        (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Subcollection error:", err)
      );
    }
  }, [currentContext, navStack, isAuthenticated]);

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

  const handleNav = (type: string, id: string, label: string) => setNavStack([...navStack, { type, id, label }]);
  const popNav = (index: number) => setNavStack(navStack.slice(0, index + 1));
  const clearNav = () => setNavStack([]);

  const toggleActive = async (id: string, currentStatus: boolean, collectionName?: string) => {
    try {
      let path = collectionName || (currentContext ? getFirestorePath() : (view === 'Movies' ? 'movies' : 'series'));
      await updateDoc(doc(db, path, id), { active: !currentStatus });
    } catch (e) { alert("Error de permisos al actualizar en Firestore."); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar este elemento?")) return;
    try {
      const path = currentContext ? getFirestorePath() : (view === 'Movies' ? 'movies' : 'series');
      await deleteDoc(doc(db, path, id));
    } catch (e) { alert("Error de permisos al eliminar en Firestore."); }
  };

  const handleAddEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const data: any = {};
    fd.forEach((value, key) => {
      if (['year', 'TMDB_id', 'rating', 'seasonNumber', 'episodeNumber', 'duration'].includes(key)) {
        data[key] = Number(value);
      } else if (['active', 'sidebar'].includes(key)) {
        data[key] = value === 'on';
      } else {
        data[key] = value;
      }
    });

    try {
      const path = currentContext ? getFirestorePath() : (view === 'Movies' ? 'movies' : 'series');
      if (editItem) {
        await updateDoc(doc(db, path, editItem.id), data);
      } else {
        data.active = data.active ?? true;
        data.createdAt = Date.now();
        await addDoc(collection(db, path), data);
      }
      setIsModalOpen(false);
      setEditItem(null);
      setTmdbSearchResults([]);
    } catch (err) {
      console.error(err);
      alert("Error al guardar: Posible fallo de reglas de seguridad en Firestore.");
    } finally { setIsSaving(false); }
  };

  const handleBatchProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const startEp = Number(fd.get('startEp'));
    const server = fd.get('server') as string;
    const quality = fd.get('quality') as string;
    const language = fd.get('language') as string;
    const format = fd.get('format') as string;
    const urlsStr = fd.get('urls') as string;
    const urls = urlsStr.split('\n').map(u => u.trim()).filter(u => u !== '');

    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;

    if (!seriesId || !seasonId) { alert("Contexto inválido."); setIsSaving(false); return; }

    try {
      const batch = writeBatch(db);
      for (let i = 0; i < urls.length; i++) {
        const targetEpNum = startEp + i;
        const targetEp = items.find(item => item.episodeNumber === targetEpNum);
        if (targetEp) {
          const videoRef = doc(collection(db, `series/${seriesId}/seasons/${seasonId}/episodes/${targetEp.id}/videos_serie`));
          batch.set(videoRef, {
            url: urls[i],
            server,
            quality,
            language,
            format,
            createdAt: Date.now(),
            active: true
          });
        }
      }
      await batch.commit();
      setIsBatchOpen(false);
      alert("Procesado por lote exitoso.");
    } catch (err) {
      alert("Fallo al ejecutar el lote. Revisa las reglas de seguridad.");
    } finally { setIsSaving(false); }
  };

  const searchTmdb = async () => {
    const queryStr = (document.getElementById('tmdb-query') as HTMLInputElement)?.value;
    if (!queryStr) return;
    setIsSearchingTmdb(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Simula una búsqueda en TMDB para "${queryStr}". Genera 3 resultados realistas en español.`;
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
                description: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                title_original: { type: Type.STRING }
              },
              required: ["title", "year", "TMDB_id", "poster"]
            }
          }
        } 
      });
      const data = JSON.parse(response.text || "[]");
      setTmdbSearchResults(data);
    } catch (e) { alert("Error al conectar con el servicio de metadatos."); }
    finally { setIsSearchingTmdb(false); }
  };

  const selectTmdbResult = (res: any) => {
    const setVal = (name: string, val: any) => {
      const el = document.getElementsByName(name)[0] as HTMLInputElement | HTMLTextAreaElement;
      if (el) el.value = val;
    };
    setVal('title', res.title);
    setVal('title_original', res.title_original || res.title);
    setVal('year', res.year);
    setVal('TMDB_id', res.TMDB_id);
    setVal('rating', res.rating);
    setVal('poster', res.poster);
    setVal('description', res.description);
    setTmdbSearchResults([]);
  };

  // --- Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100 animate-fade-in">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 mb-6 rotate-3">
              <Play fill="currentColor" size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Cine<span className="text-indigo-600">Stream</span></h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Panel de Administración</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Email</label>
              <input name="email" type="email" required placeholder="admin@cinestream.com" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Contraseña</label>
              <input name="password" type="password" required placeholder="••••••••" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 transition-all" />
            </div>
            {authError && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-widest text-center">{authError}</p>}
            <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center space-x-3 transition-all active:scale-95">
              <LogIn size={20} />
              <span>Acceder al Panel</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          <button onClick={() => { setView('Dashboard'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <LayoutDashboard size={18} /> <span className="text-sm font-bold">Dashboard</span>
          </button>
          <button onClick={() => { setView('Movies'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Movies' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <Film size={18} /> <span className="text-sm font-bold">Películas</span>
          </button>
          <button onClick={() => { setView('Series'); clearNav(); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all ${view === 'Series' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'}`}>
            <Tv size={18} /> <span className="text-sm font-bold">Series</span>
          </button>
        </nav>

        <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-rose-400 hover:bg-rose-50 transition-all font-bold text-sm">
          <LogOut size={18} /> <span>Cerrar Sesión</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto relative">
        {/* Error Overlay (Solo si las reglas de Firestore fallan) */}
        {configError && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-xl flex items-center justify-center p-12">
            <div className="max-w-xl w-full bg-white rounded-[3.5rem] shadow-2xl p-12 border border-rose-100 flex flex-col items-center text-center animate-fade-in">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
                <ShieldAlert size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter">Firestore: Reglas de Seguridad</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                El proyecto <strong>yupi-e9be3</strong> tiene denegado el acceso. 
                <br /><br />
                Solución: Ve a <strong>Firebase Console > Cloud Firestore > Rules</strong> y activa los permisos de lectura/escritura.
              </p>
              <div className="bg-slate-50 p-6 rounded-2xl w-full text-left font-mono text-[10px] text-slate-500 mb-8 border border-slate-100">
                <code className="block">service cloud.firestore {"{"}</code>
                <code className="block ml-2">match /databases/{"{"}database{"}"}/documents {"{"}</code>
                <code className="block ml-4">match /{"{"}document=**{"}"} {"{"}</code>
                <code className="block ml-6 text-indigo-500">allow read, write: if true;</code>
                <code className="block ml-4">{"}"}</code>
                <code className="block ml-2">{"}"}</code>
                <code className="block">{"}"}</code>
              </div>
              <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all">
                He actualizado las reglas, reintentar
              </button>
            </div>
          </div>
        )}

        <header className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{currentContext ? currentContext.label : view}</h2>
            <div className="mt-1 flex items-center space-x-2">
              <Badge color="slate">Admin Panel</Badge>
              {currentContext && <Badge color="indigo">{currentContext.type}</Badge>}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Filtrar por nombre..." className="pl-11 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm outline-none w-72 shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={() => { setEditItem(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl flex items-center space-x-2 transition-all active:scale-95 shadow-indigo-200">
              <Plus size={18} /> <span>Añadir Nuevo</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-200"><Loader2 size={48} className="animate-spin mb-4" /><p className="font-black text-[10px] uppercase tracking-widest">Sincronizando yupi-e9be3...</p></div>
        ) : (
          <>
            {view === 'Dashboard' && !currentContext && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"><Film className="text-indigo-600 mb-4" size={32} /><h3 className="text-4xl font-black text-slate-900">{movies.length}</h3><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Películas</p></div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"><Tv className="text-rose-500 mb-4" size={32} /><h3 className="text-4xl font-black text-slate-900">{seriesList.length}</h3><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Series</p></div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm"><CheckCircle2 className="text-emerald-500 mb-4" size={32} /><h3 className="text-4xl font-black text-slate-900">{movies.filter(m => m.active).length + seriesList.filter(s => s.active).length}</h3><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Activos</p></div>
              </div>
            )}

            {(view === 'Movies' || view === 'Series') && !currentContext && (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    <tr><th className="px-8 py-5">Vista Previa</th><th className="px-8 py-5">Título / Año</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 text-center">Estado</th><th className="px-8 py-5 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(view === 'Movies' ? movies : seriesList).filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-8 py-4 w-24"><img src={item.poster || 'https://via.placeholder.com/300x450'} className="w-12 h-18 object-cover rounded-xl shadow-lg" /></td>
                        <td className="px-8 py-4"><div className="font-bold text-slate-800 text-sm">{item.title}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.year}</div></td>
                        <td className="px-8 py-4">{view === 'Movies' ? <Badge color="indigo">Película</Badge> : <Badge color="amber">Serie</Badge>}</td>
                        <td className="px-8 py-4 text-center"><Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} /></td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2 text-slate-300">
                            {view === 'Movies' && <button onClick={() => handleNav('movie_videos', item.id, `Vídeos: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"><Layers size={18} /></button>}
                            {view === 'Series' && <button onClick={() => handleNav('series', item.id, `Temporadas: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"><List size={18} /></button>}
                            <button onClick={() => { setEditItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"><Edit3 size={18} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {currentContext && (
              <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Gestión de {currentContext.type}</h3>
                   {currentContext.type === 'season' && <button onClick={() => setIsBatchOpen(true)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center space-x-2"><List size={14} /><span>Batch URLs</span></button>}
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-5">Nombre/Info</th>
                      <th className="px-8 py-5">Atributos</th>
                      <th className="px-8 py-5 text-center">Estado</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-8 py-4 font-bold text-slate-800">{item.title || item.name || `Episodio ${item.episodeNumber}`}</td>
                        <td className="px-8 py-4"><Badge color="slate">{item.server || item.year || 'N/A'}</Badge></td>
                        <td className="px-8 py-4 text-center"><Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} /></td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2 text-slate-300">
                            {currentContext.type === 'series' && <button onClick={() => handleNav('season', item.id, `T${item.seasonNumber}: ${item.name}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"><List size={18} /></button>}
                            {currentContext.type === 'season' && <button onClick={() => handleNav('episode', item.id, `E${item.episodeNumber}: ${item.title}`)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"><Layers size={18} /></button>}
                            <button onClick={() => { setEditItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"><Edit3 size={16} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={10} className="py-20 text-center"><Info size={32} className="mx-auto text-slate-100 mb-2" /><p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">No hay registros</p></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL EDITOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <header className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                   <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{editItem ? 'Editar' : 'Añadir'} Contenido</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PROYECTO: YUPI-E9BE3</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditItem(null); setTmdbSearchResults([]); }} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400">&times;</button>
            </header>

            <form onSubmit={handleAddEdit} className="flex-1 overflow-y-auto p-12 space-y-8">
               {!currentContext && !editItem && (
                 <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                   <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Autocompletar vía TMDB (Simulado)</label>
                   <div className="flex space-x-2">
                     <input id="tmdb-query" placeholder="Escribe el nombre de la película o serie..." className="flex-1 px-6 py-4 bg-white border-none rounded-2xl outline-none font-bold shadow-sm" />
                     <button type="button" onClick={searchTmdb} disabled={isSearchingTmdb} className="px-8 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 shadow-lg shadow-indigo-100">
                       {isSearchingTmdb ? <Loader2 className="animate-spin" size={16} /> : <SearchIcon size={16} />}
                       <span>Buscar</span>
                     </button>
                   </div>
                   {tmdbSearchResults.length > 0 && (
                     <div className="grid grid-cols-3 gap-4 mt-6">
                       {tmdbSearchResults.map((res, i) => (
                         <div key={i} onClick={() => selectTmdbResult(res)} className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer border border-indigo-50 transition-all flex flex-col items-center">
                           <img src={res.poster} className="w-full h-32 object-cover rounded-xl mb-2" />
                           <h5 className="font-bold text-slate-800 text-[10px] text-center line-clamp-1">{res.title}</h5>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               )}

              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Título</label>
                  <input name="title" required defaultValue={editItem?.title} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" />
                </div>
                {!currentContext && (
                   <>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Año</label><input name="year" type="number" defaultValue={editItem?.year} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Calificación (0-10)</label><input name="rating" type="number" step="0.1" defaultValue={editItem?.rating} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Poster URL</label><input name="poster" defaultValue={editItem?.poster} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Descripción / Sinopsis</label><textarea name="description" defaultValue={editItem?.description} className="w-full h-32 px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-medium resize-none" /></div>
                   </>
                )}
                {['episode', 'movie_videos'].includes(currentContext?.type || '') && (
                  <>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Servidor</label><input name="server" required defaultValue={editItem?.server} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" placeholder="ej. Streamtape" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Idioma</label><input name="language" required defaultValue={editItem?.language || 'LAT'} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                    <div className="col-span-full"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Video URL</label><input name="url" required defaultValue={editItem?.url} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                  </>
                )}
              </div>

              <footer className="pt-8 border-t border-slate-50 flex justify-end space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Descartar</button>
                <button type="submit" disabled={isSaving} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center space-x-2 shadow-indigo-100">
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  <span>Guardar Datos</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* BATCH UPLOAD MODAL */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 flex flex-col border border-white/20">
            <h3 className="text-2xl font-black text-slate-800 mb-2 italic">Carga Rápida (Bulk)</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Pega múltiples URLs para asignar a episodios secuenciales</p>
            <form onSubmit={handleBatchProcess} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Inicio en Episodio #</label><input name="startEp" type="number" defaultValue={1} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Servidor Global</label><input name="server" defaultValue="Streamtape" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" /></div>
              </div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">URLs (Una por línea)</label><textarea name="urls" required className="w-full h-40 px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-medium text-[10px] resize-none leading-relaxed" placeholder="https://streamtape.com/v/..." /></div>
              <div className="mt-4 flex space-x-4">
                <button type="button" onClick={() => setIsBatchOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2">
                  {isSaving ? <Loader2 className="animate-spin" /> : <Plus size={16} />}
                  <span>Procesar URLs</span>
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
