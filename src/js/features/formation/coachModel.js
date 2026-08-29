// js/models/coach.js
export class Coach {
    constructor(data = {}) {
        // === Bestehende Felder ===
        this.type = (typeof data.type === 'string') ? data.type : (Coach.mapType(data) || 'middle_car');
        this.coachClass = data.coachClass !== undefined ? data.coachClass : Coach.mapClass(data);
        this.wagonIdentificationNumber = data.wagonIdentificationNumber !== undefined ? data.wagonIdentificationNumber : null;
        this.amenities = Coach.normalizeAmenities(data.amenities || data.ausstattungsmerkmale || [], data);
        this.open = data.open !== undefined ? data.open : (data.status !== 'CLOSED');

        // === Neue Felder (DB-API-Kompatibilität) ===
        this.vehicleId = data.vehicleId || data.vehicleID || '';
        this.constructionType = data.constructionType || data.type?.constructionType || '';

        this.platformPosition = data.platformPosition || null;

        // Length: Aus platformPosition berechnen oder direkt setzen
        if (data.length !== undefined) {
            this.length = data.length;
        } else if (this.platformPosition) {
            this.length = Math.round((this.platformPosition.end - this.platformPosition.start) * 100) / 100;
        } else {
            this.length = 25;
        }
    }

    isFirstClass() { 
        return this.coachClass === 1;
    }

    isLocomotive() {
        return this.type === 'locomotive';
    }
    hasAmenity(amenity) {
        return this.amenities.includes(amenity);
    }

    /** Mappt DB-API vehicle.type.category auf internen Typ */
    static mapType(data) {
        const cat = data.type?.category || '';
        const baureihe = data.type?.constructionType || '';

        // 1. Reguläre Kategorie-Matches
        if (cat.includes('LOCOMOTIVE')) return 'locomotive';
        if (cat.includes('POWERCAR')) return 'control_car';
        if (cat.includes('CONTROLCAR')) return 'control_car';
        if (cat.includes('PASSENGERCARRIAGE')) return 'middle_car';
        if (cat.includes('DININGCAR')) return 'middle_car';
        if (cat.includes('DOUBLEDECK')) return 'middle_car';
        if (cat.includes('SLEEPER')) return 'middle_car';
        if (cat.includes('COUCHETTE')) return 'middle_car';

        // 2. Heuristik für fehlerhafte/unvollständige API-Daten (z.B. "UNDEFINED")
        if (cat === 'UNDEFINED' || cat === '') {
            // 'f' steht im deutschen Baureihenschema für Führerstand (Steuerwagen)
            // 'DABdp' ist der Twindexx-Triebwagen (BR 445/446) bzw. KISS (in der App-API teilweise UNDEFINED)
            if (baureihe.toLowerCase().includes('f') || baureihe === 'DABdp') {
                return 'control_car';
            }
        }

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
     * Normalisiert Amenities aus verschiedenen Formaten und injiziert SLEEPER/COUCHETTE
     */
    static normalizeAmenities(amenities, data = {}) {
        let result = [];
        
        if (Array.isArray(amenities)) {
            if (amenities.length > 0 && typeof amenities[0] === 'string') {
                result = [...amenities];
            } else {
                for (const a of amenities) {
                    if (a.status !== 'NOT_AVAILABLE' && a.status !== 'UNAVAILABLE') {
                        const key = a.art || a.type;
                        if (key && !result.includes(key)) result.push(key);
                    }
                }
            }
        }

        // Neue Features (SLEEPER / COUCHETTE / DININGCAR) aus Fahrzeugkategorie ableiten
        const cat = data.fahrzeugtyp?.fahrzeugkategorie || data.type?.category || '';
        if (cat.includes('SLEEPER') && !result.includes('SLEEPER')) result.push('SLEEPER');
        if (cat.includes('COUCHETTE') && !result.includes('COUCHETTE')) result.push('COUCHETTE');
        if (cat.includes('DININGCAR') && !result.includes('DINING')) result.push('DINING');

        return result;
    }
}
