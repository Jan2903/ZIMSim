// js/displays/trainDisplay.js
import { Coach } from '../models/coach.js';
import { config } from '../utils/config.js';
import { images, updateRotatingDisplay} from '../utils/utils.js';

export class TrainDisplay {
    constructor(trainData) {
        this.trainData = trainData;
        this.y = 70;
        this.speed = 4;
        this.aktuelles_merkmal = 'wagennummern';
        this.merkmale = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotations_index = 0;
        this.rotating = false;
        this.scroll_divs = {};
    }

    displayDirection(richtung, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        if (richtung === 0) { // Left
            ctx.moveTo(x - 2, this.y + 52); ctx.lineTo(x + 18, this.y + 32);
            ctx.moveTo(x, this.y + 50); ctx.lineTo(x + 30, this.y + 50);
            ctx.moveTo(x - 2, this.y + 48); ctx.lineTo(x + 18, this.y + 68);
        } else { // Right
            ctx.moveTo(x + 30 + 2, this.y + 52); ctx.lineTo(x + 12, this.y + 32);
            ctx.moveTo(x + 30, this.y + 50); ctx.lineTo(x, this.y + 50);
            ctx.moveTo(x + 30 + 2, this.y + 48); ctx.lineTo(x + 12, this.y + 68);
        }
        ctx.stroke();
    }

