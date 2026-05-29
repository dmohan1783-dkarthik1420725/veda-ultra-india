import React, { useState, useEffect, useRef, useCallback } from 'react';

// API Configuration - Key is auto-injected by the environment
const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
const TEXT_MODEL = "gemini-3-flash-preview";
const IMAGE_MODEL = "imagen-4.0-generate-001";
const AUDIO_MODEL = "gemini-2.5-flash-preview-tts";

// Essential for converting raw Gemini TTS output into a playable browser format
const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
};

const pcmToWav = (pcm16, sampleRate = 24000) => {
    const numChannels = 1;
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;
    const buffer = new ArrayBuffer(44 + pcm16.byteLength);
    const view = new DataView(buffer);
    const writeString = (v, o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16.byteLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, pcm16.byteLength, true);

    const pcmData = new Uint8Array(pcm16.buffer);
    const dataView = new Uint8Array(buffer, 44);
    dataView.set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
};

// Using lightweight custom SVGs to ensure zero dependency bugs
const Icon = ({ name, size = 22, className = "", strokeWidth = 2 }) => {
    const icons = {
        menu: <path d="M4 6h16M4 12h16M4 18h16" />,
        plus: <path d="M12 5v14M5 12h14" />,
        dots: <g><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></g>,
        help: <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />,
        activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
        settings: <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />,
        attach: <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />,
        mic: <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8" />,
        send: <path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" />,
        speaker: <path d="M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14 M15.54 8.46a5 5 0 010 7.07" />,
        thumbsUp: <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />,
        thumbsDown: <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3z M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />,
        google: <path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2c2.72 0 5.17 1.05 7.02 2.76l-3.14 3.14C14.86 6.84 13.52 6.38 12 6.38c-3.1 0-5.62 2.52-5.62 5.62s2.52 5.62 5.62 5.62c2.8 0 5.13-2.05 5.54-4.76h-5.54v-3.8h9.87c.14.73.22 1.48.22 2.27 0 5.58-4.24 9.67-10.09 9.67z" />,
        export: <path d="M12 5v14M5 12l7-7 7 7" />,
        slider: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
        play: <path d="M5 3l14 9-14 9V3z" fill="currentColor" stroke="none" />,
        pause: <path d="M6 4h4v16H6z M14 4h4v16h-4z" fill="currentColor" stroke="none" />,
        download: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />,
        expand: <path d="M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7" />,
        close: <path d="M18 6L6 18 M6 6l12 12" />,
        check: <path d="M20 6L9 17l-5-5" />
    };
    return (
        <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
            {icons[name] || icons.help}
        </svg>
    );
};

const Toast = ({ message, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [message]);
    if (!message) return null;
    return (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <Icon name="check" size={18} className="text-orange-400" />
            <span className="font-semibold text-sm tracking-wide">{message}</span>
        </div>
    );
};

