import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDLBiRdbJyGb6cYrlA-1xi-N8TqJnsUljk",
    authDomain: "mundial-15371.firebaseapp.com",
    projectId: "mundial-15371",
    storageBucket: "mundial-15371.firebasestorage.app",
    messagingSenderId: "740014298129",
    appId: "1:740014298129:web:9098b4ed2c579527a68db0",
    databaseURL: "https://mundial-15371-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
let currentCedula = null;
let ocultarJugados = false;

window.toggleFiltroJugados = () => {
    ocultarJugados = !ocultarJugados;
    const btn = document.getElementById('btn-filtro-jugados');
    if (ocultarJugados) {
        btn.innerHTML = "👁️ MOSTRAR PARTIDOS JUGADOS";
        btn.style.background = "rgba(212, 175, 55, 0.2)";
    } else {
        btn.innerHTML = "👁️ OCULTAR PARTIDOS JUGADOS";
        btn.style.background = "rgba(255, 255, 255, 0.08)";
    }
    renderPartidos();
};

window.verReglamento = () => {
    Swal.fire({
        title: '<span style="font-family:Anton; color:#ffcc00">REGLAMENTO Y PUNTUACIÓN</span>',
        background: '#020d1a', color: '#fff', width: '95%',
        html: `
        <div style="text-align:left; font-size:0.85rem; line-height:1.4; color:#ccc; max-height: 400px; overflow-y: auto; padding-right: 5px;">
            <p>Los torneos están estructurados por una fase inicial de grupos seguida de una ronda eliminatoria.</p>
            <p><b>TIEMPO LÍMITE:</b> Puedes cambiar tu predicción hasta máximo <b>10 minutos antes</b> del inicio del partido.</p>
            <p><strong>90 MINUTOS:</strong> La predicción incluye el tiempo reglamentario más la reposición, pero <b>EXCLUYE</b> tiempos adicionales (prórrogas) o series de penaltis.</p>
            <h4 style="color:var(--accent-green); border-bottom:1px solid #333; margin:15px 0 5px 0">PUNTUACIÓN POR PARTIDO</h4>
            <table class="swal-table">
                <tr><th>Concepto</th><th>Ronda 1</th><th>Eliminatorias</th></tr>
                <tr><td>Acertar Resultado (Ganador/Empate)</td><td>5 pts</td><td>10 pts</td></tr>
                <tr><td>Acertar Goles Equipo Local</td><td>2 pts</td><td>4 pts</td></tr>
                <tr><td>Acertar Goles Equipo Visitante</td><td>2 pts</td><td>4 pts</td></tr>
                <tr><td>Acertar Diferencia de Goles</td><td>1 pt</td><td>2 pts</td></tr>
                <tr style="background:rgba(0,255,136,0.1)"><td><strong>TOTAL MÁXIMO</strong></td><td><strong>10 pts</strong></td><td><strong>20 pts</strong></td></tr>
            </table>
        </div>`,
        confirmButtonText: 'ENTENDIDO', confirmButtonColor: '#00ff88'
    });
};

async function mostrarLiderWOW() {
    const snap = await get(child(ref(db), 'usuarios'));
    if(snap.exists()){
        const usuarios = Object.values(snap.val()).sort((a,b) => b.puntos - a.puntos);
        if(usuarios[0] && usuarios[0].puntos > 0) {
            const maxPuntos = usuarios[0].puntos;
            const lideres = usuarios.filter(u => u.puntos === maxPuntos);
            const nombresLideres = lideres.map(u => u.nombre);
            let textoLideres = nombresLideres.length === 1 ? nombresLideres[0] : nombresLideres.slice(0, -1).join(', ') + ' y ' + nombresLideres.slice(-1);
            document.getElementById('leader-name-anim').innerText = textoLideres;
            const animDiv = document.getElementById('intro-anim');
            animDiv.style.display = 'flex';
            setTimeout(() => {
                animDiv.classList.add('animate__animated', 'animate__fadeOut');
                setTimeout(() => animDiv.style.display = 'none', 1000);
            }, 4500);
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.emailVerified) {
        const uidSnap = await get(child(ref(db), `mapa_usuarios/${user.uid}`));
        if(uidSnap.exists()) {
            currentCedula = uidSnap.val();
            const uSnap = await get(child(ref(db), `usuarios/${currentCedula}`));
            const uData = uSnap.val();
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('polla-section').style.display = 'block';
            document.getElementById('user-display-name').innerText = uData.nombre;
            document.getElementById('user-display-cedula').innerText = `C.C. ${currentCedula}`;
            if(uData.role === "admin") document.getElementById('admin-toggle').style.display = 'block';
            initApp();
            mostrarLiderWOW();
        }
    }
});

