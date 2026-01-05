// js/displays/trainDisplay.js
import { Coach } from '../models/coach.js';
import { config } from '../utils/config.js';
import { images, updateRotatingDisplay } from '../utils/utils.js';

export class TrainDisplay {
    constructor(trainData) {
        this.trainData = trainData;
        this.y = 70;
        this.aktuellesMerkmal = 'wagennummern';
        this.merkmale = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotationIndex = 0;
        this.rotating = false;
        this.scrollDivs = {};
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

    displayCompactClass(scaledCoaches, ctx) {
        let group = [];
        const processGroup = () => {
            if (group.length === 0) return;
            const first = group[0];
            const last = group[group.length - 1];
            const startPos = first.start;
            const endPos = last.start + last.length;
            const center = (startPos + endPos) / 2;
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
        scaledCoaches.forEach(coach => {
            if (['a', 'ma', 'm'].includes(coach.coach_type)) {
                if (group.length === 0 || coach.coach_class === group[0].coach_class) {
                    group.push(coach);
                } else {
                    processGroup();
                    group = [coach];
                }
            } else if (['e', 'me'].includes(coach.coach_type)) {
                if (group.length >= 0 && coach.coach_class === group[0].coach_class) {
                    group.push(coach);
                }
                processGroup();
                group = [];
            } else {
                processGroup();
            }
        });
        processGroup();
    }

    displayAmenities(coach, x, ctx) {
        let imgKey;
        let scale; // image scaling factor
        if (coach.hasAmenity('f')) imgKey = 'wagenreihung_fahrrad', scale = 0.28;
        else if (coach.hasAmenity('r')) imgKey = 'wagenreihung_rollstuhl', scale = 0.24;
        else if (coach.hasAmenity('m')) imgKey = 'wagenreihung_mehrzweck', scale = 0.28;
        else if (coach.hasAmenity('g')) imgKey = 'wagenreihung_gastronomie', scale = 0.32;
        const img = images[imgKey];
        if (img && img.isLoaded && !img.isBroken) {
            try {
                ctx.drawImage(img, x + (coach.length / 2) - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
            } catch (err) {
                console.warn(`Failed to draw amenity image ${imgKey}:`, err);
            }
        }
    }

    displayCompactAmenities(scaledCoaches, ctx) {
        let group = [];
        const processGroup = () => {
            if (group.length === 0) return;
            const first = group[0];
            const last = group[group.length - 1];
            const startPos = first.start;
            const endPos = last.start + last.length;
            const center = (startPos + endPos) / 2;
            const amenity = first.amenities;
            let imgKey;
            let scale; // image scaling factor
            if (amenity === 'f') imgKey = 'wagenreihung_fahrrad', scale = 0.28;
            else if (amenity === 'r') imgKey = 'wagenreihung_rollstuhl', scale = 0.24;
            else if (amenity === 'm') imgKey = 'wagenreihung_mehrzweck', scale = 0.28;
            else if (amenity === 'g') imgKey = 'wagenreihung_gastronomie', scale = 0.32;
            const img = images[imgKey];
            if (img && img.isLoaded && !img.isBroken) {
                try {
                    let adj = 0;
                    if (amenity === 'f' || amenity === 'm') {
                        if (last.coach_type === 'a') adj = 0;
                        else if (last.coach_type === 'e') adj = 0;
                    }
                    ctx.drawImage(img, center + adj - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
                } catch (err) {
                    console.warn(`Failed to draw compact amenity image ${imgKey}:`, err);
                }
            }
            group = [];
        };
        scaledCoaches.forEach(coach => {
            if (['a', 'ma', 'm'].includes(coach.coach_type)) {
                if (group.length === 0 || coach.amenities === group[0].amenities) {
                    group.push(coach);
                } else {
                    processGroup();
                    group = [coach];
                }
            } else if (['e', 'me'].includes(coach.coach_type)) {
                if (group.length >= 0 && coach.amenities === group[0].amenities) {
                    group.push(coach);
                }
                processGroup();
                group = [];
            } else {
                processGroup();
            }
        });
        processGroup();
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

    displayCompactWagonNumbers(scaledCoaches, ctx) {
        let group = [];
        scaledCoaches.forEach(coach => {
            if (coach.coach_number !== 0) {
                group.push(coach);
                if (['e', 'me', 'l'].includes(coach.coach_type)) {
                    if (group.length > 0) {
                        const first = group[0];
                        const last = group[group.length - 1];
                        const startPos = first.start;
                        const endPos = last.start + last.length;
                        const center = (startPos + endPos) / 2;
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
                    const startPos = first.start;
                    const endPos = last.start + last.length;
                    const center = (startPos + endPos) / 2;
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
            const startPos = first.start;
            const endPos = last.start + last.length;
            const center = (startPos + endPos) / 2;
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
        const threshold = fullScreen ? 50 : 50;
        ctx.fillStyle = 'white';
        ctx.font = '45px "Open Sans Condensed"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        sectors.forEach(([name, position]) => {
            const display_pos = threshold + 50 + (position * scale_factor);
            ctx.fillText(name, display_pos, 2);
        });
    }

    displayFormation(zugData, displayID, fullScreen) {
        const {
            Wagenreihung: coaches = [],
            PlatformLength: bahnsteigLaenge = 420,
            TrainStart: zugStart = 0,
            Richtung: richtung,
            Skalieren: skalieren,
            Zugteilung: zugteilung,
            Infoscreen: infoscreen,
            Gleiswechsel: gleiswechsel = "0",
            Ausfall: ausfall,
            VerkehrtAb: verkehrtAb = "0",
            Ziel: ziel = "",
            Ankunft: ankunft
        } = zugData;

        const canvas = document.getElementById(displayID);
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
            if (fullScreen) {
                ctx.textBaseline = 'top';
                this.displayText(ctx, 'von / from ' + ziel, 105, 20, '67px "Open Sans Condensed"', 'white', 'left');
            }
        } else {
            // Determine zugID based on displayID
            const zugID = fullScreen ? 1 : displayID === 'display2_zug1' ? 2 : 3;

            if (!this.trainData.zugDaten[zugID]) {
                console.warn(`zugDaten[${zugID}] is undefined for displayID: ${displayID}`);
                return;
            }

            //Scaling and positioning calculations
            const factor = fullScreen ? 2 : 1;
            const bahnsteiglaengeDisplay = 960 * factor;
            const threshold = fullScreen ? 50 : 50;
            let usableDisplayLength = fullScreen ? 1720 : 780;
            const gap = 4;
            let zuglaenge = coaches.reduce((sum, c) => sum + c.length, 0);
            if (!fullScreen) {
                zuglaenge -= coaches.reduce((sum, c) => sum + (c.isLocomotive() ? c.length : 0), 0);
            }
            let factorNew = usableDisplayLength / bahnsteigLaenge;
            let displayedCoaches = fullScreen ? coaches : coaches.filter(c => !c.isLocomotive());
            if (displayedCoaches.length === 0) return;

            let minCoachStart = Math.min(...displayedCoaches.map(c => c.start));

            if (minCoachStart !== zugStart) {
                minCoachStart = zugStart - minCoachStart;
            } else {
                minCoachStart = 0
            }

            let scaledCoaches = displayedCoaches.map(c => {
                let newStart = (c.start + minCoachStart) * factorNew + threshold + 50;
                let newStop = (c.stop + minCoachStart) * factorNew + threshold + 50;
                let newLength = c.length * factorNew;
                return new Coach({ ...c, start: newStart, stop: newStop, length: newLength });
            });
            for (let i = 0; i < scaledCoaches.length - 1; i++) {
                scaledCoaches[i].length = scaledCoaches[i + 1].start - scaledCoaches[i].start;
            }
            scaledCoaches[scaledCoaches.length - 1].length = scaledCoaches[scaledCoaches.length - 1].stop - scaledCoaches[scaledCoaches.length - 1].start;
            scaledCoaches.forEach(c => {
                if (fullScreen) {
                    c.length -= gap * 2;
                    c.start += gap;
                } else {
                    if (['a', 'ma'].includes(c.coach_type)) c.start += gap;
                    else if (['e', 'me'].includes(c.coach_type)) c.length -= gap;
                    else if (['m'].includes(c.coach_type)) c.length += gap;
                }
            });
            let zuglaengeScaled = scaledCoaches.reduce((sum, c) => sum + c.length, 0);
            if (zuglaengeScaled < usableDisplayLength / 2 && skalieren) {
                factorNew *= 2;
                scaledCoaches = displayedCoaches.map(c => {
                    let new_start = c.start * factorNew + threshold;
                    let new_stop = c.stop * factorNew + threshold;
                    let new_length = c.length * factorNew;
                    return new Coach({ ...c, start: new_start, stop: new_stop, length: new_length });
                });
                for (let i = 0; i < scaledCoaches.length - 1; i++) {
                    scaledCoaches[i].length = scaledCoaches[i + 1].start - scaledCoaches[i].start;
                }
                scaledCoaches[scaledCoaches.length - 1].length = scaledCoaches[scaledCoaches.length - 1].stop - scaledCoaches[scaledCoaches.length - 1].start;
                zuglaengeScaled = scaledCoaches.reduce((sum, c) => sum + c.length, 0);
            }
            let start_meter_pixel = Math.min(...scaledCoaches.map(c => c.start));
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
                if (this.aktuellesMerkmal === "klasse") this.displayCompactClass(scaledCoaches, ctx);
                if (this.aktuellesMerkmal === "ausstattung") this.displayCompactAmenities(scaledCoaches, ctx);
                if (this.aktuellesMerkmal === "wagennummern") this.displayCompactWagonNumbers(scaledCoaches, ctx);
            }
            let coach_startPositions = [];
            scaledCoaches.forEach(c => {
                if (c.coach_type === 'a') this.displayStartWagon(c, c.start, ctx);
                else if (c.coach_type.includes('m')) this.displayMiddleWagon(c, c.start, ctx);
                else if (c.coach_type === 'e') this.displayEndWagon(c, c.start, ctx);
                else if (c.coach_type === 'l' && fullScreen) this.displayLocomotive(c, c.start, ctx);
                this.displayFirstClass(c, c.start, ctx, fullScreen);
                if (fullScreen) {
                    if (this.aktuellesMerkmal === "klasse") this.displayClass(c, c.start, ctx);
                    if (this.aktuellesMerkmal === "ausstattung") this.displayAmenities(c, c.start, ctx);
                    if (this.aktuellesMerkmal === "wagennummern") this.displayWagonNumbers(c, c.start, ctx);
                }
                coach_startPositions.push(c.start + c.length);
            });
            let right_pos = Math.max(...coach_startPositions);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(right_pos + 10, 150); ctx.lineTo(bahnsteiglaengeDisplay - threshold, 150);
            ctx.stroke();
            if (richtung === 1) {
                this.displayDirection(richtung, right_pos + 10, ctx);
            }
            try {
                this.displaySectors(this.trainData.zugDaten[zugID].PlatformSections, ctx, fullScreen, factorNew, bahnsteigLaenge);
            } catch (err) {
                console.warn(`Failed to print sectors for zug_${zugID} on ${displayID}:`, err);
            }
        }

    }

    wrapAndDisplayText(ctx, text, x, y, maxWidth, lineHeight, font, textColor, textAlign) {
        if (text !== "") {
            const words = text.split(' ');
            let line = '';
            ctx.font = font; //needed for text length measurement

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

    displayAusfallUndGleiswechsel(ctx, zugData, displayID, used_nr) {
        // Unpack only what we need for this specific view
        const {
            Abfahrt: abfahrt,
            Abweichend: abfahrt_a,
            Ziel: ziel,
            Gleiswechsel: gleiswechsel = "0",
            Ausfall: ausfall,
            VerkehrtAb: verkehrtAb = "0"
        } = zugData;

        // Logic for Vias (similar to before)
        const via = zugData['Via-Halte 1 Small'] || "";
        const via2 = zugData['Via-Halte 2 Small'] || "";
        const via3 = zugData['Via-Halte 3 Small'] || "";
        
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

        this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'navy', 'left')

        this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, false, displayID, 0, 'navy', 'white');
        this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, false, displayID, 0, 'DimGrey', 'white', true, true);

        this.displayText(ctx, ziel, 50, 360, '120px "Open Sans Condensed"', 'navy', 'left')

        if (gleiswechsel !== "0") {
            const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
            this.wrapAndDisplayText(ctx, via_full, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        } else if (verkehrtAb !== "0") {
            const verkehrtAbMessage = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
            this.wrapAndDisplayText(ctx, verkehrtAbMessage, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        }
    }

    displayTextInRectangle(ctx, text, x, y, font, textAlign, textHeight, rectPadding, fullScreen, displayID, cornerRadius, rectColor, textColor, inverted = false, widthLimited = false) {
        ctx.font = font;
        ctx.textAlign = textAlign

        let textWidth = ctx.measureText(text).width;

        const checkHeight = 50; // full vertical scan area
        const availableWidth = this.findMaxZugNrWidth(
            ctx, x, y, checkHeight
        );
        const finalWidth = availableWidth - 40; // 20px padding

        // Limit width 
        if (widthLimited && textWidth > finalWidth) {
            textWidth = finalWidth;
        }

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
            //consider length limit
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
            const canvas = document.getElementById(displayID);
            const zugID = fullScreen ? 1 : displayID === 'display2_zug1' ? 2 : 3;
            
            if (widthLimited){
                if (fullScreen) {
                this.displayScrollingText(canvas, zugID, 'zugNr', text, `${canvas.offsetLeft + x - textWidth - rectPadding}px`, `${canvas.offsetTop + y - (textHeight / 2) - rectPadding}px`, `${canvas.width - 50}px`, `${textHeight + rectPadding}px`, textColor, font);
                } else {
                    this.displayScrollingText(canvas, zugID, 'zugNr', text, `${canvas.offsetLeft + x - textWidth - rectPadding}px`, `${canvas.offsetTop + y - (textHeight / 2) - rectPadding}px`, `${textWidth + 2 * rectPadding}px`, `${textHeight + rectPadding}px`, textColor, font);
                }
           
            } else {
                this.displayText(ctx, text, x, y, font, textColor, textAlign);
            }
        }
    }

    displayScrollingText(canvas, zugID, scrollingID, text, left, top, width, height, color, font) {
        // Ensure object exists
        if (!this.scrollDivs[zugID]) {
            this.scrollDivs[zugID] = {};
        }

        // Remove old one
        this.scrollDivs[zugID][scrollingID]?.remove();

        if (text === "") {
            delete this.scrollDivs[zugID][scrollingID];
            return null;
        }

        const scrollDiv = document.createElement('div');
        scrollDiv.classList.add('scroll-container');
        scrollDiv.style.left = left;
        scrollDiv.style.top = top;
        scrollDiv.style.width = width;
        scrollDiv.style.height = height;
        canvas.parentElement.appendChild(scrollDiv);

        const inner = document.createElement('div');
        inner.classList.add('scroll-text');
        inner.style.color = color;
        inner.style.font = font;
        inner.style.lineHeight = height;

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.font = font;
        const text_width = tempCtx.measureText(text).width;
        const scroll_width = parseInt(width);

        if ((text_width > scroll_width) || ((scrollingID === "ankunft") || (scrollingID === 'arrival'))) {
            let connect = ' +++ '
            if ((scrollingID === "ankunft") || (scrollingID === 'arrival')) connect = ' ';
            let result = text + connect + text + connect;
            for (let i = 0; i < Math.ceil((scroll_width * 10) / text_width); i++) {
                result += text + connect;
            }
            inner.textContent = result;
            const total_width = tempCtx.measureText(result).width;
            inner.style.setProperty('--scroll-duration', `${total_width / 100}s`);
        } else {
            inner.textContent = text;
            inner.style.animation = 'none';
            inner.style.paddingLeft = '10px';
        }

        scrollDiv.appendChild(inner);

        // Store
        this.scrollDivs[zugID][scrollingID] = scrollDiv;
    }

    getBackgroundColor(ctx) {
        const canvas = ctx.canvas;
        const x = canvas.width - 25;
        const y = 200;

        // Get 1x1 pixel
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2], pixel[3]];
    }

    findMaxZugNrWidth(ctx, startX, yCenter, height) {
        const bgColor = this.getBackgroundColor(ctx);  // ← dynamic!

        const halfH = height / 2;
        const top = Math.max(0, yCenter - halfH);
        const bottom = Math.min(ctx.canvas.height, yCenter + halfH);
        const checkHeight = bottom - top;

        let maxWidth = 0;

        for (let x = startX; x >= 0; x--) {
            const colData = ctx.getImageData(x, top, 1, checkHeight).data;

            let isClear = true;
            for (let i = 0; i < colData.length; i += 4) {
                if (
                    colData[i] !== bgColor[0] ||
                    colData[i + 1] !== bgColor[1] ||
                    colData[i + 2] !== bgColor[2] ||
                    colData[i + 3] !== bgColor[3]
                ) {
                    isClear = false;
                    break;
                }
            }

            if (isClear) {
                maxWidth = startX - x + 1;
            } else {
                break;
            }
        }

        return maxWidth;
    }

    displayTrainInfo(zugData, displayID, fullScreen) {
        const canvas = document.getElementById(displayID);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Unpack the data
        var {
            Informationen: info = "",
            Zugnummer: nr = "",
            Zugnummer_kurz: nr_kurz = "",
            Abfahrt: abfahrt = "",
            Abweichend: abfahrt_a = "",
            Ziel: ziel = "",
            Gleiswechsel: gleiswechsel = "0",
            Ausfall: ausfall = false,
            VerkehrtAb: verkehrtAb = "0",
            Ankunft: ankunft = false,
            Infoscreen: infoscreen = false,
            PlatformSections: sectors = [] 
        } = zugData;

        // Logic for Vias
        const via = fullScreen ? (zugData['Via-Halte 1'] || "") : (zugData['Via-Halte 1 Small'] || "");
        const via2 = fullScreen ? (zugData['Via-Halte 2'] || "") : (zugData['Via-Halte 2 Small'] || "");
        const via3 = zugData['Via-Halte 3 Small'] || "";

        const zugID = fullScreen ? 1 : displayID === 'display2_zug1' ? 2 : 3;

        let x = this.displayPictograms(info, nr, displayID, fullScreen, ankunft);

        let used_nr = nr;
        if (!fullScreen) used_nr = nr_kurz;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        if (ankunft) info = "Ankunft / Arrival"
        let info_full = info;
        if (infoscreen || (gleiswechsel !== "0") || ausfall || (verkehrtAb !== "0")) info = "";

        ctx.fillStyle = 'white';
        if (info !== "") ctx.fillRect(x, 0, canvas.width - x, 100);

        this.displayScrollingText(
            canvas, zugID, "info", info,
            `${canvas.offsetLeft + x + 5}px`,
            `${canvas.offsetTop}px`,
            `${canvas.width - x - 5}px`,
            '100px',
            'navy',
            '67px "Open Sans Condensed"'
        );

        if (fullScreen) {

            this.displayText(ctx, abfahrt, 100, 220, '180px "Open Sans Condensed"', 'white', 'left')
            this.displayTextInRectangle(ctx, abfahrt_a, 520, 215, '120px "Open Sans Condensed"', 'left', 120, 20, fullScreen, displayID, 0, 'white', 'navy');
            this.displayTextInRectangle(ctx, used_nr, 1855, 220, '100px "Open Sans Condensed"', 'right', 100, 15, fullScreen, displayID, 0, 'DimGrey', 'white', false, true);

            if (ankunft) {
                this.displayText(ctx, "Bitte nicht einsteigen", 110, 450, '180px "Open Sans Condensed"', 'white', 'left')
                this.displayText(ctx, "Please do not board", 105, 670, 'italic 180px "Open Sans Condensed"', 'white', 'left')

            } else {
                this.displayText(ctx, ziel, 100, 420, '180px "Open Sans Condensed"', 'white', 'left')
                const via_full = [via, via2].filter(v => v !== "").join(' ');
                this.wrapAndDisplayText(ctx, via_full, 112, 620, 1800, 100, '70px "Open Sans Condensed"', 'white', 'left');
            }

        } else {
            if (infoscreen) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 960, 800); //Create white background
                this.wrapAndDisplayText(ctx, info_full, 50, 120, 900, 80, '70px "Open Sans Condensed"', 'navy', 'left');
            }
            else if ((gleiswechsel !== "0") || ausfall || (verkehrtAb !== "0")) {
                this.displayAusfallUndGleiswechsel(ctx, zugData, displayID, used_nr)
            }
            else {
                // Draw left border line for non-fullscreen displays
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, 800);
                ctx.stroke();

                this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'white', 'left')
                this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, fullScreen, displayID, 0, 'white', 'navy');
                this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, fullScreen, displayID, 0, 'DimGrey', 'white', false, true);

                if (!ankunft) {
                    this.displayText(ctx, ziel, 50, 360, '120px "Open Sans Condensed"', 'white', 'left')
                    const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
                    this.wrapAndDisplayText(ctx, via_full, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'white', 'left');
                }
            }

