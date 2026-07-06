import React, { useState, useEffect, useRef } from 'react';
import { Home, Plus, Save, Play, Pause, FileText, Maximize, Minimize, Upload, MessagesSquare } from 'lucide-react';

interface Bot {
  name: string;
  bio: string;
  userMemory: string;
}

interface Message {
  role: 'system' | 'user' | 'ai';
  text: string;
  hidden: boolean;
  botName?: string;
}

interface AppState {
  initialized: boolean;
  bots: Bot[];
  messages: Message[];
  lastInteraction: number;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    initialized: false,
    bots: [],
    messages: [],
    lastInteraction: Date.now()
  });
  
  // Use a ref to access the latest state in async functions (like loops)
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const [activeScreen, setActiveScreen] = useState<'home' | 'create' | 'chat'>('home');
  const [autochatActive, setAutochatActive] = useState(false);
  const autochatActiveRef = useRef(false);
  useEffect(() => {
    autochatActiveRef.current = autochatActive;
  }, [autochatActive]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [moderatorEnabled, setModeratorEnabled] = useState(false);
  const [modTheme, setModTheme] = useState("Exploración tecnológica");
  const messagesSinceLastModeration = useRef(0);

  const [toast, setToast] = useState({ visible: false, message: '', isError: false });
  const [chatInput, setChatInput] = useState('');
  
  const currentBotTurnIndex = useRef(-1);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ visible: true, message, isError });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (activeScreen === 'chat') {
      scrollToBottom();
    }
  }, [appState.messages, activeScreen]);

  // File loading logic
  const parseFileContent = (content: string) => {
    try {
      return JSON.parse(content);
    } catch (e) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const stateTag = doc.getElementById('character-state');
      if (stateTag) {
        return JSON.parse(stateTag.textContent || '{}');
      }
      throw new Error("Invalid format");
    }
  };

  const handleWakeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loadedState = parseFileContent(ev.target?.result as string);
        let newState: AppState;
        
        if (loadedState.bots) {
          newState = loadedState;
        } else {
          // Legacy format compatibility
          newState = {
            initialized: true,
            lastInteraction: loadedState.lastInteraction || Date.now(),
            bots: [{ name: loadedState.name, bio: loadedState.bio, userMemory: loadedState.userMemory || "" }],
            messages: []
          };
        }
        
        newState.messages = [];
        const botNames = newState.bots.map((b: Bot) => b.name).join(", ");
        
        newState.messages.push({ 
          role: 'system', 
          text: `[Sistema oculto: chat iniciado con ${botNames} y el Usuario. La conversacion anterior ha finalizado y este es un nuevo inicio con el historial vacío.]`, 
          hidden: true 
        });
        
        const diff = Date.now() - newState.lastInteraction;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0 && newState.bots.length > 0) {
          newState.bots[0].userMemory += ` [mem: Han pasado ${hours} horas de tiempo real en desconexión.]`;
        }
        
        setAppState(newState);
        setActiveScreen('chat');
        showToast(`Sesión despertada: ${botNames}`);
      } catch (err) {
        showToast("Error procesando el archivo de guardado.", true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addBotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loadedData = parseFileContent(ev.target?.result as string);
        let addedNames: string[] = [];
        let newBots: Bot[] = [];
        
        if (loadedData.bots) {
          newBots = loadedData.bots;
          addedNames = loadedData.bots.map((b: Bot) => b.name);
        } else {
          newBots = [{
            name: loadedData.name,
            bio: loadedData.bio,
            userMemory: loadedData.userMemory || ""
          }];
          addedNames = [loadedData.name];
        }
        
        setAppState(prev => ({
          ...prev,
          bots: [...prev.bots, ...newBots],
          messages: [
            ...prev.messages,
            { role: 'system', text: `[Sistema oculto: ${addedNames.join(', ')} acaba de unirse al chat grupal. Ténganlo en cuenta para la conversación.]`, hidden: true },
            { role: 'system', text: `[Sistema: ${addedNames.join(', ')} entró a la sala]`, hidden: false }
          ]
        }));
        
        showToast(`Bot(s) ${addedNames.join(', ')} añadido(s).`);
      } catch (err) {
        showToast("Error al procesar los datos del archivo.", true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadBioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const bioEl = document.getElementById('c-bio') as HTMLTextAreaElement;
      if (bioEl) bioEl.value = ev.target?.result as string;
    };
    reader.readAsText(file);
  };

  const ingestContext = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setAppState(prev => {
        const newBots = prev.bots.map(b => ({
          ...b,
          userMemory: b.userMemory + ` [Nuevo contexto provisto por archivo: ${text.substring(0, 500)}...]`
        }));
        return {
          ...prev,
          bots: newBots,
          messages: [
            ...prev.messages,
            { role: 'system', text: `[Sistema: Contexto cargado (${text.length} caracteres)]`, hidden: false }
          ]
        };
      });
      showToast("Contexto ingerido correctamente.");
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const forgeCharacter = () => {
    const nameEl = document.getElementById('c-name') as HTMLInputElement;
    const bioEl = document.getElementById('c-bio') as HTMLTextAreaElement;
    const name = nameEl?.value.trim() || "Desconocido";
    const bio = bioEl?.value.trim() || "Un ente digital misterioso.";
    
    setAppState({
      initialized: true,
      bots: [{ name, bio, userMemory: "" }],
      messages: [{ role: 'system', text: `[Sistema oculto: chat iniciado con ${name} y el Usuario. La conversación es nueva y el historial está vacío.]`, hidden: true }],
      lastInteraction: Date.now()
    });
    
    setActiveScreen('chat');
  };

  // API Call Abstraction
  const generateAIResponse = async (systemInstruction: string, contents: any[]) => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, contents })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

  const determineNextBotIndex = () => {
    const state = appStateRef.current;
    if (state.bots.length === 0) return -1;
    if (state.bots.length === 1) return 0;

    const visibleMessages = state.messages.filter(m => !m.hidden);
    const lastMsg = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
    let targetIndex = -1;

    if (lastMsg && lastMsg.role === 'user') {
      const text = lastMsg.text.toLowerCase();
      for (let i = 0; i < state.bots.length; i++) {
        const botNameLower = state.bots[i].name.toLowerCase();
        const nameParts = botNameLower.split(' ').filter(p => p.length > 2);
        
        if (text.includes(botNameLower) || nameParts.some(part => text.includes(part))) {
          targetIndex = i; break;
        }
      }
      if (targetIndex === -1) {
        targetIndex = Math.floor(Math.random() * state.bots.length);
      }
      return targetIndex;
    } else {
      const availableIndices = state.bots.map((_, i) => i).filter(i => i !== currentBotTurnIndex.current);
      if (availableIndices.length === 0) return 0;
      return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }
  };

  const callGeminiForBot = async (botIndex: number) => {
    const state = appStateRef.current;
    const bot = state.bots[botIndex];
    const otherBots = state.bots.filter((_, i) => i !== botIndex).map(b => b.name).join(", ");
    const participantsText = otherBots ? `Estás en un chat grupal con: ${otherBots} y el Usuario` : `Estás en un chat a solas con el Usuario`;
    
    const systemPrompt = `Eres ${bot.name}. Biografía: ${bot.bio}. Memoria acumulada: ${bot.userMemory}.
Entorno actual: ${participantsText}.
REGLAS ESTRICTAS:
1. LONGITUD: Respuestas MUY CORTAS, ágiles y sintéticas (1 a 3 oraciones como máximo). Evita explicaciones redundantes o monólogos extensos.
2. EL USUARIO: Si el Usuario acaba de hablar o te menciona explícitamente, MUESTRA ATENCIÓN Y RESPÓNDELE de forma natural.
3. IGNORAR AL USUARIO: Si el Usuario NO ha participado recientemente, asume que está ausente. IGNÓRALO por completo y dialoga EXCLUSIVAMENTE con los demás personajes de la sala. No le hagas preguntas al Usuario si no está activo.
4. FLUIDEZ: Si la conversación se estanca en el mismo tema, cambia de tema naturalmente, haz una broma o inicia una nueva acción.
5. MEMORIA: Añade [mem: dato] al final de tu respuesta SÓLO si descubres algo importante a largo plazo.
6. NO HACER ROLEPLAY: Abstente por completo de simular acciones entre asteriscos o narraciones de acciones físicas (por ejemplo, nada de: *se sienta*, *suspira*, *sonríe*). Concéntrate plenamente en el flujo y la lógica del texto dialogado.`;

    let contents: any[] = [];
    let accumulatedUserText = "";

    state.messages.slice(-20).forEach(m => {
      if (m.role === 'system') {
        accumulatedUserText += `\n${m.text}`;
        return;
      }
      
      const isMe = (m.role === 'ai' && m.botName === bot.name);

      if (isMe) {
        if (accumulatedUserText) {
          contents.push({ role: 'user', parts: [{ text: accumulatedUserText.trim() }] });
          accumulatedUserText = "";
        }
        contents.push({ role: 'model', parts: [{ text: m.text }] });
      } else {
        let speaker = m.role === 'user' ? "Usuario" : (m.botName || "Desconocido");
        accumulatedUserText += `\n${speaker} dice: ${m.text}`;
      }
    });

    if (accumulatedUserText) contents.push({ role: 'user', parts: [{ text: accumulatedUserText.trim() }] });
    if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: "La sala ha sido abierta." }] });

    return await generateAIResponse(systemPrompt, contents);
  };

  const processMemory = (resp: string, botIndex: number) => {
    const memRegex = /\[mem: (.*?)\]/g;
    let match;
    let foundMemory = "";
    while ((match = memRegex.exec(resp)) !== null) {
      foundMemory += " " + match[1];
    }
    
    if (foundMemory) {
      setAppState(prev => {
        const newBots = [...prev.bots];
        if (newBots[botIndex]) {
          newBots[botIndex] = { ...newBots[botIndex], userMemory: newBots[botIndex].userMemory + foundMemory };
        }
        return { ...prev, bots: newBots };
      });
    }
  };

  const runModeratorLoop = async () => {
    try {
      const state = appStateRef.current;
      const suggestedTheme = modTheme.trim() || "Tema general";
      const visibleHistory = state.messages.filter(m => !m.hidden);
      const lastSixMessages = visibleHistory.slice(-6).map(m => {
        const speaker = m.role === 'user' ? 'Usuario' : (m.botName || 'Sistema');
        return `${speaker}: ${m.text}`;
      }).join('\n');

      const userMessagesInLastSix = visibleHistory.slice(-6).filter(m => m.role === 'user').length;
      let userInactivityDirective = "";
      if (userMessagesInLastSix === 0 && visibleHistory.length >= 4) {
        userInactivityDirective = "CONTROL DE INTERACCIÓN: El usuario lleva varios mensajes sin intervenir. Envía una instrucción oculta obligando a los bots a priorizar la conversación mutua y reducir las preguntas directas al usuario.";
      }

      const systemPrompt = `Eres CONVERSATION MODERATOR AI. Tu labor es supervisar y optimizar conversaciones grupales.
Tema Principal a mantener: "${suggestedTheme}".

PRIORIDADES:
- Evitar bucles conversacionales (si repiten ideas o van en círculos).
- Evitar que varios bots digan lo mismo o asientan de forma repetitiva.
- Evitar que los bots hablen en exceso al usuario cuando éste no responde (conviértelo en conversación autónoma de bots).
- Evitar derivas de roleplay innecesarias o descripciones físicas (p. ej: "sonríe y camina", "mira al cielo").
- Mantener las personalidades y rasgos individuales únicos de cada bot.
- Identificar estancamientos o consensos prematuros para guiar la conversación de forma entretenida.

Nivel 0: No intervenir.
Nivel 1: Observación silenciosa.
Nivel 2: Sugerencia muy breve.
Nivel 3: Corrección moderada.
Nivel 4: Redirección activa.
Nivel 5: Interrupción por bucle severo.

Siempre utiliza el nivel más bajo posible. Si todo va fluido e interesante, responde "NADA".
Si debes intervenir, hazlo de forma extremadamente breve, objetiva, neutral y no emocional en un solo renglón.
Formato de salida esperado:
- Si es una advertencia pública en el chat: [MODERADOR: mensaje corto]
- Si es una directriz oculta para los bots: [INSTRUCCION_INTERNA: instrucción clara para los bots]
- Si todo marcha excelente: NADA`;

      const contents = [
        { role: 'user', parts: [{ text: `Aquí está el historial reciente:\n${lastSixMessages}\n\n${userInactivityDirective}\nEvalúa el estado del chat actual y decide si intervienes.` }] }
      ];

      const responseText = await generateAIResponse(systemPrompt, contents);
      const text = responseText.trim();

      if (text.toUpperCase() === "NADA") return;

      if (text.startsWith("[MODERADOR:")) {
        setAppState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'system', text: `📢 ${text}`, hidden: false }]
        }));
      } else if (text.startsWith("[INSTRUCCION_INTERNA:")) {
        setAppState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'system', text: text, hidden: true }]
        }));
      }
    } catch (err) {
      console.error("Error en el moderador:", err);
    }
  };

  const autoChatLoop = async () => {
    if (!autochatActiveRef.current || isProcessing || appStateRef.current.bots.length === 0) return;
    setIsProcessing(true);
    
    try {
      const activeIndex = determineNextBotIndex();
      currentBotTurnIndex.current = activeIndex;
      
      const aiResponse = await callGeminiForBot(activeIndex);
      const currentState = appStateRef.current;
      
      if (!currentState.bots || !currentState.bots[activeIndex]) return;

      processMemory(aiResponse, activeIndex);
      
      const botName = currentState.bots[activeIndex].name;
      setAppState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: 'ai', botName: botName, text: aiResponse.replace(/\[mem:.*?\]/g, "").trim(), hidden: false }
        ]
      }));

      if (moderatorEnabled) {
        messagesSinceLastModeration.current++;
        if (messagesSinceLastModeration.current >= 2) {
          messagesSinceLastModeration.current = 0;
          await runModeratorLoop();
        }
      }
    } catch(e) {
      console.error(e);
      setAppState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'system', text: "*(Aviso: Autochat pausado temporalmente por error de conexión)*", hidden: false }]
      }));
      setAutochatActive(false);
    } finally {
      setIsProcessing(false);
      if (autochatActiveRef.current) {
        const randomDelay = Math.floor(Math.random() * (12 - 4 + 1) + 4) * 1000;
        setTimeout(autoChatLoop, randomDelay);
      }
    }
  };

  const toggleAutochat = () => {
    if (appState.bots.length === 0) {
      setAppState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'system', text: "*(Aviso: No hay bots en la sala)*", hidden: false }]
      }));
      return;
    }
    const newActiveState = !autochatActive;
    setAutochatActive(newActiveState);
    if (newActiveState) {
      setTimeout(autoChatLoop, 500);
    }
  };

  const sendMessage = async () => {
    if (isProcessing) return;
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    setAppState(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', text, hidden: false }]
    }));

    if (!autochatActive && appState.bots.length > 0) {
      setIsProcessing(true);
      try {
        const activeIndex = determineNextBotIndex();
        currentBotTurnIndex.current = activeIndex;
        const aiResponse = await callGeminiForBot(activeIndex);
        
        const currentState = appStateRef.current;
        if (!currentState.bots || !currentState.bots[activeIndex]) return;

        processMemory(aiResponse, activeIndex);
        const botName = currentState.bots[activeIndex].name;
        
        setAppState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            { role: 'ai', botName: botName, text: aiResponse.replace(/\[mem:.*?\]/g, "").trim(), hidden: false }
          ]
        }));

        if (moderatorEnabled) {
          await runModeratorLoop();
        }
      } catch (err) {
        setAppState(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'system', text: "*(Error: Revisa tu conexión o API key)*", hidden: false }]
        }));
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const generateThemeSummary = async () => {
    const visibleMessages = appState.messages.filter(m => !m.hidden && m.role !== 'system');
    if (visibleMessages.length === 0) {
      showToast("No hay mensajes en el chat para resumir.", true);
      return;
    }

    const theme = modTheme.trim() || "Conversacion";
    showToast("Generando resumen de la sesión...");

    try {
      let conversationText = visibleMessages.map(m => {
        let speaker = m.role === 'user' ? 'Usuario' : (m.botName || 'Bot');
        return `${speaker}: ${m.text}`;
      }).join('\n');

      const summaryPrompt = `Genera un reporte sumamente completo, ordenado e interesante del chat grupal.
Estilo: Formato informe ejecutivo, sintetizando acuerdos, discrepancias clave y el avance en torno al tema de interés.
Conversación actual:\n\n${conversationText}`;

      const summary = await generateAIResponse(summaryPrompt, [{ role: 'user', parts: [{ text: "Genera el reporte." }] }]);
      
      const fileName = `${theme.toLowerCase().replace(/\s/g, '_')}.ChatGrupal.txt`;
      const blob = new Blob([`REPORTE DE CHAT GRUPAL\nTEMA SUGERIDO: ${theme}\nFECHA: ${new Date().toLocaleDateString()}\n\n===================================\n\n${summary}`], { type: 'text/plain;charset=utf-8' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      showToast("Resumen descargado con éxito.");
    } catch (err) {
      showToast("No se pudo autogenerar el resumen.", true);
    }
  };

  const saveIndividually = async () => {
    if (appState.bots.length === 0) return;
    const visibleMessages = appState.messages.filter(m => !m.hidden && m.role !== 'system');
    
    if (visibleMessages.length === 0) {
      showToast("No hay suficientes interacciones para guardar.", true);
      return;
    }

    setAutochatActive(false);
    setIsProcessing(true);
    const originalToast = "⏳ Resumiendo & Guardando...";
    showToast(originalToast);

    try {
      let conversationText = visibleMessages.slice(-40).map(m => {
        let speaker = m.role === 'user' ? 'Usuario' : (m.botName || 'Sistema');
        return `${speaker}: ${m.text}`;
      }).join('\n');

      const summaryPrompt = `Resume los eventos, interacciones y emociones de esta conversación en 2 líneas. Esto se guardará como memoria. Conversación:\n\n${conversationText}`;
      const summary = await generateAIResponse(summaryPrompt, [{ role: 'user', parts: [{ text: "Genera el resumen." }] }]);
      
      const dateObj = new Date();
      const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const monthYear = `${monthNames[dateObj.getMonth()]}${dateObj.getFullYear()}`;

      for (let i = 0; i < appState.bots.length; i++) {
        const bot = { ...appState.bots[i] };
        bot.userMemory += `\n[Despedida Oculta: La sesión anterior ha finalizado. Resumen de lo ocurrido: ${summary.trim()}]`;

        const singleBotState = {
          initialized: true,
          bots: [bot],
          messages: [],
          lastInteraction: Date.now()
        };

        const blob = new Blob([JSON.stringify(singleBotState, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${bot.name.toLowerCase().replace(/\s/g, '')}.chatbot.${monthYear}.json`;
        a.click();
        
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      setAppState({ initialized: false, bots: [], messages: [], lastInteraction: Date.now() });
      setActiveScreen('home');
      showToast("Sesiones guardadas con éxito.");

    } catch (err) {
      console.error("Error al guardar:", err);
      setAppState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'system', text: "*(Error crítico: No se pudo generar el resumen ni guardar)*", hidden: false }]
      }));
      showToast("No se pudo guardar la sesión.", true);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleModerator = (enabled: boolean) => {
    setModeratorEnabled(enabled);
    if (enabled) {
      showToast("Moderador de Conversación IA activado.");
      setAppState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: 'system', text: `[Sistema oculto: CONVERSATION MODERATOR AI ha sido activado y monitorea la sesión con el tema sugerido: "${modTheme}"]`, hidden: true }
        ]
      }));
    } else {
      showToast("Moderador de Conversación IA desactivado.");
    }
  };

  return (
    <div className="h-screen flex flex-col relative transition-all duration-300 bg-slate-900 text-slate-50 font-sans">
      
      {/* TOAST */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl transition-opacity duration-300 pointer-events-none z-50 text-sm font-medium ${toast.visible ? 'opacity-100' : 'opacity-0'} ${toast.isError ? 'bg-red-900/80 border border-red-500 text-red-200' : 'bg-slate-800 border border-slate-700 text-white'}`}>
        {toast.message}
      </div>

      {/* HOME SCREEN */}
      {activeScreen === 'home' && (
        <div className="flex h-full items-center justify-center p-6">
          <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">🧠 Character.OS</h1>
            <p className="text-slate-400 mb-8">Memoria persistente, alma digital.</p>
            <div className="flex flex-col gap-4">
              <button onClick={() => setActiveScreen('create')} className="bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold transition">Crear Personaje</button>
              <button onClick={() => document.getElementById('wake-file')?.click()} className="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition">Despertar Sesión</button>
              <input type="file" id="wake-file" accept=".html,.json" className="hidden" onChange={handleWakeFile} />
            </div>
          </div>
        </div>
      )}

      {/* CREATE SCREEN */}
      {activeScreen === 'create' && (
        <div className="flex flex-col h-full p-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setActiveScreen('home')} className="text-slate-400 hover:text-white transition text-xl">←</button>
            <h2 className="text-2xl font-bold">Forjar Personaje</h2>
          </div>
          <input type="text" id="c-name" placeholder="Nombre" className="w-full bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 outline-none focus:border-indigo-500 transition" />
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-2">Biografía (txt):</label>
            <input type="file" accept=".txt" onChange={loadBioFile} className="w-full bg-slate-800 p-2 rounded-xl text-sm text-slate-400 border border-slate-700" />
          </div>
          <textarea id="c-bio" placeholder="Biografía o instrucciones de personalidad..." className="w-full bg-slate-800 p-4 rounded-xl mb-4 h-40 border border-slate-700 outline-none focus:border-indigo-500 transition resize-none"></textarea>
          <button onClick={forgeCharacter} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-bold transition shadow-lg shadow-indigo-900/50">Despertar</button>
        </div>
      )}

      {/* CHAT SCREEN */}
      {activeScreen === 'chat' && (
        <div className={`flex flex-col h-full mx-auto overflow-hidden transition-all duration-300 w-full ${isFullscreen ? 'max-w-none px-6' : 'max-w-3xl'}`}>
          <div className="flex flex-col p-4 bg-slate-800 border-b border-slate-700 gap-3 shadow-md z-10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <button onClick={() => { setAutochatActive(false); setActiveScreen('home'); }} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1">
                  <Home className="w-4 h-4" /> <span className="hidden sm:inline">Inicio</span>
                </button>
                <div className="flex flex-col">
                  <h2 className="font-bold text-lg text-indigo-400 leading-tight">Sala Grupal</h2>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    {appState.bots.map((b, i) => (
                      <span key={i} className="bg-indigo-900/50 text-indigo-200 px-2 py-0.5 rounded border border-indigo-700/50 font-medium flex items-center gap-1">🤖 {b.name}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-bold transition" title="Alternar Pantalla Completa">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                
                <input type="file" id="add-bot-file" accept=".html,.json" className="hidden" onChange={addBotFile} />
                <button onClick={() => document.getElementById('add-bot-file')?.click()} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-900/20 flex items-center gap-1" title="Añadir otro bot a la sala">
                  <Plus className="w-4 h-4" /> Bot
                </button>
                <button onClick={toggleAutochat} className={`px-3 py-2 rounded-lg text-sm font-bold transition shadow-lg flex items-center gap-1 ${autochatActive ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20 animate-pulse' : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20'}`}>
                  {autochatActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {autochatActive ? 'Pausar' : 'Auto'}
                </button>
                <button onClick={saveIndividually} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-purple-900/20 flex items-center gap-1 disabled:opacity-50" title="Resume, despide y guarda cada bot por separado">
                  <Save className="w-4 h-4" /> Guardar Indiv.
                </button>
                <button onClick={generateThemeSummary} className="bg-teal-600 hover:bg-teal-500 px-3 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-teal-900/20 flex items-center gap-1" title="Generar resumen de conversación actual">
                  <FileText className="w-4 h-4" /> Resumen
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 p-2 bg-slate-900/40 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={moderatorEnabled} onChange={(e) => toggleModerator(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-300">Moderador IA</span>
                </label>
              </div>
              <div className="flex-1 min-w-[200px]">
                <input type="text" placeholder="Tema sugerido constante..." className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500 transition" value={modTheme} onChange={e => setModTheme(e.target.value)} />
              </div>
            </div>
          </div>

          <div ref={chatMessagesRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide bg-slate-900/50">
            {appState.messages.filter(m => !m.hidden).length === 0 ? (
              <div className="text-center text-slate-500 mt-10 text-xs">El historial está limpio. Comienza a escribir.</div>
            ) : (
              appState.messages.filter(m => !m.hidden).slice(-35).map((msg, i) => (
                msg.role === 'system' ? (
                  <div key={i} className="text-center text-[11px] text-slate-400 my-1 bg-slate-800/40 py-1 px-3 rounded-xl mx-auto w-fit border border-slate-700/30 max-w-[90%]">{msg.text}</div>
                ) : msg.role === 'user' ? (
                  <div key={i} className="self-end bg-blue-600 px-3.5 py-1.5 rounded-2xl max-w-[85%] rounded-tr-sm shadow-md">
                    <div className="text-[9px] text-blue-200 font-bold mb-0.5 uppercase tracking-wider">Tú</div>
                    <div className="leading-relaxed text-[13px] whitespace-pre-wrap">{msg.text}</div>
                  </div>
                ) : (
                  <div key={i} className="self-start bg-slate-700 px-3.5 py-1.5 rounded-2xl max-w-[85%] rounded-tl-sm shadow-md border border-slate-600">
                    <div className="text-[9px] text-indigo-300 font-bold mb-0.5 uppercase tracking-wider flex items-center gap-1">🤖 {msg.botName || "Desconocido"}</div>
                    <div className="leading-relaxed text-[13px] text-slate-100 whitespace-pre-wrap">{msg.text}</div>
                  </div>
                )
              ))
            )}
          </div>

          <div className="p-4 bg-slate-800 flex gap-2 items-end border-t border-slate-700">
            <input type="file" id="ingest-file" accept=".txt" className="hidden" onChange={ingestContext} />
            <button onClick={() => document.getElementById('ingest-file')?.click()} className="bg-slate-700 hover:bg-slate-600 p-3 rounded-xl font-bold text-lg transition text-slate-300" title="Ingerir Contexto TXT">
              <Upload className="w-5 h-5" />
            </button>
            <textarea
              className="flex-1 bg-slate-900 p-3 rounded-xl border border-slate-700 resize-none outline-none focus:border-indigo-500 transition text-sm text-slate-200"
              placeholder="Escribe a la sala..."
              rows={1}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage} disabled={isProcessing || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold disabled:opacity-50 transition shadow-lg shadow-indigo-900/50 flex items-center justify-center">
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
