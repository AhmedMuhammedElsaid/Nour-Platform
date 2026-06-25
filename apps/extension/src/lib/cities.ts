// Curated city list — copied from apps/web/features/prayer-times/data/cities.ts.
// Cross-app imports are forbidden (CLAUDE.md §5) so this lives here as a copy.
// Keep the two in sync when adding cities.

export type City = {
  id: string;
  en: string;
  ar: string;
  country: string;
  lat: number;
  lng: number;
};

export const CITIES: City[] = [
  { id: "cairo", en: "Cairo", ar: "القاهرة", country: "EG", lat: 30.0444, lng: 31.2357 },
  { id: "alexandria", en: "Alexandria", ar: "الإسكندرية", country: "EG", lat: 31.2001, lng: 29.9187 },
  { id: "mecca", en: "Mecca", ar: "مكة المكرمة", country: "SA", lat: 21.3891, lng: 39.8579 },
  { id: "medina", en: "Medina", ar: "المدينة المنورة", country: "SA", lat: 24.5247, lng: 39.5692 },
  { id: "riyadh", en: "Riyadh", ar: "الرياض", country: "SA", lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", en: "Jeddah", ar: "جدة", country: "SA", lat: 21.4858, lng: 39.1925 },
  { id: "dubai", en: "Dubai", ar: "دبي", country: "AE", lat: 25.2048, lng: 55.2708 },
  { id: "abu-dhabi", en: "Abu Dhabi", ar: "أبو ظبي", country: "AE", lat: 24.4539, lng: 54.3773 },
  { id: "doha", en: "Doha", ar: "الدوحة", country: "QA", lat: 25.2854, lng: 51.531 },
  { id: "kuwait-city", en: "Kuwait City", ar: "مدينة الكويت", country: "KW", lat: 29.3759, lng: 47.9774 },
  { id: "manama", en: "Manama", ar: "المنامة", country: "BH", lat: 26.2285, lng: 50.586 },
  { id: "muscat", en: "Muscat", ar: "مسقط", country: "OM", lat: 23.588, lng: 58.3829 },
  { id: "amman", en: "Amman", ar: "عمّان", country: "JO", lat: 31.9454, lng: 35.9284 },
  { id: "jerusalem", en: "Jerusalem", ar: "القدس", country: "PS", lat: 31.7683, lng: 35.2137 },
  { id: "beirut", en: "Beirut", ar: "بيروت", country: "LB", lat: 33.8938, lng: 35.5018 },
  { id: "damascus", en: "Damascus", ar: "دمشق", country: "SY", lat: 33.5138, lng: 36.2765 },
  { id: "baghdad", en: "Baghdad", ar: "بغداد", country: "IQ", lat: 33.3152, lng: 44.3661 },
  { id: "istanbul", en: "Istanbul", ar: "إسطنبول", country: "TR", lat: 41.0082, lng: 28.9784 },
  { id: "casablanca", en: "Casablanca", ar: "الدار البيضاء", country: "MA", lat: 33.5731, lng: -7.5898 },
  { id: "tunis", en: "Tunis", ar: "تونس", country: "TN", lat: 36.8065, lng: 10.1815 },
  { id: "algiers", en: "Algiers", ar: "الجزائر", country: "DZ", lat: 36.7538, lng: 3.0588 },
  { id: "khartoum", en: "Khartoum", ar: "الخرطوم", country: "SD", lat: 15.5007, lng: 32.5599 },
  { id: "london", en: "London", ar: "لندن", country: "GB", lat: 51.5074, lng: -0.1278 },
  { id: "new-york", en: "New York", ar: "نيويورك", country: "US", lat: 40.7128, lng: -74.006 },
];