            let ankunftText = ""
            let arrivalText = ""
            if (ankunft) {
                ankunftText = "Bitte nicht einsteigen"
                arrivalText = "Please do not board"
                this.displayText(ctx, 'von / from ' + ziel, 50, 650, '67px "Open Sans Condensed"', 'white', 'left');
            }
            this.displayScrollingText(canvas, zugID, 'ankunft', ankunftText, `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 280}px`, `${canvas.width - 50}px`, '120px', 'white', '120px "Open Sans Condensed"');
            this.displayScrollingText(canvas, zugID, 'arrival', arrivalText, `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 420}px`, `${canvas.width - 50}px`, '120px', 'white', 'italic 120px "Open Sans Condensed"');
        }
    }

    displayPictograms(info, nr, displayID, fullScreen, ankunft) {

        const canvas = document.getElementById(displayID);
        const ctx = canvas.getContext('2d');
        let x = fullScreen ? 100 : 50;
        if (!ankunft) {
            const step = 105;
            const drawImageSafe = (imgKey, scale, img_x, img_y, tintColor = null) => {
                const img = images[imgKey];
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
                        console.warn(`Failed to draw pictogram ${imgKey}:`, err);
                    }
                } else {
                    console.warn(`Pictogram ${imgKey} not loaded or broken`);
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
            this.aktuellesMerkmal = value;
            this.updateAllFormations();
        }
    }

    startFeatureRotation() {
        if (!this.rotating) return;
        this.aktuellesMerkmal = this.merkmale[this.rotationIndex];
        this.rotationIndex = (this.rotationIndex + 1) % this.merkmale.length;
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

    updateFormation(zugData, displayID, fullScreen) {
        if (!zugData) return;

        this.displayFormation(zugData, displayID, fullScreen); 
    }

    update(zugID, info_canvas_id, wagen_canvas_id, fullScreen) {
        try {
            // 1. Get the single data object
            const zugData = this.trainData.zugDaten[zugID];

            if (!zugData) {
                console.warn(`zugDaten[${zugID}] is undefined`);
                return;
            }

            // 2. Pass the whole object to the rendering functions
            this.updateFormation(zugData, wagen_canvas_id, fullScreen);
            this.displayTrainInfo(zugData, info_canvas_id, fullScreen);

        } catch (err) {
            console.error(`Error in update_train_display for zug_${zugID}:`, err);
        }
    }
    updateAll() {
        for (let zugID = 1; zugID <= 3; zugID++) {
            try {
                if (zugID === 1) {
                    this.update(1, 'display1', 'display1_wagenreihung', true);
                } else if (zugID === 2) {
                    this.update(2, 'display2_zug1', 'display2_zug1_wagenreihung', false);
                } else if (zugID === 3) {
                    if (config.rotate_3_6) {
                        updateRotatingDisplay();
                    } else {
                        this.update(config.current_display3_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
                    }
                }
            } catch (err) {
                console.error(`Failed to update display for zug_${zugID}:`, err);
            }
        }
    }
}