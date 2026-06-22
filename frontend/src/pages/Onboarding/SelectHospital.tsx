import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, MapPin, Building2, Check } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";

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
const selectedIcon = makeIcon("#e05c7a");
const publicIcon   = makeIcon("#1d9e75");
const privateIcon  = makeIcon("#ba7517");

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
        <span style={{ color: h.type === "public" ? "#1d9e75" : "#ba7517" }}>
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

  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "public" | "private">("all");
  const [selected, setSelected]   = useState<Hospital | null>(null);
  // Use a read-only hospitals array for now (mocked). When fetching from API,
  // replace this with setHospitals and useEffect to update it.
  const hospitals: Hospital[] = MOCK_HOSPITALS;
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleSelectHospital = useCallback((h: Hospital) => {
    setSelected(h);
  }, []);

  // ── Fetch from Django API (uncomment when backend is ready) ──────────────
  // useEffect(() => {
  //   navigator.geolocation.getCurrentPosition(async (pos) => {
  //     const { latitude: lat, longitude: lng } = pos.coords;
  //     const res = await api.get(`/hospitals/?lat=${lat}&lng=${lng}`);
  //     setHospitals(res.data);
  //   });
  // }, []);

  // ── Filter + search ───────────────────────────────────────────────────────
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

  // ── ✅ FIX: Use api client + call refreshUser after save ─────────────────
  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      // ✅ Send hospital ID to backend — it uses 'hospital' field
      await api.patch("/patients/profile/", { hospital: selected.id });
      // ✅ Refresh user data to sync is_onboarded status
      await refreshUser();
      // ✅ Navigate only after state refresh succeeds
      navigate("/home");
    } catch (err) {
      // Keep user on this screen if save fails so they can retry
      console.error("Hospital save failed:", err);
      setError("Could not save your hospital selection. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true)
    setError("")
    try {
      // Call skip onboarding endpoint
      await api.post('/patients/skip-onboarding/')
      await refreshUser()
      navigate('/home')
    } catch (err) {
      console.error('Skip onboarding failed:', err)
      setError('Could not skip onboarding. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
      <div style={styles.page}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <button style={styles.iconBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.8)" />
          </button>
          <div style={styles.progressTrack}>
            <div style={styles.progressFill} />
          </div>
          <div style={{ ...styles.iconBtn, background: "#3d2d5e" }}>
            <MapPin size={18} color="#e05c7a" />
          </div>
        </div>

        {/* ── Title ── */}
        <div style={styles.titleBlock}>
          <h1 style={styles.title}>Select hospital</h1>
          <p style={styles.subtitle}>Find your ANC facility</p>
        </div>

         {/* ── Map ── */}
         <div style={styles.mapWrap}>
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

        {/* ── Search + filters ── */}
        <div style={styles.body}>
          <div style={styles.searchBox}>
            <Search size={16} color="rgba(255,255,255,0.4)" />
            <input
                style={styles.searchInput}
                placeholder="Search facility or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={styles.filterRow}>
            {(["all", "public", "private"] as const).map((f) => (
                <button
                    key={f}
                    style={{
                      ...styles.chip,
                      ...(filter === f ? styles.chipActive : {}),
                    }}
                    onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
            ))}
          </div>

          {/* ── Hospital list ── */}
          <p style={styles.sectionLabel}>NEAREST TO YOU</p>
          <div style={styles.list}>
            {visible.length === 0 ? (
                <p style={styles.empty}>No facilities found</p>
            ) : (
                 visible.map((h) => {
                   const isSel = selected?.id === h.id;
                   return (
                       <div
                           key={h.id}
                           style={{ ...styles.card, ...(isSel ? styles.cardSel : {}) }}
                           onClick={() => handleSelectHospital(h)}
                       >
                        <div style={styles.cardIcon}>
                          <Building2 size={20} color="#e05c7a" />
                        </div>
                        <div style={styles.cardInfo}>
                          <p style={styles.cardName}>{h.name}</p>
                          <p style={styles.cardAddr}>{h.address}</p>
                          <div style={styles.cardMeta}>
                      <span
                          style={{
                            ...styles.badge,
                            ...(h.type === "public" ? styles.badgePub : styles.badgePriv),
                          }}
                      >
                        {h.type}
                      </span>
                            <span style={styles.dist}>
                        <MapPin size={10} /> {h.distance_km} km away
                      </span>
                          </div>
                        </div>
                        <div style={{ ...styles.checkCircle, ...(isSel ? styles.checkOn : {}) }}>
                          {isSel && <Check size={12} color="white" />}
                        </div>
                      </div>
                  );
                })
            )}
          </div>

          {/* ── Error ── */}
          {error && <p style={styles.errorMsg}>{error}</p>}

          {/* ── Selected hospital summary ── */}
          {selected && (
              <div style={styles.selectedSummary}>
                <Building2 size={14} color="#e05c7a" />
                <span style={styles.selectedText}>
              Selected: <strong>{selected.name}</strong>
            </span>
              </div>
          )}

          {/* ── Continue button ── */}
          <button
              style={{
                ...styles.continueBtn,
                opacity: selected ? 1 : 0.4,
                cursor: selected ? "pointer" : "not-allowed",
              }}
              disabled={!selected || loading}
              onClick={handleContinue}
          >
            {loading ? "Saving..." : selected ? "Continue →" : "Select a facility"}
          </button>
          {/* Skip onboarding button */}
          <button
              style={{
                ...styles.continueBtn,
                marginTop: 8,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                opacity: 1,
              }}
              onClick={() => setShowSkipConfirm(true)}
              disabled={loading}
          >
            Skip for now
          </button>
        </div>

        {showSkipConfirm && (
          <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="skip-title">
            <div style={styles.modalCard}>
              <h3 id="skip-title" style={styles.modalTitle}>Skip hospital selection?</h3>
              <p style={styles.modalText}>
                You can continue without selecting a hospital now, and complete it later from your profile.
              </p>
              <div style={styles.modalActions}>
                <button
                  style={styles.modalSecondaryBtn}
                  onClick={() => setShowSkipConfirm(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  style={styles.modalPrimaryBtn}
                  onClick={handleSkip}
                  disabled={loading}
                >
                  {loading ? 'Skipping...' : 'Yes, skip'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page:            { background: "#1a1a2e", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif" },
  header:          { display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 0" },
  iconBtn:         { width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  progressTrack:   { flex: 1, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2 },
  progressFill:    { width: "100%", height: "100%", background: "#e05c7a", borderRadius: 2 },
  titleBlock:      { padding: "16px 20px 8px" },
  title:           { fontSize: 22, fontWeight: 600, color: "#fff", margin: 0 },
  subtitle:        { fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 0" },
  mapWrap:         { width: "100%", height: 220, flexShrink: 0 },
  body:            { flex: 1, padding: "16px 20px 24px", overflowY: "auto" },
  searchBox:       { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 14px", marginBottom: 12 },
  searchInput:     { background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, flex: 1 },
  filterRow:       { display: "flex", gap: 8, marginBottom: 16 },
  chip:            { padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1.5px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.6)" },
  chipActive:      { borderColor: "#e05c7a", color: "#e05c7a", background: "rgba(224,92,122,0.15)" },
  sectionLabel:    { fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: 0.5 },
  list:            { display: "flex", flexDirection: "column", gap: 10 },
  card:            { background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" },
  cardSel:         { borderColor: "#e05c7a", background: "rgba(224,92,122,0.12)" },
  cardIcon:        { width: 40, height: 40, borderRadius: 10, background: "rgba(224,92,122,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardInfo:        { flex: 1, minWidth: 0 },
  cardName:        { fontSize: 14, fontWeight: 500, color: "#fff", margin: "0 0 3px" },
  cardAddr:        { fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardMeta:        { display: "flex", alignItems: "center", gap: 8 },
  badge:           { fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 10 },
  badgePub:        { background: "rgba(29,158,117,0.25)", color: "#5dcaa5" },
  badgePriv:       { background: "rgba(186,117,23,0.25)", color: "#fac775" },
  dist:            { fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 3 },
  checkCircle:     { width: 22, height: 22, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkOn:         { background: "#e05c7a", borderColor: "#e05c7a" },
  selectedSummary: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(224,92,122,0.1)", borderRadius: 10, marginTop: 12, border: "0.5px solid rgba(224,92,122,0.3)" },
  selectedText:    { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  continueBtn:     { width: "100%", padding: 16, background: "linear-gradient(135deg, #e05c7a, #c94b6a)", color: "#fff", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 500, marginTop: 16, transition: "opacity 0.2s" },
  errorMsg:        { color: "#f09595", fontSize: 13, textAlign: "center", marginTop: 8 },
  empty:           { textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: "24px 0" },
  modalOverlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  modalCard:       { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  modalTitle:      { fontSize: 18, fontWeight: 700, margin: 0, color: "#1f1f2e" },
  modalText:       { fontSize: 14, lineHeight: 1.5, color: "#555", margin: "10px 0 18px" },
  modalActions:    { display: "flex", gap: 10, justifyContent: "flex-end" },
  modalSecondaryBtn: { padding: "10px 16px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", color: "#333", fontWeight: 600 },
  modalPrimaryBtn: { padding: "10px 16px", borderRadius: 12, border: "none", background: "#e05c7a", color: "#fff", fontWeight: 700 },
};