async function initApp() { await calcularMisPuntos(); renderPartidos(); renderRanking(); }

async function renderPartidos() {
    const snapP = await get(child(ref(db), 'partidos_oficiales'));
    const snapV = await get(child(ref(db), `pronosticos/${currentCedula}`));
    const snapR = await get(child(ref(db), 'resultados_oficiales'));
    const snapAll = await get(child(ref(db), 'pronosticos')); 

    const votos = snapV.exists() ? snapV.val() : {};
    const resultadosReales = snapR.exists() ? snapR.val() : {};
    const todosLosVotos = snapAll.exists() ? snapAll.val() : {}; 
    const cont = document.getElementById('contenedor-dinamico');
    cont.innerHTML = "";
    
    if(snapP.exists()){
        const ahora = new Date();
        const partidos = Object.entries(snapP.val());

        const banderas = {
            "alemania": "de", "arabia saudi": "sa", "arabia saudí": "sa", "arabia saudita": "sa",
            "argelia": "dz", "argentina": "ar", "australia": "au", "austria": "at",
            "bélgica": "be", "belgica": "be", "bolivia": "bo", "bosnia": "ba", "bosnia y herz": "ba",
            "bosnia y herzegovina": "ba", "brasil": "br", "cabo verde": "cv", "canadá": "ca",
            "canada": "ca", "catar": "qa", "chile": "cl", "colombia": "co", "corea del sur": "kr",
            "costa de marfil": "ci", "costa rica": "cr", "croacia": "hr", "curacao": "cw",
            "curazao": "cw", "dinamarca": "dk", "ecuador": "ec", "egipto": "eg", "escocia": "gb-sct",
            "españa": "es", "estados unidos": "us", "francia": "fr", "ghana": "gh", "grecia": "gr",
            "guatemala": "gt", "haiti": "ht", "haití": "ht", "holanda": "nl", "honduras": "hn",
            "inglaterra": "gb-eng", "irak": "iq", "iran": "ir", "irán": "ir", "iraq": "iq",
            "irlanda": "ie", "italia": "it", "jamaica": "jm", "japon": "jp", "japón": "jp",
            "jordania": "jo", "marruecos": "ma", "mexico": "mx", "méxico": "mx", "noruega": "no",
            "nueva zelanda": "nz", "países bajos": "nl", "panama": "pa", "panamá": "pa",
            "paraguay": "py", "peru": "pe", "perú": "pe", "polonia": "pl", "portugal": "pt",
            "qatar": "qa", "rd congo": "cd", "republica checa": "cz", "república checa": "cz",
            "república democrática del congo": "cd", "ri de iran": "ir", "ri de irán": "ir",
            "rumania": "ro", "rumanía": "ro", "senegal": "sn", "serbia": "rs", "sudafrica": "za",
            "sudáfrica": "za", "suecia": "se", "suiza": "ch", "turquia": "tr", "turquía": "tr",
            "tunez": "tn", "túnez": "tn","ucrania": "ua", "uruguay": "uy", "usa": "us", 
            "uzbekistan": "uz", "uzbekistán": "uz", "venezuela": "ve"
        };

        const obtenerBandera = (equipo) => {
            const nombreLimpio = equipo.toLowerCase().trim();
            const llaveEncontrada = Object.keys(banderas).find(k => nombreLimpio.includes(k) || k.includes(nombreLimpio));
            const codigo = llaveEncontrada ? banderas[llaveEncontrada] : null;
            return codigo ? `<img src="https://flagcdn.com/w80/${codigo}.png" class="flag-img" alt="${equipo}">` : `<span style="font-size: 1.5rem;">⚽</span>`;
        };

        partidos.forEach(([id, p]) => {
            const fechaPartido = new Date(p.fechaInicio);
            const bloqueado = ahora >= new Date(fechaPartido.getTime() - 600000);
            const resReal = resultadosReales[id];
            const tieneResultadoOficial = resReal !== undefined && resReal.golesL !== undefined && resReal.golesV !== undefined;
            
            if (ocultarJugados && tieneResultadoOficial) return;

            let votosLocal = 0, votosEmpate = 0, votosVisitante = 0;
            let totalVotosPartido = 0;

            Object.values(todosLosVotos).forEach(votosUsuario => {
                if(votosUsuario && votosUsuario[id]) {
                    const l = votosUsuario[id].local;
                    const v = votosUsuario[id].visitante;
                    if(l !== "" && v !== "" && l !== undefined && v !== undefined) {
                        totalVotosPartido++;
                        if(l > v) votosLocal++; else if(l < v) votosVisitante++; else votosEmpate++;
                    }
                }
            });

            const pctLocal = totalVotosPartido > 0 ? Math.round((votosLocal / totalVotosPartido) * 100) : 0;
            const pctEmpate = totalVotosPartido > 0 ? Math.round((votosEmpate / totalVotosPartido) * 100) : 100;
            const pctVisitante = totalVotosPartido > 0 ? Math.round((votosVisitante / totalVotosPartido) * 100) : 0;

            const textLocal = totalVotosPartido > 0 ? `${pctLocal}% Local` : `-`;
            const textEmpate = totalVotosPartido > 0 ? `${pctEmpate}% Empate` : `Sin pronósticos`;
            const textVisitante = totalVotosPartido > 0 ? `${pctVisitante}% Visita` : `-`;

            cont.innerHTML += `
            <div class="match-card" data-home="${p.equipoL.toLowerCase().trim()}" data-away="${p.equipoV.toLowerCase().trim()}">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--accent-gold); margin-bottom:12px;">
                    <span>${p.grupo.includes('Fase') ? p.grupo : 'GRUPO ' + p.grupo}</span>
                    <span>${fechaPartido.toLocaleString([], {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                
                <div class="match-row-container">
                    <div class="team-column">
                        <div class="team-name">${p.equipoL}</div>
                        ${obtenerBandera(p.equipoL)}
                    </div>
                    <div class="score-center-block">
                        <input type="number" id="l_${id}" value="${votos[id]?.local ?? ''}" class="input-score" ${bloqueado || tieneResultadoOficial ? 'disabled' : ''}>
                        <input type="number" id="v_${id}" value="${votos[id]?.visitante ?? ''}" class="input-score" ${bloqueado || tieneResultadoOficial ? 'disabled' : ''}>
                    </div>
                    <div class="team-column">
                        <div class="team-name">${p.equipoV}</div>
                        ${obtenerBandera(p.equipoV)}
                    </div>
                </div>
                
                <!-- ESPACIO SUTIL PARA MARCADOR EN VIVO -->
                <div class="sutil-live-score" style="text-align:center; font-size:1rem; font-weight:bold; font-family:'Anton'; margin-top:5px; min-height:22px;"></div>

                <div class="pulse-container">
                    <div class="pulse-title">TENDENCIA DE LOS PARTICIPANTES</div>
                    <div class="pulse-bar">
                        <div class="pulse-segment pulse-local" style="width: ${pctLocal}%"></div>
                        <div class="pulse-segment pulse-empate" style="width: ${pctEmpate}%"></div>
                        <div class="pulse-segment pulse-visitante" style="width: ${pctVisitante}%"></div>
                    </div>
                    <div class="pulse-labels">
                        <span class="lbl-local">${textLocal}</span>
                        <span class="lbl-empate">${textEmpate}</span>
                        <span class="lbl-visitante">${textVisitante}</span>
                    </div>
                </div>
                
                <div style="text-align:center; min-height: 35px; margin-top: 12px;">
                    ${tieneResultadoOficial ? `<div style="background: rgba(0, 255, 136, 0.12); border: 1px dashed var(--accent-green); color: var(--accent-green); padding: 5px 14px; border-radius: 8px; font-size: 0.9rem; font-weight: bold; font-family: 'Anton';">⚽ MARCADOR OFICIAL: ${resReal.golesL} - ${resReal.golesV}</div>` : ''}
                    ${bloqueado ? `<button class="btn-spy" onclick="verApuestasGlobales('${id}', '${p.equipoL}', '${p.equipoV}')">👁️ VER APUESTAS</button>` : `<span style="color:#555; font-size:0.85rem; font-style:italic;">🔒 Pronósticos ocultos</span>`}
                </div>
            </div>`;
        });
    }
}