    displayStartWagon(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 3, this.y + 83); ctx.lineTo(x + 3, this.y + 20); // Left vertical
        ctx.moveTo(x + 2, this.y + 21); ctx.lineTo(x + 22, this.y - 1); // Left diagonal
        ctx.moveTo(x + 20, this.y); ctx.lineTo(x + coach.length, this.y); // Top line
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
        ctx.stroke();
    }

    displayMiddleWagon(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, this.y); ctx.lineTo(x + coach.length, this.y);
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80);
        if (coach.coach_type === 'ma') {
            ctx.moveTo(x, this.y - 3); ctx.lineTo(x, this.y + 83);
        } else if (coach.coach_type === 'me') {
            ctx.moveTo(x + coach.length, this.y - 3); ctx.lineTo(x + coach.length, this.y + 83);
        }
        ctx.stroke();
    }

    displayEndWagon(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, this.y); ctx.lineTo(x + coach.length - 20, this.y); //Top line
        ctx.moveTo(x + coach.length - 22, this.y - 1); ctx.lineTo(x + coach.length - 2, this.y + 22); //Right diagonal
        ctx.moveTo(x + coach.length - 3, this.y + 20); ctx.lineTo(x + coach.length - 3, this.y + 83); //Right vertical
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
        ctx.stroke();
    }

    displayLocomotive(coach, x, ctx) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 3, this.y + 83); // Left vertical start
    ctx.lineTo(x + 3, this.y + 40); // Left vertical up
    ctx.arcTo(x + 3, this.y + 10, x + 30, this.y + 10, 20); // Left arc
    ctx.lineTo(x + coach.length - 30, this.y + 10); // Top line
    ctx.arcTo(x + coach.length, this.y + 10, x + coach.length - 4, this.y + 40, 20); // Right arc
    ctx.lineTo(x + coach.length - 4, this.y + 83); // Right vertical down
    ctx.moveTo(x, this.y + 80); // Bottom line start
    ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
    ctx.stroke();
}

    displayFirstClass(coach, x, ctx, fullScreen) {
        if (coach.isFirstClass()) {
            ctx.fillStyle = 'orange';
            let len = coach.length;
            if (!fullScreen) {
                //if (coach.coach_type === 'e') len += 4;
                //else if (coach.coach_type === 'a') len -= 4;
                if (coach.coach_type === 'm') len += 4;
            }
            ctx.fillRect(x, this.y + 92, len, 20);
        }
    }

    displayClass(coach, x, ctx) {
        ctx.font = 'bold 40px "Open Sans Condensed"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (coach.isFirstClass()) {
            ctx.fillStyle = 'orange';
            ctx.fillText("1.", x + (coach.length / 2), this.y + 44);
        } else if (coach.coach_class === 2 && !coach.isLocomotive()) {
            ctx.fillStyle = 'white';
            ctx.fillText("2.", x + (coach.length / 2), this.y + 44);
        }
    }

    displayCompactClass(scaled_coaches, ctx) {
        let group = [];
        const process_group = () => {
            if (group.length === 0) return;
            const first = group[0];
            const last = group[group.length - 1];
            const start_pos = first.start;
            const end_pos = last.start + last.length;
            const center = (start_pos + end_pos) / 2;
            const current_class = first.coach_class;
            ctx.font = 'bold 40px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (current_class === 1) {
                ctx.fillStyle = 'orange';
                ctx.fillText("1.", center, this.y + 44);
            } 
            group = [];
        };
        scaled_coaches.forEach(coach => {
            if (['a', 'ma', 'm'].includes(coach.coach_type)) {
                if (group.length === 0 || coach.coach_class === group[0].coach_class) {
                    group.push(coach);
                } else {
                    process_group();
                    group = [coach];
                }
            } else if (['e', 'me'].includes(coach.coach_type)) {
                if (group.length >= 0 && coach.coach_class === group[0].coach_class) {
                    group.push(coach);
                }
                process_group();
                group = [];
            } else {
                process_group();
            }
        });
        process_group();
    }

    displayAmenities(coach, x, ctx) {
        let img_key;
        let scale; // image scaling factor
        if (coach.hasAmenity('f')) img_key = 'wagenreihung_fahrrad', scale = 0.28;
        else if (coach.hasAmenity('r')) img_key = 'wagenreihung_rollstuhl', scale = 0.24;
        else if (coach.hasAmenity('m')) img_key = 'wagenreihung_mehrzweck', scale = 0.28;
        else if (coach.hasAmenity('g')) img_key = 'wagenreihung_gastronomie', scale = 0.32;
        const img = images[img_key];
        if (img && img.isLoaded && !img.isBroken) {
            try {
                ctx.drawImage(img, x + (coach.length / 2) - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
            } catch (err) {
                console.warn(`Failed to draw amenity image ${img_key}:`, err);
            }
        }
    }

    displayCompactAmenities(scaled_coaches, ctx) {
        let group = [];
        const process_group = () => {
            if (group.length === 0) return;
            const first = group[0];
            const last = group[group.length - 1];
            const start_pos = first.start;
            const end_pos = last.start + last.length;
            const center = (start_pos + end_pos) / 2;
            const amenity = first.amenities;
            let img_key;
            let scale; // image scaling factor
            if (amenity === 'f') img_key = 'wagenreihung_fahrrad', scale = 0.28;
            else if (amenity === 'r') img_key = 'wagenreihung_rollstuhl', scale = 0.24;
            else if (amenity === 'm') img_key = 'wagenreihung_mehrzweck', scale = 0.28;
            else if (amenity === 'g') img_key = 'wagenreihung_gastronomie', scale = 0.32;
            const img = images[img_key];
            if (img && img.isLoaded && !img.isBroken) {
                try {
                    let adj = 0;
                    if (amenity === 'f' || amenity === 'm') {
                        if (last.coach_type === 'a') adj = 0;
                        else if (last.coach_type === 'e') adj = 0;
                    }
                    ctx.drawImage(img, center + adj - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
                } catch (err) {
                    console.warn(`Failed to draw compact amenity image ${img_key}:`, err);
                }
            }
            group = [];
        };
        scaled_coaches.forEach(coach => {
            if (['a', 'ma', 'm'].includes(coach.coach_type)) {
                if (group.length === 0 || coach.amenities === group[0].amenities) {
                    group.push(coach);
                } else {
                    process_group();
                    group = [coach];
                }
            } else if (['e', 'me'].includes(coach.coach_type)) {
                if (group.length >= 0 && coach.amenities === group[0].amenities) {
                    group.push(coach);
                }
                process_group();
                group = [];
            } else {
                process_group();
            }
        });
        process_group();
    }

    displayWagonNumbers(coach, x, ctx) {
        if (coach.coach_number !== 0) {
            ctx.fillStyle = 'white';
            ctx.font = '40px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(coach.coach_number.toString(), x + (coach.length / 2), this.y + 44);
        }
    }

    displayCompactWagonNumbers(scaled_coaches, ctx) {
        let group = [];
        scaled_coaches.forEach(coach => {
            if (coach.coach_number !== 0) {
                group.push(coach);
                if (['e', 'me', 'l'].includes(coach.coach_type)) {
                    if (group.length > 0) {
                        const first = group[0];
                        const last = group[group.length - 1];
                        const start_pos = first.start;
                        const end_pos = last.start + last.length;
                        const center = (start_pos + end_pos) / 2;
                        const first_number = first.coach_number;
                        const last_number = last.coach_number;
                        let number_text = first_number === last_number ? first_number.toString() : `${first_number} - ${last_number}`;
                        if (number_text !== "0") {
                            ctx.fillStyle = 'white';
                            ctx.font = '40px "Open Sans Condensed"';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(number_text, center, this.y + 44);
                        }
                    }
                    group = [];
                }
            } else {
                if (group.length > 0 && ['e', 'me', 'l'].includes(coach.coach_type)) {
                    const first = group[0];
                    const last = group[group.length - 1];
                    const start_pos = first.start;
                    const end_pos = last.start + last.length;
                    const center = (start_pos + end_pos) / 2;
                    const first_number = first.coach_number;
                    const last_number = last.coach_number;
                    let number_text = first_number === last_number ? first_number.toString() : `${first_number} - ${last_number}`;
                    if (number_text !== "0") {
                        ctx.fillStyle = 'white';
                        ctx.font = '40px "Open Sans Condensed"';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(number_text, center, this.y + 44);
                    }
                    group = [];
                }
            }
        });
        if (group.length > 0) {
            const first = group[0];
            const last = group[group.length - 1];
            const start_pos = first.start;
            const end_pos = last.start + last.length;
            const center = (start_pos + end_pos) / 2;
            const first_number = first.coach_number;
            const last_number = last.coach_number;
            let number_text = first_number === last_number ? first_number.toString() : `${first_number} - ${last_number}`;
            if (number_text !== "0") {
                ctx.fillStyle = 'white';
                ctx.font = '40px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(number_text, center, this.y + 44);
            }
        }
    }

    displaySectors(sectors, ctx, fullScreen, scale_factor, platform_length) {
        const threshold = fullScreen ? 100 : 50;
        ctx.fillStyle = 'white';
        ctx.font = '45px "Open Sans Condensed"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        sectors.forEach(([name, position]) => {
            const display_pos = threshold + 50 + (position * scale_factor);
            ctx.fillText(name, display_pos, 2);
        });
    }

    displayFormation(coaches, display_id, fullScreen, richtung, platform_length, start_meter, skalieren, zugteilung, gleiswechsel) {
        const canvas = document.getElementById(display_id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw left border line for non-fullscreen displays
        if (!fullScreen) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 280);
            ctx.stroke();
        }

        // Display track change notification
        if (gleiswechsel !== "0" && display_id === "display2_zug2_wagenreihung") {
            ctx.fillStyle = 'orange';
            ctx.fillRect(3, 0, 960, 280);
            ctx.fillStyle = 'white';
            ctx.font = '67px "Open Sans Condensed"';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('Neues Gleis', 50, 50);
            ctx.font = 'italic 67px "Open Sans Condensed"';
            ctx.fillText('New Track', 50, 125);
            ctx.font = '128px "Open Sans Condensed"';
            ctx.textAlign = 'right';
            ctx.fillText(gleiswechsel, 920, 80);
            ctx.textAlign = 'left';
        } else {
            // Determine zug_nr based on display_id
            let zug_nr;
            if (display_id === 'display1_wagenreihung') {
                zug_nr = 1;
            } else if (display_id === 'display2_zug1_wagenreihung') {
                zug_nr = 2;
            } else if (display_id === 'display2_zug2_wagenreihung') {
                zug_nr = 3;
            } else {
                console.warn(`Invalid display_id: ${display_id}`);
                return;
            }
            if (!this.trainData.zugDaten[zug_nr]) {
                console.warn(`zugDaten[${zug_nr}] is undefined for display_id: ${display_id}`);
                return;
            }

            //Scaling and positioning calculations
            const factor = fullScreen ? 2 : 1;
            const bahnsteiglaenge_display = 960 * factor;
            const threshold = fullScreen ? 50 : 50;
            let usable_display_length = fullScreen ? 1580 : 740;
            const gap = 4;
            let zuglaenge = coaches.reduce((sum, c) => sum + c.length, 0);
            if (!fullScreen) {
                zuglaenge -= coaches.reduce((sum, c) => sum + (c.isLocomotive() ? c.length : 0), 0);
            }
            let factor_new = usable_display_length / platform_length;
            let display_coaches = fullScreen ? coaches : coaches.filter(c => !c.isLocomotive());
            if (display_coaches.length === 0) return;

            let min_start = Math.min(...display_coaches.map(c => c.start));
            min_start = 0;
            let scaled_coaches = display_coaches.map(c => {
                let new_start = (c.start + min_start) * factor_new + threshold + 50;
                let new_stop = (c.stop + min_start) * factor_new + threshold + 50;
                let new_length = c.length * factor_new;
                return new Coach({...c, start: new_start, stop: new_stop, length: new_length});
            });
            for (let i = 0; i < scaled_coaches.length - 1; i++) {
                scaled_coaches[i].length = scaled_coaches[i + 1].start - scaled_coaches[i].start;
            }
            scaled_coaches[scaled_coaches.length - 1].length = scaled_coaches[scaled_coaches.length - 1].stop - scaled_coaches[scaled_coaches.length - 1].start;
            scaled_coaches.forEach(c => {
                if (fullScreen) {
                    c.length -= gap * 2;
                    c.start += gap;
                } else {
                    if (['a', 'ma'].includes(c.coach_type)) c.start += gap;
                    else if (['e', 'me'].includes(c.coach_type)) c.length -= gap;
                    else if (['m'].includes(c.coach_type)) c.length += gap;
                }
            });
            let zuglaenge_scaled = scaled_coaches.reduce((sum, c) => sum + c.length, 0);
            if (zuglaenge_scaled < usable_display_length / 2 && skalieren) {
                factor_new *= 2;
                scaled_coaches = display_coaches.map(c => {
                    let new_start = c.start * factor_new + threshold;
                    let new_stop = c.stop * factor_new + threshold;
                    let new_length = c.length * factor_new;
                    return new Coach({...c, start: new_start, stop: new_stop, length: new_length});
                });
                for (let i = 0; i < scaled_coaches.length - 1; i++) {
                    scaled_coaches[i].length = scaled_coaches[i + 1].start - scaled_coaches[i].start;
                }
                scaled_coaches[scaled_coaches.length - 1].length = scaled_coaches[scaled_coaches.length - 1].stop - scaled_coaches[scaled_coaches.length - 1].start;
                zuglaenge_scaled = scaled_coaches.reduce((sum, c) => sum + c.length, 0);
            }
            let start_meter_pixel = Math.min(...scaled_coaches.map(c => c.start));
            if (richtung === 0) {
                let arrow_pos = start_meter_pixel - 40;
                this.displayDirection(richtung, arrow_pos, ctx);
            }
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(threshold, 150); ctx.lineTo(start_meter_pixel - 10, 150);
            ctx.stroke();
            if (!fullScreen) {
                if (this.aktuelles_merkmal === "klasse") this.displayCompactClass(scaled_coaches, ctx);
                if (this.aktuelles_merkmal === "ausstattung") this.displayCompactAmenities(scaled_coaches, ctx);
                if (this.aktuelles_merkmal === "wagennummern") this.displayCompactWagonNumbers(scaled_coaches, ctx);
            }
            let coach_start_positions = [];
            scaled_coaches.forEach(c => {
                if (c.coach_type === 'a') this.displayStartWagon(c, c.start, ctx);
                else if (c.coach_type.includes('m')) this.displayMiddleWagon(c, c.start, ctx);
                else if (c.coach_type === 'e') this.displayEndWagon(c, c.start, ctx);
                else if (c.coach_type === 'l' && fullScreen) this.displayLocomotive(c, c.start, ctx);
                this.displayFirstClass(c, c.start, ctx, fullScreen);
                if (fullScreen) {
                    if (this.aktuelles_merkmal === "klasse") this.displayClass(c, c.start, ctx);
                    if (this.aktuelles_merkmal === "ausstattung") this.displayAmenities(c, c.start, ctx);
                    if (this.aktuelles_merkmal === "wagennummern") this.displayWagonNumbers(c, c.start, ctx);
                }
                coach_start_positions.push(c.start + c.length);
            });
            let right_pos = Math.max(...coach_start_positions);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(right_pos + 10, 150); ctx.lineTo(bahnsteiglaenge_display - threshold, 150);
            ctx.stroke();
            if (richtung === 1) {
                this.displayDirection(richtung, right_pos + 10, ctx);
            }
            try {
                this.displaySectors(this.trainData.zugDaten[zug_nr].PlatformSections, ctx, fullScreen, factor_new, platform_length);
            } catch (err) {
                console.warn(`Failed to print sectors for zug_${zug_nr} on ${display_id}:`, err);
            }
        }
       
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
        } else {
        line = testLine;
        }
    }
    ctx.fillText(line, x, y);
    }

    displayTrainInfo(info, nr, nr_kurz, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, infoscreen, display_id, fullScreen) {
        const canvas = document.getElementById(display_id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const zug_nr = fullScreen ? 1 : display_id === 'display2_zug1' ? 2 : 3;
        if (gleiswechsel !== "0" || !infoscreen ){
            this.displayPictograms(info, nr, display_id, fullScreen, zug_nr, gleiswechsel, infoscreen);
        }
        let used_nr = nr;
        if (!fullScreen) used_nr = nr_kurz;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (fullScreen) {
            if (used_nr !== "") {
                ctx.font = '100px "Open Sans Condensed"';
                ctx.textAlign = 'right';
                const text_width = ctx.measureText(used_nr).width;
                const text_height = 100;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.roundRect(1855 - text_width - 15, 220 - text_height / 2 - 15, text_width + 30, text_height + 15, 10);
                ctx.fill();
                ctx.fillStyle = 'navy';
                ctx.fillText(used_nr, 1855, 220);
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = 'white';
            ctx.font = '180px "Open Sans Condensed"';
            ctx.fillText(abfahrt, 100, 220);
            if (abfahrt_a !== "") {
                ctx.fillStyle = 'navy';
                ctx.font = '120px "Open Sans Condensed"';
                const text_width = ctx.measureText(abfahrt_a).width;
                const text_height = 120;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.roundRect(520 - 20 , 215 - text_height / 2 - 20, text_width + 40, text_height + 20, 10);
                ctx.fill();
                ctx.fillStyle = 'navy';
                ctx.fillText(abfahrt_a, 520, 215);
            }
            ctx.fillStyle = 'white';
            ctx.font = '180px "Open Sans Condensed"';
            ctx.fillText(ziel, 100, 420);
            ctx.font = '70px "Open Sans Condensed"';
            const via_full = [via, via2].filter(v => v !== "").join(' ');
            this.wrapText(ctx, via_full, 112, 620, 1800, 100);
        } else {
            if (infoscreen) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 960, 800);
                ctx.font = '70px "Open Sans Condensed"';
                this.wrapText(ctx, info, 112, 120, 1800, 100);
            }
            // Draw left border line for non-fullscreen displays
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 800);
            ctx.stroke();
            
            if (used_nr !== "") {
                ctx.fillStyle = 'navy';
                ctx.font = '75px "Open Sans Condensed"';
                ctx.textAlign = 'right';
                const text_width = ctx.measureText(used_nr).width;
                const text_height = 75;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.roundRect(890 - text_width - 10, 200 - text_height / 2 - 10, text_width + 20, text_height + 10, 6);
                ctx.fill();
                ctx.fillStyle = 'navy';
                ctx.fillText(used_nr, 890, 200);
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = 'white';
            ctx.font = '120px "Open Sans Condensed"';
            ctx.fillText(abfahrt, 50, 200);
            if (abfahrt_a !== "") {
                ctx.fillStyle = 'navy';
                ctx.font = '90px "Open Sans Condensed"';
                const text_width = ctx.measureText(abfahrt_a).width;
                const text_height = 90;
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.roundRect(330 - 10, 195 - text_height / 2 - 10, text_width + 20, text_height + 10, 6);
                ctx.fill();
                ctx.fillStyle = 'navy';
                ctx.fillText(abfahrt_a, 330, 195);
            }
            ctx.fillStyle = 'white';
            ctx.font = '120px "Open Sans Condensed"';
            ctx.fillText(ziel, 50, 360);
            ctx.font = '70px "Open Sans Condensed"';
            const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
            this.wrapText(ctx, via_full, 50, 520, 880, 100);
            if (gleiswechsel !== "0" && display_id === "display2_zug2") { //Gleichswechsel / Ausfall / Verkehrt heute ab
                ctx.fillStyle = 'orange';
                ctx.fillRect(3, 0, 960, 100);
                ctx.fillStyle = 'white';
                ctx.font = '67px "Open Sans Condensed"';
                ctx.fillText('Gleisänderung / ', 50, 55);
                ctx.font = 'italic 67px "Open Sans Condensed"';
                ctx.fillText('Track change', 448, 55);
                ctx.fillStyle = 'white';
                ctx.fillRect(3, 100, 960, 700);
                if (used_nr !== "") {
                    ctx.fillStyle = 'navy';
                    ctx.font = '75px "Open Sans Condensed"';
                    ctx.textAlign = 'right';
                    const text_width = ctx.measureText(used_nr).width;
                    const text_height = 75;
                    ctx.strokeStyle = 'navy';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.roundRect(890 - text_width - 10, 200 - text_height / 2 - 10, text_width + 20, text_height + 10, 6);
                    ctx.stroke();
                    ctx.fillStyle = 'navy';
                    ctx.fillText(used_nr, 890, 200);
                }
                ctx.textAlign = 'left';
                ctx.fillStyle = 'navy';
                ctx.font = '120px "Open Sans Condensed"';
                ctx.fillText(abfahrt, 50, 200);
                if (abfahrt_a !== "") {
                    ctx.fillStyle = 'white';
                    ctx.font = '90px "Open Sans Condensed"';
                    const text_width = ctx.measureText(abfahrt_a).width;
                    const text_height = 90;
                    ctx.fillStyle = 'navy';
                    ctx.beginPath();
                    ctx.roundRect(330 - 10, 195 - text_height / 2 - 10, text_width + 20, text_height + 10, 6);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.fillText(abfahrt_a, 330, 195);
                }
                ctx.fillStyle = 'navy';
                ctx.font = '120px "Open Sans Condensed"';
                ctx.fillText(ziel, 50, 360);
                ctx.font = '70px "Open Sans Condensed"';
                const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
                this.wrapText(ctx, via_full, 50, 520, 880, 100);
            }
        }
    }

    displayPictograms(info, nr, display_id, fullScreen, zug_nr, gleiswechsel) {
        const canvas = document.getElementById(display_id);
        const ctx = canvas.getContext('2d');
        let x = fullScreen ? 50 : 50;
        const step = 105;
        const drawImageSafe = (img_key, scale, img_x, img_y, tintColor = null) => {
            const img = images[img_key];
            if (img && img.isLoaded && !img.isBroken) {
                try {
                    let drawImg = img; // Default to original image
                    let drawWidth = img.width * scale;
                    let drawHeight = img.height * scale;
                    if (tintColor) {
                        // Create offscreen canvas for tinting if needed
                        const offCanvas = document.createElement('canvas');
                        offCanvas.width = img.width;
                        offCanvas.height = img.height;
                        const offCtx = offCanvas.getContext('2d');
                        offCtx.drawImage(img, 0, 0);
                        offCtx.globalCompositeOperation = 'source-in';
                        offCtx.fillStyle = tintColor;
                        offCtx.fillRect(0, 0, img.width, img.height);
                        offCtx.globalCompositeOperation = 'source-over'; // Reset
                        drawImg = offCanvas; // Use tinted version
                    }
                    // Draw (centered at img_x, img_y)
                    ctx.drawImage(drawImg, img_x - (drawWidth / 2), img_y - (drawHeight / 2), drawWidth, drawHeight);
                } catch (err) {
                    console.warn(`Failed to draw pictogram ${img_key}:`, err);
                }
            } else {
                console.warn(`Pictogram ${img_key} not loaded or broken`);
            }
        };
        
        if (info.includes("Zug fällt heute aus") || info.includes("Keine Weiterfahrt nach")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw blue cross
            ctx.strokeStyle = 'navy';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 28, 28); ctx.lineTo(x + 72, 72);
            ctx.moveTo(x + 72, 28); ctx.lineTo(x + 28, 72);
            ctx.stroke();
            //Move to the right for next icon or scrolling text start
            x += step;
        }
    
        if (nr.includes("FLX")) { //Reservierungspflicht Flixtrain
            //Draw white outline box
            ctx.lineWidth = "4";
            ctx.strokeStyle = 'white';
            ctx.strokeRect(x + 2, 2, 96, 96); 
            //Draw R text
            ctx.fillStyle = 'white';
            ctx.font = '48px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", x + 75, 28);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (nr.includes("IC")) { //Reservierungspflicht Fahrrad
            //Draw white outline box
            ctx.lineWidth = "4";
            ctx.strokeStyle = 'white';
            ctx.strokeRect(x + 2, 2, 96, 96);
            //Draw bicycle icon
            drawImageSafe('wagenreihung_fahrrad',0.40 , x + 50, 66);
             //Draw R text
            ctx.fillStyle = 'white';
            ctx.font = '48px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("R", x + 75, 28);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Heute mit Halt in")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw H text
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 68px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", x + 30, 60);
            //Draw plus sign 
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 64px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("+", x + 65, 48);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Heute ohne Halt in")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw H text
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 68px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("H", x + 30, 60);
            //Draw minus sign 
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 64px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("-", x + 60, 36);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Mehrere Wagen fehlen") || info.includes("Ein Wagen fehlt")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw missing wagons icon
            drawImageSafe('wagen_fehlen',1 ,x + 50 ,50 , 'navy');
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Kein gastronomisches Angebot")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw gastronomy icon
            drawImageSafe('wagenreihung_gastronomie', 0.5, x + 30, 50, 'navy');
            // Draw red slash over the icon
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 10, 90);
            ctx.lineTo(x + 90, 10);
            ctx.stroke();
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Universal-WC fehlt") || info.includes("Kein behindertengerechtes WC")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw wheelchair icon
            drawImageSafe('wagenreihung_rollstuhl', 0.32, x + 32, 28, 'navy');
            //Draw WC text
            ctx.fillStyle = 'navy';
            ctx.font = '48px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("WC", x + 66, 75);
            // Draw red slash over the icon
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x + 10, 90);
            ctx.lineTo(x + 90, 10);
            ctx.stroke();
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Defekte fahrzeuggebundene Einstiegshilfe")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw wheelchair icon
            drawImageSafe('wagenreihung_rollstuhl', 0.5, x + 50, 50, 'navy');
            //Draw exclamation mark on the top right corner
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 56px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Eingeschränkte Fahrradbeförderung")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw bicycle icon
            drawImageSafe('wagenreihung_fahrrad',0.40 , x + 50, 66, 'navy');
            //Draw exclamation mark on the top right corner
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 56px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        if (info.includes("Eingeschränktes gastronomisches Angebot")) {
            //Draw white filled box
            ctx.fillStyle = 'white';
            ctx.fillRect(x, 0, 100, 100);
            //Draw gastronomy icon
            drawImageSafe('wagenreihung_gastronomie', 0.5, x + 30, 50, 'navy');
            //Draw exclamation mark on the top right corner
            ctx.fillStyle = 'navy';
            ctx.font = 'bold 56px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("!", x + 80, 36);
            //Move to the right for next icon or scrolling text start
            x += step;
        }

        // Remove existing scroll div if any
        if (this.scroll_divs[zug_nr]) {
            this.scroll_divs[zug_nr].remove();
            delete this.scroll_divs[zug_nr];
        }
 
        if (info !== "" && gleiswechsel === "0") {
            //Create scrolling text container
            const scroll_div = document.createElement('div');
            scroll_div.classList.add('scroll-container');
            scroll_div.style.left = `${canvas.offsetLeft + x + 5}px`;
            scroll_div.style.top = `${canvas.offsetTop}px`;
            scroll_div.style.width = `${canvas.width - x - 5}px`;
            scroll_div.style.height = '100px';
            canvas.parentElement.appendChild(scroll_div);
            this.scroll_divs[zug_nr] = scroll_div;
            //Create inner scrolling text
            const inner = document.createElement('div');
            inner.classList.add('scroll-text');
            inner.style.color = 'navy';
            inner.style.font = '67px "Open Sans Condensed"';
            inner.style.lineHeight = '100px';

            const temp_canvas = document.createElement('canvas');
            const temp_ctx = temp_canvas.getContext('2d');
            temp_ctx.font = inner.style.font;
            const text_width = temp_ctx.measureText(info).width;
            const scroll_width = parseInt(scroll_div.style.width);

            ctx.fillStyle = 'white';
            if (info !== "") ctx.fillRect(x, 0, canvas.width - x, 100);

            if (text_width > scroll_width) {
                let result = info + ' +++ ' + info + ' +++ ';
                // Ensure enough repetitions for smooth looping (at least 2x scroll_width)
                for (let i = 0; i < Math.ceil((scroll_width * 2) / text_width); i++) {
                result += info + ' +++ ';
                }
                inner.textContent = result;
                // Calculate duration for consistent speed
                const total_text_width = temp_ctx.measureText(result).width;
                const scroll_speed = 100;
                const duration = total_text_width / scroll_speed;
                inner.style.setProperty('--scroll-duration', `${duration}s`);
            } else {
                inner.textContent = info;
                inner.style.animation = 'none';
                inner.style.paddingLeft = '10px';
            }
            scroll_div.appendChild(inner);
            this.scroll_divs[zug_nr] = scroll_div;
        }
    }

    onFeatureButtonChange(value) {
        if (value === "rotierend") {
            this.rotating = true;
            if (config.rotation_timer) clearTimeout(config.rotation_timer);
            this.startFeatureRotation();
        } else {
            this.rotating = false;
            if (config.rotation_timer) clearTimeout(config.rotation_timer);
            this.aktuelles_merkmal = value;
            this.updateAllFormations();
        }
    }

    startFeatureRotation() {
        if (!this.rotating) return;
        this.aktuelles_merkmal = this.merkmale[this.rotations_index];
        this.rotations_index = (this.rotations_index + 1) % this.merkmale.length;
        this.updateAllFormations();
        config.rotation_timer = setTimeout(() => this.startFeatureRotation(), 3000);
    }

    updateAllFormations() {
        this.updateFormation(1, 'display1_wagenreihung', true);
        this.updateFormation(2, 'display2_zug1_wagenreihung', false);
        if (config.rotate_3_6) {
            this.updateFormation(config.current_rotating_zug, 'display2_zug2_wagenreihung', false);
        } else {
            this.updateFormation(config.current_display3_zug, 'display2_zug2_wagenreihung', false);
        }
    }

    updateFormation(zug_nr, display_id, fullScreen) {
        if (!this.trainData.zugDaten[zug_nr]) {
            console.warn(`zugDaten[${zug_nr}] is undefined for display_id: ${display_id}`);
            return;
        }
        const coaches = this.trainData.zugDaten[zug_nr].Wagenreihung || [];
        const platform_length = this.trainData.zugDaten[zug_nr].PlatformLength || 420;
        const train_start = parseFloat(this.trainData.zugDaten[zug_nr].TrainStart) || 0;
        const direction = this.trainData.zugDaten[zug_nr].Richtung;
        const skalieren = this.trainData.zugDaten[zug_nr].Skalieren;
        const zugteilung = this.trainData.zugDaten[zug_nr].Zugteilung;
        const gleiswechsel = this.trainData.zugDaten[zug_nr].Gleiswechsel || "0";
        this.displayFormation(coaches, display_id, fullScreen, direction, platform_length, train_start, skalieren, zugteilung, gleiswechsel);
    }

    update(zug_nr, info_canvas_id, wagen_canvas_id, fullScreen) {
        try {
            this.updateFormation(zug_nr, wagen_canvas_id, fullScreen);
            if (!this.trainData.zugDaten[zug_nr]) {
                console.warn(`zugDaten[${zug_nr}] is undefined for info_canvas_id: ${info_canvas_id}`);
                return;
            }
            const info = this.trainData.zugDaten[zug_nr].Informationen || "";
            let nr = this.trainData.zugDaten[zug_nr].Zugnummer || "";
            const nr_kurz = this.trainData.zugDaten[zug_nr].Zugnummer_kurz || "";
            const abfahrt = this.trainData.zugDaten[zug_nr].Abfahrt || "";
            const abfahrt_a = this.trainData.zugDaten[zug_nr].Abweichend || "";
            const ziel = this.trainData.zugDaten[zug_nr].Ziel || "";
            const via = fullScreen ? this.trainData.zugDaten[zug_nr]['Via-Halte 1'] || "" : this.trainData.zugDaten[zug_nr]['Via-Halte 1 Small'] || "";
            const via2 = fullScreen ? this.trainData.zugDaten[zug_nr]['Via-Halte 2'] || "" : this.trainData.zugDaten[zug_nr]['Via-Halte 2 Small'] || "";
            const via3 = this.trainData.zugDaten[zug_nr]['Via-Halte 3 Small'] || "";
            const infoscreen = this.trainData.zugDaten[zug_nr].Infoscreen;
            const gleiswechsel = this.trainData.zugDaten[zug_nr].Gleiswechsel || "0";
            this.displayTrainInfo(info, nr, nr_kurz, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, infoscreen, info_canvas_id, fullScreen);
        } catch (err) {
            console.error(`Error in update_train_display for zug_${zug_nr}:`, err);
        }
    }

    updateAll() {
        for (let zug_nr = 1; zug_nr <= 3; zug_nr++) {
            try {
                if (zug_nr === 1) {
                    this.update(1, 'display1', 'display1_wagenreihung', true);
                } else if (zug_nr === 2) {
                    this.update(2, 'display2_zug1', 'display2_zug1_wagenreihung', false);
                } else if (zug_nr === 3) {
                    if (config.rotate_3_6) {
                        updateRotatingDisplay();
                    } else {
                        this.update(config.current_display3_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
                    }
                }
            } catch (err) {
                console.error(`Failed to update display for zug_${zug_nr}:`, err);
            }
        }
    }
}