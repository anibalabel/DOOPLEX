import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Film, Tv, LayoutDashboard, Plus, Search, Bell, Sparkles, Trash2, Edit3, 
  Youtube, Star, ChevronRight, Play, Layers, Settings, ArrowLeft, 
  Calendar, Clock, CheckCircle2, XCircle, MoreVertical, Copy, List, Save, Loader2,
  ExternalLink, Info, Wand2, Eye, EyeOff, LogIn, LogOut, SearchIcon, AlertTriangle, ShieldAlert, Image as ImageIcon, Wand, Tag, Monitor, Hash, Download, RefreshCw
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, orderBy, onSnapshot, setDoc, where, writeBatch, getDoc
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
  TMDB_id?: number;
  createdAt: number;
}

// --- Componentes UI ---

const Badge = ({ children, color = "indigo" }: { children?: React.ReactNode, color?: string }) => {
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
  const [isFetchingSeasons, setIsFetchingSeasons] = useState(false);
  const [isFetchingEpisodes, setIsFetchingEpisodes] = useState(false);
  const [isUpdatingFromTmdb, setIsUpdatingFromTmdb] = useState(false);
  
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
    } catch (e) { 
      console.error("Delete error:", e);
      alert("Error al eliminar."); 
    }
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

  const updateSeasonFromTmdb = async () => {
    if (!editItem) return;
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const currentSeries = seriesList.find(s => s.id === seriesId);
    if (!currentSeries?.TMDB_id) {
      alert("La serie padre no tiene TMDB_id.");
      return;
    }

    setIsUpdatingFromTmdb(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Utilizando la API de TMDB para el programa de TV con ID ${currentSeries.TMDB_id}, obtén los metadatos de la temporada ${editItem.seasonNumber}.
      Para la imagen del banner, utiliza el campo 'backdrop_path' y conviértelo en una URL completa con el formato 'https://image.tmdb.org/t/p/original/PATH'.
      Devuelve solo un objeto JSON con: name, year, banner (URL completa de backdrop_path).`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              year: { type: Type.NUMBER },
              banner: { type: Type.STRING }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.name) {
        const setVal = (name: string, val: any) => {
          const el = document.getElementsByName(name)[0] as HTMLInputElement | HTMLTextAreaElement;
          if (el) el.value = val;
        };
        setVal('name', data.name);
        setVal('year', data.year || editItem.year);
        setVal('banner', data.banner || "");
        setBannerPreviewUrl(data.banner || "");
        alert("Metadatos de temporada actualizados desde TMDB.");
      }
    } catch (e) {
      alert("Error al actualizar temporada desde TMDB.");
    } finally {
      setIsUpdatingFromTmdb(false);
    }
  };

  const updateEpisodeFromTmdb = async () => {
    if (!editItem) return;
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;
    const currentSeries = seriesList.find(s => s.id === seriesId);
    
    if (!currentSeries?.TMDB_id) {
      alert("La serie padre no tiene TMDB_id.");
      return;
    }

    setIsUpdatingFromTmdb(true);
    try {
      const seasonDoc = await getDoc(doc(db, `series/${seriesId}/seasons`, seasonId!));
      const seasonData = seasonDoc.data();
      const seasonNumber = seasonData?.seasonNumber;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Utilizando la API de TMDB para el programa de TV con ID ${currentSeries.TMDB_id}, obtén los metadatos del episodio ${editItem.episodeNumber} de la temporada ${seasonNumber}.
      Para la miniatura, utiliza el campo 'still_path' y conviértelo en una URL completa con el formato 'https://image.tmdb.org/t/p/original/PATH'.
      Devuelve solo un objeto JSON con: title, overview, duration (en minutos), thumbnail (URL completa de still_path).`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              overview: { type: Type.STRING },
              duration: { type: Type.NUMBER },
              thumbnail: { type: Type.STRING }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.title) {
        const setVal = (name: string, val: any) => {
          const el = document.getElementsByName(name)[0] as HTMLInputElement | HTMLTextAreaElement;
          if (el) el.value = val;
        };
        setVal('title', data.title);
        setVal('duration', data.duration || editItem.duration || 0);
        setVal('thumbnail', data.thumbnail || "");
        setVal('overview', data.overview || "");
        setPosterPreviewUrl(data.thumbnail || "");
        alert("Metadatos del episodio actualizados desde TMDB.");
      }
    } catch (e) {
      alert("Error al actualizar episodio desde TMDB.");
    } finally {
      setIsUpdatingFromTmdb(false);
    }
  };

  const fetchEpisodesFromTmdb = async () => {
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    const seasonId = navStack.find(n => n.type === 'season')?.id;
    if (!seriesId || !seasonId) return;

    const currentSeries = seriesList.find(s => s.id === seriesId);
    if (!currentSeries?.TMDB_id) {
        alert("Esta serie no tiene un TMDB_id asignado.");
        return;
    }

    setIsFetchingEpisodes(true);
    try {
      const seasonDoc = await getDoc(doc(db, `series/${seriesId}/seasons`, seasonId));
      if (!seasonDoc.exists()) {
          alert("No se encontró la temporada en la base de datos.");
          return;
      }
      const seasonData = seasonDoc.data();
      const seasonNumber = seasonData.seasonNumber;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Utilizando la API de TMDB para el programa de TV con ID ${currentSeries.TMDB_id}, obtén TODOS los episodios de la temporada ${seasonNumber}. 
      Para la miniatura de cada episodio, utiliza obligatoriamente el campo 'still_path' de TMDB y conviértelo en una URL completa con el formato 'https://image.tmdb.org/t/p/original/PATH'. 
      Si no tiene imagen, deja el campo vacío.
      Devuelve solo un array JSON de objetos con: episodeNumber, title, overview, duration (en minutos), thumbnail (URL completa de la imagen del episodio).`;
      
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
                episodeNumber: { type: Type.NUMBER },
                title: { type: Type.STRING },
                overview: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                thumbnail: { type: Type.STRING }
              },
              required: ["episodeNumber", "title", "thumbnail"]
            }
          }
        }
      });

      const episodes = JSON.parse(response.text || "[]");
      if (episodes.length === 0) {
        alert("No se encontraron episodios para esta temporada.");
        return;
      }

      if (confirm(`Se han encontrado ${episodes.length} episodios. ¿Deseas importarlos todos?`)) {
        const batch = writeBatch(db);
        const episodesColRef = collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`);
        
        episodes.forEach((ep: any) => {
            const epDocRef = doc(episodesColRef);
            batch.set(epDocRef, {
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                overview: ep.overview || "",
                duration: ep.duration || 0,
                thumbnail: ep.thumbnail || "",
                active: true,
                createdAt: Date.now()
            });
        });

        await batch.commit();
        alert("Episodios importados con éxito.");
      }
    } catch (e) {
      console.error("Fetch episodes error:", e);
      alert("Error al obtener episodios.");
    } finally {
      setIsFetchingEpisodes(false);
    }
  };

  const fetchAllSeasonsFromTmdb = async () => {
    const seriesId = navStack.find(n => n.type === 'series')?.id;
    if (!seriesId) return;
    const currentSeries = seriesList.find(s => s.id === seriesId);
    if (!currentSeries?.TMDB_id) {
        alert("Esta serie no tiene un TMDB_id asignado.");
        return;
    }

    setIsFetchingSeasons(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Utilizando la API de TMDB para el programa de TV con ID ${currentSeries.TMDB_id}, obtén todas las temporadas (Season Number, Name, Year, Banner). 
      Para la imagen del banner, utiliza el campo 'backdrop_path' de la temporada y conviértelo en una URL completa con el formato 'https://image.tmdb.org/t/p/original/PATH'.
      Excluye la temporada 0 si es de especiales. Devuelve solo un array JSON de objetos con seasonNumber, name, year, banner.`;
      
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
                seasonNumber: { type: Type.NUMBER },
                name: { type: Type.STRING },
                year: { type: Type.NUMBER },
                banner: { type: Type.STRING }
              },
              required: ["seasonNumber", "name", "banner"]
            }
          }
        }
      });

      const seasons = JSON.parse(response.text || "[]");
      if (seasons.length === 0) {
        alert("No se encontraron temporadas.");
        return;
      }

      if (confirm(`Se han encontrado ${seasons.length} temporadas. ¿Deseas importarlas todas?`)) {
        const batch = writeBatch(db);
        const seasonsColRef = collection(db, `series/${seriesId}/seasons`);
        
        seasons.forEach((s: any) => {
            const seasonDocRef = doc(seasonsColRef);
            batch.set(seasonDocRef, {
                seasonNumber: s.seasonNumber,
                name: s.name,
                year: s.year || currentSeries.year || 0,
                banner: s.banner || "",
                active: true,
                createdAt: Date.now()
            });
        });

        await batch.commit();
        alert("Temporadas importadas con éxito.");
      }
    } catch (e) {
      alert("Error al obtener temporadas.");
    } finally {
      setIsFetchingSeasons(false);
    }
  };

  const searchTmdb = async () => {
    const queryStr = (document.getElementById('tmdb-query') as HTMLInputElement)?.value;
    if (!queryStr) return;
    setIsSearchingTmdb(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Extrae metadatos detallados de TMDB para "${queryStr}". 
      Para las imágenes, utiliza obligatoriamente los campos 'poster_path' y 'backdrop_path' de TMDB y conviértelos en URLs completas con el formato 'https://image.tmdb.org/t/p/original/PATH'. 
      Formato JSON con campos: title, title_original, year, TMDB_id, poster (URL completa), banner (URL completa), description, rating, duration, genres (array de strings), id_youtube (key del video trailer de youtube), status (valor 'ongoing' o 'ended' para series).`;
      
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
    } catch (e) { alert("Error al buscar en TMDB."); }
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-12 border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-[#4f46e5] rounded-3xl flex items-center justify-center text-white shadow-xl mb-6"><Play fill="currentColor" size={32} /></div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Cine<span className="text-[#4f46e5]">Panel</span></h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input name="email" type="email" required placeholder="Admin Email" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-indigo-100 transition-all" />
            <input name="password" type="password" required placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold shadow-inner focus:ring-2 focus:ring-indigo-100 transition-all" />
            {authError && <p className="text-rose-500 text-[10px] font-black text-center uppercase tracking-widest">{authError}</p>}
            <button type="submit" className="w-full py-5 bg-[#4f46e5] text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3 transition-all active:scale-95">
              <LogIn size={20} /> <span>Ingresar</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDFDFF] font-inter">
      {/* Sidebar Redesign matching screenshot */}
      <aside className="w-64 bg-white border-r border-slate-100 p-6 flex flex-col space-y-12 sticky top-0 h-screen z-40">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-12 h-12 bg-[#4f46e5] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <Play fill="currentColor" size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-[#1e293b] italic uppercase">Cine<span className="text-[#4f46e5]">Panel</span></h1>
        </div>
        
        <nav className="flex-1 space-y-4">
          <button onClick={() => { setView('Dashboard'); clearNav(); }} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${view === 'Dashboard' ? 'bg-[#4f46e5] text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] border-2 border-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutDashboard size={20} /> <span className="tracking-tight">Resumen</span>
          </button>
          <button onClick={() => { setView('Movies'); clearNav(); }} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${view === 'Movies' ? 'bg-[#4f46e5] text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] border-2 border-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
            <Film size={20} /> <span className="tracking-tight">Películas</span>
          </button>
          <button onClick={() => { setView('Series'); clearNav(); }} className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${view === 'Series' ? 'bg-[#4f46e5] text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] border-2 border-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}>
            <Tv size={20} /> <span className="tracking-tight">Series</span>
          </button>
        </nav>
        
        <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center space-x-4 px-5 py-4 rounded-2xl text-[#f87171] hover:bg-rose-50 font-bold text-sm transition-colors">
          <LogOut size={20} /> <span>Salir</span>
        </button>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto relative">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-[42px] font-black text-slate-900 tracking-tighter leading-tight">
              {currentContext ? currentContext.label : (view === 'Movies' ? 'Películas' : view === 'Series' ? 'Series TV' : 'Dashboard')}
            </h2>
            {currentContext ? (
               <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs font-black text-[#4f46e5] uppercase tracking-[0.1em]">{currentContext.label.toUpperCase()}</span>
               </div>
            ) : (
               <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Administrador de Contenidos</p>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <input type="text" placeholder="Filtrar por nombre..." className="px-6 py-4 bg-white border border-slate-100 rounded-3xl text-sm outline-none w-80 shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            
            {currentContext?.type === 'series' && (
              <button 
                onClick={fetchAllSeasonsFromTmdb} 
                disabled={isFetchingSeasons}
                className="bg-[#10141d] text-white px-8 py-4 rounded-3xl font-black text-xs flex items-center space-x-3 shadow-2xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
              >
                {isFetchingSeasons ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>Fetch All Seasons</span>
              </button>
            )}

            {currentContext?.type === 'season' && (
              <button 
                onClick={fetchEpisodesFromTmdb} 
                disabled={isFetchingEpisodes}
                className="bg-[#10141d] text-white px-8 py-4 rounded-3xl font-black text-xs flex items-center space-x-3 shadow-2xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
              >
                {isFetchingEpisodes ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>Fetch Episodes</span>
              </button>
            )}

            <button onClick={() => openModal()} className="bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] text-white px-8 py-4 rounded-3xl font-black text-xs flex items-center space-x-3 shadow-xl shadow-indigo-100 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest">
              <Plus size={18} /> <span>Añadir</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 text-slate-200"><Loader2 size={64} className="animate-spin mb-6" /><p className="font-black text-[12px] uppercase tracking-[0.3em]">Cargando recursos...</p></div>
        ) : (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
            <table className="w-full text-left">
              <thead className="bg-[#fcfcfd] border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <tr>
                  {currentContext?.type !== 'series' && <th className="px-10 py-7">Recurso</th>}
                  {currentContext?.type === 'series' && <th className="px-10 py-7">Recurso</th>}
                  <th className="px-10 py-7">Info</th>
                  <th className="px-10 py-7 text-center">Estado</th>
                  <th className="px-10 py-7 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(currentContext ? items : (view === 'Movies' ? movies : seriesList)).filter(i => (i.title || i.name || "").toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                  <tr key={item.id} className="hover:bg-[#fafbff]/50 transition-colors group">
                    {currentContext?.type !== 'series' ? (
                       <td className="px-10 py-6 w-32">
                         <div className="w-14 h-20 rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50">
                           <img src={item.poster || item.thumbnail || 'https://via.placeholder.com/300x450'} className="w-full h-full object-cover" />
                         </div>
                       </td>
                    ) : (
                      <td className="px-10 py-6 w-32">
                        <div className="w-12 h-12 rounded-xl bg-slate-100/50 border border-slate-200/50"></div>
                      </td>
                    )}
                    
                    <td className="px-10 py-6">
                      <div className="font-extrabold text-[#1e293b] text-lg tracking-tight">{item.title || item.name || `Episodio ${item.episodeNumber}`}</div>
                      <div className="flex items-center space-x-3 mt-1.5">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{item.year || item.server || (item.episodeNumber ? `Episodio ${item.episodeNumber}` : 'N/A')}</span>
                        {item.status && <Badge color={item.status === 'ongoing' ? 'emerald' : 'slate'}>{item.status}</Badge>}
                        {item.TMDB_id && <Badge color="indigo">TMDB {item.TMDB_id}</Badge>}
                      </div>
                    </td>
                    
                    <td className="px-10 py-6 text-center">
                      <div className="flex justify-center scale-110">
                        <Toggle active={item.active} onToggle={() => toggleActive(item.id, item.active)} />
                      </div>
                    </td>
                    
                    <td className="px-10 py-6 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        {view === 'Movies' && !currentContext && <button onClick={() => handleNav('movie_videos', item.id, item.title)} className="p-3 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all" title="Servidores"><Layers size={20} /></button>}
                        {view === 'Series' && !currentContext && <button onClick={() => handleNav('series', item.id, item.title)} className="p-3 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all" title="Temporadas"><List size={20} /></button>}
                        {currentContext?.type === 'series' && <button onClick={() => handleNav('season', item.id, item.name)} className="p-3 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all" title="Episodios"><List size={20} /></button>}
                        {currentContext?.type === 'season' && <button onClick={() => handleNav('episode', item.id, item.title || `Episodio ${item.episodeNumber}`)} className="p-3 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all" title="Servidores"><Layers size={20} /></button>}
                        <button onClick={() => openModal(item)} className="p-3 hover:bg-slate-100 hover:text-[#4f46e5] rounded-2xl transition-all" title="Editar"><Edit3 size={20} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-3 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all" title="Eliminar"><Trash2 size={20} /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0f172a]/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-7xl max-h-[94vh] rounded-[4rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden flex border border-white/20">
            {/* Sidebar Preview */}
            <div className="w-80 bg-[#f8fafc] border-r border-slate-100 flex flex-col p-10 items-center overflow-y-auto">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Vista Previa</h4>
               <div className="w-full aspect-[3/4] rounded-[2.5rem] bg-white shadow-2xl overflow-hidden flex items-center justify-center relative border border-slate-200/50">
                  {posterPreviewUrl ? <img src={posterPreviewUrl} className="w-full h-full object-cover" /> : <ImageIcon size={64} className="text-slate-200" />}
                  {isGeneratingPoster && <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-md flex items-center justify-center"><Loader2 className="animate-spin text-white" size={40} /></div>}
               </div>
               <div className="w-full aspect-[16/9] mt-10 rounded-3xl bg-white shadow-xl overflow-hidden flex items-center justify-center relative border border-slate-200/50">
                  {bannerPreviewUrl ? <img src={bannerPreviewUrl} className="w-full h-full object-cover" /> : <Monitor size={40} className="text-slate-200" />}
               </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              <header className="px-12 py-10 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{editItem ? 'Editando' : 'Añadir Nuevo'} {currentContext?.type || (view === 'Movies' ? 'Película' : 'Serie')}</h3>
                  <div className="mt-1"><Badge color="indigo">{currentContext?.type ? currentContext.type.toUpperCase() : 'ROOT'}</Badge></div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-all hover:rotate-90">&times;</button>
              </header>

              <form onSubmit={handleAddEdit} className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                
                {/* --- EDITOR DE PELÍCULAS --- */}
                {view === 'Movies' && !currentContext && (
                  <div className="space-y-12">
                    {!editItem && (
                      <div className="p-10 bg-indigo-50/20 rounded-[3rem] border border-indigo-100/30">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-5 block">Inteligencia TMDB (Búsqueda)</label>
                        <div className="flex space-x-3">
                          <input id="tmdb-query" placeholder="Buscar título de película..." className="flex-1 px-8 py-5 bg-white border border-indigo-50 rounded-3xl outline-none font-bold" />
                          <button type="button" onClick={searchTmdb} disabled={isSearchingTmdb} className="px-10 bg-[#4f46e5] text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 active:scale-95 shadow-xl shadow-indigo-100">
                            {isSearchingTmdb ? <Loader2 className="animate-spin" size={18} /> : <SearchIcon size={18} />}
                            <span>Buscar</span>
                          </button>
                        </div>
                        {tmdbSearchResults.length > 0 && (
                          <div className="grid grid-cols-3 gap-6 mt-8">
                            {tmdbSearchResults.map((res, i) => (
                              <div key={i} onClick={() => selectTmdbResult(res)} className="p-4 bg-white rounded-[2rem] shadow-sm hover:shadow-xl cursor-pointer border border-indigo-50/50 transition-all flex items-center space-x-4 group active:scale-95">
                                <img src={res.poster} className="w-12 h-18 object-cover rounded-xl shadow-sm" />
                                <div className="flex-1 min-w-0"><h5 className="font-bold text-slate-900 text-xs truncate group-hover:text-[#4f46e5]">{res.title}</h5><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{res.year}</p></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Título de Película</label><input name="title" required defaultValue={editItem?.title} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-lg" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nombre Original</label><input name="title_original" defaultValue={editItem?.title_original} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Año</label><input name="year" type="number" defaultValue={editItem?.year} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Rating</label><input name="rating" type="number" step="0.1" defaultValue={editItem?.rating} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      </div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Géneros (Separados por coma)</label><input name="genres" defaultValue={(editItem?.genres || []).join(', ')} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL Póster</label><input name="poster" defaultValue={editItem?.poster} onChange={(e) => setPosterPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL Banner</label><input name="banner" defaultValue={editItem?.banner} onChange={(e) => setBannerPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">ID Youtube (Trailer)</label><input name="id_youtube" defaultValue={editItem?.id_youtube} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">TMDB ID</label><input name="TMDB_id" type="number" defaultValue={editItem?.TMDB_id} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Sinopsis</label><textarea name="description" defaultValue={editItem?.description} className="w-full h-40 px-10 py-8 bg-slate-50 border-none rounded-[3rem] outline-none font-medium text-slate-700 resize-none leading-relaxed" /></div>
                    </div>
                  </div>
                )}

                {/* --- EDITOR DE SERIES --- */}
                {view === 'Series' && !currentContext && (
                  <div className="space-y-12">
                    {!editItem && (
                      <div className="p-10 bg-indigo-50/20 rounded-[3rem] border border-indigo-100/30">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-5 block">Inteligencia TMDB (Búsqueda)</label>
                        <div className="flex space-x-3">
                          <input id="tmdb-query" placeholder="Buscar título de serie..." className="flex-1 px-8 py-5 bg-white border border-indigo-50 rounded-3xl outline-none font-bold" />
                          <button type="button" onClick={searchTmdb} disabled={isSearchingTmdb} className="px-10 bg-[#4f46e5] text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 active:scale-95 shadow-xl shadow-indigo-100">
                            {isSearchingTmdb ? <Loader2 className="animate-spin" size={18} /> : <SearchIcon size={18} />}
                            <span>Buscar</span>
                          </button>
                        </div>
                        {tmdbSearchResults.length > 0 && (
                          <div className="grid grid-cols-3 gap-6 mt-8">
                            {tmdbSearchResults.map((res, i) => (
                              <div key={i} onClick={() => selectTmdbResult(res)} className="p-4 bg-white rounded-[2rem] shadow-sm hover:shadow-xl cursor-pointer border border-indigo-50/50 transition-all flex items-center space-x-4 group active:scale-95">
                                <img src={res.poster} className="w-12 h-18 object-cover rounded-xl shadow-sm" />
                                <div className="flex-1 min-w-0"><h5 className="font-bold text-slate-900 text-xs truncate group-hover:text-[#4f46e5]">{res.title}</h5><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{res.year}</p></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Título de Serie</label><input name="title" required defaultValue={editItem?.title} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-lg" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nombre Original</label><input name="title_original" defaultValue={editItem?.title_original} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Año</label><input name="year" type="number" defaultValue={editItem?.year} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Rating</label><input name="rating" type="number" step="0.1" defaultValue={editItem?.rating} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Estado</label>
                        <select name="status" defaultValue={editItem?.status || 'ongoing'} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold appearance-none">
                          <option value="ongoing">En Emisión</option>
                          <option value="ended">Finalizada</option>
                        </select>
                      </div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">TMDB ID</label><input name="TMDB_id" type="number" defaultValue={editItem?.TMDB_id} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL Póster</label><input name="poster" defaultValue={editItem?.poster} onChange={(e) => setPosterPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL Banner</label><input name="banner" defaultValue={editItem?.banner} onChange={(e) => setBannerPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Sinopsis</label><textarea name="description" defaultValue={editItem?.description} className="w-full h-40 px-10 py-8 bg-slate-50 border-none rounded-[3rem] outline-none font-medium text-slate-700 resize-none leading-relaxed" /></div>
                    </div>
                  </div>
                )}

                {/* --- EDITOR DE TEMPORADAS --- */}
                {currentContext?.type === 'series' && (
                  <div className="space-y-12">
                    {editItem && (
                      <div className="flex justify-end">
                        <button type="button" onClick={updateSeasonFromTmdb} disabled={isUpdatingFromTmdb} className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 active:scale-95 shadow-xl shadow-indigo-100 disabled:opacity-50">
                          {isUpdatingFromTmdb ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                          <span>Actualizar desde TMDB</span>
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Título de Temporada</label><input name="name" defaultValue={editItem?.name} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-lg" placeholder="Ejem: Temporada 1" /></div>
                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nº de Orden (Season #)</label><input name="seasonNumber" type="number" defaultValue={editItem?.seasonNumber} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Año</label><input name="year" type="number" defaultValue={editItem?.year} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      </div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL del Banner (Temporada)</label><input name="banner" defaultValue={editItem?.banner} onChange={(e) => setBannerPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-indigo-500 text-xs" placeholder="https://image.tmdb.org/..." /></div>
                    </div>
                  </div>
                )}

                {/* --- EDITOR DE EPISODIOS --- */}
                {currentContext?.type === 'season' && (
                  <div className="space-y-12">
                    {editItem && (
                      <div className="flex justify-end">
                        <button type="button" onClick={updateEpisodeFromTmdb} disabled={isUpdatingFromTmdb} className="px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 active:scale-95 shadow-xl shadow-indigo-100 disabled:opacity-50">
                          {isUpdatingFromTmdb ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                          <span>Actualizar desde TMDB</span>
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Título del Episodio</label><input name="title" defaultValue={editItem?.title} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-lg" /></div>
                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Número Episodio #</label><input name="episodeNumber" type="number" defaultValue={editItem?.episodeNumber} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Duración (min)</label><input name="duration" type="number" defaultValue={editItem?.duration} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      </div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL Miniatura (still_path)</label><input name="thumbnail" defaultValue={editItem?.thumbnail} onChange={(e) => setPosterPreviewUrl(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-indigo-500 text-xs" /></div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Sinopsis Episodio</label><textarea name="overview" defaultValue={editItem?.overview} className="w-full h-40 px-10 py-8 bg-slate-50 border-none rounded-[3rem] outline-none font-medium text-slate-700 resize-none leading-relaxed" /></div>
                    </div>
                  </div>
                )}

                {/* --- EDITOR DE SERVIDORES (VIDEOS) --- */}
                {(currentContext?.type === 'episode' || currentContext?.type === 'movie_videos') && (
                  <div className="space-y-12">
                    <div className="grid grid-cols-2 gap-8">
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nombre Servidor</label><input name="server" required defaultValue={editItem?.server} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Idioma</label><input name="language" defaultValue={editItem?.language || 'LAT'} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                        <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Calidad</label><input name="quality" defaultValue={editItem?.quality || '1080p'} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                      </div>
                      <div className="col-span-full"><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">URL del Video (Embed)</label><input name="url" required defaultValue={editItem?.url} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold text-indigo-500 font-mono text-sm" /></div>
                      <div><label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Formato</label><input name="format" defaultValue={editItem?.format || 'embed'} className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl outline-none font-bold" /></div>
                    </div>
                  </div>
                )}

                <footer className="pt-10 flex justify-end space-x-6 border-t border-slate-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-800 transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="px-14 py-5 bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center space-x-3 shadow-indigo-200 transition-all hover:scale-105 active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    <span>Confirmar y Guardar</span>
                  </button>
                </footer>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK URLS */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#0f172a]/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl p-14 border border-white/20">
            <h3 className="text-3xl font-black text-slate-900 mb-2 italic tracking-tighter">Importación Masiva</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-10">Generación automática de fuentes para episodios</p>
            <form onSubmit={handleBatchProcess} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Episodio de Inicio</label>
                  <input name="startEp" type="number" defaultValue={1} className="w-full px-8 py-5 bg-slate-50 rounded-3xl outline-none font-bold shadow-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Nombre del Servidor</label>
                  <input name="server" defaultValue="Streamtape" className="w-full px-8 py-5 bg-slate-50 rounded-3xl outline-none font-bold shadow-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Lista de URLs (Una por línea)</label>
                <textarea name="urls" required className="w-full h-52 px-8 py-6 bg-slate-50 border-none rounded-[2.5rem] outline-none font-medium text-xs resize-none shadow-sm leading-relaxed" placeholder="https://..." />
              </div>
              <div className="flex space-x-5 pt-4">
                <button type="button" onClick={() => setIsBatchOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-xs uppercase tracking-widest transition-colors hover:text-slate-600">Cerrar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-[#4f46e5] text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3 active:scale-95 shadow-indigo-100">
                   {isSaving ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
                   <span>Procesar Ahora</span>
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