// --- LÓGICA DE MARCADORES EN VIVO ---
async function sincronizarMarcadoresSutiles() {
    const traducciones = {
        "mexico": "méxico",
        "south africa": "sudáfrica",
        "south korea": "corea del sur",
        "czech republic": "república checa",
        "canada": "canadá",
        "bosnia and herzegovina": "bosnia y herz",
        "qatar": "qatar",
        "switzerland": "suiza",
        "brazil": "brasil",
        "morocco": "marruecos",
        "haiti": "haití",
        "scotland": "escocia",
        "united states": "estados unidos",
        "paraguay": "paraguay",
        "australia": "australia",
        "turkey": "turquía",
        "germany": "alemania",
        "curaçao": "curazao",
        "ivory coast": "costa de marfil",
        "ecuador": "ecuador",
        "netherlands": "países bajos",
        "japan": "japón",
        "sweden": "suecia",
        "tunisia": "túnez",
        "belgium": "bélgica",
        "egypt": "egipto",
        "iran": "ri de irán",
        "new zealand": "nueva zelanda",
        "spain": "españa",
        "cape verde": "cabo verde",
        "saudi arabia": "arabia saudí",
        "uruguay": "uruguay",
        "france": "francia",
        "senegal": "senegal",
        "iraq": "irak",
        "norway": "noruega",
        "argentina": "argentina",
        "algeria": "argelia",
        "austria": "austria",
        "jordan": "jordania",
        "portugal": "portugal",
        "democratic republic of the congo": "rd congo",
        "uzbekistan": "uzbekistán",
        "colombia": "colombia",
        "england": "inglaterra",
        "croatia": "croacia",
        "ghana": "ghana",
        "panama": "panamá"
    };

    try {
        const response = await fetch("https://worldcup26.ir/get/games");
        const data = await response.json();
        
        document.querySelectorAll('.match-card').forEach(card => {
            const homeCard = card.getAttribute('data-home');
            const awayCard = card.getAttribute('data-away');
            const sutilDiv = card.querySelector('.sutil-live-score');
            
            const game = (data.games || []).find(g => {
                const hApi = (g.home_team_name_en || "").toLowerCase().trim();
                const aApi = (g.away_team_name_en || "").toLowerCase().trim();
                return (traducciones[hApi] || hApi) === homeCard && (traducciones[aApi] || aApi) === awayCard;
            });

            if (game && sutilDiv) {
                if (game.time_elapsed === 'live') {
                    sutilDiv.innerHTML = `<span class="score-numbers-wow">${game.home_score}</span> <span class="estado-vivo">EN VIVO</span> <span class="score-numbers-wow">${game.away_score}</span>`;
                } 
                else if (game.time_elapsed === 'finished') {
                    sutilDiv.innerHTML = "";
                }
            }
        });
    } catch (e) { /* Silencioso */ }
}
setInterval(sincronizarMarcadoresSutiles, 1000);

