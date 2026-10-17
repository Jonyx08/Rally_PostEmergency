
// simulador_mula.js
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/reportes/sync';

// Coordenadas base en San Miguel (El Salvador)
const CENTRO_SM_LAT = 13.4833;
const CENTRO_SM_LNG = -88.1833;

function generarReportes(cantidad) {
    const reportes = [];
    const tipos = ['DERRUMBE', 'INUNDACION', 'ACCIDENTE', 'COLAPSO_ESTRUCTURAL'];

    for (let i = 0; i < cantidad; i++) {
        // Generar coordenadas ligeramente dispersas
        // 0.001 de lat/lng son aprox 100 metros
        const offsetLat = (Math.random() - 0.5) * 0.01;
        const offsetLng = (Math.random() - 0.5) * 0.01;

        reportes.push({
            tipoEmergencia: tipos[Math.floor(Math.random() * tipos.length)],
            latitud: CENTRO_SM_LAT + offsetLat,
            longitud: CENTRO_SM_LNG + offsetLng,
            timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Última hora
            dispositivoId: `device-simulado-${i}`,
            estado: 'OFFLINE'
        });
    }

    // Para el demo del Rally: forzar un "cluster" (mucha gente reportando lo mismo en el mismo lugar)
    const clusterLat = 13.4900;
    const clusterLng = -88.1900;
    for (let i = 0; i < 20; i++) {
        reportes.push({
            tipoEmergencia: 'INUNDACION',
            // Todos caen en un radio de ~10 metros
            latitud: clusterLat + (Math.random() - 0.5) * 0.0001,
            longitud: clusterLng + (Math.random() - 0.5) * 0.0001,
            timestamp: new Date().toISOString(),
            dispositivoId: `device-cluster-${i}`,
            estado: 'OFFLINE'
        });
    }

    return reportes;
}

async function simularLlegadaMula() {
    console.log("🚙 Patrulla recuperó señal. Iniciando descarga...");
    const reportesOffline = generarReportes(80); // 80 aleatorios + 20 del cluster

    try {
        const response = await axios.post(API_URL, reportesOffline);
        console.log(`✅ Sincronización exitosa: ${response.data.count} reportes subidos.`);
    } catch (error) {
        console.error("❌ Error en sincronización:", error.message);
    }
}

simularLlegadaMula();
