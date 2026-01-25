import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack/Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapOrder {
    id_orden: number;
    latcambio: string;
    longcambio: string;
    id_estado_orden: string;
}

interface AgentMapProps {
    orders: MapOrder[];
}

const AgentMap: React.FC<AgentMapProps> = ({ orders }) => {
    // Filter orders with valid coordinates
    const mapPoints = orders
        .filter(o => o.latcambio && o.longcambio && !isNaN(parseFloat(o.latcambio)) && !isNaN(parseFloat(o.longcambio)))
        .map(o => ({
            id: o.id_orden,
            position: [parseFloat(o.latcambio), parseFloat(o.longcambio)] as [number, number],
            title: `Orden #${o.id_orden}`,
            status: o.id_estado_orden
        }));

    // Default center (e.g., center calculated from points or a default city like Cordoba)
    const center: [number, number] = mapPoints.length > 0
        ? mapPoints[0].position
        : [-31.4135, -64.18105]; // Default Cordoba

    return (
        <div className="w-full h-full rounded-[2rem] overflow-hidden shadow-inner border border-gray-100">
            <MapContainer
                center={center}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapPoints.map((point) => (
                    <Marker key={point.id} position={point.position}>
                        <Popup>
                            <div className="font-sans">
                                <p className="font-black text-slate-800 m-0">{point.title}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Estado registrado</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default AgentMap;
