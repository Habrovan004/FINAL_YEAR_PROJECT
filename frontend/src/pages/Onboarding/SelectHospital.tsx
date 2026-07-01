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
type HospitalType = "public" | "private" | "maternity";

interface Hospital {
  id: number;
  name: string;
  address: string;
  type: HospitalType;
  lat: number;
  lng: number;
  distance_km: number | null;
}

// Backend (HospitalSerializer) exposes `latitude`/`longitude` and may compute
// `distance_km` only when lat/lng query params are supplied. This shape is
// kept narrow on purpose — extra fields from the API are ignored.
interface HospitalApi {
  id: number;
  name: string;
  address?: string | null;
  type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
}

// Dar es Salaam centre — used as the map default when geolocation is unavailable
// AND as the lat/lng we send to the API so distance_km is always populated.
const FALLBACK_CENTRE = { lat: -6.7924, lng: 39.2083 };

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
const maternityIcon = makeIcon("#7C3AED");

const iconFor = (type: HospitalType, isSelected: boolean) => {
  if (isSelected) return selectedIcon;
  if (type === "private") return privateIcon;
  if (type === "maternity") return maternityIcon;
  return publicIcon;
};

const normalizeType = (raw?: string | null): HospitalType => {
  const v = (raw || "").toLowerCase();
  if (v === "private") return "private";
  if (v === "maternity") return "maternity";
  return "public";
};

const toHospital = (h: HospitalApi): Hospital | null => {
  if (h.latitude == null || h.longitude == null) return null;
  return {
    id: h.id,
    name: h.name,
    address: h.address || "",
    type: normalizeType(h.type),
    lat: h.latitude,
    lng: h.longitude,
    distance_km: h.distance_km ?? null,
  };
};

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
  const icon = iconFor(h.type, isSelected);
  const badgeColor = h.type === "private" ? "#B45309" : h.type === "maternity" ? "#7C3AED" : "#1D9E75";

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
        <span style={{ color: badgeColor }}>{h.type}</span>
        {h.distance_km != null && <>{" "} · {h.distance_km} km</>}
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
  const [filter, setFilter]       = useState<"all" | HospitalType>("all");
  const [selected, setSelected]   = useState<Hospital | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [fetching, setFetching]   = useState(true);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [mapCentre, setMapCentre] = useState<[number, number]>([FALLBACK_CENTRE.lat, FALLBACK_CENTRE.lng]);

  // Try to get the user's location once on mount; fall back to Dar es Salaam
  // centre. Either way, we send a lat/lng to the API so distance_km comes back.
  useEffect(() => {
    let cancelled = false;

    const fetchHospitals = (lat: number, lng: number) => {
      api.get<HospitalApi[]>(`/hospitals/?lat=${lat}&lng=${lng}`)
        .then((res) => {
          if (cancelled) return;
          const mapped = (res.data || [])
            .map(toHospital)
            .filter((h): h is Hospital => h !== null);
          setHospitals(mapped);
          if (mapped.length === 0) setError(t("no_facilities_found"));
        })
        .catch(() => {
          if (!cancelled) setError(t("hospital_load_failed"));
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setMapCentre([pos.coords.latitude, pos.coords.longitude]);
          fetchHospitals(pos.coords.latitude, pos.coords.longitude);
        },
        () => fetchHospitals(FALLBACK_CENTRE.lat, FALLBACK_CENTRE.lng),
        { timeout: 4000, maximumAge: 60_000 }
      );
    } else {
      fetchHospitals(FALLBACK_CENTRE.lat, FALLBACK_CENTRE.lng);
    }

    return () => { cancelled = true; };
  }, [t]);

  const handleSelectHospital = useCallback((h: Hospital) => {
    setSelected(h);
  }, []);

  const visible = useMemo(() => {
    const term = search.toLowerCase();
    return [...hospitals]
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
        .filter((h) => filter === "all" || h.type === filter)
        .filter(
            (h) =>
                h.name.toLowerCase().includes(term) ||
                h.address.toLowerCase().includes(term)
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
              center={mapCentre}
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
            {(["all", "public", "private", "maternity"] as const).map((f) => (
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
            {fetching ? (
                <p className="sh-empty">{t('loading_facilities')}</p>
            ) : visible.length === 0 ? (
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
                            {h.distance_km != null && (
                              <span className="sh-dist">
                                <MapPin size={10} /> {h.distance_km} km {t('away')}
                              </span>
                            )}
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
