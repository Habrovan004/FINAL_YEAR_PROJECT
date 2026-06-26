import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, MapPin, Building2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import "./auth.css";
import "./SelectHospital.css";

// ── Types ──────────────────────────────────────────────────────────────────
interface Hospital {
  id: number;
  name: string;
  address: string;
  type: "public" | "private";
  lat: number;
  lng: number;
  distance_km: number;
}

// ── Mock data (replace with API call: GET /api/hospitals/?lat=...&lng=...) ──
const MOCK_HOSPITALS: Hospital[] = [
  { id: 1, name: "Mwananyamala Hospital",      address: "Bagamoyo Rd, Dar es Salaam",  type: "public",  lat: -6.7724, lng: 39.2383, distance_km: 1.2 },
  { id: 2, name: "Sinza Hospital",              address: "Sinza, Dar es Salaam",         type: "public",  lat: -6.7824, lng: 39.2283, distance_km: 2.4 },
  { id: 3, name: "CCBRT Hospital",              address: "Bagamoyo Rd, Dar es Salaam",  type: "private", lat: -6.7924, lng: 39.2483, distance_km: 3.1 },
  { id: 4, name: "Marie Stopes Tanzania",       address: "Kinondoni Rd, Dar es Salaam", type: "private", lat: -6.8024, lng: 39.2183, distance_km: 3.8 },
  { id: 5, name: "Muhimbili National Hospital", address: "Kalenga St, Dar es Salaam",   type: "public",  lat: -6.8124, lng: 39.2683, distance_km: 4.5 },
  { id: 6, name: "Aga Khan Hospital",           address: "Ocean Rd, Dar es Salaam",     type: "private", lat: -6.8224, lng: 39.2783, distance_km: 5.2 },
];

// ── Custom Leaflet marker icons (memoized for performance) ──────────────────
const makeIcon = (color: string) =>
    L.divIcon({
      className: "",
      html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:${color};border:3px solid white;
      transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3)
    "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -36],
    });

// Create icons once and reuse them (performance optimization)
const selectedIcon = makeIcon("#D4537E");
const publicIcon   = makeIcon("#1D9E75");
const privateIcon  = makeIcon("#B45309");

// ── Helper: pan map to selected hospital ──────────────────────────────────
function MapPanner({ hospital }: { hospital: Hospital | null }) {
  const map = useMap();
  useEffect(() => {
    if (hospital) map.flyTo([hospital.lat, hospital.lng], 14, { duration: 0.8 });
  }, [hospital, map]);
  return null;
}

// ── Optimized Marker component with memoization ────────────────────────────
interface OptimizedMarkerProps {
  hospital: Hospital;
  isSelected: boolean;
  onSelect: (h: Hospital) => void;
}

const OptimizedMarker = memo(({ hospital: h, isSelected, onSelect }: OptimizedMarkerProps) => {
  const icon = isSelected
    ? selectedIcon
    : h.type === "public"
      ? publicIcon
      : privateIcon;

  return (
    <Marker
      position={[h.lat, h.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(h) }}
    >
      <Popup>
        <strong>{h.name}</strong>
        <br />
        {h.address}
        <br />
        <span style={{ color: h.type === "public" ? "#1D9E75" : "#B45309" }}>
          {h.type}
        </span>
        {" "} · {h.distance_km} km
      </Popup>
    </Marker>
  );
});

OptimizedMarker.displayName = 'OptimizedMarker';

