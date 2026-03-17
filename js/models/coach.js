// js/models/coach.js
export class Coach {
    constructor(data = {}) {
        this.type = data.type || 'middle_car'; // 'locomotive', 'control_car', 'middle_car'
        this.length = data.length || 25;       // Länge in Metern
        this.coachClass = data.coachClass !== undefined ? data.coachClass : 2; // 1, 2 oder null
        this.coachNumber = data.coachNumber || ''; 
        this.amenities = data.amenities || []; // z.B. ['bike', 'wheelchair']
        this.open = data.open !== undefined ? data.open : true; // true = für Fahrgäste offen
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
}