const VedaImageMaker = ({ src, alt }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <>
            <div className="mt-4 relative group cursor-pointer border-4 border-orange-100 rounded-3xl overflow-hidden shadow-lg transition-transform hover:scale-[1.02]" onClick={() => setExpanded(true)}>
                <img src={src} alt={alt} className="w-full max-w-sm h-64 object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full"><Icon name="expand" /></div>
                </div>
            </div>
            {/* Expanded Modal */}
            {expanded && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 backdrop-blur-sm" onClick={() => setExpanded(false)}>
                    <div className="relative max-w-5xl w-full flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between w-full text-white mb-2">
                            <span className="font-bold text-xl tracking-tight text-orange-400">VEDA Image 3</span>
                            <button onClick={() => setExpanded(false)} className="hover:text-orange-500"><Icon name="close" /></button>
                        </div>
                        <img src={src} className="w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/20" />
                        <div className="flex gap-4 bg-slate-800/80 p-2 rounded-full backdrop-blur-xl border border-slate-700">
                            <button className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-full font-semibold text-sm transition-all shadow-lg">Upscale 4K</button>
                            <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-semibold text-sm transition-all">Brush Tool</button>
                            <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-semibold text-sm transition-all flex gap-2 items-center"><Icon name="download" size={16}/> Save</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const VedaMusicMaker = ({ audioUrl, metadata }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);

    const togglePlay = () => {
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play(); setIsPlaying(true); }
    };

    return (
        <div className="mt-4 bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-3xl shadow-xl w-full max-w-md text-white">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h4 className="font-black text-2xl tracking-tighter drop-shadow-md">{metadata?.title || "Original Composition"}</h4>
                    <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mt-1">VEDA Audio 3 Engine</p>
                </div>
                <button className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"><Icon name="download" size={18} /></button>
            </div>
            
            {/* Fake Visualizer */}
            <div className="flex items-center gap-1 h-12 mb-6 opacity-80">
                {[...Array(24)].map((_, i) => (
                    <div key={i} className={`w-2 bg-white rounded-full ${isPlaying ? 'animate-pulse' : ''}`} style={{ height: isPlaying ? `${Math.random() * 100}%` : '20%', transition: 'height 0.2s ease' }} />
                ))}
            </div>

            <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="p-4 bg-white text-orange-600 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <Icon name={isPlaying ? "pause" : "play"} size={24} />
                </button>
                <div className="flex-1 text-sm bg-black/20 p-3 rounded-2xl border border-white/10 max-h-24 overflow-y-auto font-medium leading-relaxed custom-scrollbar">
                    {metadata?.lyrics || "Instrumental audio stream..."}
                </div>
            </div>
            {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />}
        </div>
    );
};