// --- UTILIDADES ---
window.verApuestasGlobales = async (id, eL, eV) => {
    const snapU = await get(child(ref(db), 'usuarios'));
    const snapV = await get(child(ref(db), 'pronosticos'));
    if(!snapU.exists()) return Swal.fire("Información", "No hay usuarios.", "info");
    const usuarios = snapU.val();
    const todosLosPronosticos = snapV.exists() ? snapV.val() : {};
    let tablaHtml = `<div style="max-height: 350px; overflow-y: auto; padding-right: 5px;"><table class="swal-table"><thead><tr><th>Participante</th><th style="text-align:center; width:80px;">Pronóstico</th></tr></thead><tbody>`;
    let contadorVotos = 0;
    Object.keys(usuarios).forEach(cedula => {
        const nombreUsuario = usuarios[cedula].nombre;
        const votoUsuario = todosLosPronosticos[cedula]?.[id];
        let celdaPronostico = `<span style="color:#666; font-style:italic;">Sin apuesta</span>`;
        if(votoUsuario !== undefined && votoUsuario.local !== "" && votoUsuario.visitante !== "") {
            celdaPronostico = `<b style="color:var(--accent-green); font-size:1.1rem;">${votoUsuario.local} - ${votoUsuario.visitante}</b>`;
            contadorVotos++;
        }
        tablaHtml += `<tr><td style="color:#fff; font-weight:600;">${nombreUsuario}</td><td style="text-align:center;">${celdaPronostico}</td></tr>`;
    });
    tablaHtml += `</tbody></table></div><p style="font-size:0.8rem; color:#888; text-align:right; margin-top:10px;">Apuestas registradas: ${contadorVotos}</p>`;
    Swal.fire({ title: `<span style="font-family:Anton; color:var(--accent-gold); font-size:1.4rem;">PRONÓSTICOS REGISTRADOS</span><br><span style="font-size:0.9rem; color:#fff;">${eL} vs ${eV}</span>`, background: '#020d1a', color: '#fff', width: '450px', html: tablaHtml, confirmButtonText: 'CERRAR', confirmButtonColor: '#333' });
};

