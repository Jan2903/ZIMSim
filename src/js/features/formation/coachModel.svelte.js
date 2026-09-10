// js/features/formation/coachModel.svelte.js

/**
 * Repräsentiert einen einzelnen Wagen (oder eine Lokomotive) innerhalb einer FormationGroup.
 * Verwaltet Reaktivität mit Svelte 5 $state für nahtlose UI- und Canvas-Synchronisation.
 */
export class Coach {
    id = '';
    type = $state('middle_car');
    coachClass = $state(2);
    wagonIdentificationNumber = $state(null);
    amenities = $state([]);
    open = $state(true);
    vehicleId = $state('');
    constructionType = $state('');
    platformPosition = $state(null);
    length = $state(26);

    constructor(data = {}) {
        this.id = data.id || crypto.randomUUID();

        // Falls data eine Coach-Instanz mit toJSON ist
        const d = (data && typeof data.toJSON === 'function') ? data.toJSON() : data;

        // === Bestehende Felder ===
        this.type = (typeof d.type === 'string') ? d.type : (Coach.mapType(d) || 'middle_car');
        this.coachClass = d.coachClass !== undefined ? d.coachClass : Coach.mapClass(d);
        this.wagonIdentificationNumber = d.wagonIdentificationNumber !== undefined ? d.wagonIdentificationNumber : null;
        this.amenities = Coach.normalizeAmenities(d.amenities || d.ausstattungsmerkmale || [], d);
        this.open = d.open !== undefined ? d.open : (d.status !== 'CLOSED');

        // === Neue Felder (DB-API-Kompatibilität) ===
        this.vehicleId = d.vehicleId || d.vehicleID || '';
        this.constructionType = d.constructionType || d.type?.constructionType || '';
        this.platformPosition = d.platformPosition || null;

        // Length: Aus platformPosition berechnen oder direkt setzen
        if (d.length !== undefined) {
            this.length = Number(d.length) || 26;
        } else if (this.platformPosition && typeof this.platformPosition.start === 'number' && typeof this.platformPosition.end === 'number') {
            this.length = Math.round((this.platformPosition.end - this.platformPosition.start) * 100) / 100;
        } else {
            this.length = (this.type === 'locomotive') ? 19 : 26;
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

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            coachClass: this.coachClass,
            wagonIdentificationNumber: this.wagonIdentificationNumber,
            amenities: this.amenities,
            open: this.open,
            vehicleId: this.vehicleId,
            constructionType: this.constructionType,
            platformPosition: this.platformPosition,
            length: this.length
        };
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
            if (baureihe.toLowerCase().includes('f') || baureihe === 'DABdp') {
                return 'control_car';
            }
        }

        return null;
    }

    /** Mappt DB-API Klassen-Flags auf coachClass */
    static mapClass(data) {
        const typeInfo = data.type || {};
        if (typeInfo.hasFirstClass && typeInfo.hasEconomyClass) return 1;
        if (typeInfo.hasFirstClass) return 1;
        if (typeInfo.hasEconomyClass) return 2;
        return 2;
    }

    /**
     * Normalisiert Amenities aus verschiedenen Formaten und injiziert SLEEPER/COUCHETTE/DINING
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

        // Features aus Fahrzeugkategorie ableiten
        const cat = data.fahrzeugtyp?.fahrzeugkategorie || data.type?.category || '';
        if (cat.includes('SLEEPER') && !result.includes('SLEEPER')) result.push('SLEEPER');
        if (cat.includes('COUCHETTE') && !result.includes('COUCHETTE')) result.push('COUCHETTE');
        if (cat.includes('DININGCAR') && !result.includes('DINING') && !result.includes('BOARD_RESTAURANT')) {
            result.push('BOARD_RESTAURANT');
        }

        return result;
    }
}
