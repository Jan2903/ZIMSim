// js/models/coach.js
export class Coach {
    constructor(coach) {
        this.coach_type = coach.coach_type || '';
        this.double_decker = coach.double_decker || '';
        this.length = coach.length || 0;
        this.coach_class = coach.coach_class !== undefined ? coach.coach_class : null;
        this.coach_number = coach.coach_number || 0;
        this.amenities = coach.amenities || '';
        this.start = coach.start || 0;
        this.stop = coach.stop || 0;
    }
    isFirstClass() {
        return this.coach_class === 1;
    }
    isLocomotive() {
        return this.coach_type === 'l';
    }
    hasAmenity(amenity) {
        return this.amenities === amenity;
    }
}