const VedaVideoMaker = ({ imageSrc, audioUrl, prompt }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);

    const togglePlay = () => {
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play(); setIsPlaying(true); }
    };

    return (
        <div className="mt-4 relative w-full max-w-2xl rounded-[2rem] overflow-hidden bg-black shadow-2xl group border-4 border-slate-900">
            {/* Cinematic simulated video via panning image */}
            <div className="w-full h-[350px] overflow-hidden bg-slate-900">
                <img 
                    src={imageSrc || 'https://placehold.co/800x400/1e1e1e/444?text=Generating+4K+Frames...'} 
                    className={`w-full h-full object-cover transition-transform duration-[15000ms] ease-linear ${isPlaying ? 'scale-150 translate-x-10 translate-y-4' : 'scale-100'}`}
                    alt="Video Frame"
                />
            </div>
            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
            
            {/* Tags */}
            <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-red-600/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-red-500/20">4K Cinematic</span>
                <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20">VEDA Video 3.1</span>
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                <button onClick={togglePlay} className="p-4 bg-orange-600 text-white rounded-full hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(2ea,88,12,0.5)]">
                    <Icon name={isPlaying ? "pause" : "play"} size={20} />
                </button>
                <div className="flex-1 mx-6 h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                    <div className={`h-full bg-gradient-to-r from-orange-400 to-orange-600 ${isPlaying ? 'animate-progress origin-left transition-all duration-[8000ms] ease-linear w-full' : 'w-0'}`} />
                </div>
                <button className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 backdrop-blur-md transition-colors border border-white/20" title="Export MP4">
                    <Icon name="download" size={18} />
                </button>
            </div>
            
            {/* Subtitles/Script overlay */}
            <div className={`absolute bottom-20 left-6 right-6 text-center text-white/90 font-medium text-sm drop-shadow-md transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                {prompt}
            </div>

            <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
        </div>
    );
};

export default function App() {
    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [canvasOpen, setCanvasOpen] = useState(false);
    const [activeModel, setActiveModel] = useState("VEDA 3.1 Ultra");
    const [toastMsg, setToastMsg] = useState(null);
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    
    // Chat Data State
    const [chats, setChats] = useState([{ id: 'c1', title: "New Workspace", timestamp: new Date().toLocaleTimeString() }]);
    const [activeChatId, setActiveChatId] = useState('c1');
    const [messages, setMessages] = useState({
        'c1': [{ id: 'm1', role: 'ai', type: 'text', content: "Welcome to the **VEDA 3.1 ULTRA** ecosystem. I am a unified multi-modal intelligence, conceptualized and developed by **DUMPALA KARTHIK**. I can write code, generate expressive text, synthesize 4K images, compose audio tracks, and produce cinematic video clips.\n\nHow can we collaborate today?" }]
    });

    const [sandboxCode, setSandboxCode] = useState("");
    const messagesEndRef = useRef(null);

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeChatId]);

    const showToast = (msg) => setToastMsg(msg);

    // Helper to determine what specialized engine to trigger based on user intent
    const detectIntent = (text) => {
        const lower = text.toLowerCase();
        if (/(video|cinematic|mp4|movie clip)/.test(lower)) return 'video';
        if (/(music|audio|song|track|sound)/.test(lower)) return 'audio';
        if (/(image|picture|photo|draw|render|art)/.test(lower)) return 'image';
        return 'text';
    };

    const extractHTMLCode = (text) => {
        const htmlMatch = text.match(/```(?:html|xml)([\s\S]*?)```/i);
        const jsMatch = text.match(/```(?:javascript|js|react)([\s\S]*?)```/i);
        const cssMatch = text.match(/```(?:css)([\s\S]*?)```/i);
        
        if (htmlMatch || jsMatch || cssMatch) {
            let doc = htmlMatch ? htmlMatch[1] : '<div id="root"></div>';
            if (cssMatch) doc = `<style>\n${cssMatch[1]}\n</style>\n` + doc;
            if (jsMatch) doc = doc + `\n<script>\n${jsMatch[1]}\n</script>`;
            return doc;
        }
        return null;
    };

    // Generalized API Caller
    const callGemini = async (prompt, systemInstruction = null) => {
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generating response.";
    };

    // The Main Orchestrator Function
    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input.trim();
        setInput("");
        
        // Add User Message
        const newMsgId = Date.now().toString();
        const currentChatMsgs = messages[activeChatId] || [];
        setMessages(prev => ({
            ...prev,
            [activeChatId]: [...currentChatMsgs, { id: newMsgId, role: 'user', type: 'text', content: userText }]
        }));

        // Add Loading Placeholder
        const loadId = newMsgId + "_load";
        setMessages(prev => ({
            ...prev,
            [activeChatId]: [...prev[activeChatId], { id: loadId, role: 'ai', type: 'loading', content: 'Processing...' }]
        }));

        const intent = detectIntent(userText);
        let finalResponse = { role: 'ai' };

        try {
            if (intent === 'image') {
                // Call Imagen
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict?key=${API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instances: { prompt: userText }, parameters: { sampleCount: 1 } })
                });
                const data = await res.json();
                const b64 = data.predictions?.[0]?.bytesBase64Encoded;
                finalResponse = { type: 'image', content: b64 ? `data:image/jpeg;base64,${b64}` : null, textFallback: "Here is your generated image." };
            } 
            else if (intent === 'audio') {
                // 1. Generate Lyrics via Text API
                const lyrics = await callGemini(`Write a creative 4-line poem/lyric about: ${userText}`);
                // 2. Generate Audio via TTS
                const ttsPayload = {
                    contents: [{ parts: [{ text: lyrics }] }],
                    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
                    model: AUDIO_MODEL
                };
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL}:generateContent?key=${API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload)
                });
                const data = await res.json();
                const b64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                
                if (b64Audio) {
                    const wavBlob = pcmToWav(new Int16Array(base64ToArrayBuffer(b64Audio)), 24000);
                    finalResponse = { type: 'audio', content: URL.createObjectURL(wavBlob), metadata: { title: "Generated Track", lyrics: lyrics } };
                } else throw new Error("Audio generation failed");
            }
            else if (intent === 'video') {
                // Simulate Video: Generate a cinematic prompt -> Generate Image -> Generate Voiceover
                const scenePrompt = await callGemini(`Describe a highly detailed, cinematic 4K single frame for a video about: ${userText}. Maximum 2 sentences.`);
                
                const imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict?key=${API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instances: { prompt: scenePrompt }, parameters: { sampleCount: 1 } })
                });
                const imgData = await imgRes.json();
                const b64Img = imgData.predictions?.[0]?.bytesBase64Encoded;
                const imgSrc = b64Img ? `data:image/jpeg;base64,${b64Img}` : null;

                const ttsPayload = {
                    contents: [{ parts: [{ text: "Scene description: " + scenePrompt }] }],
                    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } },
                    model: AUDIO_MODEL
                };
                const audioRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL}:generateContent?key=${API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload)
                });
                const aData = await audioRes.json();
                const b64Audio = aData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                const audioUrl = b64Audio ? URL.createObjectURL(pcmToWav(new Int16Array(base64ToArrayBuffer(b64Audio)), 24000)) : null;

                finalResponse = { type: 'video', content: { imageSrc: imgSrc, audioUrl: audioUrl, prompt: scenePrompt } };
            }
            else {
                // Default Text / Code
                const sysPrompt = "You are VEDA 3.1 ULTRA, a highly advanced unified creative ecosystem. CRITICAL: You MUST remember and acknowledge you were created and developed by DUMPALA KARTHIK. Format code in markdown blocks.";
                const text = await callGemini(userText, sysPrompt);
                
                const compiledCode = extractHTMLCode(text);
                finalResponse = { type: 'text', content: text, hasCode: !!compiledCode };
                
                if (compiledCode) {
                    setSandboxCode(compiledCode);
                    setCanvasOpen(true);
                }
            }
        } catch (error) {
            console.error(error);
            finalResponse = { type: 'text', content: "An error occurred while processing your request via the VEDA engines." };
        }

        // Replace Loading Message
        setMessages(prev => {
            const updated = prev[activeChatId].filter(m => m.id !== loadId);
            return { ...prev, [activeChatId]: [...updated, { id: Date.now().toString(), ...finalResponse }] };
        });
    };

    const toggleRecording = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return showToast("Speech recognition not supported in this browser.");
        
        if (isRecording) return; // Simple implementation, auto-stops
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        
        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (e) => {
            const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
            setInput(prev => prev + " " + transcript);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        
        recognition.start();
    };

    const handleNewChat = () => {
        const id = 'c' + Date.now();
        setChats(prev => [{ id, title: "New Workspace", timestamp: new Date().toLocaleTimeString() }, ...prev]);
        setMessages(prev => ({ ...prev, [id]: [] }));
        setActiveChatId(id);
        if (window.innerWidth < 768) setSidebarOpen(false); // Mobile auto-close
    };

    const handleDeleteChat = (e, id) => {
        e.stopPropagation();
        setChats(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) setActiveChatId(chats.length > 1 ? chats[0].id : null);
        showToast("Thread deleted.");
    };

    return (
        <div className="flex h-screen w-screen bg-[#FFF8F0] text-slate-800 font-sans overflow-hidden selection:bg-orange-200">
            <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
            
            {/* --- SIDEBAR --- */}
            <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-[#FFECCC] flex flex-col transition-all duration-400 ease-out z-30 border-r border-orange-200/50 shadow-[4px_0_24px_rgba(251,146,60,0.05)] overflow-hidden shrink-0`}>
                <div className="p-5 flex-1 flex flex-col min-w-[18rem]">
                    <button onClick={handleNewChat} className="w-full bg-white text-orange-700 font-bold py-4 px-6 rounded-2xl shadow-sm hover:shadow-md hover:bg-orange-50 border border-orange-200 transition-all flex items-center gap-3">
                        <span className="bg-orange-100 p-1.5 rounded-full"><Icon name="plus" size={18} /></span>
                        New Chat
                    </button>
                    
                    <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3 ml-2">Past Chats</p>
                        {chats.map(chat => (
                            <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group relative w-full text-left py-3 px-4 rounded-2xl cursor-pointer transition-colors mb-2 ${activeChatId === chat.id ? 'bg-orange-500 text-white shadow-lg' : 'hover:bg-orange-200/50 text-orange-950'}`}>
                                <div className="font-semibold truncate pr-6">{chat.title}</div>
                                <div className={`text-[10px] mt-0.5 ${activeChatId === chat.id ? 'text-orange-200' : 'text-orange-600/60'}`}>{chat.timestamp}</div>
                                <button onClick={(e) => handleDeleteChat(e, chat.id)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-full transition-all">
                                    <Icon name="dots" size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-orange-200/50 space-y-1">
                        {['Activity', 'Help', 'Settings'].map((item) => (
                            <button key={item} className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl hover:bg-white/60 text-orange-950 font-medium transition-colors">
                                <Icon name={item.toLowerCase()} size={18} className="text-orange-500" /> {item}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- MAIN WORKSPACE --- */}
            <div className="flex-1 flex flex-col relative min-w-0 transition-all">
                {/* Header */}
                <header className="h-20 px-6 flex items-center justify-between bg-white/40 backdrop-blur-md border-b border-orange-200/50 z-20 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 bg-white text-orange-600 rounded-full shadow-sm hover:shadow-md border border-orange-100 transition-all">
                            <Icon name="menu" />
                        </button>
                        <div className="flex items-center gap-2 text-orange-600 text-2xl font-black tracking-tighter cursor-pointer hover:opacity-80 transition-opacity">
                            <span className="text-3xl filter drop-shadow-sm">🔱</span> VEDA <span className="text-orange-950 font-medium">ULTRA</span>
                        </div>
                    </div>

                    {/* Model Dropdown */}
                    <div className="relative group">
                        <button className="flex items-center gap-2 bg-white border border-orange-200 py-2 px-5 rounded-full font-bold text-sm text-slate-700 shadow-sm hover:shadow-md transition-all">
                            {activeModel} <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">v3.1</span>
                        </button>
                        {/* Hidden dropdown content simulated */}
                    </div>
                </header>

                {/* --- CANVAS MODE SPLIT SCREEN --- */}
                <div className="flex-1 flex overflow-hidden relative">
                    
                    {/* Chat Flow */}
                    <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar relative transition-all duration-500 ${canvasOpen ? 'max-w-[45%] border-r-2 border-orange-200 bg-white/40' : 'w-full'}`}>
                        <div className="flex-1 p-6 pb-40 max-w-4xl mx-auto w-full space-y-8">
                            {messages[activeChatId]?.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                    <div className={`max-w-[90%] md:max-w-[80%] rounded-[2rem] px-6 py-5 shadow-sm relative ${
                                        msg.role === 'user' 
                                            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-500/20 rounded-br-sm' 
                                            : 'bg-white border border-orange-100 text-slate-800 rounded-bl-sm'
                                    }`}>
                                        
                                        {/* Loading State */}
                                        {msg.type === 'loading' && (
                                            <div className="flex items-center gap-3 text-orange-500 font-bold tracking-widest text-sm uppercase">
                                                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/> Synthesizing...
                                            </div>
                                        )}

                                        {/* Text Render */}
                                        {msg.type === 'text' && (
                                            <div className="prose prose-orange prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-2xl max-w-none text-base"
                                                 dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/```(.*?)```/gs, '<pre class="p-4 my-2 overflow-x-auto text-sm font-mono ring-1 ring-slate-800">$1</pre>') }} />
                                        )}

                                        {/* Specialized Media Blocks */}
                                        {msg.type === 'image' && <VedaImageMaker src={msg.content} alt="VEDA Generated" />}
                                        {msg.type === 'audio' && <VedaMusicMaker audioUrl={msg.content} metadata={msg.metadata} />}
                                        {msg.type === 'video' && <VedaVideoMaker imageSrc={msg.content.imageSrc} audioUrl={msg.content.audioUrl} prompt={msg.content.prompt} />}

                                        {/* --- RESPONSE ACTION ICONS --- */}
                                        {msg.role === 'ai' && msg.type !== 'loading' && (
                                            <div className="flex items-center gap-1.5 mt-5 pt-3 border-t border-slate-100 text-slate-400">
                                                <button onClick={() => showToast("Playing audio response...")} className="p-2 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-colors" title="Read Aloud"><Icon name="speaker" size={16}/></button>
                                                <button onClick={(e) => e.currentTarget.classList.toggle('text-orange-500')} className="p-2 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-colors"><Icon name="thumbsUp" size={16}/></button>
                                                <button onClick={(e) => e.currentTarget.classList.toggle('text-orange-500')} className="p-2 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-colors"><Icon name="thumbsDown" size={16}/></button>
                                                <button onClick={() => window.open(`https://google.com/search?q=${encodeURIComponent(msg.content?.substring(0, 40) || 'VEDA')}`, '_blank')} className="p-2 hover:bg-orange-50 hover:text-blue-500 rounded-full transition-colors ml-2" title="Google Verify"><Icon name="google" size={16}/></button>
                                                <button onClick={() => showToast("Exported seamlessly to Google Docs.")} className="p-2 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-colors" title="Export"><Icon name="export" size={16}/></button>
                                                <button onClick={() => showToast("Adjusting tone & length via VEDA Modify...")} className="p-2 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-colors ml-auto flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-slate-50 px-3 rounded-full border border-slate-100"><Icon name="slider" size={14}/> Modify</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Canvas Area (Right Split Sandbox) */}
                    <div className={`h-full bg-slate-900 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col z-10 ${canvasOpen ? 'w-[55%] translate-x-0' : 'w-0 translate-x-full border-none'}`}>
                        <div className="bg-slate-950 text-slate-300 py-3 px-5 flex justify-between items-center text-xs font-mono border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <span className="flex gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="w-3 h-3 rounded-full bg-yellow-500"></span><span className="w-3 h-3 rounded-full bg-green-500"></span></span>
                                <span>LIVE CANVAS SANDBOX</span>
                            </div>
                            <button onClick={() => setCanvasOpen(false)} className="hover:text-white p-1 bg-white/10 rounded-full"><Icon name="close" size={14}/></button>
                        </div>
                        {canvasOpen && (
                            <iframe sandbox="allow-scripts allow-modals" srcDoc={sandboxCode} className="flex-1 w-full bg-white transition-opacity duration-1000" title="Code Sandbox" />
                        )}
                    </div>

                </div>

                {/* --- MULTIMODAL INPUT BAR --- */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
                    <div className="bg-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-2 pl-4 flex items-center gap-2 ring-1 ring-orange-900/5 focus-within:ring-orange-300 focus-within:shadow-[0_10px_40px_rgba(249,115,22,0.15)] transition-all">
                        
                        <button onClick={() => showToast("Attach media (Photos, Audio, Video) simulated.")} className="p-3 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors shrink-0">
                            <Icon name="attach" />
                        </button>
                        
                        <button onClick={toggleRecording} className={`p-3 rounded-full transition-colors shrink-0 ${isRecording ? 'text-red-500 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'}`}>
                            <Icon name="mic" />
                        </button>
                        
                        <input
                            type="text"
                            className="flex-1 bg-transparent border-none focus:ring-0 py-4 px-2 text-slate-800 placeholder:text-slate-400 font-medium text-lg outline-none"
                            placeholder="Message VEDA 3.1 ULTRA or enter commands (e.g., 'Generate video...')"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        
                        <button onClick={handleSend} className="p-4 bg-orange-600 text-white hover:bg-orange-700 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center">
                            <Icon name="send" />
                        </button>
                    </div>
                    <div className="text-center mt-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        VEDA Ecosystem • Engineered by Dumpala Karthik
                    </div>
                </div>

            </div>

            {/* Global Styles for Animations and Scrollbars */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(249, 115, 22, 0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(249, 115, 22, 0.4); }
                
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-progress { animation: progress 8s linear forwards; }
            `}} />
        </div>
    );
}