window.guardarTodosLosPronosticos = async () => {
    try {
        const snapP = await get(child(ref(db), 'partidos_oficiales'));
        if (!snapP.exists()) return;
        let up = {}; const ahora = new Date(); let hayCambios = false;
        Object.entries(snapP.val()).forEach(([id, p]) => {
            const bloqueado = ahora >= new Date(new Date(p.fechaInicio).getTime() - 600000);
            if (!bloqueado) {
                const inputL = document.getElementById(`l_${id}`);
                const inputV = document.getElementById(`v_${id}`);
                if (inputL && inputV) {
                    const l = inputL.value.trim(); const v = inputV.value.trim();
                    if (l !== "" && v !== "" && !isNaN(l) && !isNaN(v)) {
                        up[id] = { local: Math.max(0, parseInt(l)), visitante: Math.max(0, parseInt(v)) };
                        hayCambios = true;
                    } else {
                        up[id] = { local: "", visitante: "" };
                        hayCambios = true;
                    }
                }
            }
        });
        if (hayCambios) await update(ref(db, `pronosticos/${currentCedula}`), up);
        Swal.fire("Éxito", "Tus pronósticos han sido actualizados", "success").then(() => renderPartidos());
    } catch (error) { Swal.fire("Error", "No se pudo guardar: " + error.message, "error"); }
};

async function calcularMisPuntos() {
    const snapO = await get(child(ref(db), 'resultados_oficiales'));
    const snapP = await get(child(ref(db), 'partidos_oficiales'));
    const snapU = await get(child(ref(db), 'usuarios'));
    const snapV = await get(child(ref(db), 'pronosticos'));
    if(!snapO.exists() || !snapP.exists() || !snapU.exists()) return;
    const ofi = snapO.val(), part = snapP.val(), usuarios = snapU.val(), todosLosPronosticos = snapV.exists() ? snapV.val() : {};
    let updatesUsuarios = {};
    Object.keys(usuarios).forEach(cedula => {
        let pts = 0; const misPronosticos = todosLosPronosticos[cedula] || {};
        Object.keys(part).forEach(id => {
            if(misPronosticos[id] && ofi[id]) {
                const golesL = parseInt(ofi[id].golesL, 10); const golesV = parseInt(ofi[id].golesV, 10);
                const local = parseInt(misPronosticos[id].local, 10); const visitante = parseInt(misPronosticos[id].visitante, 10);
                if(isNaN(golesL) || isNaN(golesV) || isNaN(local) || isNaN(visitante)) return;
                const esEliminatoria = part[id].grupo.toLowerCase().includes('fase') || part[id].grupo.toLowerCase().includes('final');
                const factor = esEliminatoria ? 2 : 1;
                if(Math.sign(golesL - golesV) === Math.sign(local - visitante)) pts += (5 * factor);
                if(golesL === local) pts += (2 * factor); if(golesV === visitante) pts += (2 * factor);
                if((golesL - golesV) === (local - visitante)) pts += (1 * factor);
            }
        });
        updatesUsuarios[`usuarios/${cedula}/puntos`] = pts;
    });
    await update(ref(db), updatesUsuarios);
    if (currentCedula && usuarios[currentCedula]) document.getElementById('mis-puntos-total').innerText = updatesUsuarios[`usuarios/${currentCedula}/puntos`] || 0;
}

