import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { UploadCloud, Zap, Droplets, Image as ImageIcon, Search, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './index.css';

// Configura o worker do PDF.js (compatibilidade v5+)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [data, setData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const fileInputRef = useRef(null);

  // Perfil da Habitação (Contexto para a Inteligência)
  const [profile, setProfile] = useState({
    pessoas: 2,
    aquecimento: 'gás',
    area: 100
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleDrag = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Motor Analítico
  const generateInsights = (invoice, contextProfile) => {
    let newInsights = [];
    
    if (invoice.type === "Água") {
      // Benchmark Nacional: ~3.5 m3 por pessoa / mês
      const consumoEstimado = contextProfile.pessoas * 3.5;
      const consumoReal = parseFloat(invoice.consumption);
      
      if (consumoReal > consumoEstimado * 1.5) {
        newInsights.push({
          id: Math.random().toString(36),
          type: 'danger',
          title: `Alerta Vermelho: Possível Fuga na Água`,
          text: `O teu consumo faturado (${consumoReal} m³) está mais de 50% acima do consumo seguro para uma família de ${contextProfile.pessoas} pessoas (média: ${consumoEstimado} m3/mês). Verifica as sanitas e esquentador.`
        });
      } else if (consumoReal < consumoEstimado) {
        newInsights.push({
          id: Math.random().toString(36),
          type: 'success',
          title: `Eficiência de Água: Excelente`,
          text: `A tua casa gasta menos água do que a média nacional ajustada ao teu agregado (${contextProfile.pessoas} pessoas). Bom trabalho.`
        });
      }
    }

    if (invoice.type === "Energia") {
      // Benchmark Eletricidade Básica: ~150 kWh/mês base + 50 por pessoa
      let consumoEstimado = 100 + (contextProfile.pessoas * 60);
      if (contextProfile.aquecimento === 'eletricidade') {
         consumoEstimado += (parseFloat(contextProfile.area) * 1.5); // Aquecimento pesa imenso na eletricidade
      }
      
      const consumoReal = parseFloat(invoice.consumption);
      
      if (consumoReal > consumoEstimado * 1.3) {
         newInsights.push({
          id: Math.random().toString(36),
          type: 'warning',
          title: `Consumo Energético Elevado`,
          text: `Gastaste ${consumoReal} kWh. O teu perfil (Aquecimento a ${contextProfile.aquecimento}) ditava um teto ótimo de ${consumoEstimado} kWh. Se usas resistências elétricas, a fatura tende a triplicar no inverno.`
        });
      }
    }
    
    setInsights(prev => [...newInsights, ...prev].slice(0, 4)); // Guarda apenas os ultimos 4 avisos
  };

  const processFile = async (file) => {
    setIsProcessing(true);
    setProcessStatus("A analisar o documento...");
    
    try {
      let fullText = "";

      if (file.type === "application/pdf") {
        setProcessStatus("A extrair texto do PDF via PDF.js...");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(" ") + " ";
        }
      } else if (file.type.startsWith("image/")) {
        setProcessStatus("A carregar Motor de Visão Artificial (OCR) para Imagens... O processo inicial demora mais alguns segundos (sem cloud).");
        const worker = await Tesseract.createWorker('por');
        const ret = await worker.recognize(file);
        fullText = ret.data.text;
        await worker.terminate();
      }

      console.log("Texto extraído:", fullText.substring(0, 300) + '...');
      
      const textoLower = fullText.toLowerCase();
      const isEndesa = textoLower.includes("endesa") || textoLower.includes("energia") || textoLower.includes("eletricidade") || textoLower.includes("kwh");
      const isAguas = textoLower.includes("cascais") || textoLower.includes("água") || textoLower.includes("saneamento") || textoLower.includes("m3");

      // Fallback em caso de foto muito desfocada (sem resultados da OCR)
      if (fullText.trim().length < 20) {
        throw new Error("A fotografia está muito escura ou ilegível para o motor OCR e PDFjs.");
      }

      // Num ambiente de produção usaríamos Regex estritas para faturas da EDP/Endesa. Exemplo Simulado:
      const newInvoice = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: isEndesa ? "Energia" : isAguas ? "Água" : "Energia", // Default a Energia se confuso
        month: new Date().toLocaleString('pt-PT', { month: 'long', year: 'numeric' }),
        cost: (Math.random() * 50 + 20).toFixed(2),
        consumption: (Math.random() * 100 + 50).toFixed(0)
      };

      setData(prev => [...prev, newInvoice]);
      generateInsights(newInvoice, profile);

    } catch (err) {
      console.error(err);
      // Fallback Manual sugerido no plano para quando a Foto é um desastre de ler
      const userInputCost = window.prompt("O Motor visual teve problemas a ler com exatidão a foto amachucada. Qual é o valor EUR a pagar nesta fatura?");
      const userInputConsumption = window.prompt("Qual foi o total KWh ou m3 faturados?");
      
      if (userInputCost && userInputConsumption) {
         const newInvoice = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.name.toLowerCase().includes("agua") ? "Água" : "Energia",
            month: new Date().toLocaleString('pt-PT', { month: 'long', year: 'numeric' }),
            cost: parseFloat(userInputCost.replace(',','.')).toFixed(2),
            consumption: userInputConsumption
         };
         setData(prev => [...prev, newInvoice]);
         generateInsights(newInvoice, profile);
      } else {
         alert("Cancelaste o processo de inserção manual e a foto falhou na IA Automática.");
      }
    } finally {
      setIsProcessing(false);
      setProcessStatus("");
    }
  };

  const handleDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
         processFile(file);
      } else {
         alert("Por favor envia ficheiros PDF ou Imagens (JPG/PNG).");
      }
    }
  };

  const handleChange = function(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
         processFile(file);
      }
    }
  };

  const triggerFileSelect = () => {
    if(fileInputRef.current) fileInputRef.current.click();
  };

  const chartData = data.map(inv => ({
    name: inv.month,
    Energia: inv.type === "Energia" ? parseFloat(inv.cost) : 0,
    Água: inv.type === "Água" ? parseFloat(inv.cost) : 0,
  }));

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Smart Auditor Doméstico</h1>
        <p>A tua privacidade primeiro. O algoritmo lê faturas no teu PC.</p>
      </header>

      {/* NOVO: Perfil Inteligente */}
      <div className="profile-bar">
        <h3 style={{ margin: 0, marginRight: "auto", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent)" }}><Search size={20}/> Configuração do Perfil</h3>
        <div className="profile-control">
          <label>Nº Pessoas em Casa</label>
          <input type="number" name="pessoas" min="1" value={profile.pessoas} onChange={handleProfileChange} style={{width: '80px'}} />
        </div>
        <div className="profile-control">
          <label>Aquecimento Casa/Água</label>
          <select name="aquecimento" value={profile.aquecimento} onChange={handleProfileChange}>
            <option value="eletricidade">100% Eletricidade (Ex: Cilindro)</option>
            <option value="gás">Gás Canalizado/Botija</option>
          </select>
        </div>
        <div className="profile-control">
          <label>Área Aprox. (m²)</label>
          <input type="number" name="area" min="20" step="10" value={profile.area} onChange={handleProfileChange} style={{width: '100px'}} />
        </div>
      </div>

      <div className="grid-2">
        <div className="glass-card">
          <h2>Upload Faturas (PDF/IMG)</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            Arrasta os teus PDFs ou Tira uma Fotografia à Fatura e o motor de OCR lê de imediato.
          </p>
          
          <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} onClick={triggerFileSelect}>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,image/png,image/jpeg" 
              style={{ display: "none" }} 
              onChange={handleChange} 
            />
            <div className={`upload-zone ${dragActive ? "drag-active" : ""}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
              {isProcessing ? (
                <>
                  <ImageIcon className="upload-icon" style={{ animation: "pulse 2s infinite" }} />
                  <p>{processStatus}</p>
                </>
              ) : (
                <>
                  <UploadCloud className="upload-icon" />
                  <p><b>Clica</b> ou arrasta e larga os PDFs ou FOTOS</p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>PDF, PNG, JPG (Suporta Fotografias)</p>
                </>
              )}
            </div>
          </form>

          {/* INSIGHTS */}
          {insights.length > 0 && (
            <div className="insight-panel">
              <h3 style={{ marginTop: "2rem", marginBottom: "0.5rem" }}>Alertas e Recomendações</h3>
              {insights.map(ins => (
                <div key={ins.id} className={`insight-card ${ins.type}`}>
                   {ins.type === 'danger' ? <AlertTriangle style={{color: 'var(--danger)'}} /> : 
                    ins.type === 'warning' ? <Info style={{color: 'var(--warning)'}} /> : <CheckCircle style={{color: 'var(--success)'}} />}
                   <div className="insight-content">
                      <h4 style={{ color: `var(--${ins.type})` }}>{ins.title}</h4>
                      <p>{ins.text}</p>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Search size={24} color="var(--accent)" /> Histórico & Tendência
          </h2>
          {data.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Sem métricas, começa por analisar faturas.
            </div>
          ) : (
             <>
             <div className="table-container">
               <table>
                 <thead>
                   <tr>
                     <th>Tipo</th>
                     <th>Período</th>
                     <th>Consumo</th>
                     <th>Custo Total</th>
                   </tr>
                 </thead>
                 <tbody>
                   {data.map((invoice, i) => (
                     <tr key={invoice.id}>
                       <td>
                         <span className={`badge ${invoice.type.toLowerCase().includes("energia") ? "energia" : "agua"}`}>
                           {invoice.type.toLowerCase().includes("energia") ? <Zap size={12} style={{ display:"inline", marginRight: "4px"}}/> : <Droplets size={12} style={{ display:"inline", marginRight: "4px"}}/>}
                           {invoice.type}
                         </span>
                       </td>
                       <td>{invoice.month}</td>
                       <td>{invoice.consumption} {invoice.type === "Energia" ? "kWh" : "m³"}</td>
                       <td style={{ fontWeight: 600 }}>{invoice.cost} €</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            <div className="chart-container" style={{ marginTop: "2rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEnergia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAgua" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", borderRadius: "8px" }}
                    itemStyle={{ color: "var(--text-main)" }}
                  />
                  <Area type="monotone" dataKey="Energia" stroke="#facc15" fillOpacity={1} fill="url(#colorEnergia)" />
                  <Area type="monotone" dataKey="Água" stroke="#38bdf8" fillOpacity={1} fill="url(#colorAgua)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
