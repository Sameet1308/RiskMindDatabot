
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';
import { Loader2, AlertTriangle, Shield, AlertOctagon } from 'lucide-react';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for risk levels
const highRiskIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const mediumRiskIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const lowRiskIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function RiskMap() {
    const [policies, setPolicies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                const data = await apiService.getPolicies();
                // Filter policies that have lat/long
                const validPolicies = data.filter((p: any) => p.latitude && p.longitude);
                setPolicies(validPolicies);
            } catch (error) {
                console.error("Failed to fetch policies for map", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPolicies();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full relative" style={{ height: '85vh' }}>
            <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-gray-200 w-64">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" /> Geospatial Intelligence
                </h3>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span>High Risk ({policies.filter(p => p.risk_level === 'high').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                        <span>Medium Risk ({policies.filter(p => p.risk_level === 'medium').length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        <span>Low Risk ({policies.filter(p => p.risk_level === 'low').length})</span>
                    </div>
                </div>
            </div>

            <MapContainer
                center={[39.8283, -98.5795]}
                zoom={4}
                className="h-full w-full"
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {policies.map((policy) => (
                    <Marker
                        key={policy.policy_number}
                        position={[policy.latitude, policy.longitude]}
                        icon={
                            policy.risk_level === 'high' ? highRiskIcon :
                                policy.risk_level === 'medium' ? mediumRiskIcon :
                                    lowRiskIcon
                        }
                    >
                        <Popup>
                            <div className="p-1">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${policy.risk_level === 'high' ? 'bg-red-100 text-red-800' :
                                        policy.risk_level === 'medium' ? 'bg-amber-100 text-amber-800' :
                                            'bg-emerald-100 text-emerald-800'
                                        }`}>
                                        {policy.risk_level} Risk
                                    </span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">{policy.policyholder_name}</h4>
                                <p className="text-xs text-gray-500 mb-2">{policy.industry_type}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                                    <div>
                                        <span className="block text-gray-400">Policy #</span>
                                        <span className="font-mono">{policy.policy_number}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-gray-400">Premium</span>
                                        <span className="font-medium">${policy.premium.toLocaleString()}</span>
                                    </div>
                                </div>
                                <button className="w-full mt-3 bg-slate-900 text-white text-xs py-1.5 rounded hover:bg-slate-800 transition-colors">
                                    Analyze Risk
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