async function renderRanking() {
    const snap = await get(child(ref(db), 'usuarios'));
    if(snap.exists()){
        const sorted = Object.values(snap.val()).sort((a,b) => b.puntos - a.puntos);
        let htmlRanking = ""; let puestoActual = 1;
        sorted.forEach((u, i) => {
            if (i > 0 && u.puntos < sorted[i - 1].puntos) puestoActual++;
            const esMismoPuntajeAnterior = i > 0 && u.puntos === sorted[i - 1].puntos;
            htmlRanking += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight: 600;">${esMismoPuntajeAnterior ? '&nbsp;&nbsp;&nbsp;&nbsp;' : puestoActual + '.'} ${u.nombre}</span><span style="color:var(--accent-gold); font-weight:bold">${u.puntos} PTS</span></div>`;
        });
        document.getElementById('body-ranking').innerHTML = htmlRanking;
    }
}

window.toggleAdminPanel = () => {
    const p = document.getElementById('admin-panel');
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
    if(p.style.display === 'block') renderAdminList();
};

async function renderAdminList() {
    const snapP = await get(child(ref(db), 'partidos_oficiales'));
    const snapR = await get(child(ref(db), 'resultados_oficiales'));
    const list = document.getElementById('admin-list'); list.innerHTML = "";
    if(snapP.exists()){
        const resOf = snapR.exists() ? snapR.val() : {};
        Object.entries(snapP.val()).forEach(([id, p]) => {
            const tieneResultado = resOf[id] !== undefined && resOf[id].golesL !== undefined && resOf[id].golesV !== undefined && resOf[id].golesL !== "" && resOf[id].golesV !== "";
            list.innerHTML += `<div style="margin-bottom:10px; padding:10px; border-bottom:1px solid #333">${p.equipoL} vs ${p.equipoV} (${p.grupo})<div style="display:flex; gap:5px; margin-top:5px"><input type="number" id="adm_l_${id}" class="input-score" style="width:40px; height:40px" value="${resOf[id]?.golesL ?? ''}" ${tieneResultado ? 'disabled' : ''}><input type="number" id="adm_v_${id}" class="input-score" style="width:40px; height:40px" value="${resOf[id]?.golesV ?? ''}" ${tieneResultado ? 'disabled' : ''}></div></div>`;
        });
    }
}

window.crearPartidoOficial = async () => {
    const l = document.getElementById('new-equipoL').value, v = document.getElementById('new-equipoV').value, g = document.getElementById('new-grupo').value, f = document.getElementById('new-fecha').value;
    if(!l || !v || !g || !f) return Swal.fire("Error", "Faltan datos", "error");
    await set(ref(db, 'partidos_oficiales/p_' + Date.now()), { equipoL: l, equipoV: v, grupo: g, fechaInicio: f });
    renderAdminList(); Swal.fire("Creado", "Partido en línea", "success");
};

window.cargarPartidosMasivos = async () => {
    const jsonText = document.getElementById('bulk-json').value;
    if(!jsonText) return Swal.fire("Error", "Por favor pega el código JSON primero", "warning");
    try {
        const partidos = JSON.parse(jsonText);
        if(!Array.isArray(partidos)) throw new Error("El formato debe ser una lista con corchetes [ ]");
        let contadorAgregados = 0;
        for (let i = 0; i < partidos.length; i++) {
            const p = partidos[i];
            const eqL = p.local || p.equipoL; const eqV = p.visitante || p.equipoV; const grp = p.grupo; const fecha = p.fecha_hora || p.fechaInicio;
            if(eqL && eqV && grp && fecha) {
                const uniqueId = 'p_' + (Date.now() + i);
                await set(ref(db, `partidos_oficiales/${uniqueId}`), { equipoL: eqL, equipoV: eqV, grupo: grp, fechaInicio: fecha });
                contadorAgregados++;
            }
        }
        document.getElementById('bulk-json').value = ""; renderAdminList();
        Swal.fire("Sincronización Exitosa", `Se importaron ${contadorAgregados} partidos correctamente.`, "success");
    } catch (err) { Swal.fire("Error de Formato JSON", err.message, "error"); }
};

