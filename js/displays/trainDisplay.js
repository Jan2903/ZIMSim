// js/displays/trainDisplay.js
import { Coach } from '../models/coach.js';
import { config } from '../utils/config.js';
import { images, updateRotatingDisplay } from '../utils/utils.js';

export class TrainDisplay {
    constructor(trainData) {
        this.trainData = trainData;
        this.y = 70;
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

    displayFormation(coaches, display_id, fullScreen, richtung, platform_length, start_meter, skalieren, zugteilung, gleiswechsel, ausfall, verkehrtAb, ziel, ankunft, infoscreen) {
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
        if (gleiswechsel !== "0") {
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
        } else if (infoscreen || ausfall || (verkehrtAb !== "0")) {
            ctx.fillStyle = 'white';
            ctx.fillRect(3, 0, 960, 280);
        } else if (ankunft) {
            if (fullScreen){
                ctx.textBaseline = 'top';
                this.displayText(ctx,'von / from ' + ziel, 105, 20, '67px "Open Sans Condensed"', 'white','left');
            }
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
                return new Coach({ ...c, start: new_start, stop: new_stop, length: new_length });
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
                    return new Coach({ ...c, start: new_start, stop: new_stop, length: new_length });
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

    wrapAndDisplayText(ctx, text, x, y, maxWidth, lineHeight, font, textColor, textAlign) {

        if (text !== "") {
            const words = text.split(' ');
            let line = '';
            ctx.font=font; //needed for text length measurement

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    //ctx.fillText(line, x, y);
                    this.displayText(ctx, line, x, y, font, textColor, textAlign)
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            //ctx.fillText(line, x, y);
            this.displayText(ctx, line, x, y, font, textColor, textAlign)
        }
    }

    displayInfoTopText(ctx, backgroundColor, textColor, infoText1, infoText2, x1, x2) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 960, 100);
        ctx.fillStyle = textColor;
        ctx.font = '67px "Open Sans Condensed"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(infoText1, x1, 55);
        ctx.font = 'italic 67px "Open Sans Condensed"';
        ctx.fillText(infoText2, x2, 55);
    }

    displayText(ctx, text, x, y, font, textColor, textAlign) {
        ctx.font = font;
        ctx.textAlign = textAlign;
        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);

    }