// ── Main Component ────────────────────────────────────────────────────────
export default function SelectHospital() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "public" | "private">("all");
  const [selected, setSelected]   = useState<Hospital | null>(null);
  const hospitals: Hospital[] = MOCK_HOSPITALS;
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const handleSelectHospital = useCallback((h: Hospital) => {
    setSelected(h);
  }, []);

  const visible = useMemo(() => {
    return [...hospitals]
        .sort((a, b) => a.distance_km - b.distance_km)
        .filter((h) => filter === "all" || h.type === filter)
        .filter(
            (h) =>
                h.name.toLowerCase().includes(search.toLowerCase()) ||
                h.address.toLowerCase().includes(search.toLowerCase())
        );
  }, [hospitals, filter, search]);

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      await api.patch("/patients/profile/", { hospital: selected.id });
      await refreshUser();
      navigate("/home");
    } catch (err) {
      console.error("Hospital save failed:", err);
      setError(t("hospital_save_failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post('/patients/skip-onboarding/');
      await refreshUser();
      navigate('/home');
    } catch (err) {
      console.error('Skip onboarding failed:', err);
      setError(t('skip_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="sh-page">
        <div className="sh-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label={t('back')}>
            <ArrowLeft size={18} />
          </button>
          <div className="sh-progress-track">
            <div className="sh-progress-fill" />
          </div>
          <div className="sh-header-icon" aria-hidden="true">
            <MapPin size={18} />
          </div>
        </div>

        <div className="sh-title-block">
          <h1 className="sh-title">{t('select_hospital_title')}</h1>
          <p className="sh-subtitle">{t('select_hospital_sub')}</p>
        </div>

        <div className="sh-map-wrap">
          <MapContainer
              center={[-6.7924, 39.2083]}
              zoom={12}
              style={{ width: "100%", height: "100%" }}
              zoomControl={false}
          >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
            />
            <MapPanner hospital={selected} />
            {visible.map((h) => (
              <OptimizedMarker
                key={h.id}
                hospital={h}
                isSelected={selected?.id === h.id}
                onSelect={handleSelectHospital}
              />
            ))}
          </MapContainer>
        </div>

        <div className="sh-body">
          <div className="sh-search">
            <Search size={16} className="sh-search-icon" />
            <input
                className="sh-search-input"
                placeholder={t('search_facility_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sh-filter-row">
            {(["all", "public", "private"] as const).map((f) => (
                <button
                    key={f}
                    className={`sh-chip${filter === f ? " sh-chip-active" : ""}`}
                    onClick={() => setFilter(f)}
                >
                  {t(`hospital_filter_${f}`)}
                </button>
            ))}
          </div>

          <p className="sh-section-label">{t('nearest_to_you')}</p>
          <div className="sh-list">
            {visible.length === 0 ? (
                <p className="sh-empty">{t('no_facilities_found')}</p>
            ) : (
                 visible.map((h) => {
                   const isSel = selected?.id === h.id;
                   return (
                       <button
                           key={h.id}
                           type="button"
                           className={`sh-card${isSel ? " sh-card-sel" : ""}`}
                           onClick={() => handleSelectHospital(h)}
                       >
                        <div className="sh-card-icon">
                          <Building2 size={20} />
                        </div>
                        <div className="sh-card-info">
                          <p className="sh-card-name">{h.name}</p>
                          <p className="sh-card-addr">{h.address}</p>
                          <div className="sh-card-meta">
                            <span className={`sh-badge sh-badge-${h.type}`}>{h.type}</span>
                            <span className="sh-dist">
                              <MapPin size={10} /> {h.distance_km} km {t('away')}
                            </span>
                          </div>
                        </div>
                        <div className={`sh-check${isSel ? " sh-check-on" : ""}`}>
                          {isSel && <Check size={12} />}
                        </div>
                      </button>
                  );
                })
            )}
          </div>

          {error && <p className="sh-error">{error}</p>}

          {selected && (
              <div className="sh-selected-summary">
                <Building2 size={14} />
                <span>
                  {t('selected_label')}: <strong>{selected.name}</strong>
                </span>
              </div>
          )}

          <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              disabled={!selected || loading}
              onClick={handleContinue}
          >
            {loading ? t('saving_ellipsis') : selected ? t('continue') : t('select_a_facility')}
          </button>
          <button
              className="btn-ghost"
              onClick={() => setShowSkipConfirm(true)}
              disabled={loading}
          >
            {t('skip_for_now')}
          </button>
        </div>

        {showSkipConfirm && (
          <div className="sh-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="skip-title">
            <div className="sh-modal-card">
              <h3 id="skip-title" className="sh-modal-title">{t('skip_hospital_q')}</h3>
              <p className="sh-modal-text">{t('skip_hospital_body')}</p>
              <div className="sh-modal-actions">
                <button
                  className="sh-modal-secondary"
                  onClick={() => setShowSkipConfirm(false)}
                  disabled={loading}
                >
                  {t('cancel')}
                </button>
                <button
                  className="sh-modal-primary"
                  onClick={handleSkip}
                  disabled={loading}
                >
                  {loading ? t('skipping_ellipsis') : t('yes_skip')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