window.guardarResultadosOficiales = async () => {
    const snapP = await get(child(ref(db), 'partidos_oficiales')); let data = {};
    Object.keys(snapP.val()).forEach(id => {
        const l = document.getElementById(`adm_l_${id}`).value, v = document.getElementById(`adm_v_${id}`).value;
        if(l !== "" && v !== "") data[id] = { golesL: parseInt(l), golesV: parseInt(v) };
    });
    await set(ref(db, 'resultados_oficiales'), data); await calcularMisPuntos();
    Swal.fire("Publicado", "Los resultados ya son oficiales", "success");
};

window.abrirLaboratorioDatos = async () => {
    const snapP = await get(child(ref(db), 'partidos_oficiales')); const snapR = await get(child(ref(db), 'resultados_oficiales'));
    if (!snapP.exists() || !snapR.exists()) return Swal.fire("Info", "Aún no hay suficientes partidos jugados.", "info");
    const partidos = snapP.val(); const resultados = snapR.val(); let statsEquipos = {};
    Object.keys(partidos).forEach(id => {
        if (resultados[id] && resultados[id].golesL !== "" && resultados[id].golesV !== "") {
            const eqL = partidos[id].equipoL; const eqV = partidos[id].equipoV; const gL = parseInt(resultados[id].golesL, 10); const gV = parseInt(resultados[id].golesV, 10);
            if (!statsEquipos[eqL]) statsEquipos[eqL] = { jugados: 0, victorias: 0, empates: 0, derrotas: 0, golesFavor: 0, golesContra: 0 };
            if (!statsEquipos[eqV]) statsEquipos[eqV] = { jugados: 0, victorias: 0, empates: 0, derrotas: 0, golesFavor: 0, golesContra: 0 };
            statsEquipos[eqL].jugados++; statsEquipos[eqV].jugados++; statsEquipos[eqL].golesFavor += gL; statsEquipos[eqL].golesContra += gV; statsEquipos[eqV].golesFavor += gV; statsEquipos[eqV].golesContra += gL;
            if (gL > gV) { statsEquipos[eqL].victorias++; statsEquipos[eqV].derrotas++; } else if (gL < gV) { statsEquipos[eqV].victorias++; statsEquipos[eqL].derrotas++; } else { statsEquipos[eqL].empates++; statsEquipos[eqV].empates++; }
        }
    });
    let arrayStats = Object.entries(statsEquipos).map(([nombre, s]) => ({ nombre, ...s, winRate: s.jugados > 0 ? Math.round((s.victorias / s.jugados) * 100) : 0 }));
    if (arrayStats.length === 0) return Swal.fire("Info", "No hay resultados oficiales.", "info");
    const rankOfensivas = [...arrayStats].filter(e => e.golesFavor > 0).sort((a, b) => b.golesFavor - a.golesFavor);
    const rankDefensas = [...arrayStats].filter(e => e.jugados > 0).sort((a, b) => a.golesContra - b.golesContra);
    const rankWinRate = [...arrayStats].filter(e => e.jugados > 0).sort((a, b) => b.winRate - a.winRate);
    const maxGolesF = rankOfensivas.length > 0 ? Math.max(...rankOfensivas.map(e => e.golesFavor)) : 1;
    const maxGolesC = rankDefensas.length > 0 ? Math.max(...rankDefensas.map(e => e.golesContra)) : 1; 

    const generarHTMLBarra = (titulo, icono, arrayDatos, valorKey, textoSufijo, colorClass, maxValor, idBloque) => {
        let html = `<h4 style="color:var(--accent-gold); margin: 25px 0 10px 0; border-bottom: 1px solid #333; padding-bottom: 5px;">${icono} ${titulo}</h4>`;
        arrayDatos.slice(0, 5).forEach((eq, index) => {
            const porcentajeAncho = maxValor > 0 ? (eq[valorKey] / maxValor) * 100 : 0;
            html += `<div class="stat-row"><div class="stat-team-info"><span style="color:#666; font-size:0.8rem; width:15px;">${index+1}.</span> <span>${eq.nombre.substring(0, 12)}</span></div><div class="stat-bar-container"><div class="stat-bar-fill ${colorClass}" style="width: ${porcentajeAncho}%"></div></div><div class="stat-numbers">${eq[valorKey]} ${textoSufijo}</div></div>`;
        });
        if (arrayDatos.length > 5) {
            html += `<div id="extra-rows-${idBloque}" style="display:none;">`;
            arrayDatos.slice(5).forEach((eq, index) => {
                const porcentajeAncho = maxValor > 0 ? (eq[valorKey] / maxValor) * 100 : 0;
                html += `<div class="stat-row animate__animated animate__fadeIn"><div class="stat-team-info"><span style="color:#666; font-size:0.8rem; width:15px;">${index + 6}.</span> <span>${eq.nombre.substring(0, 12)}</span></div><div class="stat-bar-container"><div class="stat-bar-fill ${colorClass}" style="width: ${porcentajeAncho}%"></div></div><div class="stat-numbers">${eq[valorKey]} ${textoSufijo}</div></div>`;
            });
            html += `</div><div style="text-align:center; margin-top:8px;"><button onclick="toggleStatsLaboratorio('${idBloque}', this)" style="background:none; border:1px solid #555; color:#aaa; padding:5px 15px; border-radius:15px; cursor:pointer; font-family:'Barlow Condensed'; font-weight:bold; transition:0.3s;">VER MÁS ▼</button></div>`;
        }
        return html;
    };
    let modalHTML = `<div class="stats-container">` + generarHTMLBarra("MÁQUINAS GOLEADORAS (Goles a Favor)", "⚽", rankOfensivas, 'golesFavor', 'GF', 'bg-offensive', maxGolesF, 'ofensiva') + generarHTMLBarra("MUROS INFRANQUEABLES (Goles en Contra)", "🛡️", rankDefensas, 'golesContra', 'GC', 'bg-defensive', Math.max(maxGolesC, 5), 'defensa') + generarHTMLBarra("EFECTIVIDAD (% Victorias)", "🔥", rankWinRate, 'winRate', '%', 'bg-winrate', 100, 'efectividad') + `</div>`;
    Swal.fire({ title: `<span style="font-family:Anton; font-size:1.8rem; color:#fff;">CENTRAL DE DATOS</span>`, html: modalHTML, background: '#020d1a', color: '#fff', width: '600px', confirmButtonText: 'CERRAR PANEL', confirmButtonColor: '#333' });
};