    displayAusfallUndGleiswechsel(ctx, used_nr, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, ausfall, verkehrtAb) {
        ctx.textBaseline = 'middle';

        if (ausfall) {
            this.displayInfoTopText(ctx, 'DarkRed', 'white', 'Fährt fällt aus / ', 'Cancelled', 50, 430);
        } else if (verkehrtAb !== "0") {
            this.displayInfoTopText(ctx, 'DarkRed', 'white', 'Halt entfällt hier / ', 'Stop cancelled', 50, 490);
        } else if (gleiswechsel !== "0") {
            this.displayInfoTopText(ctx, 'orange', 'white', 'Gleisänderung / ', 'Track change', 50, 450);
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(3, 100, 960, 700); //white background

        this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'navy','left')

        this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, false, 0, 'navy', 'white');
        this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, false, 0, 'DimGrey', 'white', true);

        this.displayText(ctx, ziel, 50, 360, '120px "Open Sans Condensed"', 'navy', 'left')

        if (gleiswechsel !== "0") {
            const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
            this.wrapAndDisplayText(ctx, via_full, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        } else if (verkehrtAb !== "0") {
            const verkehrtAbMessage = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
            this.wrapAndDisplayText(ctx, verkehrtAbMessage, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        }
    }

    displayTextInRectangle(ctx, text, x, y, font, textAlign, textHeight, rectPadding, fullScreen, cornerRadius, rectColor, textColor, inverted = false) {
        ctx.font = font;
        ctx.textAlign = textAlign
        const textWidth = ctx.measureText(text).width;
        let stroke = false;
        if (text !== "") {
            if (text.includes("IC")) {
                if (fullScreen) {
                    textColor = 'navy';
                    ctx.fillStyle = 'white';
                    cornerRadius = 15;
                } else {
                    if (inverted) {
                        stroke = true;
                        cornerRadius = 10;
                        textColor = 'navy';
                        ctx.fillStyle = 'navy';
                        ctx.strokeStyle = 'navy';
                        ctx.lineWidth = 4;
                    } else {
                        textColor = 'navy';
                        ctx.fillStyle = 'white';
                        cornerRadius = 15;
                    }
                }
            } else if (text.includes("FLX")) {
                textColor = 'white';
                ctx.fillStyle = 'lime';
            } else {
                ctx.fillStyle = rectColor;
            }
            ctx.beginPath();
            if (textAlign === 'left') {
                ctx.roundRect(x - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
            } else if (textAlign === 'right') {
                ctx.roundRect(x - textWidth - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
            }
            if (stroke) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
            ctx.fillStyle = textColor;
            ctx.fillText(text, x, y);
        }
    }

    displayScrollingText(canvas, zug_nr, id, text, left, top, width, height, color, font) {
        // Ensure object exists
        if (!this.scroll_divs[zug_nr]) {
            this.scroll_divs[zug_nr] = {};
        }

        // Remove old one
        this.scroll_divs[zug_nr][id]?.remove();

        if (text === "") {
            delete this.scroll_divs[zug_nr][id];
            return null;
        }

        const scroll_div = document.createElement('div');
        scroll_div.classList.add('scroll-container');
        scroll_div.style.left = left;
        scroll_div.style.top = top;
        scroll_div.style.width = width;
        scroll_div.style.height = height;
        canvas.parentElement.appendChild(scroll_div);

        const inner = document.createElement('div');
        inner.classList.add('scroll-text');
        inner.style.color = color;
        inner.style.font = font;
        inner.style.lineHeight = height;

        const temp_ctx = document.createElement('canvas').getContext('2d');
        temp_ctx.font = font;
        const text_width = temp_ctx.measureText(text).width;
        const scroll_width = parseInt(width);

        if ((text_width > scroll_width) || ((id === "ankunft") || (id === 'arrival'))){
            let connect = ' +++ ' 
            if ((id==="ankunft") || (id==='arrival')) connect = ' ';
            let result = text + connect + text + connect;
            for (let i = 0; i < Math.ceil((scroll_width * 10) / text_width); i++) {
                result += text + connect;
            }
            inner.textContent = result;
            const total_width = temp_ctx.measureText(result).width;
            inner.style.setProperty('--scroll-duration', `${total_width / 100}s`);
        } else {
            inner.textContent = text;
            inner.style.animation = 'none';
            inner.style.paddingLeft = '10px';
        }

        scroll_div.appendChild(inner);

        // Store and return
        this.scroll_divs[zug_nr][id] = scroll_div;
        return scroll_div;
    }

    displayTrainInfo(info, nr, nr_kurz, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, ausfall, verkehrtAb, ankunft, infoscreen, display_id, fullScreen) {
        const canvas = document.getElementById(display_id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const zug_nr = fullScreen ? 1 : display_id === 'display2_zug1' ? 2 : 3;
        let x = 0
        x = this.displayPictograms(info, nr, display_id, fullScreen, ankunft);
      
        let used_nr = nr;
        if (!fullScreen) used_nr = nr_kurz;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        if (ankunft) info = "Ankunft / Arrival"
           
        ctx.fillStyle = 'white';
        if (info !== "") ctx.fillRect(x, 0, canvas.width - x, 100);

        this.displayScrollingText(
            canvas, zug_nr, "info", info,
            `${canvas.offsetLeft + x + 5}px`,
            `${canvas.offsetTop}px`,
            `${canvas.width - x - 5}px`,
            '100px',
            'navy',
            '67px "Open Sans Condensed"'
        );

        if (fullScreen) {

            this.displayText(ctx, abfahrt, 100, 220, '180px "Open Sans Condensed"', 'white','left')
            this.displayTextInRectangle(ctx, abfahrt_a, 520, 215, '120px "Open Sans Condensed"', 'left', 120, 20, fullScreen, 0, 'white', 'navy');
            this.displayTextInRectangle(ctx, used_nr, 1855, 220, '100px "Open Sans Condensed"', 'right', 100, 15, fullScreen, 0, 'DimGrey', 'white');

            if (ankunft){
                this.displayText(ctx, "Bitte nicht einsteigen", 110,450, '180px "Open Sans Condensed"', 'white','left')
                this.displayText(ctx, "Please do not board", 105,670, 'italic 180px "Open Sans Condensed"', 'white','left')

            } else{
                this.displayText(ctx, ziel, 100, 420, '180px "Open Sans Condensed"', 'white','left')
                const via_full = [via, via2].filter(v => v !== "").join(' ');
                this.wrapAndDisplayText(ctx, via_full, 112, 620, 1800, 100, '70px "Open Sans Condensed"', 'white', 'left');
            }
           
        } else {
            if (infoscreen) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 960, 800); //Create white background
                this.wrapAndDisplayText(ctx, info, 50, 120, 900, 80, '70px "Open Sans Condensed"', 'navy', 'left');
            }
            else if ((gleiswechsel !== "0") || ausfall || (verkehrtAb !== "0")) {
                this.displayAusfallUndGleiswechsel(ctx, used_nr, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, ausfall, verkehrtAb)
            }
            else {
                // Draw left border line for non-fullscreen displays
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, 800);
                ctx.stroke();

                this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'white','left')
                this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, fullScreen, 0, 'white', 'navy');
                this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, fullScreen, 0, 'DimGrey', 'white');

                if (!ankunft){
                   
                    this.displayText(ctx, ziel, 50, 360, '120px "Open Sans Condensed"', 'white', 'left')
                    const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
                    this.wrapAndDisplayText(ctx, via_full, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'white', 'left');
                } 
                if (ankunft) this.displayText(ctx,'von / from ' + ziel, 50, 650, '67px "Open Sans Condensed"', 'white','left');
            }

            let ankunftText = ""
            let arrivalText = ""
            if (ankunft){
                ankunftText = "Bitte nicht einsteigen"
                arrivalText = "Please do not board"
                } 
            this.displayScrollingText(canvas, zug_nr, 'ankunft', ankunftText, `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 280}px`,`${canvas.width - 50}px`,'120px','white', '120px "Open Sans Condensed"');
            this.displayScrollingText(canvas, zug_nr, 'arrival', arrivalText, `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 420}px`,`${canvas.width - 50}px`,'120px','white', 'italic 120px "Open Sans Condensed"');
        }
    }

    displayPictograms(info, nr, display_id, fullScreen, ankunft) {

            const canvas = document.getElementById(display_id);
            const ctx = canvas.getContext('2d');
            let x = fullScreen ? 100 : 50;
            if (!ankunft){
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
                    drawImageSafe('wagenreihung_fahrrad', 0.40, x + 50, 66);
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
                    drawImageSafe('wagen_fehlen', 1, x + 50, 50, 'navy');
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
                    drawImageSafe('wagenreihung_fahrrad', 0.40, x + 50, 66, 'navy');
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
            }

            return x
    }

    onFeatureButtonChange(value) {
        if (value === "rotierend") {
            this.rotating = true;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.startFeatureRotation();
        } else {
            this.rotating = false;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.aktuelles_merkmal = value;
            this.updateAllFormations();
        }
    }

    startFeatureRotation() {
        if (!this.rotating) return;
        this.aktuelles_merkmal = this.merkmale[this.rotations_index];
        this.rotations_index = (this.rotations_index + 1) % this.merkmale.length;
        this.updateAllFormations();
        config.feature_rotation_timer = setTimeout(() => this.startFeatureRotation(), 3000);
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
        const infoscreen = this.trainData.zugDaten[zug_nr].Infoscreen;
        const gleiswechsel = this.trainData.zugDaten[zug_nr].Gleiswechsel || "0";
        const ausfall = this.trainData.zugDaten[zug_nr].Ausfall;
        const verkehrtAb = this.trainData.zugDaten[zug_nr].VerkehrtAb || "0";
        const ziel = this.trainData.zugDaten[zug_nr].Ziel || "";
        const ankunft = this.trainData.zugDaten[zug_nr].Ankunft;
        this.displayFormation(coaches, display_id, fullScreen, direction, platform_length, train_start, skalieren, zugteilung, gleiswechsel, ausfall, verkehrtAb, ziel, ankunft, infoscreen);
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
            const ankunft = this.trainData.zugDaten[zug_nr].Ankunft;
            const infoscreen = this.trainData.zugDaten[zug_nr].Infoscreen;
            const gleiswechsel = this.trainData.zugDaten[zug_nr].Gleiswechsel || "0";
            const ausfall = this.trainData.zugDaten[zug_nr].Ausfall;
            const verkehrtAb = this.trainData.zugDaten[zug_nr].VerkehrtAb || "0";
            this.displayTrainInfo(info, nr, nr_kurz, abfahrt, abfahrt_a, ziel, via, via2, via3, gleiswechsel, ausfall, verkehrtAb, ankunft, infoscreen, info_canvas_id, fullScreen);
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