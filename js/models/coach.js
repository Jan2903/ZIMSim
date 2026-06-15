// js/models/coach.js
export class Coach {
    constructor(data = {}) {
        // === Bestehende Felder ===
        this.type = data.type || Coach.mapType(data) || 'middle_car';
        this.coachClass = data.coachClass !== undefined ? data.coachClass : Coach.mapClass(data);
        this.coachNumber = data.coachNumber || '';
        this.amenities = data.amenities ? Coach.normalizeAmenities(data.amenities) : [];
        this.open = data.open !== undefined ? data.open : (data.status !== 'CLOSED');

        // === Neue Felder (DB-API-Kompatibilität) ===
        this.vehicleId = data.vehicleId || data.vehicleID || '';
        this.constructionType = data.constructionType || data.type?.constructionType || '';
        this.orientation = data.orientation || 'FORWARDS';
        this.platformPosition = data.platformPosition || null;

        // Length: Aus platformPosition berechnen oder direkt setzen
        if (this.platformPosition) {
            this.length = Math.round((this.platformPosition.end - this.platformPosition.start) * 100) / 100;
        } else {
            this.length = data.length || 25;
        }
    }

    isFirstClass() { return this.coachClass === 1; }
    isLocomotive() { return this.type === 'locomotive'; }
    hasAmenity(amenity) { return this.amenities.includes(amenity); }

    /** Mappt DB-API vehicle.type.category auf internen Typ */
    static mapType(data) {
        const cat = data.type?.category || '';
        if (cat.includes('LOCOMOTIVE')) return 'locomotive';
        if (cat.includes('CONTROLCAR')) return 'control_car';
        if (cat.includes('PASSENGERCARRIAGE')) return 'middle_car';
        return null;
    }

    /** Mappt DB-API Klassen-Flags auf coachClass */
    static mapClass(data) {
        const typeInfo = data.type || {};
        if (typeInfo.hasFirstClass) return 1;
        if (typeInfo.hasEconomyClass) return 2;
        return 2;
    }

    /**
     * Normalisiert Amenities aus verschiedenen Formaten.
     * DB-API: [{ type: "BIKE_SPACE", amount: 4, status: "AVAILABLE" }]
     * Intern: ['f', 'r', 'g', 'm']
     */
    static normalizeAmenities(amenities) {
        if (!Array.isArray(amenities)) return [];
        if (amenities.length > 0 && typeof amenities[0] === 'string') return amenities;

        const result = [];
        const mapping = {
            'BIKE_SPACE': 'f',
            'WHEELCHAIR_SPACE': 'r',
            'ZONE_MULTI_PURPOSE': 'm',
        };
        for (const a of amenities) {
            if (a.type && mapping[a.type] && a.status !== 'NOT_AVAILABLE') {
                const mapped = mapping[a.type];
                if (!result.includes(mapped)) result.push(mapped);
            }
        }
        return result;
    }
}