window.toggleStatsLaboratorio = (idBloque, btnElement) => {
    const contenedorExtra = document.getElementById(`extra-rows-${idBloque}`);
    if (!contenedorExtra) return;
    const estaOculto = contenedorExtra.style.display === 'none';
    contenedorExtra.style.display = estaOculto ? 'block' : 'none';
    btnElement.innerText = estaOculto ? "VER MENOS ▲" : "VER MÁS ▼";
    btnElement.style.color = estaOculto ? "var(--accent-green)" : "#aaa";
    btnElement.style.borderColor = estaOculto ? "var(--accent-green)" : "#555";
};

window.handleLogin = async () => {
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    try {
        const res = await signInWithEmailAndPassword(auth, e, p);
        if(!res.user.emailVerified) { await signOut(auth); return Swal.fire("Verifica tu email", "", "warning"); }
    } catch (err) { Swal.fire("Error", "Credenciales incorrectas", "error"); }
};

window.handleRegister = async () => {
    const n = document.getElementById('reg-nombre').value, c = document.getElementById('reg-cedula').value, e = document.getElementById('reg-email').value, p = document.getElementById('reg-pass').value;
    try {
        const res = await createUserWithEmailAndPassword(auth, e, p); await sendEmailVerification(res.user);
        await set(ref(db, `usuarios/${c}`), { nombre: n, email: e, uid: res.user.uid, puntos: 0, role: "user" });
        await set(ref(db, `mapa_usuarios/${res.user.uid}`), c); Swal.fire("Registro", "Revisa tu email", "success"); mostrarLogin();
    } catch (err) { Swal.fire("Error", err.message, "error"); }
};

window.mostrarRegistro = () => { document.getElementById('login-form').style.display='none'; document.getElementById('register-form').style.display='block'; };
window.mostrarLogin = () => { document.getElementById('login-form').style.display='block'; document.getElementById('register-form').style.display='none'; };
window.logout = () => signOut(auth).then(() => location.reload());
