import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';
import { Loader2, Shield, TrendingUp, AlertTriangle, Activity, Layers } from 'lucide-react';
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

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toLocaleString()}`;
const fmtFull = (n: number) => `$${n.toLocaleString()}`;

type RiskMapProps = {
    policies?: any[];
    analytics?: any;
    height?: string;
    aiInsights?: string;
};

export default function RiskMap({ policies: providedPolicies, analytics: providedAnalytics, height = '60vh', aiInsights }: RiskMapProps) {
    const [policies, setPolicies] = useState<any[]>(providedPolicies || []);
    const [analytics, setAnalytics] = useState<any>(providedAnalytics || null);
    const [loading, setLoading] = useState(!providedPolicies);
    const [activeTab, setActiveTab] = useState<'overview' | 'industry' | 'hotspots'>('overview');

    useEffect(() => {
        if (providedPolicies) {
            setPolicies(providedPolicies);
            setAnalytics(providedAnalytics || null);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const data = await apiService.getGeoPolicies();
                setPolicies(data.policies || []);
                setAnalytics(data.analytics || null);
            } catch (error) {
                console.error("Failed to fetch geo policies", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [providedPolicies, providedAnalytics]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                <Loader2 style={{ width: '2rem', height: '2rem', animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            </div>
        );
    }

    const riskDist = analytics?.risk_distribution || {
        high: policies.filter(p => p.risk_level === 'high').length,
        medium: policies.filter(p => p.risk_level === 'medium').length,
        low: policies.filter(p => p.risk_level === 'low').length,
    };
    const totalPolicies = analytics?.total_policies || policies.length;
    const portfolioLR = analytics?.portfolio_loss_ratio || 0;
    const totalPremium = analytics?.total_premium || 0;
    const totalClaims = analytics?.total_claims || 0;
    const industries = analytics?.industry_concentration || [];
    const hotspots = analytics?.hotspots || [];
    const topRisk = analytics?.top_risk_policies || [];

    return (
        <div className="geo-enhanced-layout" style={{ height }}>
            {/* Map */}
            <div className="geo-map-area">
                <MapContainer
                    center={[39.8283, -98.5795]}
                    zoom={4}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                                <div style={{ minWidth: '220px', padding: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span className={`geo-popup-badge geo-popup-badge--${policy.risk_level}`}>
                                            {policy.risk_level} risk
                                        </span>
                                        {policy.loss_ratio > 0 && (
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 600,
                                                color: policy.loss_ratio > 80 ? '#dc2626' : policy.loss_ratio > 60 ? '#d97706' : '#059669'
                                            }}>
                                                LR: {policy.loss_ratio}%
                                            </span>
                                        )}
                                    </div>
                                    <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111', marginBottom: '2px' }}>
                                        {policy.policyholder_name}
                                    </h4>
                                    <p style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '8px' }}>
                                        {policy.industry_type}
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.7rem', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
                                        <div>
                                            <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.6rem' }}>Premium</span>
                                            <span style={{ fontWeight: 600 }}>{fmt(policy.premium)}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.6rem' }}>Claims</span>
                                            <span style={{ fontWeight: 600 }}>{policy.claim_count}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', color: '#9ca3af', fontSize: '0.6rem' }}>Total</span>
                                            <span style={{ fontWeight: 600 }}>{fmt(policy.total_claims)}</span>
                                        </div>
                                    </div>
                                    {policy.claim_types && policy.claim_types.length > 0 && (
                                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                                            <span style={{ fontSize: '0.6rem', color: '#9ca3af', display: 'block', marginBottom: '3px' }}>Claim Types</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                                {policy.claim_types.map((ct: any, i: number) => (
                                                    <span key={i} style={{
                                                        fontSize: '0.6rem', padding: '1px 6px',
                                                        background: '#f3f4f6', borderRadius: '8px', color: '#374151'
                                                    }}>
                                                        {ct.type} ({ct.count})
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '6px', fontFamily: 'monospace' }}>
                                        {policy.policy_number}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Intelligence Sidebar */}
            <div className="geo-sidebar">
                {/* Portfolio KPIs */}
                <div className="geo-kpi-strip">
                    <div className="geo-kpi">
                        <span className="geo-kpi-value">{totalPolicies}</span>
                        <span className="geo-kpi-label">Policies</span>
                    </div>
                    <div className="geo-kpi">
                        <span className="geo-kpi-value">{fmt(totalPremium)}</span>
                        <span className="geo-kpi-label">Premium</span>
                    </div>
                    <div className="geo-kpi">
                        <span className="geo-kpi-value">{fmt(totalClaims)}</span>
                        <span className="geo-kpi-label">Claims</span>
                    </div>
                    <div className="geo-kpi">
                        <span className="geo-kpi-value" style={{ color: portfolioLR > 80 ? '#dc2626' : portfolioLR > 60 ? '#d97706' : '#059669' }}>
                            {portfolioLR}%
                        </span>
                        <span className="geo-kpi-label">Loss Ratio</span>
                    </div>
                </div>

                {/* Risk Distribution Bar */}
                <div className="geo-section">
                    <div className="geo-section-title">
                        <Shield style={{ width: '0.75rem', height: '0.75rem' }} /> Risk Distribution
                    </div>
                    <div className="geo-risk-bar">
                        {riskDist.high > 0 && <div className="geo-risk-seg geo-risk-seg--high" style={{ flex: riskDist.high }} />}
                        {riskDist.medium > 0 && <div className="geo-risk-seg geo-risk-seg--med" style={{ flex: riskDist.medium }} />}
                        {riskDist.low > 0 && <div className="geo-risk-seg geo-risk-seg--low" style={{ flex: riskDist.low }} />}
                    </div>
                    <div className="geo-risk-legend">
                        <span><span className="geo-dot geo-dot--high" /> High ({riskDist.high})</span>
                        <span><span className="geo-dot geo-dot--med" /> Medium ({riskDist.medium})</span>
                        <span><span className="geo-dot geo-dot--low" /> Low ({riskDist.low})</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="geo-tabs">
                    <button className={`geo-tab ${activeTab === 'overview' ? 'geo-tab--active' : ''}`} onClick={() => setActiveTab('overview')}>
                        <Activity style={{ width: '0.7rem', height: '0.7rem' }} /> Top Risk
                    </button>
                    <button className={`geo-tab ${activeTab === 'industry' ? 'geo-tab--active' : ''}`} onClick={() => setActiveTab('industry')}>
                        <Layers style={{ width: '0.7rem', height: '0.7rem' }} /> Industry
                    </button>
                    <button className={`geo-tab ${activeTab === 'hotspots' ? 'geo-tab--active' : ''}`} onClick={() => setActiveTab('hotspots')}>
                        <AlertTriangle style={{ width: '0.7rem', height: '0.7rem' }} /> Hotspots
                    </button>
                </div>

                <div className="geo-tab-content">
                    {activeTab === 'overview' && (
                        <div className="geo-list">
                            {topRisk.length === 0 && <p className="geo-empty">No high-risk policies</p>}
                            {topRisk.map((p: any, i: number) => (
                                <div key={i} className="geo-list-item">
                                    <div className="geo-list-item-main">
                                        <span className="geo-list-item-name">{p.name}</span>
                                        <span className="geo-list-item-id">{p.policy_number}</span>
                                    </div>
                                    <div className="geo-list-item-metrics">
                                        <span className="geo-list-item-claims">{fmt(p.total_claims)}</span>
                                        <span className={`geo-list-item-lr ${p.loss_ratio > 80 ? 'geo-lr--danger' : p.loss_ratio > 60 ? 'geo-lr--warn' : 'geo-lr--ok'}`}>
                                            {p.loss_ratio}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'industry' && (
                        <div className="geo-list">
                            {industries.map((ind: any, i: number) => (
                                <div key={i} className="geo-industry-item">
                                    <div className="geo-industry-header">
                                        <span className="geo-industry-name">{ind.industry}</span>
                                        <span className="geo-industry-count">{ind.count} policies</span>
                                    </div>
                                    <div className="geo-industry-bar-wrap">
                                        <div className="geo-industry-bar" style={{
                                            width: `${Math.min(ind.loss_ratio, 120)}%`,
                                            background: ind.loss_ratio > 80 ? '#ef4444' : ind.loss_ratio > 60 ? '#f59e0b' : '#10b981'
                                        }} />
                                    </div>
                                    <div className="geo-industry-stats">
                                        <span>Premium: {fmt(ind.premium)}</span>
                                        <span>Claims: {fmt(ind.claims)}</span>
                                        <span style={{ fontWeight: 600, color: ind.loss_ratio > 80 ? '#dc2626' : ind.loss_ratio > 60 ? '#d97706' : '#059669' }}>
                                            LR: {ind.loss_ratio}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'hotspots' && (
                        <div className="geo-list">
                            {hotspots.length === 0 && <p className="geo-empty">No concentration hotspots detected</p>}
                            {hotspots.map((h: any, i: number) => (
                                <div key={i} className="geo-hotspot-item">
                                    <div className="geo-hotspot-icon">
                                        <AlertTriangle style={{ width: '0.75rem', height: '0.75rem', color: '#f59e0b' }} />
                                    </div>
                                    <div className="geo-hotspot-info">
                                        <span className="geo-hotspot-title">
                                            Cluster ({h.policy_count} policies)
                                        </span>
                                        <span className="geo-hotspot-detail">
                                            {fmtFull(h.total_claims)} claims | LR: {h.loss_ratio}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Narrative */}
                {aiInsights && (
                    <div className="geo-ai-panel">
                        <div className="geo-ai-title">
                            <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} /> AI Risk Insights
                        </div>
                        <p className="geo-ai-text">{aiInsights}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
